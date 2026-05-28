import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Search,
  ChevronRight,
  CircleDot,
  Calendar as CalendarIcon,
  Sparkles,
  Factory,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import { Skeleton } from "@budget/components/ui/skeleton";
import { cn } from "@budget/lib/utils";
import { supabase } from "@budget/integrations/supabase/client";
import {
  useFinancialContracts,
  useCompanyEntities,
  type FinancialContract,
} from "@budget/hooks/useFinancialContracts";
import { useContractCompetences, formatCompetenceShort } from "@budget/hooks/useContractCompetences";
import { useAllContractsSaude, SAUDE_LABEL, SAUDE_CLASS } from "@budget/hooks/useContractResults";

// ----------------------------------------------------------------------
// Saúde de cada contrato (apenas totais e flags de existência de módulos).
// A última competência vem agora do hook centralizado useContractCompetences,
// que aplica a hierarquia REAL → ACOMP → DRG → PLANNED por contrato individual.
// ----------------------------------------------------------------------
interface ContractHealth {
  hasBaseline: boolean;
  hasReal: boolean;
  hasDrg: boolean;
  hasResumo: boolean;
  totalActual: number;
  totalPlanned: number;
}

const useContractsHealth = () => {
  return useQuery({
    queryKey: ["financial-contracts-health-portal"],
    queryFn: async (): Promise<Record<string, ContractHealth>> => {
      const map: Record<string, ContractHealth> = {};
      const ensure = (id: string): ContractHealth => {
        if (!map[id]) {
          map[id] = {
            hasBaseline: false,
            hasReal: false,
            hasDrg: false,
            hasResumo: false,
            totalActual: 0,
            totalPlanned: 0,
          };
        }
        return map[id];
      };

      const [snaps, files, bls] = await Promise.all([
        supabase
          .from("financial_contract_snapshots")
          .select("project_id, actual_value, planned_value"),
        supabase
          .from("financial_contract_files")
          .select("project_id, file_kind"),
        supabase.from("financial_baselines").select("project_id, total_revenue").eq("status", "active"),
      ]);

      (snaps.data ?? []).forEach((s) => {
        const h = ensure(s.project_id);
        h.totalActual += Number(s.actual_value ?? 0);
        h.totalPlanned += Number(s.planned_value ?? 0);
      });

      (files.data ?? []).forEach((f) => {
        const h = ensure(f.project_id);
        if (f.file_kind === "baseline") h.hasBaseline = true;
        if (f.file_kind === "real_mensal") h.hasReal = true;
        if (f.file_kind === "drg") h.hasDrg = true;
        if (f.file_kind === "resumo") h.hasResumo = true;
      });

      (bls.data ?? []).forEach((b) => {
        const h = ensure(b.project_id);
        h.hasBaseline = true;
        if (!h.totalPlanned) h.totalPlanned = Number(b.total_revenue ?? 0);
      });

      return map;
    },
    staleTime: 60 * 1000,
  });
};

// ----------------------------------------------------------------------
// formatCompetence foi unificado em formatCompetenceShort (Jan/26)



const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

// ----------------------------------------------------------------------
// CARD GRANDE
// ----------------------------------------------------------------------
interface ContractCardProps {
  contract: FinancialContract;
  health?: ContractHealth;
  /** Última competência individual deste contrato (hierarquia real→acomp→drg→planned) */
  competenceIso?: string | null;
  isCorporate?: boolean;
  saude?: import("@budget/hooks/useContractResults").ContractSaude;
  onSelect: (id: string) => void;
}

