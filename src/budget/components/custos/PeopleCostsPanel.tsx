import { useMemo, useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Switch } from "@budget/components/ui/switch";
import { Badge } from "@budget/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@budget/components/ui/sheet";
import { Settings2, Users, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useWorkforceRows } from "@budget/hooks/useScheduleEngine";
import { usePeopleCostParameters, useUpsertPeopleCostParameters, getEffectiveParams } from "@budget/hooks/usePeopleCostParameters";
import { computePeopleCosts, type PeopleCostParams } from "@budget/lib/peopleCostsEngine";
import { formatBRL } from "@budget/lib/format";

interface Props {
  scenarioId: string | undefined;
}

const PeopleCostsPanel = ({ scenarioId }: Props) => {
  const { data: workforce = [] } = useWorkforceRows(scenarioId);
  const { data: paramsRow, isLoading } = usePeopleCostParameters(scenarioId);
  const upsert = useUpsertPeopleCostParameters(scenarioId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  const params = useMemo(() => getEffectiveParams(paramsRow), [paramsRow]);

  // Derive headcount + homem-mês a partir das linhas estruturadas (people_count > 0)
  const inputs = useMemo(() => {
    const rows = (workforce as any[]).filter(r => Number(r.people_count) > 0 && Number(r.period_months) > 0);
    let headcount = 0;
    let homemMes = 0;
    let maxMonths = 0;
    for (const r of rows) {
      const p = Number(r.people_count) || 0;
      const m = Number(r.period_months) || 0;
      headcount += p;
      homemMes += p * m;
      if (m > maxMonths) maxMonths = m;
    }
    return { headcount_total: headcount, homem_mes_total: homemMes, period_months_max: maxMonths };
  }, [workforce]);

  const result = useMemo(() => computePeopleCosts(inputs, params), [inputs, params]);

  const toggle = (k: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const updateParam = (patch: Partial<PeopleCostParams>) => upsert.mutate(patch);

  const noTeam = inputs.headcount_total === 0;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custos de Pessoas em Campo</h3>
          <Badge variant="secondary" className="text-[10px] font-mono">{formatBRL(result.total)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {inputs.headcount_total} pess. · {inputs.homem_mes_total.toFixed(1)} h-m · {inputs.period_months_max}m
          </span>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <Settings2 className="w-3 h-3" /> Parâmetros
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Parâmetros — Pessoas em Campo</SheetTitle>
                <SheetDescription>
                  Ajuste as fórmulas paramétricas. Salvo automaticamente por orçamento.
                </SheetDescription>
              </SheetHeader>
              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <div className="space-y-6 mt-6">
                  <ParamGroup title="EPI / Uniformes">
                    <NumField label="Kit inicial por pessoa (R$)" value={params.epi_kit_inicial_pessoa} onChange={v => updateParam({ epi_kit_inicial_pessoa: v })} />
                    <NumField label="Reposição mensal por pessoa (R$)" value={params.epi_mensal_pessoa} onChange={v => updateParam({ epi_mensal_pessoa: v })} />
                  </ParamGroup>

                  <ParamGroup title="Hospedagem & Translados">
                    <NumField label="Diária (R$)" value={params.hospedagem_diaria} onChange={v => updateParam({ hospedagem_diaria: v })} />
                    <NumField label="Dias por mês" value={params.hospedagem_dias_mes} onChange={v => updateParam({ hospedagem_dias_mes: v })} />
                    <NumField label="Translado mensal por pessoa (R$)" value={params.translado_mensal_pessoa} onChange={v => updateParam({ translado_mensal_pessoa: v })} />
                    <NumField label="% do efetivo alojado" value={params.pct_alojados} suffix="%" onChange={v => updateParam({ pct_alojados: v })} />
                  </ParamGroup>

                  <ParamGroup title="Saúde Ocupacional">
                    <NumField label="ASO admissional (R$/pessoa)" value={params.saude_aso_admissional} onChange={v => updateParam({ saude_aso_admissional: v })} />
                    <NumField label="Exames periódicos (R$/pessoa)" value={params.saude_exames_periodicos} onChange={v => updateParam({ saude_exames_periodicos: v })} />
                    <NumField label="Periodicidade (meses)" value={params.saude_periodicidade_meses} onChange={v => updateParam({ saude_periodicidade_meses: v })} />
                    <NumField label="Treinamentos NR mensal/pessoa (R$)" value={params.saude_nr_mensal_pessoa} onChange={v => updateParam({ saude_nr_mensal_pessoa: v })} />
                  </ParamGroup>

                  <ParamGroup title="Mobilização / Desmobilização">
                    <NumField label="Mobilização por pessoa (R$)" value={params.mob_custo_pessoa} onChange={v => updateParam({ mob_custo_pessoa: v })} />
                    <NumField label="Desmobilização por pessoa (R$)" value={params.desmob_custo_pessoa} onChange={v => updateParam({ desmob_custo_pessoa: v })} />
                    <NumField label="% do efetivo transferido" value={params.pct_transferidos} suffix="%" onChange={v => updateParam({ pct_transferidos: v })} />
                  </ParamGroup>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {noTeam && (
        <div className="px-4 py-3 bg-muted/20 text-xs text-muted-foreground">
          Adicione linhas com <strong>quantidade × período</strong> na aba <strong>Cronograma & Equipe</strong> para calcular automaticamente estes custos.
        </div>
      )}

      <div className="divide-y divide-border/50">
        {result.categories.map(cat => {
          const isOpen = expanded.has(cat.key);
          const pct = result.total > 0 ? (cat.total / result.total) * 100 : 0;
          return (
            <div key={cat.key}>
              <div
                onClick={() => toggle(cat.key)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm text-foreground font-medium">{cat.label}</span>
                  {cat.is_override && <Badge variant="outline" className="text-[9px] h-5 border-accent text-accent">override</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                  <span className="text-sm font-mono font-bold text-foreground w-32 text-right">{formatBRL(cat.total)}</span>
                </div>
              </div>
              {isOpen && (
                <div className="bg-muted/10 border-t border-border/30 px-10 py-3 space-y-2">
                  {cat.detalhe.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="font-mono text-foreground">{formatBRL(d.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/30 pt-2 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Calculado pela fórmula</span>
                    <span className="font-mono text-foreground">{formatBRL(cat.formula_total)}</span>
                  </div>
                  <OverrideRow
                    catKey={cat.key}
                    enabled={cat.is_override}
                    value={getOverrideValue(params, cat.key)}
                    formulaValue={cat.formula_total}
                    onToggle={(on) => updateParam(getOverrideTogglePatch(cat.key, on, cat.formula_total))}
                    onValueChange={(v) => updateParam(getOverrideValuePatch(cat.key, v))}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Footer total */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t-2 border-primary/40">
          <span className="text-sm font-semibold text-foreground">SUBTOTAL — Pessoas em Campo</span>
          <span className="text-base font-mono font-bold text-primary">{formatBRL(result.total)}</span>
        </div>
      </div>
    </Card>
  );
};

/* ── helpers ── */
function getOverrideValue(p: PeopleCostParams, key: string): number {
  switch (key) {
    case "epi": return p.epi_override_value;
    case "hospedagem": return p.hospedagem_override_value;
    case "saude": return p.saude_override_value;
    case "mob": return p.mob_override_value;
  }
  return 0;
}
function getOverrideTogglePatch(key: string, on: boolean, formula: number): Partial<PeopleCostParams> {
  switch (key) {
    case "epi": return { epi_override_enabled: on, epi_override_value: on ? formula : 0 };
    case "hospedagem": return { hospedagem_override_enabled: on, hospedagem_override_value: on ? formula : 0 };
    case "saude": return { saude_override_enabled: on, saude_override_value: on ? formula : 0 };
    case "mob": return { mob_override_enabled: on, mob_override_value: on ? formula : 0 };
  }
  return {};
}
function getOverrideValuePatch(key: string, v: number): Partial<PeopleCostParams> {
  switch (key) {
    case "epi": return { epi_override_value: v };
    case "hospedagem": return { hospedagem_override_value: v };
    case "saude": return { saude_override_value: v };
    case "mob": return { mob_override_value: v };
  }
  return {};
}

const OverrideRow = ({
  enabled, value, formulaValue, onToggle, onValueChange,
}: {
  catKey: string; enabled: boolean; value: number; formulaValue: number;
  onToggle: (on: boolean) => void; onValueChange: (v: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value || formulaValue));
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        <span className="text-xs text-muted-foreground">Sobrescrever manualmente</span>
      </div>
      {enabled && (
        <Input
          type="number" step="0.01" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { const n = parseFloat(draft); if (!isNaN(n)) onValueChange(n); }}
          className="h-7 w-32 text-xs font-mono text-right"
        />
      )}
    </div>
  );
};

const ParamGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border/50 pb-1">{title}</h4>
    <div className="space-y-2">{children}</div>
  </div>
);

const NumField = ({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) => {
  const [draft, setDraft] = useState(String(value));
  // refresh when value changes externally
  useMemo(() => setDraft(String(value)), [value]);
  return (
    <div className="grid grid-cols-[1fr_120px] items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number" step="0.01" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { const n = parseFloat(draft); if (!isNaN(n) && n !== value) onChange(n); }}
          className="h-7 text-xs font-mono text-right pr-7"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
};

export default PeopleCostsPanel;
