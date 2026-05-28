import { useEffect, useMemo, useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Badge } from "@budget/components/ui/badge";
import { Separator } from "@budget/components/ui/separator";
import { RotateCcw, Save, GitCompare } from "lucide-react";
import { useToast } from "@budget/hooks/use-toast";
import {
  useExecutiveBudget,
  useUpdateExecutiveSnapshot,
  type ExecutiveBudget,
} from "@budget/hooks/useExecutiveBudgets";
import {
  applySimulation,
  defaultParams,
  readParamsFromSnapshot,
  type SimulationParameters,
} from "@budget/lib/executiveSimulation";
import { formatBRL, formatNumber } from "@budget/lib/format";

interface Props {
  simulation: ExecutiveBudget;
}

const SimulationEditor = ({ simulation }: Props) => {
  const { toast } = useToast();
  const { data: parent } = useExecutiveBudget(simulation.parent_executive_id || undefined);
  const updateSnapshot = useUpdateExecutiveSnapshot();

  const [params, setParams] = useState<SimulationParameters>(() =>
    readParamsFromSnapshot(simulation.snapshot_data)
  );

  // Reset quando troca de simulação
  useEffect(() => {
    setParams(readParamsFromSnapshot(simulation.snapshot_data));
  }, [simulation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snapshot original = do pai (se existir) ou base preservada na simulação
  const originalSnapshot = parent?.snapshot_data || simulation.snapshot_data;

  const previewSnapshot = useMemo(
    () => applySimulation(originalSnapshot, params),
    [originalSnapshot, params]
  );

  const set = (k: keyof SimulationParameters) => (v: number) =>
    setParams((p) => ({ ...p, [k]: Number.isFinite(v) ? v : 0 }));

  const handleSave = () => {
    const newSnap = {
      ...applySimulation(originalSnapshot, params),
      simulation_params: params,
      simulation_of: parent?.document_number,
    };
    updateSnapshot.mutate(
      { id: simulation.id, snapshotData: newSnap },
      { onSuccess: () => toast({ title: "Simulação atualizada" }) }
    );
  };

  const handleReset = () => setParams({ ...defaultParams });

  const o = originalSnapshot.indicators;
  const s = previewSnapshot.indicators;

  const rows: Array<{ label: string; orig: number; sim: number; format: "money" | "num" | "pct" | "int" }> = [
    { label: "HH total", orig: o.totalHH, sim: s.totalHH, format: "num" },
    { label: "HH produtivo", orig: o.productiveHH, sim: s.productiveHH, format: "num" },
    { label: "Pico de efetivo", orig: o.peakEffective, sim: s.peakEffective, format: "int" },
    { label: "Prazo (meses)", orig: o.durationMonths, sim: s.durationMonths, format: "int" },
    { label: "Custo direto", orig: o.directCost, sim: s.directCost, format: "money" },
    { label: "Preço de venda", orig: o.salePrice, sim: s.salePrice, format: "money" },
    { label: "Margem bruta", orig: o.grossMargin, sim: s.grossMargin, format: "pct" },
    { label: "R$/HH produtivo", orig: o.pricePerProductiveHH, sim: s.pricePerProductiveHH, format: "money" },
  ];

  const fmt = (v: number, t: string) => {
    if (t === "money") return formatBRL(v);
    if (t === "pct") return `${v.toFixed(1)}%`;
    if (t === "int") return Math.round(v).toString();
    return formatNumber(v);
  };

  return (
    <div className="space-y-4">
      {/* Editor de parâmetros */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Parâmetros da Simulação</h2>
            <p className="text-xs text-muted-foreground">
              Ajustes aplicados sobre {parent ? `${parent.document_number}` : "o snapshot base"}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Resetar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateSnapshot.isPending} className="gap-1">
              <Save className="w-3.5 h-3.5" /> Salvar simulação
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Fator HH" hint="1.0 = mantém · 1.10 = +10%" value={params.hh_factor} step={0.05} onChange={set("hh_factor")} />
          <Field label="Fator de efetivo" value={params.headcount_factor} step={0.05} onChange={set("headcount_factor")} />
          <Field label="Fator de prazo" value={params.duration_factor} step={0.05} onChange={set("duration_factor")} />
          <Field label="Fator de custo" hint="Multiplica todos os custos diretos" value={params.cost_factor} step={0.05} onChange={set("cost_factor")} />
          <Field label="Δ Contingência (p.p.)" suffix="%" value={params.contingency_delta_pct} step={0.5} onChange={set("contingency_delta_pct")} />
          <Field label="Δ BDI (p.p.)" suffix="%" value={params.bdi_delta_pct} step={0.5} onChange={set("bdi_delta_pct")} />
          <Field label="Δ Margem (p.p.)" suffix="%" value={params.margin_delta_pct} step={0.5} onChange={set("margin_delta_pct")} />
        </div>
      </Card>

      {/* Comparação Original vs Simulação */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Comparação Original vs Simulação</h2>
          <Badge variant="outline">prévia ao vivo</Badge>
        </div>
        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <div className="col-span-4">Indicador</div>
            <div className="col-span-2 text-right">Original</div>
            <div className="col-span-2 text-right">Simulação</div>
            <div className="col-span-2 text-right">Δ</div>
            <div className="col-span-2 text-right">Δ %</div>
          </div>
          {rows.map((r, idx) => {
            const delta = r.sim - r.orig;
            const deltaPct = r.orig !== 0 ? (delta / Math.abs(r.orig)) * 100 : 0;
            const positive = delta > 0;
            const colorClass =
              Math.abs(delta) < 0.01
                ? "text-muted-foreground"
                : positive
                ? "text-green-500"
                : "text-destructive";
            return (
              <div
                key={idx}
                className="grid grid-cols-12 px-3 py-2 text-sm border-t border-border/40 items-center"
              >
                <div className="col-span-4">{r.label}</div>
                <div className="col-span-2 text-right font-mono text-muted-foreground">{fmt(r.orig, r.format)}</div>
                <div className="col-span-2 text-right font-mono">{fmt(r.sim, r.format)}</div>
                <div className={`col-span-2 text-right font-mono ${colorClass}`}>
                  {Math.abs(delta) < 0.01 ? "—" : `${positive ? "+" : ""}${fmt(delta, r.format)}`}
                </div>
                <div className={`col-span-2 text-right font-mono ${colorClass}`}>
                  {Math.abs(deltaPct) < 0.05 ? "—" : `${positive ? "+" : ""}${deltaPct.toFixed(1)}%`}
                </div>
              </div>
            );
          })}
        </div>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          Os valores acima são uma prévia. Clique em <strong>Salvar simulação</strong> para persistir o snapshot ajustado e habilitar a geração do PDF com esses números.
        </p>
      </Card>
    </div>
  );
};

const Field = ({
  label, value, onChange, step = 0.01, hint, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string; suffix?: string;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-8 font-mono text-sm"
      />
      {suffix && <span className="text-xs text-muted-foreground w-4">{suffix}</span>}
    </div>
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

export default SimulationEditor;
