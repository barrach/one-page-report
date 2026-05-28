import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import ContractSelector, { CONTRACT_NEW_VALUE } from "@budget/components/financeiro/ContractSelector";
import { useRegisterContractFile } from "@budget/hooks/useFinancialContracts";
import { formatBRL } from "@budget/lib/format";
import { parseUniparBaselineWorkbook } from "@budget/lib/uniparBaselineParser";

interface ImportResult {
  project_id: string;
  baseline_id: string;
  version: number;
  total_revenue: number;
  items_imported: number;
  months_detected: number;
  cost_lines_total?: number;
  cost_lines_matched?: number;
  cost_lines_unmatched?: number;
  cost_lines_zero?: number;
  cost_rows_inserted?: number;
  audit_report?: {
    budget_rows_total?: number;
    budget_rows_with_values?: number;
    budget_rows_zero?: number;
    fallback_codes_added?: string[];
    unmatched_samples?: Array<{ code: string | null; description: string }>;
    warnings?: string[];
  };
  cadastro: Record<string, unknown>;
}

const UniparBaselineUploader = () => {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const registerFile = useRegisterContractFile();

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Selecione um arquivo .xlsx", variant: "destructive" });
      return;
    }
    if (!projectId) {
      toast({
        title: "Selecione o contrato",
        description: "É obrigatório indicar o contrato ao qual essa baseline pertence.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const parsed = await parseUniparBaselineWorkbook(file);
      const payload = {
        ...parsed,
        project_id: projectId !== CONTRACT_NEW_VALUE ? projectId : null,
      };

      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectRef}.supabase.co/functions/v1/import-unipar-baseline`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na importação");

      setResult(json);
      const targetContractId = json.project_id ?? (projectId !== CONTRACT_NEW_VALUE ? projectId : null);
      if (targetContractId) {
        await registerFile.mutateAsync({
          project_id: targetContractId,
          file_kind: "baseline",
          file_name: file.name,
          row_count: json.items_imported ?? 0,
          total_value: json.total_revenue ?? 0,
          metadata: { version: json.version, months_detected: json.months_detected },
        }).catch(() => undefined);
      }
      toast({
        title: "Baseline importada",
        description: `v${json.version} • ${json.items_imported} itens • ${formatBRL(json.total_revenue)}`,
      });
      qc.invalidateQueries({ queryKey: ["financial-baselines"] });
      qc.invalidateQueries({ queryKey: ["financial-projects-list"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts"] });
      qc.invalidateQueries({ queryKey: ["revenue-items"] });
      qc.invalidateQueries({ queryKey: ["planned-spreadsheet"] });
      qc.invalidateQueries({ queryKey: ["financial-planned-entries"] });
      qc.invalidateQueries({ queryKey: ["planned-available-years"] });
      qc.invalidateQueries({ queryKey: ["financial-categories"] });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Importar baseline a partir de uma planilha de orçamento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lê preferencialmente a aba <strong>Budget</strong> (consolidada — receita, impostos, custos e despesas com meses Previsto + Realizado). Se ela não existir, usa <strong>I Receita</strong> + abas de custo separadas. A aba <strong>Cadastro Budget</strong> é sempre obrigatória.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ContractSelector
          value={projectId}
          onChange={setProjectId}
          allowCreateNew
          createNewLabel="Criar novo contrato a partir do cadastro da planilha"
          label="Contrato desta baseline"
        />
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
          />
          <Button onClick={handleUpload} disabled={!file || !projectId || uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Importar
          </Button>
        </div>

        {result && (
          <div className="rounded-md border bg-primary/5 border-primary/20 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="w-4 h-4" /> Importação concluída
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">Baseline v{result.version}</Badge>
              <Badge variant="outline">{result.items_imported} itens de receita</Badge>
              <Badge variant="outline">{result.months_detected} competências</Badge>
              <Badge variant="secondary">
                {formatBRL(result.total_revenue)} de receita prevista
              </Badge>
              {(result.cost_rows_inserted ?? 0) > 0 && (
                <Badge variant="secondary">
                  {result.cost_rows_inserted} lançamentos de custo/imposto/despesa
                </Badge>
              )}
              {(result.cost_lines_matched ?? 0) > 0 && (
                <Badge variant="outline">
                  {result.cost_lines_matched}/{result.cost_lines_total} linhas mapeadas
                </Badge>
              )}
              {(result.cost_lines_unmatched ?? 0) > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {result.cost_lines_unmatched} sem categoria
                </Badge>
              )}
              {(result.cost_lines_zero ?? 0) > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {result.cost_lines_zero} linhas zeradas preservadas
                </Badge>
              )}
              {(result.audit_report?.budget_rows_total ?? 0) > 0 && (
                <Badge variant="outline">
                  {result.audit_report?.budget_rows_total} linhas no Budget
                </Badge>
              )}
              {(result.audit_report?.fallback_codes_added?.length ?? 0) > 0 && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  +{result.audit_report?.fallback_codes_added?.length} códigos da I Receita (4.x/5.x/6.x)
                </Badge>
              )}
            </div>
            {(result.audit_report?.unmatched_samples?.length ?? 0) > 0 && (
              <details className="mt-2 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Ver linhas sem categoria ({result.audit_report?.unmatched_samples?.length})
                </summary>
                <ul className="mt-1 ml-4 space-y-0.5 list-disc">
                  {result.audit_report?.unmatched_samples?.map((s, i) => (
                    <li key={i}>
                      <span className="font-mono">{s.code ?? "—"}</span> · {s.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UniparBaselineUploader;
