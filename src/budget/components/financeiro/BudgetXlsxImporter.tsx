import { useRef, useState } from "react";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@budget/components/ui/alert-dialog";
import { FileUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import {
  parseBudgetXlsx,
  normalizeName,
  type BudgetXlsxParseResult,
} from "@budget/lib/budgetXlsxParser";

interface Props {
  projectId: string;
}

type ContractMatch = {
  status: "match" | "mismatch" | "unknown";
  detail: string;
  resolvedProjectId: string | null;
  resolvedProjectName: string | null;
};

const BudgetXlsxImporter = ({ projectId }: Props) => {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<BudgetXlsxParseResult | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [contractMatch, setContractMatch] = useState<ContractMatch | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * Resolve the contract identified inside the file against the projects table
   * and check whether it matches the current contract context (`projectId`).
   */
  const resolveContract = async (
    parseResult: BudgetXlsxParseResult,
  ): Promise<ContractMatch> => {
    const hint = parseResult.contractHint;
    if (hint.source === "none" || (!hint.drgCode && !hint.nameNorm)) {
      return {
        status: "unknown",
        detail:
          "Não foi possível identificar o contrato a partir do arquivo. Confirme manualmente que está importando para o contrato correto.",
        resolvedProjectId: null,
        resolvedProjectName: null,
      };
    }

    // Carrega só os projetos do usuário (RLS já filtra) para comparar in-memory.
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, project_name, client, dept_code")
      .order("project_name");
    if (error) throw error;

    const candidates = projects ?? [];
    const drgNorm = hint.drgCode ? hint.drgCode.replace(/\./g, "") : null;

    let matched: { id: string; name: string } | null = null;

    // 1) Match por dept_code (exato)
    if (drgNorm) {
      const byCode = candidates.find(
        (p) => p.dept_code && p.dept_code.replace(/\./g, "") === drgNorm,
      );
      if (byCode)
        matched = { id: byCode.id, name: byCode.project_name || byCode.client || "—" };
    }

    // 2) Match por nome (normalizado, contains nos dois sentidos)
    if (!matched && hint.nameNorm) {
      const byName = candidates.find((p) => {
        const n = normalizeName(`${p.project_name ?? ""} ${p.client ?? ""}`);
        return n.includes(hint.nameNorm!) || hint.nameNorm!.includes(n);
      });
      if (byName)
        matched = { id: byName.id, name: byName.project_name || byName.client || "—" };
    }

    if (!matched) {
      return {
        status: "unknown",
        detail: `Contrato detectado no arquivo (${hint.drgCode ?? hint.name ?? "?"}) não foi encontrado no banco. Confirme se está importando para o contrato correto.`,
        resolvedProjectId: null,
        resolvedProjectName: null,
      };
    }

    if (matched.id === projectId) {
      return {
        status: "match",
        detail: `Contrato confirmado: ${matched.name}${hint.drgCode ? ` (${hint.drgCode})` : ""}.`,
        resolvedProjectId: matched.id,
        resolvedProjectName: matched.name,
      };
    }

    return {
      status: "mismatch",
      detail: `Este arquivo é do contrato "${matched.name}"${hint.drgCode ? ` (${hint.drgCode})` : ""}, mas você está importando para outro contrato. Cancele e abra o contrato correto antes de importar.`,
      resolvedProjectId: matched.id,
      resolvedProjectName: matched.name,
    };
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";

    setBusy(true);
    try {
      const result = await parseBudgetXlsx(file);

      // Hard fail when Budget_Acomp exists but its structure is invalid.
      if (result.budgetAcompStructure && !result.budgetAcompStructure.ok) {
        throw new Error(
          `Estrutura Budget_Acomp inválida — verifique se é o arquivo correto. ${result.budgetAcompStructure.errors.join(" ")}`,
        );
      }

      const match = await resolveContract(result);

      // Check for existing planned entries in the months covered by the file
      const monthKeys = result.monthHeaders.map((m) => m.monthKey);
      const { count, error } = await supabase
        .from("financial_planned_entries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .in("competence_month", monthKeys);
      if (error) throw error;

      setParsed(result);
      setContractMatch(match);
      setExistingCount(count ?? 0);
      setConfirmOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao ler arquivo", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const performImport = async () => {
    if (!parsed) return;
    if (contractMatch?.status === "mismatch") {
      toast({
        title: "Importação bloqueada",
        description:
          "O arquivo é de outro contrato. Abra o contrato correto antes de importar.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Resolve PG codes -> financial_categories.id (case-insensitive match on `code`)
      const codesNeeded = Array.from(new Set(parsed.rows.map((r) => r.pgCode)));
      const { data: cats, error: catsErr } = await supabase
        .from("financial_categories")
        .select("id, code, kind")
        .in("code", codesNeeded);
      if (catsErr) throw catsErr;

      const codeToCategory = new Map<string, { id: string; kind: string }>();
      (cats ?? []).forEach((c) => codeToCategory.set(c.code, { id: c.id, kind: c.kind }));

      const monthKeys = parsed.monthHeaders.map((m) => m.monthKey);

      // Wipe existing planned entries for these months on this contract
      const { error: delErr } = await supabase
        .from("financial_planned_entries")
        .delete()
        .eq("project_id", projectId)
        .in("competence_month", monthKeys);
      if (delErr) throw delErr;

      // Build rows to insert (only for codes we could resolve, and with non-zero values)
      type InsertRow = {
        user_id: string;
        project_id: string;
        category_id: string;
        competence_month: string;
        planned_value: number;
        kind: string;
      };

      const inserts: InsertRow[] = [];
      const unmatchedCodes = new Set<string>();
      let zeroCount = 0;

      for (const row of parsed.rows) {
        const cat = codeToCategory.get(row.pgCode);
        if (!cat) {
          unmatchedCodes.add(row.pgCode);
          continue;
        }
        for (const cell of row.cells) {
          if (cell.value === 0) {
            zeroCount++;
            continue;
          }
          inserts.push({
            user_id: user.id,
            project_id: projectId,
            category_id: cat.id,
            competence_month: cell.monthKey,
            planned_value: cell.value,
            kind: cat.kind === "revenue" ? "revenue" : "cost",
          });
        }
      }

      if (inserts.length > 0) {
        // Insert in batches of 500 to be safe
        const batchSize = 500;
        for (let i = 0; i < inserts.length; i += batchSize) {
          const batch = inserts.slice(i, i + batchSize);
          const { error: insErr } = await supabase
            .from("financial_planned_entries")
            .insert(batch);
          if (insErr) throw insErr;
        }
      }

      const yearsLabel = parsed.years.join(", ");
      const monthsLabel =
        parsed.monthHeaders.length > 0
          ? `${parsed.monthHeaders[0].label} a ${parsed.monthHeaders[parsed.monthHeaders.length - 1].label}`
          : "—";

      const contractLabel = contractMatch?.resolvedProjectName
        ? `${contractMatch.resolvedProjectName}${parsed.contractHint.drgCode ? ` (${parsed.contractHint.drgCode})` : ""}`
        : "contrato atual";

      toast({
        title: "Budget importado",
        description: `✓ ${contractLabel} · ${parsed.rows.length} linhas PG · ${inserts.length} valores em ${parsed.monthHeaders.length} meses (${monthsLabel}) · Anos ${yearsLabel}.${
          unmatchedCodes.size > 0
            ? ` ${unmatchedCodes.size} códigos PG sem categoria correspondente.`
            : ""
        }`,
      });

      if (unmatchedCodes.size > 0) {
        toast({
          title: "Códigos PG não mapeados — ignorados",
          description: Array.from(unmatchedCodes).slice(0, 12).join(", "),
          variant: "default",
        });
      }

      qc.invalidateQueries({ queryKey: ["planned-spreadsheet"] });
      qc.invalidateQueries({ queryKey: ["planned-available-years"] });
      qc.invalidateQueries({ queryKey: ["financial-planned-entries"] });

      setConfirmOpen(false);
      setParsed(null);
      setContractMatch(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const monthsRange =
    parsed && parsed.monthHeaders.length > 0
      ? `${parsed.monthHeaders[0].label} a ${parsed.monthHeaders[parsed.monthHeaders.length - 1].label}`
      : "";

  const isBlocked = contractMatch?.status === "mismatch";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="h-8"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileUp className="w-3.5 h-3.5 mr-1.5" />
        )}
        Importar Budget (.xlsx)
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isBlocked ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              )}
              {isBlocked
                ? "Contrato não confere"
                : "Confirmar importação do Budget"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {parsed && contractMatch && (
                  <div
                    className={`rounded border p-2 text-xs ${
                      contractMatch.status === "match"
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : contractMatch.status === "mismatch"
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-amber-500/40 bg-amber-500/5 text-foreground"
                    }`}
                  >
                    {contractMatch.detail}
                    <div className="mt-1 text-muted-foreground">
                      Origem da identificação: {parsed.contractHint.source}
                    </div>
                  </div>
                )}
                {parsed && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{parsed.rows.length} linhas PG</Badge>
                    <Badge variant="outline">{parsed.monthHeaders.length} meses</Badge>
                    <Badge variant="secondary">{monthsRange}</Badge>
                    {parsed.years.map((y) => (
                      <Badge key={y} variant="outline">
                        {y}
                      </Badge>
                    ))}
                    {parsed.budgetAcompStructure && (
                      <Badge
                        variant={
                          parsed.budgetAcompStructure.ok ? "outline" : "destructive"
                        }
                      >
                        Budget_Acomp: {parsed.budgetAcompStructure.ok ? "OK" : "inválido"}
                      </Badge>
                    )}
                  </div>
                )}
                {existingCount > 0 ? (
                  <p className="text-destructive">
                    Este contrato já tem <strong>{existingCount}</strong> valores planejados nos meses do arquivo.
                    Continuar irá <strong>substituir</strong> esses valores pelo conteúdo do arquivo.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhum valor planejado existe ainda nesses meses para este contrato.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void performImport();
              }}
              disabled={busy || isBlocked}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="w-4 h-4 mr-2" />
              )}
              {isBlocked
                ? "Importação bloqueada"
                : existingCount > 0
                  ? "Substituir Budget existente"
                  : "Importar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BudgetXlsxImporter;