const ContractCard = ({ contract, health, competenceIso, isCorporate, saude, onSelect }: ContractCardProps) => {
  const status = (contract.status ?? "active").toLowerCase();
  const isInactive = status === "inactive";
  const isNew = status === "new" || status === "draft";



  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(contract.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(contract.id);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden border transition-all duration-200",
        "hover:border-primary/60 hover:shadow-lg hover:-translate-y-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "min-h-[220px] flex flex-col",
        isCorporate
          ? "bg-gradient-to-br from-blue-500/[0.06] via-background to-background"
          : "bg-gradient-to-br from-emerald-500/[0.06] via-background to-background",
      )}
    >
      {/* Faixa lateral colorida */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          isCorporate ? "bg-blue-500/70" : "bg-emerald-500/70",
        )}
      />

      <CardContent className="p-5 flex flex-col flex-1 gap-3 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "h-11 w-11 rounded-lg flex items-center justify-center shrink-0",
                isCorporate ? "bg-blue-500/15" : "bg-emerald-500/15",
              )}
            >
              {isCorporate ? (
                <Sparkles className="h-5 w-5 text-blue-700" />
              ) : (
                <Briefcase className="h-5 w-5 text-emerald-700" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "font-mono text-xs font-bold tracking-wider",
                  isCorporate ? "text-blue-700" : "text-emerald-700",
                )}
              >
                {contract.dept_code ?? "—"}
              </div>
              <div className="text-base font-semibold leading-tight truncate" title={contract.project_name}>
                {contract.project_name}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 min-w-0">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {contract.client ?? <span className="italic">sem cliente</span>}
                </span>
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 text-[10px] gap-1",
              isNew
                ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                : isInactive
                ? "bg-muted text-muted-foreground"
                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
            )}
          >
            <CircleDot className="h-2.5 w-2.5" />
            {isNew ? "Novo" : isInactive ? "Inativo" : "Ativo"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 text-[10px]",
              isCorporate
                ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
            )}
          >
            {isCorporate ? "Empresa" : "Operacional"}
          </Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 bg-background">
            <CalendarIcon className="h-2.5 w-2.5" />
            {formatCompetenceShort(competenceIso ?? null)}
          </Badge>
          {saude && (
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[10px] gap-1", SAUDE_CLASS[saude])}
              title={`Saúde do contrato: ${SAUDE_LABEL[saude]}`}
            >
              <CircleDot className="h-2.5 w-2.5" />
              {SAUDE_LABEL[saude]}
            </Badge>
          )}
        </div>

        {/* Resumo financeiro */}
        {(health?.totalPlanned ?? 0) + (health?.totalActual ?? 0) > 0 && (
          <div className="grid grid-cols-2 gap-3 py-2 border-y border-dashed">
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Previsto</div>
              <div
                className="text-[13px] font-semibold tabular-nums truncate"
                title={formatBRL(health?.totalPlanned ?? 0)}
              >
                {formatBRL(health?.totalPlanned ?? 0)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Realizado</div>
              <div
                className="text-[13px] font-semibold tabular-nums truncate"
                title={formatBRL(health?.totalActual ?? 0)}
              >
                {formatBRL(health?.totalActual ?? 0)}
              </div>
            </div>
          </div>
        )}

        {/* Abrir hub */}
        <div className="mt-auto flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1 opacity-70 group-hover:opacity-100 transition-opacity",
              isCorporate ? "text-blue-700 hover:text-blue-800" : "text-emerald-700 hover:text-emerald-800",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(contract.id);
            }}
          >
            Abrir hub
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ----------------------------------------------------------------------
const CardSkeleton = () => (
  <Card className="min-h-[220px]">
    <CardContent className="p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-7 w-full" />
    </CardContent>
  </Card>
);

// ----------------------------------------------------------------------
// PORTAL — página principal de cards
// ----------------------------------------------------------------------
export interface ContractPortalProps {
  /** Callback chamado quando o usuário clica em um card */
  onOpenContract: (id: string) => void;
}

