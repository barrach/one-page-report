import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  PieChart,
  FileSpreadsheet,
  BarChart3,
  Calendar as CalendarIcon,
  Briefcase,
  Building2,
  CircleDot,
  ChevronRight,
  
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@budget/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import { cn } from "@budget/lib/utils";
import { useFinancialContracts, useCompanyEntities } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useContractCompetences } from "@budget/hooks/useContractCompetences";
import { usePayrollHeadcount } from "@budget/hooks/usePayrollFromEntries";


// Lazy modules — só carrega quando aberto
const FinanceiroDashboard = lazy(() => import("./FinanceiroDashboard"));
const FinanceiroPlanejado = lazy(() => import("./FinanceiroPlanejado"));
const FinanceiroPessoal = lazy(() => import("./FinanceiroPessoal"));
const FinanceiroImobilizado = lazy(() => import("./FinanceiroImobilizado"));
const ContractRateioAdmin = lazy(() => import("./ContractRateioAdmin"));
const ContractBudgetAcomp = lazy(() => import("./ContractBudgetAcomp"));
const FinanceiroDRG = lazy(() => import("./FinanceiroDRG"));


type TabKey =
  | "dashboard"
  | "budget"
  | "budget-acomp"
  | "pessoal"
  | "imobilizado"
  | "rateio"
  | "drg-analitico";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  Component: React.LazyExoticComponent<React.ComponentType>;
}

/** Ordem das abas — exatamente como pedido pelo usuário. */
const TABS: TabDef[] = [
  { key: "dashboard",      label: "Dashboard",      icon: LayoutDashboard, Component: FinanceiroDashboard },
  { key: "budget",         label: "Budget",         icon: ClipboardList,   Component: FinanceiroPlanejado },
  { key: "budget-acomp",   label: "Acompanhamento Executivo", icon: FileSpreadsheet, Component: ContractBudgetAcomp },
  { key: "pessoal",        label: "Pessoal",        icon: Users,           Component: FinanceiroPessoal },
  { key: "imobilizado",    label: "Imobilizado",    icon: Package,         Component: FinanceiroImobilizado },
  { key: "rateio",         label: "Rateio Admin",   icon: PieChart,        Component: ContractRateioAdmin },
  { key: "drg-analitico",  label: "DRG Analítico",  icon: BarChart3,       Component: FinanceiroDRG },
];

const buildMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = format(d, "yyyy-MM-dd");
    const label = format(d, "MMM/yy", { locale: ptBR });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
};

const ModuleFallback = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-1/3" />
    <Skeleton className="h-64" />
  </div>
);

interface ContractWorkspaceProps {
  contractId: string;
  /** Callback para voltar à Área do Contrato */
  onBack: () => void;
}

