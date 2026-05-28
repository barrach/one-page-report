import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Badge } from "@budget/components/ui/badge";
import { Switch } from "@budget/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Calculator, ChevronDown, ChevronRight, Settings2, AlertTriangle, Users, Hammer, Briefcase } from "lucide-react";
import { useProductionFactors, resolveProductionFactor } from "@budget/hooks/useProductionFactors";
import { useProjectParameters, useSaveProjectParameters, buildDefaultParameters } from "@budget/hooks/useProjectParameters";
import { useScopeMutations } from "@budget/hooks/useScopeData";
import {
  ALTURA_OPTIONS,
  CONFINAMENTO_OPTIONS,
  TURNO_OPTIONS,
  ACESSO_OPTIONS,
  resolveLocalAdjustment,
  computeHHForItem,
  computeHHDirect,
  summarizeBySpecialty,
  splitMODMOI,
  DEFAULT_LOCAL_ADJUSTMENT,
  type LocalAdjustment,
} from "@budget/lib/hhCalculator";
import { formatNumber } from "@budget/lib/format";
import type { ScopeItem } from "@budget/hooks/useScopeData";

interface Props {
  projectId: string;
  scenarioId: string;
  scopeItems: ScopeItem[];
}

/**
 * Carrega componentes agrupados por especialidade (= scope_item).
 * Cada scope_item representa uma "especialidade" no contexto deste módulo.
 */
function useScopeBundle(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["hh_scope_bundle", scenarioId],
    enabled: !!scenarioId,
    queryFn: async () => {
      const { data: items, error: e1 } = await supabase
        .from("scope_items")
        .select("*")
        .eq("scenario_id", scenarioId!)
        .order("sort_order");
      if (e1) throw e1;
      if (!items?.length) return { items: [], components: [] };
      const ids = items.map((i) => i.id);
      const { data: comps, error: e2 } = await supabase
        .from("scope_components")
        .select("*")
        .in("scope_item_id", ids);
      if (e2) throw e2;
      return { items, components: comps || [] };
    },
  });
}

const SPECIALTY_ICONS: Record<string, any> = {
  supervisao: Briefcase,
  controle_qualidade: Briefcase,
};

