import { useEffect, useMemo, useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/components/ui/tooltip";
import {
  Clock, Users, DollarSign, TrendingUp, CalendarClock, Calculator, FileText, Settings,
} from "lucide-react";
import StatCard from "@budget/components/dashboard/StatCard";
import ParetoChart from "@budget/components/dashboard/ParetoChart";
import CostIndicators from "@budget/components/dashboard/CostIndicators";
import ProjectParametersSheet from "@budget/components/projeto/ProjectParametersSheet";
import { useActiveScenario, useEnsureScenario, useScopeItems } from "@budget/hooks/useScopeData";
import { useCostStages, useCostItems, computeStageSummaries } from "@budget/hooks/useCostData";
import { useWorkforceRows, useTimelinePhases } from "@budget/hooks/useScheduleEngine";
import { useScenarioPricing, computePricing } from "@budget/hooks/usePricingData";
import { useBudgetStageState } from "@budget/hooks/useBudgetStageState";
import { formatBRL, formatPct, formatNumber } from "@budget/lib/format";

interface Props {
  projectId: string;
  project: any;
  onTabChange?: (tab: string) => void;
}


// ── Pending placeholder for stat cards ──
const PendingCard = ({ label, icon: Icon, pendingText, onNavigate }: { label: string; icon: any; pendingText: string; onNavigate?: () => void }) => (
  <div
    className={`glass-card p-5 animate-fade-in border-border ${onNavigate ? "cursor-pointer hover:border-primary/30 transition-colors" : ""}`}
    onClick={onNavigate}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-medium text-muted-foreground/60">—</p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">{pendingText}</p>
      </div>
      <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const ProjectDashboardTab = ({ projectId, project, onTabChange }: Props) => {
  const [paramsOpen, setParamsOpen] = useState(false);
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: scopeItems = [] } = useScopeItems(scenarioId);
  const { data: stages = [] } = useCostStages(scenarioId);
  const { data: costItems = [] } = useCostItems(scenarioId);
  const { data: timelinePhases = [] } = useTimelinePhases(scenarioId);
  const { data: workforceRows = [] } = useWorkforceRows(scenarioId);
  const { data: pricing } = useScenarioPricing(scenarioId);

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

  // ── Derived data (only from real sources) ──
  const summaries = useMemo(() => computeStageSummaries(stages, costItems), [stages, costItems]);
  const serviceCost = summaries.filter((s) => s.stage.cost_class === "service").reduce((a, s) => a + s.total, 0);
  const materialCost = summaries.filter((s) => s.stage.cost_class === "material").reduce((a, s) => a + s.total, 0);

  const calc = useMemo(
    () => computePricing(serviceCost, materialCost, 0, pricing ?? null),
    [serviceCost, materialCost, pricing]
  );

  const stageState = useBudgetStageState({
    project,
    scopeItems,
    workforceRows,
    timelinePhases,
    costItems,
    pricing: pricing ?? null,
    calc,
  });

  const totalPhaseHH = stageState.totalHH;
  const peakTeam = stageState.peakEffective;

  // ── Module availability flags (source of truth) ──
  const hasScope = stageState.hasScope;
  const hasSchedule = stageState.hasScheduleStructure;
  const hasHH = stageState.hasHH;
  const hasCosts = stageState.hasCosts;
  const hasPricing = stageState.hasPricing;


  const composition = useMemo(() => {
    if (calc.salePrice <= 0) return [];
    return [
      { label: "Custos Diretos", pct: (calc.totalDirectCost / calc.salePrice) * 100, color: "bg-primary" },
      { label: "BDI", pct: (calc.totalIndirect / calc.salePrice) * 100, color: "bg-accent" },
      { label: "Impostos", pct: (calc.totalTaxes / calc.salePrice) * 100, color: "bg-destructive" },
      { label: "Lucro", pct: calc.profitPct, color: "bg-green-500" },
    ];
  }, [calc]);

  const goTo = (tab: string) => onTabChange?.(tab);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Visão geral do orçamento com indicadores de custo, produtividade, prazo e desempenho do projeto.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setParamsOpen(true)} className="gap-1.5 shrink-0">
          <Settings className="w-3.5 h-3.5" /> Configurar
        </Button>
      </div>

      <ProjectParametersSheet open={paramsOpen} onOpenChange={setParamsOpen} projectId={projectId} />


      {/* Project info header */}
      <Card className="p-5 bg-card border-border mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          {[
            { l: "Cliente", v: project.client },
            { l: "Proposta", v: project.proposal || "—" },
            { l: "Local", v: [project.unit, project.location].filter(Boolean).join(", ") || "—" },
            { l: "Prazo", v: project.expected_duration_days ? `${project.expected_duration_days} dias` : "—" },
            { l: "Contrato", v: project.contract_type || "—" },
            { l: "Versão", v: `v${project.version || 1}` },
          ].map((r) => (
            <div key={r.l}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.l}</p>
              <p className="text-foreground font-medium">{r.v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Stats (show pending state when no real data) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {hasHH ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                 <StatCard label="HH Total" value={formatNumber(totalPhaseHH)} subtitle={`${stageState.populatedFunctionCount} funções dimensionadas`} icon={Clock} variant="default" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Calculado a partir do cronograma</TooltipContent>
          </Tooltip>
        ) : (
          <PendingCard label="HH Total" icon={Clock} pendingText="Aguardando cronograma" onNavigate={() => goTo("cronograma")} />
        )}

        {hasHH ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                 <StatCard label="Pico Efetivo" value={String(peakTeam)} subtitle={stageState.phaseCount > 0 ? `${stageState.phaseCount} fases` : `${stageState.functionCount} funções`} icon={Users} variant="default" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">max(efetivo) semanal do histograma</TooltipContent>
          </Tooltip>
        ) : (
          <PendingCard label="Pico Efetivo" icon={Users} pendingText="Aguardando histograma" onNavigate={() => goTo("cronograma")} />
        )}

        {hasCosts ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <StatCard label="Custo Direto" value={formatBRL(calc.totalDirectCost)} subtitle={`${stageState.validCostItemCount} itens | Serv: ${formatBRL(serviceCost)} | Mat: ${formatBRL(materialCost)}`} icon={DollarSign} variant="primary" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Σ (qtd × custo_unit) de {stageState.validCostItemCount} itens válidos</TooltipContent>
          </Tooltip>
        ) : (
          <PendingCard label="Custo Direto" icon={DollarSign} pendingText="Aguardando custos" onNavigate={() => goTo("custos")} />
        )}

        {hasPricing ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <StatCard label="Preço de Venda" value={formatBRL(calc.salePrice)} subtitle={`Margem: ${formatPct(calc.profitPct)}`} icon={TrendingUp} variant="accent" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Gross-up: (Custo + BDI) / (1 - Impostos%)</TooltipContent>
          </Tooltip>
        ) : (
          <PendingCard label="Preço de Venda" icon={TrendingUp} pendingText="Aguardando precificação" onNavigate={() => goTo("preco")} />
        )}
      </div>

      {/* ── Executive summary (only when there's real data) ── */}
      {(hasCosts || hasHH) && (
        <Card className="p-5 bg-card border-border mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Resumo Executivo
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              hasCosts ? { icon: DollarSign, label: "Custo Direto", value: formatBRL(calc.totalDirectCost), sub: `${stageState.validCostItemCount} itens` } : null,
              hasPricing ? { icon: Calculator, label: "BDI + Impostos", value: formatBRL(calc.totalIndirect + calc.totalTaxes), sub: formatPct(calc.totalDirectCost > 0 ? ((calc.totalIndirect + calc.totalTaxes) / calc.totalDirectCost) * 100 : 0) } : null,
              hasPricing ? { icon: TrendingUp, label: "Lucro", value: formatBRL(calc.profitValue), sub: formatPct(calc.profitPct) } : null,
              hasPricing ? { icon: DollarSign, label: "Preço de Venda", value: formatBRL(calc.salePrice), sub: "Gross-up", accent: true } : null,
               hasHH ? { icon: Calculator, label: "HH Total", value: formatNumber(totalPhaseHH), sub: `${stageState.populatedFunctionCount} funções` } : null,
               hasHH ? { icon: Users, label: "Pico Efetivo", value: String(peakTeam), sub: `${stageState.phaseCount} fases` } : null,
              hasPricing && hasHH ? { icon: CalendarClock, label: "R$/HH", value: formatBRL(calc.pricePerHH), sub: `Custo: ${formatBRL(calc.costPerHH)}` } : null,
            ].filter(Boolean).map((item: any) => (
              <div key={item.label} className="text-center">
                <item.icon className={`w-4 h-4 mx-auto mb-1 ${item.accent ? "text-accent" : "text-primary"}`} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className={`text-sm font-bold font-mono ${item.accent ? "text-accent" : "text-foreground"}`}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Empty state when nothing exists yet ── */}
      {!hasCosts && !hasHH && !hasPricing && (
        <Card className="p-8 bg-card border-border mb-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">Orçamento em construção</h3>
            <p className="text-xs text-muted-foreground">
              Preencha as abas na ordem: <strong>Escopo</strong> → <strong>Cronograma</strong> → <strong>Custos</strong> → <strong>Preço Final</strong>.
              Os indicadores aparecerão conforme os dados forem processados.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              {!hasScope && (
                <button onClick={() => goTo("escopo")} className="text-xs text-primary hover:underline">
                  Começar pelo Escopo →
                </button>
              )}
              {hasScope && !hasSchedule && (
                <button onClick={() => goTo("cronograma")} className="text-xs text-primary hover:underline">
                  Montar Cronograma →
                </button>
              )}
              {hasScope && hasSchedule && !hasCosts && (
                <button onClick={() => goTo("custos")} className="text-xs text-primary hover:underline">
                  Cadastrar Custos →
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Charts and indicators (only when data exists) ── */}
      {(hasCosts || hasPricing) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {hasCosts && <ParetoChart summaries={summaries} />}

            {hasPricing && (
              <Card className="p-5 bg-card border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Composição do Preço</h3>
                <div className="space-y-3">
                  {composition.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Configure custos e BDI</p>
                  ) : (
                    composition.map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="text-foreground font-medium font-mono">{formatPct(s.pct)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.color} transition-all duration-700`} style={{ width: `${Math.max(s.pct, 0)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Preço de Venda</span>
                    <span className="text-xl font-bold text-accent">{formatBRL(calc.salePrice)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {(hasCosts || hasHH) && (
            <div className="space-y-4">
              <CostIndicators
                calc={calc}
                totalHH={totalPhaseHH}
                peakTeam={peakTeam}
                  totalBaseHH={0}
                costItems={costItems.length}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDashboardTab;
