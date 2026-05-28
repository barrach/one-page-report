import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { formatBRL, formatPct } from "@budget/lib/format";
import type { PricingCalc } from "@budget/hooks/usePricingData";

interface Props {
  calc: PricingCalc;
  totalHH: number;
  peakTeam: number;
  totalBaseHH: number;
  costItems: number;
}

export default function CostIndicators({ calc, totalHH, peakTeam, totalBaseHH, costItems }: Props) {
  const modHH = totalHH * 0.85;
  const moiHH = totalHH * 0.15;
  const costPerHH_MOD = modHH > 0 ? calc.totalDirectCost / modHH : 0;
  const costPerHH_MODMOI = totalHH > 0 ? calc.totalDirectCost / totalHH : 0;
  const pricePerHH_MOD = modHH > 0 ? calc.salePrice / modHH : 0;
  const pricePerHH_MODMOI = totalHH > 0 ? calc.salePrice / totalHH : 0;
  const marginPerHH = pricePerHH_MODMOI - costPerHH_MODMOI;

  const costPctMO = calc.totalDirectCost > 0 ? (calc.serviceCost / calc.totalDirectCost) * 100 : 0;
  const costPctMat = calc.totalDirectCost > 0 ? (calc.materialCost / calc.totalDirectCost) * 100 : 0;

  return (
    <Card className="p-5 bg-card border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">Indicadores de Custo</h3>

      {/* R$/HH Table */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">R$/HH</p>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium text-muted-foreground" />
                <th className="text-right p-2 font-medium text-muted-foreground">MOD</th>
                <th className="text-right p-2 font-medium text-muted-foreground">MOD+MOI</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/50">
                <td className="p-2 text-muted-foreground">R$/HH (Custo)</td>
                <td className="p-2 text-right font-mono text-foreground">{formatBRL(costPerHH_MOD)}</td>
                <td className="p-2 text-right font-mono text-foreground">{formatBRL(costPerHH_MODMOI)}</td>
              </tr>
              <tr className="border-t border-border/50">
                <td className="p-2 text-muted-foreground">R$/HH (Venda)</td>
                <td className="p-2 text-right font-mono text-primary">{formatBRL(pricePerHH_MOD)}</td>
                <td className="p-2 text-right font-mono text-primary">{formatBRL(pricePerHH_MODMOI)}</td>
              </tr>
              <tr className="border-t border-border/50 bg-muted/20">
                <td className="p-2 text-muted-foreground font-medium">Margem/HH</td>
                <td className="p-2 text-right font-mono text-green-500">{formatBRL(pricePerHH_MOD - costPerHH_MOD)}</td>
                <td className="p-2 text-right font-mono text-green-500">{formatBRL(marginPerHH)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost distribution */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Distribuição de Custos</p>
        <div className="space-y-2">
          {[
            { label: "Mão de Obra", pct: costPctMO, color: "bg-primary" },
            { label: "Materiais", pct: costPctMat, color: "bg-accent" },
          ].map((d) => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-mono text-foreground">{formatPct(d.pct, 1)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="space-y-1.5 text-xs">
        {[
          { l: "HH MOD (85%)", v: modHH.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) },
          { l: "HH MOI (15%)", v: moiHH.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) },
          { l: "R$/Pessoa/Período", v: peakTeam > 0 ? formatBRL(calc.totalDirectCost / peakTeam) : "—" },
          { l: "Custo/PV", v: formatPct(calc.salePrice > 0 ? (calc.totalDirectCost / calc.salePrice) * 100 : 0) },
          { l: "BDI Efetivo", v: formatPct(calc.totalDirectCost > 0 ? ((calc.salePrice - calc.totalDirectCost) / calc.totalDirectCost) * 100 : 0) },
          { l: "Itens de Custo", v: String(costItems) },
        ].map((r) => (
          <div key={r.l} className="flex justify-between">
            <span className="text-muted-foreground">{r.l}</span>
            <span className="font-mono font-medium text-foreground">{r.v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
