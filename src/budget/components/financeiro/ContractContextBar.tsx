import { useMemo } from "react";
import { Briefcase, Calendar as CalendarIcon, Building2, Tag, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { cn } from "@budget/lib/utils";

interface ContractContextBarProps {
  /** When true, shows even without contract selected (with empty state). */
  required?: boolean;
}

/**
 * Sticky banner that highlights which contract is currently being edited.
 * Renders only when the active section is contract-scoped.
 */
const ContractContextBar = ({ required = false }: ContractContextBarProps) => {
  const { contractId, competenceMonth } = useFinancialWorkspace();
  const { data: contracts } = useFinancialContracts({ onlyActive: false });

  const contract = useMemo(
    () => (contracts ?? []).find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  const competenceLabel = useMemo(() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const label = format(d, "MMMM/yyyy", { locale: ptBR });
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return competenceMonth;
    }
  }, [competenceMonth]);

  if (!contract) {
    if (!required) return null;
    return (
      <div className="border-b border-dashed bg-amber-500/5">
        <div className="px-4 lg:px-6 py-2 flex items-center gap-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Selecione um contrato para começar a editar.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-emerald-500/5">
      <div className="px-4 lg:px-6 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
          {/* Contract code + name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-7 w-7 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Briefcase className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold text-emerald-700">
                  {contract.dept_code ?? "—"}
                </span>
                <span className="text-sm font-semibold truncate max-w-[240px] sm:max-w-[420px] lg:max-w-[520px]">
                  {contract.project_name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {contract.client && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {contract.client}
                  </span>
                )}
                {contract.dept_group && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-2.5 w-2.5" />
                    {contract.dept_group}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Competence */}
          <Badge
            variant="outline"
            className="h-7 gap-1.5 text-xs bg-background border-emerald-500/30 shrink-0"
          >
            <CalendarIcon className="h-3 w-3 text-emerald-700" />
            <span className="text-muted-foreground">Competência</span>
            <span className="font-semibold text-foreground">{competenceLabel}</span>
          </Badge>

          {/* Status badge */}
          {contract.status && (
            <Badge
              variant="outline"
              className={cn(
                "h-7 text-xs capitalize",
                contract.status === "inactive"
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
              )}
            >
              {contract.status === "inactive" ? "inativo" : "ativo"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractContextBar;
