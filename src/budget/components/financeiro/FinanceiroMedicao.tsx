import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Separator } from "@budget/components/ui/separator";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useFinancialEntries, useBaselines } from "@budget/hooks/useFinancial";
import { supabase } from "@budget/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@budget/hooks/use-toast";
import { formatBRL, formatPct } from "@budget/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet,
  Target, Save, AlertTriangle, CheckCircle2, ClipboardEdit,
} from "lucide-react";
import { cn } from "@budget/lib/utils";

interface ContractRevenueRow {
  id: string;
  project_id: string;
  competence_month: string;
  revenue_planned: number;
  revenue_actual: number;
  observation: string | null;
  notes: string | null;
}

const FinanceiroMedicao = () => {
  const { contractId, competenceYm, competenceMonth } = useFinancialWorkspace();
  const qc = useQueryClient();

  const { data: contracts = [] } = useFinancialContracts({ onlyActive: true });
  const { data: baselines = [] } = useBaselines();
  const { data: entries = [] } = useFinancialEntries({ projectId: contractId });

  const [revenueInput, setRevenueInput] = useState<string>("");
  const [observationInput, setObservationInput] = useState<string>("");

  // Carrega medições do contrato
  const { data: revenuesAll, isLoading: lr } = useQuery({
    queryKey: ["contract-revenues-medicao", contractId],
    queryFn: async (): Promise<ContractRevenueRow[]> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("contract_revenues")
        .select("id, project_id, competence_month, revenue_planned, revenue_actual, observation, notes")
        .eq("project_id", contractId)
        .order("competence_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractRevenueRow[];
    },
    enabled: !!contractId,
  });

  const activeContract = contracts.find((c) => c.id === contractId);
  const baseline = useMemo(
    () => (baselines ?? []).find((b) => b.project_id === contractId && b.status === "active"),
    [baselines, contractId],
  );

  // Receita prevista do mês (a partir do monthly_breakdown da baseline)
  const plannedRevenueOfMonth = useMemo(() => {
    if (!baseline) return 0;
    const breakdown = (baseline.monthly_breakdown ?? []) as Array<{ month?: string; revenue?: number }>;
    const target = competenceMonth.slice(0, 7);
    const row = breakdown.find((b) => String(b.month ?? "").slice(0, 7) === target);
    return Number(row?.revenue ?? 0);
  }, [baseline, competenceMonth]);

  // Custo realizado do mês
  const actualCostOfMonth = useMemo(() => {
    return (entries ?? [])
      .filter((e) => !e.is_excluded && !e.is_duplicate)
      .filter((e) => {
        const m = e.competence ?? (e.competence_date ? String(e.competence_date).slice(0, 7) : null);
        return m === competenceYm;
      })
      .reduce((sum, e) => sum + Number(e.cost_value || 0), 0);
  }, [entries, competenceYm]);

  // Custo previsto do mês (do baseline)
  const plannedCostOfMonth = useMemo(() => {
    if (!baseline) return 0;
    const breakdown = (baseline.monthly_breakdown ?? []) as Array<{ month?: string; direct_cost?: number; indirect_cost?: number }>;
    const target = competenceMonth.slice(0, 7);
    const row = breakdown.find((b) => String(b.month ?? "").slice(0, 7) === target);
    return Number(row?.direct_cost ?? 0) + Number(row?.indirect_cost ?? 0);
  }, [baseline, competenceMonth]);

  // Medição existente do mês selecionado
  const currentMeasurement = useMemo(
    () => (revenuesAll ?? []).find((r) => String(r.competence_month).slice(0, 7) === competenceYm) ?? null,
    [revenuesAll, competenceYm],
  );

  // Pré-preenche inputs ao mudar de mês ou contrato
  useEffect(() => {
    setRevenueInput(currentMeasurement ? String(currentMeasurement.revenue_actual ?? "") : "");
    setObservationInput(currentMeasurement?.observation ?? "");
  }, [currentMeasurement, competenceYm, contractId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contractId) throw new Error("Selecione um contrato");
      const value = Number(revenueInput.replace(",", ".").trim() || 0);
      if (Number.isNaN(value)) throw new Error("Valor de receita inválido");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const competenceMonthDate = `${competenceYm}-01`;
      const payload = {
        user_id: user.id,
        project_id: contractId,
        competence_month: competenceMonthDate,
        revenue_planned: plannedRevenueOfMonth,
        revenue_actual: value,
        observation: observationInput.trim() || null,
      };

      if (currentMeasurement) {
        const { error } = await supabase
          .from("contract_revenues")
          .update({
            revenue_actual: value,
            revenue_planned: plannedRevenueOfMonth,
            observation: observationInput.trim() || null,
          })
          .eq("id", currentMeasurement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contract_revenues").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Medição salva", description: "Os indicadores foram atualizados." });
      qc.invalidateQueries({ queryKey: ["contract-revenues-medicao"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues"] });
      qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  if (!contractId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-2">
          <ClipboardEdit className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Selecione um contrato na barra acima para lançar a medição mensal.</p>
        </CardContent>
      </Card>
    );
  }

  // Cálculos do mês
  const revenueActual = Number(revenueInput.replace(",", ".").trim() || 0);
  const grossMarginPlanned = plannedRevenueOfMonth - plannedCostOfMonth;
  const grossMarginActual = revenueActual - actualCostOfMonth;
  const marginPctPlanned = plannedRevenueOfMonth > 0 ? (grossMarginPlanned / plannedRevenueOfMonth) * 100 : 0;
  const marginPctActual = revenueActual > 0 ? (grossMarginActual / revenueActual) * 100 : 0;
  const isProfit = grossMarginActual >= 0;

  const monthLabel = (() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const l = format(d, "MMMM 'de' yyyy", { locale: ptBR });
      return l.charAt(0).toUpperCase() + l.slice(1);
    } catch { return competenceYm; }
  })();

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      {/* Cabeçalho */}
      <header className="border-b pb-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Medição mensal · {activeContract?.project_name ?? "—"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Lance a receita real medida no mês. O sistema compara com o baseline e os custos realizados.
        </p>
      </header>

      {/* Form de lançamento */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lançamento — {monthLabel}</CardTitle>
            {currentMeasurement ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Medição registrada
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
              <Label htmlFor="revenue-input" className="text-xs uppercase tracking-wide text-muted-foreground">
                Receita medida (R$)
              </Label>
              <Input
                id="revenue-input"
                type="text"
                inputMode="decimal"
                value={revenueInput}
                onChange={(e) => setRevenueInput(e.target.value)}
                placeholder="0,00"
                className="h-10 text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                Previsto no baseline: <span className="font-medium">{formatBRL(plannedRevenueOfMonth)}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Custo realizado do mês</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-base font-medium">
                {formatBRL(actualCostOfMonth)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Previsto no baseline: <span className="font-medium">{formatBRL(plannedCostOfMonth)}</span>
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
              placeholder="Justifique variações, atrasos de medição, glosas, aditivos…"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !revenueInput}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando…" : currentMeasurement ? "Atualizar medição" : "Salvar medição"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs do mês */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Receita medida"
          value={formatBRL(revenueActual)}
          sub={`Prev ${formatBRL(plannedRevenueOfMonth)}`}
          tone="blue"
        />
        <KpiCard
          icon={Wallet}
          label="Custo realizado"
          value={formatBRL(actualCostOfMonth)}
          sub={`Prev ${formatBRL(plannedCostOfMonth)}`}
          tone="orange"
        />
        <KpiCard
          icon={isProfit ? TrendingUp : TrendingDown}
          label="Margem bruta"
          value={formatBRL(grossMarginActual)}
          sub={`Prev ${formatBRL(grossMarginPlanned)}`}
          tone={isProfit ? "emerald" : "red"}
          highlight
        />
        <KpiCard
          icon={Target}
          label="Margem %"
          value={formatPct(marginPctActual, 1)}
          sub={`Prev ${formatPct(marginPctPlanned, 1)}`}
          tone={isProfit ? "emerald" : "red"}
        />
      </section>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de medições</CardTitle>
        </CardHeader>
        <CardContent>
          {lr ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (revenuesAll ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma medição registrada ainda para este contrato.
            </p>
          ) : (
            <div className="divide-y">
              {(revenuesAll ?? []).map((r) => {
                const m = String(r.competence_month).slice(0, 7);
                const label = (() => {
                  try {
                    const d = new Date(`${r.competence_month}T00:00:00`);
                    return format(d, "MMM/yyyy", { locale: ptBR });
                  } catch { return m; }
                })();
                const variation = Number(r.revenue_actual || 0) - Number(r.revenue_planned || 0);
                return (
                  <div key={r.id} className="py-3 grid grid-cols-12 gap-3 items-center text-sm">
                    <div className="col-span-2 font-medium capitalize">{label}</div>
                    <div className="col-span-3 text-right">
                      <div className="text-xs text-muted-foreground">Real</div>
                      <div className="font-semibold">{formatBRL(Number(r.revenue_actual || 0))}</div>
                    </div>
                    <div className="col-span-3 text-right">
                      <div className="text-xs text-muted-foreground">Previsto</div>
                      <div>{formatBRL(Number(r.revenue_planned || 0))}</div>
                    </div>
                    <div className={cn(
                      "col-span-2 text-right text-xs font-medium",
                      variation >= 0 ? "text-emerald-600" : "text-destructive",
                    )}>
                      {variation >= 0 ? "+" : ""}{formatBRL(variation)}
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate" title={r.observation ?? ""}>
                      {r.observation || <span className="opacity-50">—</span>}
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

export default FinanceiroMedicao;
