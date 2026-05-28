import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { CheckCircle2, AlertTriangle, Circle, RotateCcw, Lock } from "lucide-react";
import {
  useStageStates,
  useConfirmStage,
  useReopenStage,
  getStageStatus,
  canConfirmStage,
  type StageKey,
  type StageStatus,
} from "@budget/hooks/useStageStates";

interface Props {
  scenarioId: string | undefined;
  stageKey: StageKey;
  /** Whether the stage has enough data to be confirmable */
  hasData: boolean;
}

const STATUS_LABELS: Record<StageStatus, { label: string; icon: typeof Circle; className: string }> = {
  draft: { label: "Rascunho", icon: Circle, className: "text-muted-foreground" },
  saved: { label: "Salvo", icon: Circle, className: "text-muted-foreground" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, className: "text-primary" },
  reopened: { label: "Reaberto", icon: AlertTriangle, className: "text-accent" },
};

const StageConfirmBar = ({ scenarioId, stageKey, hasData }: Props) => {
  const { data: states } = useStageStates(scenarioId);
  const confirmMutation = useConfirmStage(scenarioId);
  const reopenMutation = useReopenStage(scenarioId);

  const status = getStageStatus(states, stageKey);
  const canConfirm = canConfirmStage(states, stageKey);
  const cfg = STATUS_LABELS[status];
  const Icon = cfg.icon;

  const isConfirmed = status === "confirmed";
  const canUserConfirm = hasData && canConfirm && !isConfirmed;

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 px-4 rounded-lg border border-border bg-card mb-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${cfg.className}`} />
        <span className="text-sm font-medium text-foreground">Status da etapa:</span>
        <Badge
          variant={isConfirmed ? "default" : status === "reopened" ? "secondary" : "outline"}
          className="gap-1"
        >
          {cfg.label}
        </Badge>
        {!canConfirm && !isConfirmed && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> Confirme as etapas anteriores
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {isConfirmed && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => reopenMutation.mutate(stageKey)}
            disabled={reopenMutation.isPending}
          >
            <RotateCcw className="w-3 h-3" /> Reabrir
          </Button>
        )}
        {!isConfirmed && (
          <Button
            size="sm"
            className="gap-1 text-xs"
            onClick={async () => {
              await confirmMutation.mutateAsync(stageKey);
              // Cronograma also confirms HH since they share the same tab
              if (stageKey === "cronograma") {
                await confirmMutation.mutateAsync("hh");
              }
            }}
            disabled={!canUserConfirm || confirmMutation.isPending}
          >
            <CheckCircle2 className="w-3 h-3" /> Confirmar etapa
          </Button>
        )}
      </div>
    </div>
  );
};

export default StageConfirmBar;
