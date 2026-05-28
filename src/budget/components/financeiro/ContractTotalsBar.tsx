import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { formatBRL } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";
import { Skeleton } from "@budget/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Hash, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractTotalsBarProps {
  projectId: string;
  competenceMonth: string; // YYYY-MM-DD (1st of month)
}

interface SnapshotRow {
  planned_value: number;
  actual_value: number;
  variance_value: number;
  margin_percent: number;
  accumulated_planned: number;
  accumulated_actual: number;
}

/**
 * Reactive totals bar for a contract — driven by the auto-recalculated
 * `financial_contract_snapshots` table. Updates whenever entries / planned
 * entries / DRG lines change (triggers in DB recompute the snapshot).
 */
const ContractTotalsBar = ({ projectId, competenceMonth }: ContractTotalsBarProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["contract-totals", projectId, competenceMonth],
    enabled: !!projectId && !!competenceMonth,
    queryFn: async (): Promise<{
      snapshot: SnapshotRow | null;
      entryCount: number;
    }> => {
      const [snapshotRes, countRes] = await Promise.all([
        supabase
          .from("financial_contract_snapshots")
          .select(
            "planned_value, actual_value, variance_value, margin_percent, accumulated_planned, accumulated_actual",
          )
          .eq("project_id", projectId)
          .eq("competence_month", competenceMonth)
          .eq("source", "auto")
          .maybeSingle(),
        supabase
          .from("financial_entries")
          .select("id", { count: "exact", head: true })
          .eq("contract_project_id", projectId)
          .eq("is_excluded", false)
          .eq("is_duplicate", false)
          .gte("competence_date", competenceMonth)
          .lt(
            "competence_date",
            new Date(
              new Date(`${competenceMonth}T00:00:00`).getFullYear(),
              new Date(`${competenceMonth}T00:00:00`).getMonth() + 1,
              1,
            )
              .toISOString()
              .slice(0, 10),
          ),
      ]);

      return {
        snapshot: (snapshotRes.data as SnapshotRow | null) ?? null,
        entryCount: countRes.count ?? 0,
      };
    },
  });

  const competenceLabel = useMemo(() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const label = format(d, "MMM/yy", { locale: ptBR });
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return competenceMonth;
    }
  }, [competenceMonth]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  const planned = Number(data?.snapshot?.planned_value ?? 0);
  const actual = Number(data?.snapshot?.actual_value ?? 0);
  const variance = Number(data?.snapshot?.variance_value ?? 0);
  const margin = Number(data?.snapshot?.margin_percent ?? 0);
  const entryCount = data?.entryCount ?? 0;
  const total = planned; // "total do contrato" no mês = previsto

  const variancePositive = variance > 0; // realizado > previsto = ruim para custo
  const VarianceIcon = variance === 0 ? Minus : variancePositive ? TrendingUp : TrendingDown;

  const cells = [
    {
      label: "Competência",
      value: competenceLabel,
      icon: Calendar,
      tone: "neutral" as const,
    },
    {
      label: "Total previsto",
      value: formatBRL(total),
      tone: "neutral" as const,
    },
    {
      label: "Realizado",
      value: formatBRL(actual),
      tone: "info" as const,
    },
    {
      label: "Desvio",
      value: formatBRL(Math.abs(variance)),
      icon: VarianceIcon,
      tone: variancePositive ? ("danger" as const) : ("success" as const),
      hint: variancePositive ? "acima do previsto" : "abaixo do previsto",
    },
    {
      label: "Margem",
      value: `${margin.toFixed(1)}%`,
      tone: margin >= 0 ? ("success" as const) : ("danger" as const),
    },
    {
      label: "Lançamentos",
      value: entryCount.toString(),
      icon: Hash,
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {cells.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={cn(
              "rounded-lg border bg-card px-3 py-2 flex flex-col gap-0.5",
              c.tone === "success" && "border-emerald-500/20 bg-emerald-500/[0.03]",
              c.tone === "danger" && "border-amber-500/20 bg-amber-500/[0.03]",
              c.tone === "info" && "border-blue-500/20 bg-blue-500/[0.03]",
            )}
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {Icon && <Icon className="h-2.5 w-2.5" />}
              {c.label}
            </div>
            <div
              className={cn(
                "text-xs font-semibold tabular-nums leading-tight whitespace-nowrap",
                c.tone === "success" && "text-emerald-700",
                c.tone === "danger" && "text-amber-700",
                c.tone === "info" && "text-blue-700",
              )}
            >
              {c.value}
            </div>
            {"hint" in c && c.hint && (
              <div className="text-[10px] text-muted-foreground leading-tight">{c.hint}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContractTotalsBar;
