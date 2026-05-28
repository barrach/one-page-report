import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@budget/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@budget/components/ui/dropdown-menu";
import {
  Building2,
  Search,
  FileText,
  Files,
  Wallet,
  CheckCircle2,
  CircleDot,
  Trash2,
  MoreVertical,
  Pencil,
  ExternalLink,
} from "lucide-react";
import {
  STATUS_META,
  deriveContractStatus,
  useContractsMaster,
  type ContractMaster,
  type DerivedStatus,
} from "@budget/hooks/useContractsMaster";
import NewContractDialog from "@budget/components/contratos/NewContractDialog";
import ImportContractsDialog from "@budget/components/contratos/ImportContractsDialog";
import EditContractDialog from "@budget/components/contratos/EditContractDialog";
import { useFinancialWorkspace, FinancialWorkspaceProvider } from "@budget/hooks/useFinancialWorkspace";
import { formatCompetenceShort } from "@budget/hooks/useContractCompetences";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";

type FilterKey = "official" | "all" | DerivedStatus;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "official", label: "Lista oficial" },
  { key: "all", label: "Todos (incl. inativos)" },
  { key: "active", label: "Ativos" },
  { key: "partial", label: "Parciais" },
  { key: "complete", label: "Completos" },
  { key: "inactive", label: "Inativos" },
];

// Lista oficial de contratos válidos (fonte: estrutura DRG da planilha Megasteam)
const OFFICIAL_CONTRACT_CODES = new Set<string>([
  "5020.100", "5040.102", "5060.103", "5040.105", "5040.107",
  "5040.108", "5040.109", "5040.110", "5040.111", "5070.101",
  "DRG-Administrativo",
]);

const ContratosPageInner = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setView, setContractId } = useFinancialWorkspace();
  const { data: contracts, isLoading } = useContractsMaster();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("official");
  const [editing, setEditing] = useState<ContractMaster | null>(null);

  const enriched = useMemo(
    () => (contracts ?? []).map((c) => ({ ...c, derived: deriveContractStatus(c) })),
    [contracts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (q) {
        const hay = `${c.project_name} ${c.client ?? ""} ${c.dept_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "all": return true;
        case "official": return OFFICIAL_CONTRACT_CODES.has(c.dept_code ?? "");
        default: return c.derived === filter;
      }
    });
  }, [enriched, search, filter]);

  const counts = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c) => c.derived === "active" || c.derived === "partial" || c.derived === "complete").length;
    const completos = enriched.filter((c) => c.derived === "complete").length;
    const inativos = enriched.filter((c) => c.derived === "inactive").length;
    return { total, active, completos, inativos };
  }, [enriched]);

  const removeContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts-master"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts"] });
      toast({ title: "Contrato removido" });
    },
    onError: (e: Error) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const openInFinanceiro = (c: ContractMaster, key?: "contract-planejado" | "contract-real" | "contract-drg" | "contract-producao" | "contract-pessoal" | "contract-imobilizado" | "contract-dashboard") => {
    setView("contract");
    setContractId(c.id);
    navigate(`/financeiro/contrato/${c.id}`);
    void key;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" /> Cadastro mestre · Megasteam
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Contratos</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Cada aba DRG da planilha financeira é tratada como um contrato independente. Esta é a base
              organizacional que alimenta o módulo de Controladoria (baseline, real, produção, pessoal, DRG, etc.).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportContractsDialog />
            <NewContractDialog />
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Total" value={counts.total} icon={Files} />
          <SummaryCard label="Ativos" value={counts.active} icon={CircleDot} tone="primary" />
          <SummaryCard label="Completos" value={counts.completos} icon={CheckCircle2} tone="success" />
          <SummaryCard label="Inativos" value={counts.inativos} icon={Trash2} tone="muted" />
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Lista de contratos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, código ou cliente..."
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                <SelectTrigger className="sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTERS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabela em desktop, cards em mobile */}
            <div className="hidden md:block border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px]">Código DRG</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última competência</TableHead>
                    <TableHead className="w-[80px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        Carregando contratos…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                        Nenhum contrato encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((c) => {
                    const meta = STATUS_META[c.derived];
                    const code = c.dept_code ?? "—";
                    const displayCode = code.startsWith("DRG-") ? code : `DRG-${code}`;
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs">{displayCode}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{c.project_name}</div>
                          {c.dept_group && (
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.dept_group}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-foreground/80">
                          {c.client ?? <span className="text-muted-foreground italic">Não identificado</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span title={c.last_competence_source ? `Fonte: ${c.last_competence_source}` : undefined}>
                            {formatCompetenceShort(c.last_competence)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            contract={c}
                            onEdit={() => setEditing(c)}
                            onOpen={() => openInFinanceiro(c)}
                            onDelete={() => removeContract.mutate(c.id)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Cards em mobile */}
            <div className="md:hidden grid gap-2">
              {filtered.map((c) => {
                const meta = STATUS_META[c.derived];
                const code = c.dept_code ?? "";
                const displayCode = code ? (code.startsWith("DRG-") ? code : `DRG-${code}`) : null;
                return (
                  <div key={c.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {displayCode && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-muted rounded">{displayCode}</span>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                        </div>
                        <div className="font-medium text-sm mt-1 truncate">{c.project_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.client ?? "—"}</div>
                      </div>
                      <RowActions
                        contract={c}
                        onEdit={() => setEditing(c)}
                        onOpen={() => openInFinanceiro(c)}
                        onDelete={() => removeContract.mutate(c.id)}
                      />
                    </div>
                  </div>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">Nenhum contrato encontrado.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EditContractDialog contract={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </AppLayout>
  );
};

const SummaryCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "muted";
}) => {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-md bg-muted flex items-center justify-center ${toneCls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-xl font-bold ${toneCls}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
};

// LinksGrid removido visualmente (vínculos seguem ativos no backend para cálculos).

const RowActions = ({
  contract,
  onEdit,
  onOpen,
  onDelete,
}: {
  contract: ContractMaster;
  onEdit: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreVertical className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuLabel className="text-xs">{contract.project_name}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onOpen} className="gap-2">
        <ExternalLink className="w-4 h-4" /> Abrir contrato
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onEdit} className="gap-2">
        <Pencil className="w-4 h-4" /> Editar contrato
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onOpen} className="gap-2">
        <FileText className="w-4 h-4" /> Vincular baseline / DRG
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onOpen} className="gap-2">
        <Wallet className="w-4 h-4" /> Vincular real mensal
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          if (confirm(`Remover o contrato "${contract.project_name}"? Esta ação não pode ser desfeita.`)) onDelete();
        }}
        className="gap-2 text-destructive focus:text-destructive"
      >
        <Trash2 className="w-4 h-4" /> Excluir contrato
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const Contratos = () => (
  <FinancialWorkspaceProvider>
    <ContratosPageInner />
  </FinancialWorkspaceProvider>
);

export default Contratos;
