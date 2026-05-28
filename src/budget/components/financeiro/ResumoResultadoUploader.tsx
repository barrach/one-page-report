import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface BudgetAcompDiag {
  resolution: "drg_code" | "unipar_fallback" | "consolidated_fallback" | "skipped_no_match";
  hint_drg_code: string | null;
  target_project_id: string | null;
  target_project_name: string | null;
  months_found: number;
  month_columns: Array<{ col: number; month: string }>;
  rows_imported: number;
  rows_inserted: number;
  rejected_columns: Array<{ col: number; reason: string }>;
  fallback_unipar_enabled: boolean;
}

interface ImportResult {
  success: boolean;
  drg_lines_imported: number;
  saldos_imported: number;
  contracts: Array<{ sheet: string; matched: boolean; project_name?: string; rows: number; is_consolidated?: boolean }>;
  unmatched_sheets: string[];
  budget_acomp?: BudgetAcompDiag | null;
}

const ResumoResultadoUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fallbackUnipar, setFallbackUnipar] = useState(false);
  const qc = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const form = new FormData();
      form.append("file", file);

      const qs = fallbackUnipar ? "?fallback_unipar=1" : "";
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/import-resumo-resultado${qs}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Falha na importação");

      setResult(data);
      qc.invalidateQueries({ queryKey: ["financial-drg-lines"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues"] });
      qc.invalidateQueries({ queryKey: ["financial-contract-files"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      const matched = data.contracts.filter((c: any) => c.matched).length;
      toast({
        title: "Dashboard executivo atualizado",
        description: `${matched} abas vinculadas · ${data.drg_lines_imported} linhas DRG · ${data.saldos_imported} saldos`,
      });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Importar "Resumo do Resultado" — Dashboard Executivo Consolidado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Lê todas as 13 abas: <strong>GERAL OH Real</strong> (consolidado da empresa), <strong>Saldos</strong> (pendências)
          e cada aba de contrato (INSPEÇÃO, ELECNOR, RHODIA, ENEVA, VALE, EUROCHEM, GERDAU, UNIPAR, NTS, PSB).
          Cada aba é vinculada automaticamente ao contrato cadastrado pelo <em>código de centro de custo</em>
          no título (ex.: <code>5040107 - UNIPAR</code>) — nenhum contrato novo é criado.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 flex items-center gap-3 rounded-md border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary/60 transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {file ? file.name : "Selecionar arquivo .xlsx"}
              </div>
              {file && (
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={handleUpload} disabled={!file || loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? "Processando..." : "Importar"}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={fallbackUnipar}
            onChange={(e) => setFallbackUnipar(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span>
            Fallback Budget_Acomp → UNIPAR/Consolidado quando código DRG não for detectado
            (caso contrário, a aba é ignorada com diagnóstico)
          </span>
        </label>

        {result && (
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              {result.drg_lines_imported} linhas DRG · {result.saldos_imported} saldos
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {result.contracts.map((c) => (
                <div key={c.sheet} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background border border-border">
                  <span className="truncate flex items-center gap-1.5">
                    {c.is_consolidated && <Badge variant="default" className="h-4 px-1 text-[10px]">EMPRESA</Badge>}
                    {c.sheet}
                  </span>
                  {c.matched ? (
                    <Badge variant="secondary">
                      {c.rows} linhas → {c.project_name?.slice(0, 18)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <AlertCircle className="w-3 h-3" />sem match
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {result.unmatched_sheets.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Abas sem contrato correspondente: cadastre o <code>dept_code</code> no projeto
                (ex.: <code>5040107</code>) e reimporte.
              </p>
            )}

            {result.budget_acomp && (
              <div className="rounded border border-border bg-background p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                  Diagnóstico Budget_Acomp
                  <Badge variant="outline" className="text-[10px]">
                    {result.budget_acomp.resolution}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <div>Código DRG detectado: <strong className="text-foreground">{result.budget_acomp.hint_drg_code ?? "—"}</strong></div>
                  <div>Contrato destino: <strong className="text-foreground">{result.budget_acomp.target_project_name ?? "—"}</strong></div>
                  <div>Meses encontrados: <strong className="text-foreground">{result.budget_acomp.months_found}</strong></div>
                  <div>Linhas gravadas: <strong className="text-foreground">{result.budget_acomp.rows_inserted}</strong></div>
                </div>
                {result.budget_acomp.month_columns.length > 0 && (
                  <div className="text-muted-foreground">
                    Meses: {result.budget_acomp.month_columns.map((m) => m.month.slice(0, 7)).join(" · ")}
                  </div>
                )}
                {result.budget_acomp.rejected_columns.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Colunas rejeitadas ({result.budget_acomp.rejected_columns.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                      {result.budget_acomp.rejected_columns.slice(0, 20).map((r, i) => (
                        <li key={i}>col {r.col}: {r.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {result.budget_acomp.resolution === "skipped_no_match" && (
                  <p className="text-warning">
                    ⚠ Nenhum contrato detectado pelo código DRG no cabeçalho. Marque a opção
                    "Fallback Budget_Acomp → UNIPAR" acima e reimporte, ou inclua o código DRG
                    (ex.: <code>5040.107</code>) na primeira linha da aba Budget_Acomp.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResumoResultadoUploader;
