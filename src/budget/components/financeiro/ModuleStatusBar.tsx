import { Badge } from "@budget/components/ui/badge";
import { CheckCircle2, Clock, Lock, Loader2 } from "lucide-react";
import { useModuleState, type ModuleScope } from "@budget/hooks/useModuleState";
import type { AutosaveStatus } from "@budget/hooks/useAutosave";
import { cn } from "@budget/lib/utils";

type Props = {
  scope: ModuleScope;
  title: string;
  description?: string;
  autosaveStatus?: AutosaveStatus;
  lastSavedAt?: Date | null;
  className?: string;
};

const statusMap: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border", icon: Clock },
  saved: { label: "Salvo", className: "bg-secondary text-secondary-foreground border-border", icon: CheckCircle2 },
  confirmed: { label: "Confirmado", className: "bg-primary/10 text-primary border-primary/20", icon: Lock },
};

const ModuleStatusBar = ({ scope, title, description, autosaveStatus, lastSavedAt, className }: Props) => {
  const { data: state } = useModuleState(scope);

  const status = state?.status ?? "draft";
  const meta = statusMap[status];
  const Icon = meta.icon;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3", className)}>
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="outline" className={cn("gap-1", meta.className)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
          {state?.version && state.version > 1 && <span className="opacity-60">v{state.version}</span>}
        </Badge>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {autosaveStatus && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-[110px] justify-end">
            {autosaveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>)}
            {autosaveStatus === "saved" && lastSavedAt && (<><CheckCircle2 className="h-3 w-3 text-primary" /> Salvo {lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>)}
            {autosaveStatus === "error" && <span className="text-destructive">Erro ao salvar</span>}
            {autosaveStatus === "idle" && <span className="opacity-0">.</span>}
          </div>
        )}

      </div>
    </div>
  );
};

export default ModuleStatusBar;