const ContractWorkspace = ({ contractId, onBack }: ContractWorkspaceProps) => {
  const {
    competenceMonth, setCompetenceMonth,
    showAllPeriods, setShowAllPeriods,
    setContractId,
    setView,
  } = useFinancialWorkspace();
  const { data: contracts } = useFinancialContracts({ onlyActive: false });
  const { data: companies } = useCompanyEntities();

  const { data: contractCompetences } = useContractCompetences();
  const { data: headcountByMonth } = usePayrollHeadcount(contractId ?? undefined);

  /** Snapshot de headcount = última competência com dado. */
  const headcountSnapshot = useMemo(() => {
    if (!headcountByMonth) return null;
    const months = Object.keys(headcountByMonth).sort();
    for (let i = months.length - 1; i >= 0; i--) {
      const hc = headcountByMonth[months[i]]?.headcount ?? 0;
      if (hc > 0) return { month: months[i], headcount: hc };
    }
    return null;
  }, [headcountByMonth]);

  // Garante que o workspace está em modo "contrato" e que o contractId bate com a rota
  useEffect(() => {
    setView("contract");
    setContractId(contractId);
  }, [contractId, setContractId, setView]);

  // Auto-snap: ao abrir o hub do contrato, alinha a competência selecionada com
  // a ÚLTIMA competência onde o contrato realmente tem dados (real / acomp / DRG / planejado).
  // Evita o caso "tela vazia" quando o usuário acabou de importar uma planilha de
  // outro mês — antes a competência ficava presa no mês corrente do calendário.
  useEffect(() => {
    if (!contractId || !contractCompetences) return;
    const last = contractCompetences[contractId]?.lastCompetence;
    if (!last) return;
    if (showAllPeriods) return;
    if (competenceMonth?.slice(0, 10) === last) return;
    setCompetenceMonth(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, contractCompetences]);

  const contract = useMemo(() => {
    const fromOps = (contracts ?? []).find((c) => c.id === contractId);
    if (fromOps) return fromOps;
    return (companies ?? []).find((c) => c.id === contractId) ?? null;
  }, [contracts, companies, contractId]);

  const isCorporate = contract?.is_company_entity ?? false;
  const [active, setActive] = useState<TabKey>("dashboard");

  const monthOptions = useMemo(buildMonthOptions, []);

  // Reset aba quando trocar de contrato
  useEffect(() => {
    setActive("dashboard");
  }, [contractId]);

  const ActiveModule = useMemo(
    () => TABS.find((t) => t.key === active)?.Component,
    [active],
  );

  const isInactive = (contract?.status ?? "active") === "inactive";

  return (
    <div className="bg-background">
      {/* ===========================================================
          HEADER DO CONTRATO — identidade + breadcrumb + competência
          (fluxo normal — rola junto com a página)
          =========================================================== */}
      <div
        className={cn(
          "border-b",
          isCorporate
            ? "bg-gradient-to-r from-blue-500/[0.06] via-background to-background"
            : "bg-gradient-to-r from-emerald-500/[0.06] via-background to-background",
        )}
      >
        <div className="px-4 lg:px-6 pt-3 pb-2 space-y-2">
          {/* Linha 1: breadcrumb + competência */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-xs text-muted-foreground min-w-0"
            >
              <button
                onClick={onBack}
                className="hover:text-foreground transition-colors"
              >
                Contratos
              </button>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <button
                onClick={onBack}
                className="hover:text-foreground transition-colors"
              >
                Área do Contrato
              </button>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="font-mono text-foreground font-semibold">
                {contract?.dept_code ?? "—"}
              </span>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
              <Select
                value={showAllPeriods ? "__all__" : competenceMonth}
                onValueChange={(v) => {
                  if (v === "__all__") {
                    setShowAllPeriods(true);
                  } else {
                    setShowAllPeriods(false);
                    setCompetenceMonth(v);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="__all__" className="text-xs font-medium">
                    Geral do contrato
                  </SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: identidade do contrato */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-10 w-10 rounded-md flex items-center justify-center shrink-0",
                isCorporate ? "bg-blue-500/15" : "bg-emerald-500/15",
              )}
            >
              {isCorporate ? (
                <Building2 className="h-5 w-5 text-blue-700" />
              ) : (
                <Briefcase className="h-5 w-5 text-emerald-700" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base lg:text-lg font-semibold leading-tight truncate">
                {contract?.project_name ?? "—"}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {contract?.client && (
                  <span className="text-xs text-muted-foreground truncate">
                    {contract.client}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[10px] gap-1",
                    isInactive
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                  )}
                >
                  <CircleDot className="h-2.5 w-2.5" />
                  {isInactive ? "Inativo" : "Ativo"}
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
                {headcountSnapshot && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] gap-1 bg-amber-500/10 text-amber-700 border-amber-500/30"
                    title={`Snapshot de ${format(new Date(headcountSnapshot.month + "-01"), "MMM/yy", { locale: ptBR })}`}
                  >
                    <Users className="h-2.5 w-2.5" />
                    {headcountSnapshot.headcount} pessoas
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===========================================================
            ABAS HORIZONTAIS — navegação interna do hub
            =========================================================== */}
        <ScrollArea className="w-full">
          <div className="px-4 lg:px-6 flex items-center gap-0.5 min-w-max">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(t.key)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {isActive && (
                    <span
                      className={cn(
                        "absolute left-2 right-2 -bottom-px h-0.5 rounded-full",
                        isCorporate ? "bg-blue-600" : "bg-emerald-600",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </div>

      {/* ===========================================================
          CONTEÚDO DA ABA ATIVA (fluxo normal)
          =========================================================== */}
      <div>
        <div className="px-4 lg:px-6 py-4 lg:py-5 pb-12">
          <Suspense fallback={<ModuleFallback />}>
            {ActiveModule ? <ActiveModule /> : null}
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ContractWorkspace;