const ContractPortal = ({ onOpenContract }: ContractPortalProps) => {
  const { data: contracts, isLoading: loadingContracts } = useFinancialContracts({
    onlyActive: false,
  });
  const { data: companies, isLoading: loadingCompanies } = useCompanyEntities();
  const { data: health } = useContractsHealth();
  const { data: competences } = useContractCompetences();
  const { data: saudeMap } = useAllContractsSaude();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "operational" | "company">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    (contracts ?? []).forEach((c) => c.client && set.add(c.client));
    return Array.from(set).sort();
  }, [contracts]);

  const matchesSearch = (c: FinancialContract) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.project_name ?? "").toLowerCase().includes(q) ||
      (c.dept_code ?? "").toLowerCase().includes(q) ||
      (c.client ?? "").toLowerCase().includes(q)
    );
  };
  const matchesStatus = (c: FinancialContract) => {
    if (statusFilter === "all") return true;
    const s = (c.status ?? "active") === "inactive" ? "inactive" : "active";
    return s === statusFilter;
  };
  const matchesClient = (c: FinancialContract) => {
    if (clientFilter === "all") return true;
    return c.client === clientFilter;
  };

  const operationalFiltered = useMemo(() => {
    if (typeFilter === "company") return [];
    return (contracts ?? [])
      .filter(matchesSearch)
      .filter(matchesStatus)
      .filter(matchesClient)
      .sort((a, b) => (a.dept_code ?? "").localeCompare(b.dept_code ?? ""));
  }, [contracts, search, statusFilter, typeFilter, clientFilter]);

  const corporateFiltered = useMemo(() => {
    if (typeFilter === "operational") return [];
    return (companies ?? []).filter(matchesSearch).filter(matchesStatus);
  }, [companies, search, statusFilter, typeFilter]);

  const isLoading = loadingContracts || loadingCompanies;
  const totalShown = operationalFiltered.length + corporateFiltered.length;

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
        {/* HERO */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Controladoria</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-foreground">Portal</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Portal</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Selecione um contrato abaixo para abrir o hub de controladoria completo daquele contrato:
            Baseline, Custos Mensais, Produção, Pessoal, Imobilizado, Rateios, DRG e Resumo Executivo —
            tudo no contexto do contrato escolhido.
          </p>
        </header>

        {/* FILTROS */}
        <div className="rounded-xl border bg-card shadow-sm p-3 lg:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative md:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, código ou cliente..."
                className="pl-9 h-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="operational">Apenas Operacionais</SelectItem>
                <SelectItem value="company">Apenas Empresa</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            {clientOptions.length > 0 && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 lg:col-span-1">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {isLoading
              ? "Carregando contratos..."
              : `${totalShown} ${totalShown === 1 ? "card" : "cards"}`}
          </div>
        </div>

        {/* OPERACIONAIS */}
        {typeFilter !== "company" && (
          <section className="space-y-3">
            <header className="flex items-center justify-between gap-3 border-b pb-2">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-emerald-700" />
                <h2 className="text-base font-semibold">Contratos Operacionais</h2>
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                >
                  {operationalFiltered.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                DRGs de clientes — abrem o hub completo
              </p>
            </header>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : operationalFiltered.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum contrato operacional encontrado com os filtros aplicados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {operationalFiltered.map((c) => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    health={health?.[c.id]}
                    competenceIso={competences?.[c.id]?.lastCompetence ?? null}
                    saude={saudeMap?.[c.id]?.saude}
                    onSelect={onOpenContract}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* CORPORATIVO */}
        {typeFilter !== "operational" && (
          <section className="space-y-3">
            <header className="flex items-center justify-between gap-3 border-b pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-700" />
                <h2 className="text-base font-semibold">Empresa / Corporativo</h2>
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30"
                >
                  {corporateFiltered.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Megasteam · Administrativo · GERAL_OH — visões consolidadas
              </p>
            </header>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : corporateFiltered.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma entidade corporativa encontrada.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {corporateFiltered.map((c) => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    health={health?.[c.id]}
                    competenceIso={competences?.[c.id]?.lastCompetence ?? null}
                    saude={saudeMap?.[c.id]?.saude}
                    isCorporate
                    onSelect={onOpenContract}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ContractPortal;
