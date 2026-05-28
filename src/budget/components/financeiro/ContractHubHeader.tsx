import { useMemo } from "react";
import { Briefcase, Building2, Tag, Calendar as CalendarIcon, CircleDot } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { cn } from "@budget/lib/utils";
import ContractSettingsDialog from "./ContractSettingsDialog";

interface ContractHubHeaderProps {
  contractId: string;
  competenceMonth: string;
}

/**
 * Rich identification header for the contract hub — sticky on top of the
 * tab bar. Shows code, name, client, competence and status so the user
 * always knows which contract they are inside.
 */
const ContractHubHeader = ({ contractId, competenceMonth }: ContractHubHeaderProps) => {
  const { data: contracts, isLoading } = useFinancialContracts({ onlyActive: false });

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

  if (isLoading || !contract) {
    return <Skeleton className="h-16 w-full" />;
  }

  const isInactive = (contract.status ?? "active") === "inactive";

  return (
    <div className="rounded-lg border bg-gradient-to-r from-emerald-500/[0.04] via-background to-background px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Avatar + code/name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-emerald-700">
                {contract.dept_code ?? "—"}
              </span>
              <span className="text-base sm:text-lg font-semibold truncate max-w-[260px] sm:max-w-[460px]">
                {contract.project_name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              {contract.client && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Cliente: <span className="text-foreground font-medium">{contract.client}</span>
                </span>
              )}
              {contract.dept_group && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {contract.dept_group}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Competence */}
        <Badge
          variant="outline"
          className="h-7 gap-1.5 text-xs bg-background border-emerald-500/30"
        >
          <CalendarIcon className="h-3 w-3 text-emerald-700" />
          <span className="text-muted-foreground">Competência</span>
          <span className="font-semibold text-foreground">{competenceLabel}</span>
        </Badge>

        {/* Status */}
        <Badge
          variant="outline"
          className={cn(
            "h-7 gap-1.5 text-xs",
            isInactive
              ? "bg-muted text-muted-foreground"
              : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
          )}
        >
          <CircleDot className="h-3 w-3" />
          {isInactive ? "Inativo" : "Ativo"}
        </Badge>

        {/* View badge */}
        <Badge
          variant="outline"
          className="h-7 gap-1.5 text-xs bg-blue-500/10 text-blue-700 border-blue-500/30"
        >
          <Briefcase className="h-3 w-3" />
          Visão por Contrato
        </Badge>

        {/* Settings */}
        <ContractSettingsDialog contractId={contractId} />
      </div>
    </div>
  );
};

export default ContractHubHeader;
