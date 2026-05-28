import { useEffect, useMemo, type ElementType } from "react";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  Circle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  CalendarClock,
  Clock,
  DollarSign,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import { useScopeItems } from "@budget/hooks/useScopeData";
import { useCostStages, useCostItems, computeStageSummaries } from "@budget/hooks/useCostData";
import { useWorkforceRows, useTimelinePhases } from "@budget/hooks/useScheduleEngine";
import { useScenarioPricing, computePricing } from "@budget/hooks/usePricingData";
import { useBudgetStageState } from "@budget/hooks/useBudgetStageState";
import { useStageStates, getStageStatus, isStageConfirmed, type StageKey } from "@budget/hooks/useStageStates";
import { formatBRL, formatNumber } from "@budget/lib/format";

interface Props {
  projectId: string;
  project: any;
  onTabChange?: (tab: string) => void;
}

type ChecklistStatus = "done" | "warning" | "pending" | "reopened";

const STATUS_CONFIG: Record<ChecklistStatus, { icon: ElementType; badge: string; iconClass: string; label: string }> = {
  done: { icon: CheckCircle2, badge: "default", iconClass: "text-primary", label: "Confirmado" },
  warning: { icon: AlertTriangle, badge: "secondary", iconClass: "text-accent", label: "Em andamento" },
  reopened: { icon: RotateCcw, badge: "secondary", iconClass: "text-accent", label: "Reaberto" },
  pending: { icon: Circle, badge: "outline", iconClass: "text-muted-foreground", label: "Pendente" },
};

const STAGE_KEYS: { stepKey: string; stageKey: StageKey }[] = [
  { stepKey: "scope", stageKey: "escopo" },
  { stepKey: "schedule", stageKey: "cronograma" },
  { stepKey: "hh", stageKey: "hh" },
  { stepKey: "costs", stageKey: "custos" },
  { stepKey: "pricing", stageKey: "preco" },
];

function resolveStatus(hasData: boolean, stageKey: StageKey, states: any[] | undefined): ChecklistStatus {
  const dbStatus = getStageStatus(states, stageKey);
  if (dbStatus === "confirmed") return "done";
  if (dbStatus === "reopened") return "reopened";
  if (hasData && (dbStatus === "saved" || dbStatus === "draft")) return "warning";
  return "pending";
}