export default function HHCalculationPanel({ projectId, scenarioId, scopeItems }: Props) {
  const { data: factors = [] } = useProductionFactors();
  const { data: paramsRaw } = useProjectParameters(projectId);
  const { data: bundle } = useScopeBundle(scenarioId);
  const saveParams = useSaveProjectParameters(projectId);
  const { updateItem, updateComponent } = useScopeMutations(scenarioId);

  const [showAdj, setShowAdj] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const params = useMemo(() => paramsRaw ?? buildDefaultParameters(), [paramsRaw]);
  const projectAdj: LocalAdjustment =
    (params as any).local_adjustment_defaults ?? DEFAULT_LOCAL_ADJUSTMENT;
  const overrideMap: Record<string, number> =
    (params as any).production_factors_override ?? {};

  const projectAdjResolved = useMemo(() => resolveLocalAdjustment(projectAdj), [projectAdj]);

  // ── Map scope_item → especialidade (usa title como label, category como code)
  // Como o modelo atual de escopo é por categoria livre, mapeamos por nome do item.
  // O usuário pode editar a especialidade manualmente via select na linha.
  const items = bundle?.items ?? scopeItems;
  const components = bundle?.components ?? [];

  // ── Calcula HH por item agregando seus componentes
  const itemRows = useMemo(() => {
    return items.map((item: any) => {
      const specialtyCode = item.category || "atividades_principais";
      const specialtyLabel =
        factors.find((f) => f.specialty_code === specialtyCode)?.specialty_label ||
        item.title ||
        specialtyCode;
      const productionFactor = resolveProductionFactor(specialtyCode, factors, overrideMap);

      const itemComps = components.filter((c: any) => c.scope_item_id === item.id);

      let totalHH = 0;
      let baseHH = 0;
      let adjHH = 0;

      if (item.entry_mode === "hh_direto") {
        const r = computeHHDirect(Number(item.direct_hh_value) || 0, productionFactor);
        totalHH = r.totalHH;
        baseHH = r.baseHH;
        adjHH = r.adjustedHH;
      } else {
        for (const c of itemComps) {
          const localAdj = c.local_adjustment_override
            ? resolveLocalAdjustment(c.local_adjustment_override as LocalAdjustment).factor
            : projectAdjResolved.factor;
          const r = computeHHForItem({
            quantity: Number(c.quantity) || 0,
            productivity_index: Number(c.productivity_index) || 0,
            local_adjustment_factor: localAdj,
            production_factor: productionFactor,
          });
          baseHH += r.baseHH;
          adjHH += r.adjustedHH;
          totalHH += r.totalHH;
        }
      }

      return {
        item,
        specialtyCode,
        specialtyLabel,
        productionFactor,
        productionFactorIsOverride: typeof overrideMap[specialtyCode] === "number",
        components: itemComps,
        baseHH,
        adjHH,
        totalHH,
      };
    });
  }, [items, components, factors, overrideMap, projectAdjResolved]);

  const summary = useMemo(
    () =>
      summarizeBySpecialty(
        itemRows
          .filter((r) => r.totalHH > 0)
          .map((r) => ({
            specialty_code: r.specialtyCode,
            specialty_label: r.specialtyLabel,
            totalHH: r.totalHH,
          })),
      ),
    [itemRows],
  );

  const totals = useMemo(() => splitMODMOI(summary), [summary]);
  const peak = useMemo(() => {
    // Estimativa simples de pico: média mensal × 1,3 considerando 6 meses padrão
    const months = 6;
    const monthly = totals.totalHH / (months * 176);
    return Math.ceil(monthly * 1.3);
  }, [totals]);

  // ── Handlers
  const updateProjectAdj = (patch: Partial<LocalAdjustment>) => {
    saveParams.mutate({
      ...params,
      local_adjustment_defaults: { ...projectAdj, ...patch },
    } as any);
  };

  const updateOverride = (specialtyCode: string, value: number | null) => {
    const next = { ...overrideMap };
    if (value === null || isNaN(value)) delete next[specialtyCode];
    else next[specialtyCode] = value;
    saveParams.mutate({ ...params, production_factors_override: next } as any);
  };

  const toggleEntryMode = (item: any) => {
    const next = item.entry_mode === "hh_direto" ? "quantitativo" : "hh_direto";
    updateItem.mutate({ id: item.id, entry_mode: next });
  };

  const updateDirectHH = (item: any, value: number) => {
    updateItem.mutate({ id: item.id, direct_hh_value: value });
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="p-5 bg-card border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cálculo de HH por Especialidade</h3>
            <p className="text-xs text-muted-foreground">
              HH = (qtd × índice RIP) × ajuste_local ÷ fator_produção
            </p>
          </div>
        </div>
      </div>

      {/* ── BLOCO 1: AJUSTES LOCAIS DO ORÇAMENTO ── */}
      <div className="border border-border rounded-md">
        <button
          onClick={() => setShowAdj((v) => !v)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30"
        >
          <div className="flex items-center gap-2">
            {showAdj ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Settings2 className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Fatores de Ajuste Local</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              Combinado: {projectAdjResolved.factor.toFixed(2)}x
            </Badge>
            {projectAdjResolved.parts.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({projectAdjResolved.parts.map((p) => `${p.label} ${p.factor}x`).join(" × ")})
              </span>
            )}
          </div>
        </button>
        {showAdj && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border-t border-border bg-muted/10">
            <FactorSelect
              label="Altura de trabalho"
              value={projectAdj.altura ?? "0_6"}
              options={ALTURA_OPTIONS}
              onChange={(v) => updateProjectAdj({ altura: v })}
            />
            <FactorSelect
              label="Espaço confinado"
              value={projectAdj.confinamento ?? "sem"}
              options={CONFINAMENTO_OPTIONS}
              onChange={(v) => updateProjectAdj({ confinamento: v })}
            />
            <FactorSelect
              label="Turno"
              value={projectAdj.turno ?? "diurno"}
              options={TURNO_OPTIONS}
              onChange={(v) => updateProjectAdj({ turno: v })}
            />
            <FactorSelect
              label="Acesso"
              value={projectAdj.acesso ?? "facil"}
              options={ACESSO_OPTIONS}
              onChange={(v) => updateProjectAdj({ acesso: v })}
            />
          </div>
        )}
      </div>

      {/* ── BLOCO 2: TABELA POR ITEM/ESPECIALIDADE ── */}
      {itemRows.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-md">
          Nenhuma especialidade cadastrada. Adicione itens na Decomposição Técnica acima.
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Especialidade / Item</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">HH base</TableHead>
                <TableHead className="text-right">HH ajustado</TableHead>
                <TableHead className="text-center">Fator prod.</TableHead>
                <TableHead className="text-right">HH total</TableHead>
                <TableHead className="text-center w-32">Modo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemRows.map((row) => {
                const isExpanded = expandedItems.has(row.item.id);
                const isDirect = row.item.entry_mode === "hh_direto";
                return (
                  <>
                    <TableRow key={row.item.id} className="hover:bg-muted/40">
                      <TableCell>
                        {row.components.length > 0 && (
                          <button
                            onClick={() => toggleExpand(row.item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.item.title}</div>
                        <div className="text-[10px] text-muted-foreground">{row.specialtyLabel}</div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {isDirect ? "—" : row.components.length}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {isDirect ? "—" : formatNumber(row.baseHH)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {isDirect ? (
                          <Input
                            type="number"
                            value={Number(row.item.direct_hh_value) || 0}
                            onChange={(e) => updateDirectHH(row.item, +e.target.value)}
                            className="h-7 text-right text-xs"
                          />
                        ) : (
                          <span className="text-foreground">{formatNumber(row.adjHH)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="1"
                            value={row.productionFactor}
                            onChange={(e) =>
                              updateOverride(row.specialtyCode, +e.target.value || null)
                            }
                            className="h-7 w-16 text-center text-xs font-mono"
                          />
                          {row.productionFactorIsOverride && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              ovr
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-semibold text-primary">
                          {formatNumber(row.totalHH)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Qty</span>
                          <Switch
                            checked={isDirect}
                            onCheckedChange={() => toggleEntryMode(row.item)}
                            className="scale-75"
                          />
                          <span className="text-[10px] text-muted-foreground">HH</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded &&
                      row.components.map((c: any) => {
                        const localAdj = c.local_adjustment_override
                          ? resolveLocalAdjustment(c.local_adjustment_override as LocalAdjustment)
                          : projectAdjResolved;
                        const r = computeHHForItem({
                          quantity: Number(c.quantity) || 0,
                          productivity_index: Number(c.productivity_index) || 0,
                          local_adjustment_factor: localAdj.factor,
                          production_factor: row.productionFactor,
                        });
                        return (
                          <TableRow key={c.id} className="bg-muted/20">
                            <TableCell></TableCell>
                            <TableCell className="pl-6">
                              <span className="text-[11px] text-muted-foreground">↳ {c.description}</span>
                            </TableCell>
                            <TableCell className="text-right text-[11px] text-muted-foreground">
                              {Number(c.quantity)} {c.unit}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px]">
                              {formatNumber(r.baseHH)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px]">
                              <span title={`Ajuste local: ${localAdj.factor.toFixed(2)}x`}>
                                {formatNumber(r.adjustedHH)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-[10px] text-muted-foreground">
                              {row.productionFactor.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-primary">
                              {formatNumber(r.totalHH)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        );
                      })}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── BLOCO 3: CONSOLIDADO POR ESPECIALIDADE ── */}
      {summary.length > 0 && (
        <div className="border border-border rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Consolidado por especialidade
          </p>
          <div className="space-y-1">
            {summary.map((s) => (
              <div key={s.specialty_code} className="flex items-center gap-3">
                <span className="text-xs flex-1 text-foreground">{s.specialty_label}</span>
                <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(s.pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-foreground w-20 text-right">
                  {formatNumber(s.totalHH)} HH
                </span>
                <span className="text-[10px] text-muted-foreground w-12 text-right">
                  {s.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BLOCO 4: TOTAIS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TotalCard label="HH Total" value={totals.totalHH} icon={Calculator} highlight />
        <TotalCard label="HH MOD (campo)" value={totals.modHH} icon={Hammer} />
        <TotalCard label="HH MOI (gestão)" value={totals.moiHH} icon={Briefcase} />
        <TotalCard label="Pico efetivo" value={peak} icon={Users} suffix="pessoas" isInt />
      </div>
    </Card>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────
function FactorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { code: string; label: string; factor: number }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.code} value={o.code} className="text-xs">
              {o.label} <span className="text-muted-foreground ml-1">({o.factor}x)</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TotalCard({
  label,
  value,
  icon: Icon,
  highlight,
  suffix = "HH",
  isInt = false,
}: {
  label: string;
  value: number;
  icon: any;
  highlight?: boolean;
  suffix?: string;
  isInt?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-md border ${
        highlight ? "bg-primary/5 border-primary/30" : "bg-card border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="font-mono text-lg font-bold text-foreground">
        {isInt ? Math.round(value) : formatNumber(value)}
        <span className="text-[10px] text-muted-foreground ml-1 font-normal">{suffix}</span>
      </div>
    </div>
  );
}
