import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Building2, FileSpreadsheet, Search, Trash2 } from "lucide-react";
import {
  CONTRACT_FILE_KIND_LABELS,
  useContractFiles,
  useDeleteContractFile,
  useFinancialContracts,
  type ContractFileKind,
} from "@budget/hooks/useFinancialContracts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const KIND_COLOR: Record<ContractFileKind, string> = {
  baseline: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  real_mensal: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  drg: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  producao: "bg-green-500/10 text-green-700 dark:text-green-300",
  pessoal: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  imobilizado: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  resumo: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
};

const FinanceiroContratos = () => {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: contracts } = useFinancialContracts({ onlyActive: false });
  const { data: files } = useContractFiles(selectedId);
  const deleteFile = useDeleteContractFile();

  const filtered = (contracts ?? []).filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.project_name.toLowerCase().includes(q) ||
      (c.client ?? "").toLowerCase().includes(q) ||
      (c.dept_code ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = (contracts ?? []).filter((c) => (c.status ?? "active") !== "inactive").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Contratos financeiros
            </span>
            <Badge variant="outline">
              {activeCount} ativos / {contracts?.length ?? 0} total
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada contrato (centro de custo ou orçamento) é tratado como uma entidade financeira independente.
            Baseline, real mensal, DRG, produção e pessoal são vinculados ao contrato selecionado nos uploaders.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cliente ou código do contrato..."
              className="pl-9"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((c) => {
              const isSelected = selectedId === c.id;
              const isInactive = (c.status ?? "active") === "inactive";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? undefined : c.id)}
                  className={`text-left rounded-lg border p-3 transition-all hover:border-primary/60 hover:bg-primary/5 ${
                    isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border"
                  } ${isInactive ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {c.dept_code && (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted shrink-0">
                          {c.dept_code}
                        </span>
                      )}
                      <span className="font-medium text-sm truncate">{c.project_name}</span>
                    </div>
                    {c.is_cost_center ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">CC</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">Orç.</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.client ?? "—"}</div>
                  {c.dept_group && (
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      {c.dept_group}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-8">
                Nenhum contrato encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Arquivos importados para este contrato
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Histórico de planilhas vinculadas (baseline, real mensal, DRG, etc.).
            </p>
          </CardHeader>
          <CardContent>
            {(files ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum arquivo importado ainda. Use os uploaders das subabas <strong>Planejado</strong>,{" "}
                <strong>Real Mensal</strong>, <strong>DRG</strong> ou <strong>Resumo</strong> para vincular planilhas a este contrato.
              </div>
            ) : (
              <div className="space-y-1.5">
                {(files ?? []).map((f: {
                  id: string;
                  file_kind: string;
                  file_name: string;
                  sheet_name: string | null;
                  competence_month: string | null;
                  row_count: number;
                  created_at: string;
                }) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md border border-border hover:bg-muted/40"
                  >
                    <Badge
                      className={`text-[10px] ${KIND_COLOR[f.file_kind as ContractFileKind] ?? ""}`}
                      variant="outline"
                    >
                      {CONTRACT_FILE_KIND_LABELS[f.file_kind as ContractFileKind] ?? f.file_kind}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{f.file_name}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {f.sheet_name && <span>aba: {f.sheet_name}</span>}
                        {f.competence_month && (
                          <span>
                            • {format(new Date(f.competence_month), "MMM/yy", { locale: ptBR })}
                          </span>
                        )}
                        {f.row_count > 0 && <span>• {f.row_count.toLocaleString("pt-BR")} linhas</span>}
                        <span>
                          • {format(new Date(f.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteFile.mutate(f.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinanceiroContratos;
