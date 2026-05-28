import { useMemo } from "react";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { formatBRL, formatPct } from "@budget/lib/format";
import type { StageSummary } from "@budget/hooks/useCostData";

interface Props {
  summaries: StageSummary[];
}

export default function ParetoChart({ summaries }: Props) {
  const paretoData = useMemo(() => {
    const sorted = summaries
      .map((s) => ({ label: s.stage.label, total: s.total, count: s.items.length, code: s.stage.stage_code }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);

    const grandTotal = sorted.reduce((s, d) => s + d.total, 0);
    let cumulative = 0;
    return sorted.map((d) => {
      cumulative += d.total;
      const pct = grandTotal > 0 ? (d.total / grandTotal) * 100 : 0;
      const cumPct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0;
      return { ...d, pct, cumPct, grandTotal };
    });
  }, [summaries]);

  if (paretoData.length === 0) {
    return (
      <Card className="p-5 bg-card border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Pareto de Custos (80/20)</h3>
        <p className="text-sm text-muted-foreground text-center py-4">Adicione itens de custo para ver o Pareto</p>
      </Card>
    );
  }

  const maxPct = Math.max(...paretoData.map((d) => d.pct), 1);

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Pareto de Custos (80/20)</h3>
        <Badge variant="outline" className="text-[10px]">
          Total: {formatBRL(paretoData[0]?.grandTotal || 0)}
        </Badge>
      </div>

      <div className="space-y-2">
        {paretoData.map((d, i) => {
          const is80 = d.cumPct <= 80;
          return (
            <div key={d.code} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs truncate ${is80 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {d.label}
                  </span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground">{formatPct(d.pct, 1)}</span>
                    <span className="text-xs font-mono font-medium text-foreground">{formatBRL(d.total)}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${is80 ? "bg-primary" : "bg-muted-foreground/30"}`}
                    style={{ width: `${(d.pct / maxPct) * 100}%` }}
                  />
                </div>
              </div>
              <span className={`text-[10px] font-mono w-12 text-right ${d.cumPct <= 80 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {formatPct(d.cumPct, 0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 80/20 line legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded bg-primary" />
          <span>80% do custo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded bg-muted-foreground/30" />
          <span>20% restante</span>
        </div>
        <span className="ml-auto font-mono">
          {paretoData.filter((d) => d.cumPct <= 80).length} de {paretoData.length} categorias = 80%
        </span>
      </div>
    </Card>
  );
}
