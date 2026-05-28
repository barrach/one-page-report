import { useMemo } from "react";
import { Card } from "@budget/components/ui/card";
import { useTeamPayrollTotals } from "@budget/hooks/useTeamPayrollTotals";
import { usePeopleCostParameters, getEffectiveParams } from "@budget/hooks/usePeopleCostParameters";
import { computePeopleCosts } from "@budget/lib/peopleCostsEngine";
import { formatBRL } from "@budget/lib/format";

interface Props {
  projectId: string;
  scenarioId: string;
  serviceTotal: number;
  materialTotal: number;
}

interface Row {
  label: string;
  value: number;
  group?: "labor" | "people" | "items" | "future";
  hint?: string;
}

const CostSummaryTable = ({ projectId, scenarioId, serviceTotal, materialTotal }: Props) => {
  const { totals } = useTeamPayrollTotals(projectId, scenarioId);
  const { data: paramsRow } = usePeopleCostParameters(scenarioId);

  const peopleInputs = useMemo(() => ({
    headcount_total: totals.pico_mod + totals.pico_moi,
    homem_mes_total: totals.homem_mes_mod + totals.homem_mes_moi,
    period_months_max: 0, // computed via duration field — fallback uses 0 ciclos
  }), [totals]);

  const peopleCosts = useMemo(
    () => computePeopleCosts(peopleInputs, getEffectiveParams(paramsRow)),
    [peopleInputs, paramsRow]
  );

  const rows: Row[] = [
    { label: "Salários MOD", value: totals.salario_mod, group: "labor" },
    { label: "Salários MOI", value: totals.salario_moi, group: "labor" },
    { label: "Encargos sociais (MOD + MOI)", value: totals.encargos_mod + totals.encargos_moi, group: "labor" },
    { label: "Adicionais (Pericul./Insalub.)", value: totals.adicionais_total, group: "labor" },
    { label: "Benefícios (cesta, convênio, PLR…)", value: totals.beneficios_total, group: "labor" },
    { label: "EPI / Uniformes", value: peopleCosts.epi.total, group: "people" },
    { label: "Hospedagem & Translados", value: peopleCosts.hospedagem.total, group: "people" },
    { label: "Saúde Ocupacional", value: peopleCosts.saude.total, group: "people" },
    { label: "Mobilização / Desmobilização", value: peopleCosts.mob.total, group: "people" },
    { label: "Itens manuais — Serviços", value: serviceTotal, group: "items" },
    { label: "Itens manuais — Materiais", value: materialTotal, group: "items" },
    { label: "Ferramentas e consumíveis", value: 0, group: "future", hint: "próxima fase" },
    { label: "Canteiro de Obras", value: 0, group: "future", hint: "próxima fase" },
    { label: "Veículos e Equipamentos", value: 0, group: "future", hint: "próxima fase" },
    { label: "Subcontratos de 3ºs", value: 0, group: "future", hint: "próxima fase" },
    { label: "Materiais fornecidos", value: 0, group: "future", hint: "próxima fase" },
    { label: "Seguros e Garantias", value: 0, group: "future", hint: "próxima fase" },
    { label: "Contingências", value: 0, group: "future", hint: "próxima fase" },
  ];

  const total = rows.reduce((s, r) => s + r.value, 0);

  const groupColor = (g?: string) => {
    if (g === "labor") return "bg-primary/5";
    if (g === "people") return "bg-accent/5";
    if (g === "items") return "bg-muted/30";
    return "bg-muted/10 opacity-60";
  };

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3">RESUMO — CUSTO TOTAL DIRETO</h2>
      <Card className="bg-card border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="text-left p-2 pl-4 font-medium text-muted-foreground">Categoria</th>
              <th className="text-right p-2 font-medium text-muted-foreground w-32">Valor (R$)</th>
              <th className="text-right p-2 pr-4 font-medium text-muted-foreground w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = total > 0 ? (r.value / total) * 100 : 0;
              return (
                <tr key={i} className={`border-b border-border/20 ${groupColor(r.group)}`}>
                  <td className="p-2 pl-4 text-foreground">
                    {r.label}
                    {r.hint && <span className="ml-2 text-[10px] text-muted-foreground italic">({r.hint})</span>}
                  </td>
                  <td className="p-2 text-right font-mono text-foreground">{formatBRL(r.value)}</td>
                  <td className="p-2 pr-4 text-right font-mono text-muted-foreground">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary/10 border-t-2 border-primary/40">
              <td className="p-3 pl-4 text-sm font-semibold text-foreground">CUSTO TOTAL DIRETO</td>
              <td className="p-3 text-right text-base font-mono font-bold text-primary">{formatBRL(total)}</td>
              <td className="p-3 pr-4 text-right text-xs font-mono text-muted-foreground">100%</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
};

export default CostSummaryTable;
