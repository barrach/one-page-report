import { useMemo, useState } from "react";
import { Card, CardContent } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@budget/components/ui/table";
import { Skeleton } from "@budget/components/ui/skeleton";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Receipt,
  Building2,
} from "lucide-react";
import { formatBRL } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";
import {
  useFinancialEntries,
  useFinancialCategories,
  useProjectsList,
} from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import EntryReviewRow, { type EntryRow } from "./EntryReviewRow";

type StatusFilter =
  | "all"
  | "ok"
  | "needs_review"
  | "no_category"
  | "excluded"
  | "duplicate";

/**
 * Aba "Custos Mensais" DENTRO do Hub do Contrato.
 *
 * NÃO é uma página de importação — apenas consome os lançamentos que já foram
 * importados na página global Financeiro > Custos Mensais e que estão vinculados
 * ao contrato selecionado. Funciona como uma planilha viva do contrato:
 * filtros, totais, edição inline.
 */
const ContractMonthlyCosts = () => {
  const { contractId, competenceMonth } = useFinancialWorkspace();
  const competenceYm = competenceMonth?.slice(0, 7); // "YYYY-MM"

  const { data: entries, isLoading } = useFinancialEntries({
    projectId: contractId ?? undefined,
    competenceMonth: competenceYm,
  });
  const { data: categories = [] } = useFinancialCategories();
  const { data: projects = [] } = useProjectsList();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Lista de lançamentos do contrato + competência ativa
  const contractEntries = useMemo(() => {
    if (!entries) return [] as EntryRow[];
    const list = entries as unknown as EntryRow[];
    // Filtro adicional defensivo: só do contrato + dentro do mês de competência
    return list.filter((e) => {
      if (!e.contract_project_id || e.contract_project_id !== contractId) return false;
      if (e.competence_date && competenceYm) {
        const ym = e.competence_date.slice(0, 7);
        if (ym !== competenceYm) return false;
      }
      return true;
    });
  }, [entries, contractId, competenceYm]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contractEntries.filter((e) => {
      if (q) {
        const haystack =
          `${e.supplier ?? ""} ${e.cost_center_description ?? ""} ${e.managerial_code ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "none" && e.category_id) return false;
        if (categoryFilter !== "none" && e.category_id !== categoryFilter) return false;
      }
      switch (statusFilter) {
        case "ok":
          return !e.is_duplicate && !e.is_excluded && e.review_status !== "needs_review";
        case "needs_review":
          return e.review_status === "needs_review";
        case "no_category":
          return !e.category_id && !e.is_excluded;
        case "excluded":
          return e.is_excluded;
        case "duplicate":
          return e.is_duplicate;
        default:
          return true;
      }
    });
  }, [contractEntries, search, statusFilter, categoryFilter]);

  // Totais consolidados do contrato no mês
  const totals = useMemo(() => {
    const valid = contractEntries.filter((e) => !e.is_excluded && !e.is_duplicate);
    const totalValue = valid.reduce((s, e) => s + Number(e.cost_value || 0), 0);
    const categorized = valid.filter((e) => e.category_id).length;
    const suppliers = new Set(valid.map((e) => e.supplier).filter(Boolean)).size;
    return {
      total: contractEntries.length,
      valid: valid.length,
      totalValue,
      categorized,
      noCategory: valid.filter((e) => !e.category_id).length,
      review: contractEntries.filter((e) => e.review_status === "needs_review").length,
      excluded: contractEntries.filter((e) => e.is_excluded).length,
      duplicates: contractEntries.filter((e) => e.is_duplicate).length,
      coverage: valid.length ? Math.round((categorized / valid.length) * 1000) / 10 : 0,
      suppliers,
    };
  }, [contractEntries]);

  // Helper para formatar a competência ativa
  const competenceLabel = useMemo(() => {
    if (!competenceMonth) return "—";
    const d = new Date(competenceMonth);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [competenceMonth]);

  if (!contractId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum contrato selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============================================================
          KPIs — totais consolidados do contrato no mês
          ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Custo total ({competenceLabel})
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1">
              {formatBRL(totals.totalValue)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {totals.valid} lançamento(s) válidos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              {totals.coverage >= 80 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Categorização DRG
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1">
              {totals.coverage}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {totals.noCategory} sem categoria
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Fornecedores
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1">
              {totals.suppliers}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              únicos no mês
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Lançamentos
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1">
              {totals.total}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {totals.review} a revisar · {totals.excluded} excl · {totals.duplicates} dup
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          FILTROS
          ============================================================ */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por fornecedor, código ou centro de custo..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                <SelectItem value="none" className="text-xs">Sem categoria</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.code} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                <SelectItem value="ok" className="text-xs">OK</SelectItem>
                <SelectItem value="needs_review" className="text-xs">Precisa revisão</SelectItem>
                <SelectItem value="no_category" className="text-xs">Sem categoria</SelectItem>
                <SelectItem value="duplicate" className="text-xs">Duplicados</SelectItem>
                <SelectItem value="excluded" className="text-xs">Excluídos</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline" className="ml-auto text-[10px] h-6">
              {filtered.length} de {totals.total}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================
          TABELA — planilha viva do contrato
          ============================================================ */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <p>
                Nenhum lançamento encontrado para este contrato em{" "}
                <strong>{competenceLabel}</strong>.
              </p>
              <p className="text-xs">
                Os custos aparecem aqui automaticamente após a importação mensal em{" "}
                <strong>Financeiro &gt; Custos Mensais</strong>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table
                className={cn(
                  "w-full text-xs",
                  // Compact paddings on header & cells
                  "[&_th]:px-2 [&_th]:py-2 [&_th]:whitespace-nowrap",
                  "[&_td]:px-2 [&_td]:py-1.5 [&_td]:align-middle",
                  // For display rows: neutralize inline min-widths and truncate long text
                  "[&_tr:not([data-editing=true])_td]:!min-w-0",
                  "[&_tr:not([data-editing=true])_td>span]:!max-w-none",
                  "[&_tr:not([data-editing=true])_td]:overflow-hidden",
                  "[&_tr:not([data-editing=true])_td]:text-ellipsis",
                  "[&_tr:not([data-editing=true])_td]:whitespace-nowrap",
                  // For editing rows: allow inputs/selects to use full cell width, no clipping
                  "[&_tr[data-editing=true]_td]:!overflow-visible",
                  "[&_tr[data-editing=true]_td]:!whitespace-normal",
                  "[&_tr[data-editing=true]_td]:!min-w-0",
                  "[&_tr[data-editing=true]_td_input]:w-full [&_tr[data-editing=true]_td_input]:min-w-0",
                  "[&_tr[data-editing=true]_td_[role=combobox]]:w-full [&_tr[data-editing=true]_td_[role=combobox]]:min-w-0",
                )}
              >
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[68px]">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[80px]">Emissão</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide">Fornecedor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[64px]">Código</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide">C. custo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[110px]">Cat. DRG</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[80px]">Contrato</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide text-right w-[100px]">Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide w-[68px]">Comp.</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wide text-right w-[72px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <EntryReviewRow
                      key={entry.id}
                      entry={entry}
                      categories={categories as any}
                      projects={projects as any}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Rodapé com total */}
          {filtered.length > 0 && (
            <div
              className={cn(
                "border-t px-4 py-2.5 flex items-center justify-between text-xs",
                "bg-muted/30",
              )}
            >
              <span className="text-muted-foreground">
                {filtered.length} lançamento(s) exibidos
              </span>
              <span className="font-semibold tabular-nums">
                Total filtrado:{" "}
                {formatBRL(
                  filtered
                    .filter((e) => !e.is_excluded && !e.is_duplicate)
                    .reduce((s, e) => s + Number(e.cost_value || 0), 0),
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractMonthlyCosts;