const ProjectChecklistTab = ({ projectId, project, onTabChange }: Props) => {
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: scopeItems = [] } = useScopeItems(scenarioId);
  const { data: stages = [] } = useCostStages(scenarioId);
  const { data: costItems = [] } = useCostItems(scenarioId);
  const { data: workforceRows = [] } = useWorkforceRows(scenarioId);
  const { data: timelinePhases = [] } = useTimelinePhases(scenarioId);
  const { data: pricing } = useScenarioPricing(scenarioId);
  const { data: stageStates } = useStageStates(scenarioId);

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

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

  const handleAction = (tab: string) => {
    onTabChange?.(tab);
  };

  const steps = useMemo(() => {
    const allConfirmed = STAGE_KEYS.every(({ stageKey }) => isStageConfirmed(stageStates, stageKey));

    return [
      {
        key: "scope",
        label: "Escopo preenchido e confirmado",
        tab: "escopo",
        icon: FileText,
        status: resolveStatus(stageState.hasScope, "escopo", stageStates),
        detail: isStageConfirmed(stageStates, "escopo")
          ? stageState.hasScopeItems
            ? `${scopeItems.length} itens técnicos — etapa confirmada.`
            : "Escopo importado — etapa confirmada."
          : stageState.hasScope
            ? "Dados existem, mas a etapa ainda não foi confirmada."
            : "Aguardando PDF ou estruturação do escopo.",
      },
      {
        key: "schedule",
        label: "Cronograma & HH confirmados",
        tab: "cronograma",
        icon: CalendarClock,
        status: (() => {
          const cronoConfirmed = isStageConfirmed(stageStates, "cronograma");
          const hhConfirmed = isStageConfirmed(stageStates, "hh");
          if (cronoConfirmed && hhConfirmed) return "done" as ChecklistStatus;
          const cronoStatus = getStageStatus(stageStates, "cronograma");
          const hhStatus = getStageStatus(stageStates, "hh");
          if (cronoStatus === "reopened" || hhStatus === "reopened") return "reopened" as ChecklistStatus;
          if (stageState.hasScheduleStructure || stageState.hasHH) return "warning" as ChecklistStatus;
          return "pending" as ChecklistStatus;
        })(),
        detail: (() => {
          const bothConfirmed = isStageConfirmed(stageStates, "cronograma") && isStageConfirmed(stageStates, "hh");
          if (bothConfirmed)
            return `${stageState.phaseCount} fases • ${formatNumber(stageState.totalHH)} HH • pico ${stageState.peakEffective} — confirmado.`;
          if (stageState.hasHH)
            return "Cronograma e HH dimensionados, confirme a etapa para prosseguir.";
          if (stageState.hasScheduleStructure)
            return "Estrutura criada, preencha HH e confirme.";
          return "Aguardando timeline, equipe e HH.";
        })(),
      },
      {
        key: "costs",
        label: "Custos lançados e confirmados",
        tab: "custos",
        icon: DollarSign,
        status: resolveStatus(stageState.hasCosts, "custos", stageStates),
        detail: isStageConfirmed(stageStates, "custos")
          ? `${stageState.validCostItemCount} itens válidos • ${formatBRL(calc.totalDirectCost)} — confirmado.`
          : stageState.hasCosts
            ? "Custos cadastrados, confirme a etapa para prosseguir."
            : "Aguardando cadastro dos custos do orçamento.",
      },
      {
        key: "pricing",
        label: "Preço final confirmado",
        tab: "preco",
        icon: TrendingUp,
        status: resolveStatus(stageState.hasPricing, "preco", stageStates),
        detail: isStageConfirmed(stageStates, "preco")
          ? `Preço de venda ${formatBRL(calc.salePrice)} — confirmado.`
          : stageState.hasPricing
            ? "Preço calculado, confirme a etapa para finalizar."
            : "Aguardando custos e etapa de precificação.",
      },
      {
        key: "review",
        label: "Revisão final",
        tab: "dashboard",
        icon: ClipboardCheck,
        status: (allConfirmed ? "done" : "pending") as ChecklistStatus,
        detail: allConfirmed
          ? "Todas as etapas confirmadas — pronto para proposta."
          : "Confirme todas as etapas anteriores para liberar a revisão final.",
      },
    ];
  }, [stageState, stageStates, scopeItems.length, costItems.length, calc]);

  const doneCount = steps.filter((step) => step.status === "done").length;
  const warningCount = steps.filter((step) => step.status === "warning" || step.status === "reopened").length;
  const pendingCount = steps.filter((step) => step.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Checklist</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Cada etapa deve ser confirmada explicitamente pelo usuário. Dados preenchidos sem confirmação não marcam a etapa como concluída.
        </p>
      </div>

      <Card className="p-5 sm:p-6 bg-card border-border">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Status real do orçamento</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {doneCount === steps.length
                ? "Fluxo completo e pronto para proposta."
                : doneCount === 0
                  ? "Nenhuma etapa confirmada ainda. Preencha e confirme cada módulo."
                  : `${doneCount} de ${steps.length} etapas confirmadas.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{doneCount} confirmada(s)</Badge>
            {warningCount > 0 && <Badge variant="secondary">{warningCount} em andamento</Badge>}
            {pendingCount > 0 && <Badge variant="outline">{pendingCount} pendente(s)</Badge>}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const cfg = STATUS_CONFIG[step.status];
          const Icon = step.icon;
          const StatusIcon = cfg.icon;
          return (
            <Card key={step.key} className="p-4 bg-card border-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{index + 1}. {step.label}</span>
                      <Badge variant={cfg.badge as "default" | "secondary" | "outline"} className="gap-1">
                        <StatusIcon className={`w-3 h-3 ${cfg.iconClass}`} /> {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{step.detail}</p>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="gap-1 text-primary self-start sm:self-auto" onClick={() => handleAction(step.tab)}>
                  Abrir etapa <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectChecklistTab;
