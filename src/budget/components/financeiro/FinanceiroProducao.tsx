import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Save, AlertTriangle, CheckCircle2, Activity, Target, Wallet,
} from "lucide-react";
import { toast } from "@budget/hooks/use-toast";
import { formatBRL, formatPct } from "@budget/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useBaselines } from "@budget/hooks/useFinancial";
import { cn } from "@budget/lib/utils";

interface RevenueRow {
  id: string;
  project_id: string;
  competence_month: string;
  revenue_planned: number;
  revenue_actual: number;
  observation: string | null;
  notes: string | null;
}

const FinanceiroProducao = () => {
  const { contractId, competenceYm, competenceMonth } = useFinancialWorkspace();
  const qc = useQueryClient();

  const { data: contracts = [] } = useFinancialContracts({ onlyActive: false });
  const { data: baselines = [] } = useBaselines();

  const activeContract = contracts.find((c) => c.id === contractId);
  const baseline = useMemo(
    () => (baselines ?? []).find((b) => b.project_id === contractId && b.status === "active"),
    [baselines, contractId],
  );

  // Receita prevista do mês (do budget/baseline)
  const plannedRevenueOfMonth = useMemo(() => {
    if (!baseline) return 0;
    const breakdown = (baseline.monthly_breakdown ?? []) as Array<{ month?: string; revenue?: number }>;
    const target = competenceMonth.slice(0, 7);
    const row = breakdown.find((b) => String(b.month ?? "").slice(0, 7) === target);
    return Number(row?.revenue ?? 0);
  }, [baseline, competenceMonth]);

  const { data: rowsAll, isLoading } = useQuery({
    queryKey: ["contract-revenues-producao", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<RevenueRow[]> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("contract_revenues")
        .select("id, project_id, competence_month, revenue_planned, revenue_actual, observation, notes")
        .eq("project_id", contractId)
        .order("competence_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RevenueRow[];
    },
  });

  const currentRow = useMemo(
    () => (rowsAll ?? []).find((r) => String(r.competence_month).slice(0, 7) === competenceYm) ?? null,
    [rowsAll, competenceYm],
  );

  const [plannedInput, setPlannedInput] = useState("");
  const [actualInput, setActualInput] = useState("");
  const [observationInput, setObservationInput] = useState("");

  // Pré-preenche ao trocar de mês ou contrato
  useEffect(() => {
    setPlannedInput(
      currentRow?.revenue_planned
        ? String(currentRow.revenue_planned)
        : plannedRevenueOfMonth
          ? String(plannedRevenueOfMonth)
          : "",
    );
    setActualInput(currentRow?.revenue_actual ? String(currentRow.revenue_actual) : "");
    setObservationInput(currentRow?.observation ?? "");
  }, [currentRow, plannedRevenueOfMonth, competenceYm, contractId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("Selecione um contrato");
      const planned = Number(plannedInput.replace(",", ".").trim() || 0);
      const actual = Number(actualInput.replace(",", ".").trim() || 0);
      if (Number.isNaN(planned) || Number.isNaN(actual)) throw new Error("Valor inválido");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const competenceMonthDate = `${competenceYm}-01`;
      const payload = {
        user_id: user.id,
        project_id: contractId,
        competence_month: competenceMonthDate,
        revenue_planned: planned,
        revenue_actual: actual,
        observation: observationInput.trim() || null,
      };

      if (currentRow) {
        const { error } = await supabase
          .from("contract_revenues")
          .update({
            revenue_planned: planned,
            revenue_actual: actual,
            observation: observationInput.trim() || null,
          })
          .eq("id", currentRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contract_revenues").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Produção salva", description: "Boletim de medição atualizado." });
      qc.invalidateQueries({ queryKey: ["contract-revenues-producao"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues-medicao"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues-grid"] });
      qc.invalidateQueries({ queryKey: ["contract-totals"] });
      qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  if (!contractId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-2">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Selecione um contrato para lançar a produção mensal (BM).
          </p>
        </CardContent>
      </Card>
    );
  }

  const planned = Number(plannedInput.replace(",", ".").trim() || 0);
  const actual = Number(actualInput.replace(",", ".").trim() || 0);
  const adherence = planned > 0 ? (actual / planned) * 100 : 0;
  const variation = actual - planned;
  const isPositive = variation >= 0;

  const monthLabel = (() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const l = format(d, "MMMM 'de' yyyy", { locale: ptBR });
      return l.charAt(0).toUpperCase() + l.slice(1);
    } catch {
      return competenceYm;
    }
  })();

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      {/* Cabeçalho */}
      <header className="border-b pb-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Produção (BM) · {activeContract?.project_name ?? "—"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Lance o boletim de medição do mês. Use o seletor de competência no topo do hub para alternar entre meses.
        </p>
      </header>

      {/* Form de lançamento */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lançamento — {monthLabel}</CardTitle>
            {currentRow ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
                <CheckCircle2 className="w-3 h-3" /> BM registrado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
                <AlertTriangle className="w-3 h-3" /> Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="planned-input" className="text-xs uppercase tracking-wide text-muted-foreground">
                Produção planejada (R$)
              </Label>
              <Input
                id="planned-input"
                type="text"
                inputMode="decimal"
                value={plannedInput}
                onChange={(e) => setPlannedInput(e.target.value)}
                placeholder="0,00"
                className="h-10 text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                Sugerido pelo Budget: <span className="font-medium">{formatBRL(plannedRevenueOfMonth)}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actual-input" className="text-xs uppercase tracking-wide text-muted-foreground">
                Produção realizada — BM (R$)
              </Label>
              <Input
                id="actual-input"
                type="text"
                inputMode="decimal"
                value={actualInput}
                onChange={(e) => setActualInput(e.target.value)}
                placeholder="0,00"
                className="h-10 text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                Boletim de medição efetivo no mês.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observation-input" className="text-xs uppercase tracking-wide text-muted-foreground">
              Observação
            </Label>
            <Textarea
              id="observation-input"
              value={observationInput}
              onChange={(e) => setObservationInput(e.target.value)}
              placeholder="Justifique variações de produção, atrasos, glosas, aditivos…"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando…" : currentRow ? "Atualizar BM" : "Salvar BM"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs do mês */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Planejada"
          value={formatBRL(planned)}
          tone="blue"
        />
        <KpiCard
          icon={Activity}
          label="Realizada (BM)"
          value={formatBRL(actual)}
          tone="emerald"
          highlight
        />
        <KpiCard
          icon={isPositive ? TrendingUp : TrendingDown}
          label="Variação"
          value={`${isPositive ? "+" : ""}${formatBRL(variation)}`}
          tone={isPositive ? "emerald" : "red"}
        />
        <KpiCard
          icon={Target}
          label="Aderência"
          value={planned > 0 ? formatPct(adherence, 1) : "—"}
          tone={adherence >= 95 ? "emerald" : adherence >= 80 ? "orange" : "red"}
        />
      </section>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de produção (BM)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (rowsAll ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum BM registrado ainda para este contrato.
            </p>
          ) : (
            <div className="divide-y">
              {(rowsAll ?? []).map((r) => {
                const m = String(r.competence_month).slice(0, 7);
                const label = (() => {
                  try {
                    const d = new Date(`${r.competence_month}T00:00:00`);
                    return format(d, "MMM/yyyy", { locale: ptBR });
                  } catch { return m; }
                })();
                const v = Number(r.revenue_actual || 0) - Number(r.revenue_planned || 0);
                const adh = Number(r.revenue_planned || 0) > 0
                  ? (Number(r.revenue_actual || 0) / Number(r.revenue_planned)) * 100
                  : 0;
                return (
                  <div key={r.id} className="py-3 grid grid-cols-12 gap-3 items-center text-sm">
                    <div className="col-span-2 font-medium capitalize">{label}</div>
                    <div className="col-span-3 text-right">
                      <div className="text-xs text-muted-foreground">Realizada</div>
                      <div className="font-semibold">{formatBRL(Number(r.revenue_actual || 0))}</div>
                    </div>
                    <div className="col-span-3 text-right">
                      <div className="text-xs text-muted-foreground">Planejada</div>
                      <div>{formatBRL(Number(r.revenue_planned || 0))}</div>
                    </div>
                    <div className={cn(
                      "col-span-2 text-right text-xs font-medium",
                      v >= 0 ? "text-emerald-600" : "text-destructive",
                    )}>
                      {v >= 0 ? "+" : ""}{formatBRL(v)}
                    </div>
                    <div className={cn(
                      "col-span-2 text-right text-xs font-medium",
                      Number(r.revenue_planned || 0) > 0
                        ? (adh >= 95 ? "text-emerald-600" : adh >= 80 ? "text-amber-600" : "text-destructive")
                        : "text-muted-foreground",
                    )}>
                      {Number(r.revenue_planned || 0) > 0 ? `${adh.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TONE_CLASSES = {
  blue: "border-l-blue-500/60 bg-blue-500/5",
  orange: "border-l-orange-500/60 bg-orange-500/5",
  emerald: "border-l-emerald-500/60 bg-emerald-500/5",
  red: "border-l-red-500/60 bg-red-500/5",
} as const;

const ICON_TONES = {
  blue: "text-blue-600",
  orange: "text-orange-600",
  emerald: "text-emerald-600",
  red: "text-red-600",
} as const;

const KpiCard = ({
  icon: Icon, label, value, sub, tone, highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TONE_CLASSES;
  highlight?: boolean;
}) => (
  <Card className={cn("border-l-4", TONE_CLASSES[tone], highlight && "shadow-sm")}>
    <CardContent className="pt-4 pb-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("w-4 h-4", ICON_TONES[tone])} />
        <span>{label}</span>
      </div>
      <div className={cn("text-xl font-semibold mt-1", highlight && "text-2xl")}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent>
  </Card>
);

export default FinanceiroProducao;
