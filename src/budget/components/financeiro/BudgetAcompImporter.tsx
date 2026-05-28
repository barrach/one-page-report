import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";
import ContractSelector from "@budget/components/financeiro/ContractSelector";
import { parseBudgetAcompWorkbook, type ParsedBudgetAcomp } from "@budget/lib/budgetAcompParser";
import { isValidPgCode } from "@budget/lib/pgCodes";
import { formatBRL } from "@budget/lib/format";

type Origem = "auto" | "ia" | "manual" | null;

interface UiRow {
  descricao: string;
  codigoPg: string | null;
  origem: Origem;
  confianca?: string;
  valoresPrevistos: number[];
}

const BudgetAcompImporter = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedBudgetAcomp | null>(null);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [contractId, setContractId] = useState<string>("");

  const invalidCount = useMemo(
    () => rows.filter((r) => !r.codigoPg || !isValidPgCode(r.codigoPg)).length,
    [rows],
  );
  const totalPrevisto = useMemo(
    () => rows.reduce((s, r) => s + r.valoresPrevistos.reduce((a, b) => a + b, 0), 0),
    [rows],
  );

  const tryAutoSelectContract = async (code: string | null) => {
    if (!code) return;
    const { data } = await supabase
      .from("projects")
      .select("id, dept_code")
      .eq("dept_code", code)
      .maybeSingle();
    if (data?.id) setContractId(data.id);
  };

  const callIaForPending = async (uiRows: UiRow[]): Promise<UiRow[]> => {
    const pendingDescs = Array.from(
      new Set(uiRows.filter((r) => !r.codigoPg).map((r) => r.descricao)),
    );
    if (pendingDescs.length === 0) return uiRows;

    setIaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("map-budget-pg", {
        body: { descricoes: pendingDescs },
      });
      if (error) throw error;
      const map = new Map<string, { codigo_pg: string | null; confianca: string }>();
      for (const m of data?.mappings ?? []) {
        map.set(m.descricao, { codigo_pg: m.codigo_pg, confianca: m.confianca });
      }
      return uiRows.map((r) => {
        if (r.codigoPg) return r;
        const m = map.get(r.descricao);
        if (m?.codigo_pg && isValidPgCode(m.codigo_pg)) {
          return { ...r, codigoPg: m.codigo_pg, origem: "ia", confianca: m.confianca };
        }
        return r;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha no mapeamento por IA: ${msg}`);
      return uiRows;
    } finally {
      setIaLoading(false);
    }
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParsed(null);
    setRows([]);
    setContractId("");
    try {
      const result = await parseBudgetAcompWorkbook(f);
      setParsed(result);
      const initial: UiRow[] = result.rows.map((r) => ({
        descricao: r.descricao,
        codigoPg: r.codigoPg,
        origem: r.codigoPg ? "auto" : null,
        valoresPrevistos: r.valoresPrevistos,
      }));
      await tryAutoSelectContract(result.contractCode);
      const mapped = await callIaForPending(initial);
      setRows(mapped);
      toast.success(`Planilha lida: ${result.rows.length} linhas, ${result.months.length} meses`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao ler planilha: ${msg}`);
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleEditCode = (idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, codigoPg: value.trim() || null, origem: "manual" } : r,
    ));
  };

  const handleRemap = async () => {
    setRows(await callIaForPending(rows));
  };

  const handleImport = async () => {
    if (!parsed) return;
    if (!contractId) { toast.error("Selecione o contrato de destino"); return; }
    if (invalidCount > 0) { toast.error(`${invalidCount} linha(s) sem código PG válido`); return; }

    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const records: Array<{
        user_id: string; contract_id: string; mes_ano: string; linha_pg: string;
        descricao_origem: string; valor_previsto: number; origem: string; confianca: string | null;
      }> = [];

      for (const r of rows) {
        if (!r.codigoPg || !isValidPgCode(r.codigoPg)) continue;
        parsed.months.forEach((mes, i) => {
          const v = r.valoresPrevistos[i] ?? 0;
          records.push({
            user_id: user.id,
            contract_id: contractId,
            mes_ano: mes,
            linha_pg: r.codigoPg!,
            descricao_origem: r.descricao,
            valor_previsto: v,
            origem: r.origem ?? "auto",
            confianca: r.confianca ?? null,
          });
        });
      }

      // Upsert em batches
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase
          .from("budget_previsto")
          .upsert(batch, { onConflict: "contract_id,mes_ano,linha_pg" });
        if (error) throw error;
        inserted += batch.length;
      }

      toast.success(`${inserted.toLocaleString()} valores previstos importados (${rows.length} linhas × ${parsed.months.length} meses)`);
      setFile(null);
      setParsed(null);
      setRows([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro na importação: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const renderOrigemBadge = (r: UiRow) => {
    const invalid = !r.codigoPg || !isValidPgCode(r.codigoPg);
    if (invalid) return <Badge variant="destructive">não mapeado</Badge>;
    if (r.origem === "auto") return <Badge variant="outline" className="border-emerald-500 text-emerald-600">auto</Badge>;
    if (r.origem === "ia") return <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1"><Sparkles className="w-3 h-3" /> IA</Badge>;
    if (r.origem === "manual") return <Badge variant="outline" className="border-amber-500 text-amber-600">manual</Badge>;
    return <Badge variant="secondary">—</Badge>;
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Importar Budget Comparativo (Real x Orçado)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lê a aba <strong>Budget_Acomp</strong> de qualquer arquivo <code className="text-xs">Comparativo_real_x_orçado_*.xlsx</code>,
          extrai automaticamente o código do Plano Gerencial pelo prefixo da descrição e usa IA para mapear o que sobrar.
          Apenas valores <strong>PREVISTO</strong> são importados (Realizado e Diferença ficam de fora).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
          />
          {(parsing || iaLoading) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {parsing ? "Lendo planilha..." : "Mapeando com IA..."}
            </div>
          )}
        </div>

        {parsed && (
          <div className="space-y-3">
            <div className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">CR detectado: {parsed.contractCode ?? "—"}</Badge>
                <Badge variant="secondary">{parsed.contractName ?? "Contrato sem nome"}</Badge>
                <Badge variant="outline">{parsed.months.length} meses</Badge>
                <Badge variant="outline">{rows.length} linhas</Badge>
                <Badge variant="outline">{formatBRL(totalPrevisto)} previsto total</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> {invalidCount} sem código
                  </Badge>
                )}
              </div>
              <div>
                <ContractSelector
                  value={contractId}
                  onChange={setContractId}
                  label="Contrato de destino"
                />
              </div>
            </div>

            <div className="rounded-md border overflow-auto max-h-[480px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-[45%]">Descrição original</TableHead>
                    <TableHead className="w-[140px]">Código PG</TableHead>
                    <TableHead className="text-right w-[140px]">1º mês previsto</TableHead>
                    <TableHead className="w-[120px]">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const invalid = !r.codigoPg || !isValidPgCode(r.codigoPg);
                    return (
                      <TableRow key={i} className={invalid ? "bg-destructive/5" : undefined}>
                        <TableCell className="text-xs">{r.descricao}</TableCell>
                        <TableCell>
                          <Input
                            value={r.codigoPg ?? ""}
                            onChange={(e) => handleEditCode(i, e.target.value)}
                            placeholder="—"
                            className={`h-8 text-xs ${invalid ? "border-destructive text-destructive" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatBRL(r.valoresPrevistos[0] ?? 0)}
                        </TableCell>
                        <TableCell>{renderOrigemBadge(r)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemap}
                disabled={iaLoading || invalidCount === 0}
              >
                {iaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Re-mapear com IA ({invalidCount})
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || invalidCount > 0 || !contractId}
              >
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirmar e Importar
              </Button>
              {invalidCount > 0 && (
                <span className="text-xs text-destructive">
                  Resolva todas as linhas sem código PG válido antes de importar.
                </span>
              )}
            </div>
          </div>
        )}

        {!parsed && !parsing && (
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo .xlsx
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetAcompImporter;
