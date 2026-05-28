import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { useBaselines, useFinancialEntries, useContractRevenues } from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useScopedSelection } from "@budget/hooks/useScopedSelection";
import { useContractResults } from "@budget/hooks/useContractResults";
import { supabase } from "@budget/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatBRL, formatPct } from "@budget/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, DollarSign, Target,
  Receipt, ArrowDownRight, Briefcase, ListChecks, AlertTriangle,
  Building2, Calendar, User, FileText, Hash,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@budget/lib/utils";

const TAX_RATE_DEFAULT = 0.0928;
const ADMIN_RATE_DEFAULT = 0.08;

/** Normaliza qualquer formato de competência para "YYYY-MM" (ou null). Aceita: "2026-03", "2026-03-01", "03/2026", Date. */
const normalizeYearMonth = (raw: unknown): string | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  return null;
};

/** Formata "2026-03" (ou "03/2026") → "Mar/26" — mesmo padrão do filtro de mês. */
const formatMonthTick = (raw: unknown): string => {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let year: number | null = null;
  let month: number | null = null;
  // YYYY-MM or YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) { year = Number(m[1]); month = Number(m[2]); }
  // MM/YYYY
  if (!m) {
    m = s.match(/^(\d{2})\/(\d{4})$/);
    if (m) { month = Number(m[1]); year = Number(m[2]); }
  }
  if (!year || !month || month < 1 || month > 12) return s;
  try {
    const d = new Date(year, month - 1, 1);
    const label = format(d, "MMM/yy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
  } catch {
    return s;
  }
};

interface ContractAggregate {
  projectId: string;
  projectName: string;
  client?: string;
  revenuePlanned: number;
  costPlanned: number;
  taxesPlanned: number;
  grossMarginPlanned: number;
  adminPlanned: number;
  netResultPlanned: number;
  revenueActual: number;
  costActual: number;
  taxesActual: number;
  grossMarginActual: number;
  adminActual: number;
  netResultActual: number;
  variation: number;
  marginPctPlanned: number;
  marginPctActual: number;
  hasActualData: boolean;
}

const FinanceiroDashboard = () => {
  const { view, contractId, competenceYm, competenceMonth, showAllPeriods } = useFinancialWorkspace();
  const scoped = useScopedSelection();
  const month = competenceYm;
  const isContractView = view === "contract";
  // Quando "Geral do contrato" está ativo, ignoramos o filtro de mês em todo o dashboard
  const monthCutoff = showAllPeriods ? null : month;
  // Conjunto de project_ids que esta tela deve agregar (1 contrato OU N contratos no consolidado)
  const scopedIdSet = useMemo(() => new Set(scoped.projectIds), [scoped.projectIds]);
  const inScope = (id?: string | null) => !!id && scopedIdSet.has(id);

  // Quando estamos no hub do contrato, todas as fontes são filtradas no servidor
  // pelo contractId — nada de outros contratos vaza para esta tela.
  const projectFilter = isContractView && contractId ? contractId : undefined;

  const { data: baselines, isLoading: lb } = useBaselines({ projectId: projectFilter });
  const { data: entries, isLoading: le } = useFinancialEntries({
    projectId: projectFilter,
  });
  const { data: revenues } = useContractRevenues({ projectId: projectFilter });
  const { data: contracts } = useFinancialContracts({ onlyActive: false });

  const { data: planned } = useQuery({
    queryKey: ["financial-planned-entries", projectFilter ?? null],
    queryFn: async () => {
      let q = supabase
        .from("financial_planned_entries")
        .select("project_id, competence_month, planned_value, kind")
        .order("competence_month");
      if (projectFilter) q = q.eq("project_id", projectFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // DRG lines — fallback source for actual revenue/cost (consolidated DRG base)
  const { data: drgLines } = useQuery({
    queryKey: ["dashboard-drg-lines", projectFilter ?? null],
    queryFn: async () => {
      let q = supabase
        .from("financial_drg_lines")
        .select("project_id, competence_month, line_code, planned_value, actual_value");
      if (projectFilter) q = q.eq("project_id", projectFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthLabel = useMemo(() => {
    if (showAllPeriods) return "Geral do contrato";
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const l = format(d, "MMMM/yyyy", { locale: ptBR });
      return l.charAt(0).toUpperCase() + l.slice(1);
    } catch { return month; }
  }, [competenceMonth, month, showAllPeriods]);

  const activeContract = useMemo(
    () => (contracts ?? []).find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  // ============ Aggregation by contract ============
  const contractsData = useMemo<ContractAggregate[]>(() => {
    const activeBaselines = (baselines ?? []).filter((b) => b.status === "active");
    const map = new Map<string, ContractAggregate>();

    for (const b of activeBaselines) {
      const p = (b as { projects?: { project_name?: string; client?: string } }).projects;
      const revenue = Number(b.total_revenue || 0);
      const costPlanned = Number(b.total_direct_cost || 0) + Number(b.total_indirect_cost || 0);
      const taxesPlanned = Number(b.total_taxes || 0);
      const grossMarginPlanned = revenue - costPlanned - taxesPlanned;
      const adminPlanned = revenue * ADMIN_RATE_DEFAULT;
      const netResultPlanned = grossMarginPlanned - adminPlanned;
      map.set(b.project_id, {
        projectId: b.project_id,
        projectName: p?.project_name ?? "—",
        client: p?.client,
        revenuePlanned: revenue,
        costPlanned, taxesPlanned, grossMarginPlanned, adminPlanned, netResultPlanned,
        revenueActual: 0, costActual: 0, taxesActual: 0,
        grossMarginActual: 0, adminActual: 0, netResultActual: 0,
        variation: 0,
        marginPctPlanned: revenue > 0 ? (netResultPlanned / revenue) * 100 : 0,
        marginPctActual: 0,
        hasActualData: false,
      });
    }

    // Garante que TODO contrato com dados reais (custos mensais ou receitas) apareça
    // no agregado, mesmo sem baseline planejada.
    const ensureContract = (projectId: string): ContractAggregate => {
      let cur = map.get(projectId);
      if (cur) return cur;
      const contract = (contracts ?? []).find((c) => c.id === projectId);
      cur = {
        projectId,
        projectName: contract?.project_name ?? "—",
        client: contract?.client,
        revenuePlanned: 0, costPlanned: 0, taxesPlanned: 0,
        grossMarginPlanned: 0, adminPlanned: 0, netResultPlanned: 0,
        revenueActual: 0, costActual: 0, taxesActual: 0,
        grossMarginActual: 0, adminActual: 0, netResultActual: 0,
        variation: 0, marginPctPlanned: 0, marginPctActual: 0,
        hasActualData: false,
      };
      map.set(projectId, cur);
      return cur;
    };

    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      if (!e.contract_project_id) continue;
      const m = normalizeYearMonth(e.competence ?? e.competence_date);
      if (monthCutoff && m && m > monthCutoff) continue;
      const cur = ensureContract(e.contract_project_id);
      cur.costActual += Number(e.cost_value || 0);
      cur.hasActualData = true;
    }

    for (const r of revenues ?? []) {
      const m = String(r.competence_month).slice(0, 7);
      if (monthCutoff && m > monthCutoff) continue;
      const cur = ensureContract(r.project_id);
      cur.revenueActual += Number(r.revenue_actual || 0);
      if (Number(r.revenue_actual || 0) > 0) cur.hasActualData = true;
    }

    // DRG fallback — when a contract has no entries/revenues yet, use DRG line totals
    // line_code starting with "REC" → revenue, "CUS"/"CST"/"DESP" → cost
    const drgAgg = new Map<string, { rev: number; cost: number }>();
    for (const d of drgLines ?? []) {
      const m = String(d.competence_month).slice(0, 7);
      if (monthCutoff && m > monthCutoff) continue;
      const code = String(d.line_code ?? "").toUpperCase();
      const v = Number(d.actual_value || 0);
      if (!v) continue;
      const agg = drgAgg.get(d.project_id) ?? { rev: 0, cost: 0 };
      if (code.startsWith("REC")) agg.rev += v;
      else if (code.startsWith("CUS") || code.startsWith("CST") || code.startsWith("DESP")) agg.cost += v;
      drgAgg.set(d.project_id, agg);
    }
    for (const [pid, agg] of drgAgg) {
      const cur = ensureContract(pid);
      if (cur.revenueActual === 0 && agg.rev > 0) {
        cur.revenueActual = agg.rev;
        cur.hasActualData = true;
      }
      if (cur.costActual === 0 && agg.cost > 0) {
        cur.costActual = agg.cost;
        cur.hasActualData = true;
      }
    }

    for (const c of map.values()) {
      c.taxesActual = c.revenueActual * (c.revenuePlanned > 0 ? c.taxesPlanned / c.revenuePlanned : TAX_RATE_DEFAULT);
      c.grossMarginActual = c.revenueActual - c.costActual - c.taxesActual;
      c.adminActual = c.revenueActual * ADMIN_RATE_DEFAULT;
      c.netResultActual = c.grossMarginActual - c.adminActual;
      c.variation = c.costPlanned > 0 ? ((c.costActual - c.costPlanned) / c.costPlanned) * 100 : 0;
      c.marginPctActual = c.revenueActual > 0 ? (c.netResultActual / c.revenueActual) * 100 : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.revenuePlanned - a.revenuePlanned);
  }, [baselines, entries, revenues, drgLines, contracts, monthCutoff]);

  // ============ Consolidated KPIs ============
  const kpis = useMemo(() => {
    // Aplica o escopo: contrato → 1 projectId; empresa consolidada → todos; empresa única → só ela
    const list = scoped.isConsolidatedCompany
      ? contractsData
      : contractsData.filter((c) => inScope(c.projectId));

    const sum = list.reduce(
      (acc, c) => ({
        revenuePlanned: acc.revenuePlanned + c.revenuePlanned,
        costPlanned: acc.costPlanned + c.costPlanned,
        taxesPlanned: acc.taxesPlanned + c.taxesPlanned,
        adminPlanned: acc.adminPlanned + c.adminPlanned,
        netResultPlanned: acc.netResultPlanned + c.netResultPlanned,
        grossMarginPlanned: acc.grossMarginPlanned + c.grossMarginPlanned,
        revenueActual: acc.revenueActual + c.revenueActual,
        costActual: acc.costActual + c.costActual,
        taxesActual: acc.taxesActual + c.taxesActual,
        adminActual: acc.adminActual + c.adminActual,
        netResultActual: acc.netResultActual + c.netResultActual,
        grossMarginActual: acc.grossMarginActual + c.grossMarginActual,
      }),
      {
        revenuePlanned: 0, costPlanned: 0, taxesPlanned: 0, adminPlanned: 0, netResultPlanned: 0, grossMarginPlanned: 0,
        revenueActual: 0, costActual: 0, taxesActual: 0, adminActual: 0, netResultActual: 0, grossMarginActual: 0,
      },
    );

    const totalCostPlanned = sum.costPlanned + sum.taxesPlanned + sum.adminPlanned;
    const totalCostActual = sum.costActual + sum.taxesActual + sum.adminActual;

    return {
      ...sum,
      totalCostPlanned,
      totalCostActual,
      grossMarginPctPlanned: sum.revenuePlanned > 0 ? (sum.grossMarginPlanned / sum.revenuePlanned) * 100 : 0,
      grossMarginPctActual: sum.revenueActual > 0 ? (sum.grossMarginActual / sum.revenueActual) * 100 : 0,
      netMarginPctPlanned: sum.revenuePlanned > 0 ? (sum.netResultPlanned / sum.revenuePlanned) * 100 : 0,
      netMarginPctActual: sum.revenueActual > 0 ? (sum.netResultActual / sum.revenueActual) * 100 : 0,
      executionRevenue: sum.revenuePlanned > 0 ? (sum.revenueActual / sum.revenuePlanned) * 100 : 0,
      executionCost: totalCostPlanned > 0 ? (totalCostActual / totalCostPlanned) * 100 : 0,
      hasActualData: list.some((c) => c.hasActualData),
    };
  }, [contractsData, scoped.isConsolidatedCompany, scopedIdSet]);

  // ============ Monthly series ============
  const monthlySeries = useMemo(() => {
    type Row = { month: string; receitaPrev: number; receitaReal: number; custoPrev: number; custoReal: number; margemReal: number };
    const monthMap = new Map<string, Row>();
    const ensure = (m: string) => {
      let cur = monthMap.get(m);
      if (!cur) { cur = { month: m, receitaPrev: 0, receitaReal: 0, custoPrev: 0, custoReal: 0, margemReal: 0 }; monthMap.set(m, cur); }
      return cur;
    };

    const passes = (pid?: string | null) =>
      scoped.isConsolidatedCompany ? true : inScope(pid);

    for (const p of planned ?? []) {
      if (!passes(p.project_id)) continue;
      const m = String(p.competence_month).slice(0, 7);
      if (monthCutoff && m > monthCutoff) continue;
      const cur = ensure(m);
      const v = Number(p.planned_value || 0);
      if (p.kind === "revenue") cur.receitaPrev += v;
      else if (p.kind === "cost") cur.custoPrev += v;
    }

    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      if (!passes(e.contract_project_id)) continue;
      const m = normalizeYearMonth(e.competence ?? e.competence_date);
      if (!m) continue;
      if (monthCutoff && m > monthCutoff) continue;
      ensure(m).custoReal += Number(e.cost_value || 0);
    }

    for (const r of revenues ?? []) {
      if (!passes(r.project_id)) continue;
      const m = String(r.competence_month).slice(0, 7);
      if (monthCutoff && m > monthCutoff) continue;
      ensure(m).receitaReal += Number(r.revenue_actual || 0);
    }

    return Array.from(monthMap.values())
      .map((m) => ({ ...m, margemReal: m.receitaReal - m.custoReal }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [planned, entries, revenues, scoped.isConsolidatedCompany, scopedIdSet, monthCutoff]);

  // ============ Monthly series — INDIVIDUAL POR CONTRATO ============
  // Fonte única de verdade: financial_drg_lines (Budget = planned_value, Budget_Acomp = actual_value)
  // Usa SOMENTE as linhas-resumo do DRG para evitar dupla contagem:
  //   - Receita Prev/Real ← RECEITA_LIQUIDA (fallback: RECEITA_BRUTA, REC_LIQUIDA, REC_BRUTA)
  //   - Custo  Prev/Real ← CUSTO_TOTAL (fallback: CUSTO_OPERACIONAL)
  //   - Margem Real      ← Receita Real - |Custo Real|
  const REVENUE_CODES = ["RECEITA_LIQUIDA", "RECEITA_BRUTA", "REC_LIQUIDA", "REC_BRUTA"];
  const COST_CODES = ["CUSTO_TOTAL", "CUSTO_OPERACIONAL"];

  const contractMonthlySeries = useMemo(() => {
    type Row = {
      month: string;
      receitaPrev: number; receitaReal: number;
      custoPrev: number;   custoReal: number;
      margemReal: number;
    };
    if (!isContractView || !contractId) return [] as Row[];

    // Agrupa por mês + code → pega só o melhor code disponível por categoria
    const byMonth = new Map<string, Map<string, { planned: number; actual: number }>>();
    for (const d of drgLines ?? []) {
      if (d.project_id !== contractId) continue;
      const code = String(d.line_code ?? "").toUpperCase();
      const m = String(d.competence_month).slice(0, 7);
      if (monthCutoff && m > monthCutoff) continue;
      const planned = Number(d.planned_value || 0);
      const actual = Number(d.actual_value || 0);
      if (!planned && !actual) continue;
      if (!byMonth.has(m)) byMonth.set(m, new Map());
      const codeMap = byMonth.get(m)!;
      const cur = codeMap.get(code) ?? { planned: 0, actual: 0 };
      cur.planned += planned;
      cur.actual += actual;
      codeMap.set(code, cur);
    }

    const pickFirst = (codeMap: Map<string, { planned: number; actual: number }>, codes: string[]) => {
      for (const c of codes) {
        const v = codeMap.get(c);
        if (v && (v.planned !== 0 || v.actual !== 0)) return v;
      }
      return { planned: 0, actual: 0 };
    };

    const rows: Row[] = [];
    for (const [month, codeMap] of byMonth) {
      const rev = pickFirst(codeMap, REVENUE_CODES);
      const cost = pickFirst(codeMap, COST_CODES);
      // Custo no DRG vem negativo (subtrai da receita) — normalizamos em valor absoluto para o gráfico
      const custoPrev = Math.abs(cost.planned);
      const custoReal = Math.abs(cost.actual);
      rows.push({
        month,
        receitaPrev: rev.planned,
        receitaReal: rev.actual,
        custoPrev,
        custoReal,
        margemReal: rev.actual - custoReal,
      });
    }

    return rows.sort((a, b) => a.month.localeCompare(b.month));
  }, [drgLines, isContractView, contractId, monthCutoff]);

  // ============ Empresa-only metrics ============
  const monthEntriesCount = useMemo(() => {
    return (entries ?? []).filter((e) => {
      if (e.is_excluded || e.is_duplicate) return false;
      const m = normalizeYearMonth(e.competence ?? e.competence_date);
      return m === month;
    }).length;
  }, [entries, month]);

  const activeContractsCount = useMemo(
    () => (contracts ?? []).filter((c) => c.status !== "inactive").length,
    [contracts],
  );

  // Top 5 contratos com maior desvio absoluto de resultado
  const topDeviations = useMemo(() => {
    return contractsData
      .filter((c) => c.hasActualData)
      .map((c) => ({
        ...c,
        deviation: c.netResultActual - c.netResultPlanned,
        absDeviation: Math.abs(c.netResultActual - c.netResultPlanned),
      }))
      .sort((a, b) => b.absDeviation - a.absDeviation)
      .slice(0, 5);
  }, [contractsData]);

  if (lb || le) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  // ============ Empty contract state ============
  if (isContractView && !contractId) {
    return (
      <div className="mx-auto w-full max-w-[1440px]">
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-2">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Selecione um contrato na barra acima para ver seus indicadores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================ EMPRESA VIEW ============================
  if (!isContractView) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-8">
        {/* Title */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Resumo executivo · Empresa</h1>
            <p className="text-xs text-muted-foreground">{showAllPeriods ? "Posição consolidada · Geral (todos os períodos)" : `Posição consolidada até ${monthLabel}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[11px]">
              Fontes: Baseline · Real Mensal · DRG · Receitas
            </Badge>
            {!kpis.hasActualData && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
                <AlertTriangle className="w-3 h-3" /> Sem realizado importado
              </Badge>
            )}
          </div>
        </header>

        {/* KPIs principais — 4 cards */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KpiBig
            icon={DollarSign} accent="blue"
            label="Receita Líquida"
            value={formatBRL(kpis.revenueActual)}
            sub={`Prev ${formatBRL(kpis.revenuePlanned)} · ${formatPct(kpis.executionRevenue, 0)} executado`}
            pending={!kpis.hasActualData}
          />
          <KpiBig
            icon={Wallet} accent="orange"
            label="Custo Total"
            value={formatBRL(kpis.totalCostActual)}
            sub={`Prev ${formatBRL(kpis.totalCostPlanned)} · ${formatPct(kpis.executionCost, 0)} consumido`}
            pending={!kpis.hasActualData}
          />
          <KpiBig
            icon={ArrowDownRight} accent="emerald"
            label="Resultado Líquido"
            value={formatBRL(kpis.netResultActual)}
            sub={`Prev ${formatBRL(kpis.netResultPlanned)}`}
            isNegative={kpis.netResultActual < 0}
            highlight
            pending={!kpis.hasActualData}
          />
          <KpiBig
            icon={Target} accent="emerald"
            label="Margem Líquida"
            value={formatPct(kpis.netMarginPctActual, 1)}
            sub={`Prev ${formatPct(kpis.netMarginPctPlanned, 1)}`}
            isNegative={kpis.netMarginPctActual < 0}
            pending={!kpis.hasActualData}
          />
        </section>

        {/* Comparação visual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Previsto x Real — Evolução mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySeries.length === 0 ? (
              <EmptyState message="Sem dados de previsto ou realizado" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tickFormatter={formatMonthTick} />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    labelFormatter={(label) => formatMonthTick(label)}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="receitaPrev" name="Receita Prev." fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receitaReal" name="Receita Real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custoPrev" name="Custo Prev." fill="hsl(var(--destructive) / 0.4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custoReal" name="Custo Real" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="margemReal" name="Margem Real" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top desvios */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Principais desvios de resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topDeviations.length === 0 ? (
              <EmptyState message="Sem realizado para calcular desvios" />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left py-2 px-4">Contrato</th>
                    <th className="text-right py-2 px-4">Resultado prev.</th>
                    <th className="text-right py-2 px-4">Resultado real</th>
                    <th className="text-right py-2 px-4">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {topDeviations.map((c) => (
                    <tr key={c.projectId} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-4">
                        <div className="font-medium">{c.projectName}</div>
                        {c.client && <div className="text-xs text-muted-foreground">{c.client}</div>}
                      </td>
                      <td className="text-right py-2 px-4 tabular-nums">{formatBRL(c.netResultPlanned)}</td>
                      <td className={cn("text-right py-2 px-4 tabular-nums", c.netResultActual >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {formatBRL(c.netResultActual)}
                      </td>
                      <td className={cn("text-right py-2 px-4 tabular-nums font-medium", c.deviation >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {c.deviation >= 0 ? "+" : ""}{formatBRL(c.deviation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================ CONTRATO VIEW ============================
  // Renderizado em sub-componente para usar hooks dedicados (useContractResults,
  // metadata, OS) sem misturar com a empresa view.
  return (
    <ContractDashboardView
      contractId={contractId!}
      competenceMonth={competenceMonth}
      showAllPeriods={showAllPeriods}
      monthLabel={monthLabel}
      activeContract={activeContract}
    />
  );
};

// ============================================================================
// CONTRACT DASHBOARD VIEW — usa contract_results (canonical) + DRG (OS, Receita
// Bruta, Impostos) + metadata. Mesma fonte de dados do Acompanhamento Executivo.
// ============================================================================
interface ContractDashboardViewProps {
  contractId: string;
  competenceMonth: string;
  showAllPeriods: boolean;
  monthLabel: string;
  activeContract: ReturnType<typeof useFinancialContracts>["data"] extends (infer T)[] | undefined
    ? T | null
    : null;
}

const ContractDashboardView = ({
  contractId,
  competenceMonth,
  showAllPeriods,
  monthLabel,
  activeContract,
}: ContractDashboardViewProps) => {
  // 1. Resultados canonicalmente calculados (VL, CO, MB, TA, RL, ML%)
  const { results } = useContractResults(contractId);

  // 2. DRG lines — para extrair OS, RECEITA_BRUTA e IMPOSTOS por mês
  const { data: drgRows } = useQuery({
    queryKey: ["dashboard-contract-drg", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_drg_lines")
        .select("competence_month, line_code, planned_value, actual_value")
        .eq("project_id", contractId)
        .in("line_code", ["OS", "RECEITA_BRUTA", "REC_BRUTA", "IMPOSTOS"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Metadata do contrato
  const { data: metadata } = useQuery({
    queryKey: ["dashboard-contract-metadata", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_contract_metadata")
        .select(
          "contract_total_value, contract_start_date, contract_end_date, measurement_modality, responsible, client_name, contract_number, specialty",
        )
        .eq("project_id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ----- Indexa OS, REC_BRUTA, IMPOSTOS por mês (YYYY-MM) -----
  type DrgPick = { planned: number; actual: number };
  const drgByMonth = useMemo(() => {
    const map = new Map<string, { os: DrgPick; recBruta: DrgPick; impostos: DrgPick }>();
    const ensure = (m: string) => {
      let cur = map.get(m);
      if (!cur) {
        cur = {
          os: { planned: 0, actual: 0 },
          recBruta: { planned: 0, actual: 0 },
          impostos: { planned: 0, actual: 0 },
        };
        map.set(m, cur);
      }
      return cur;
    };
    for (const r of drgRows ?? []) {
      const m = String(r.competence_month).slice(0, 7);
      const planned = Number(r.planned_value || 0);
      const actual = Number(r.actual_value || 0);
      const cur = ensure(m);
      if (r.line_code === "OS") {
        cur.os.planned += planned;
        cur.os.actual += actual;
      } else if (r.line_code === "RECEITA_BRUTA" || r.line_code === "REC_BRUTA") {
        // pega o que tiver (sem somar duplicado se existirem ambos os códigos)
        if (!cur.recBruta.planned && planned) cur.recBruta.planned = planned;
        if (!cur.recBruta.actual && actual) cur.recBruta.actual = actual;
      } else if (r.line_code === "IMPOSTOS") {
        cur.impostos.planned += planned;
        cur.impostos.actual += actual;
      }
    }
    return map;
  }, [drgRows]);

  // ----- KPIs do MÊS SELECIONADO -----
  const monthYm = competenceMonth.slice(0, 7);
  const monthRow = useMemo(
    () => results.find((r) => r.competence_month.slice(0, 7) === monthYm) ?? null,
    [results, monthYm],
  );
  const monthDrg = drgByMonth.get(monthYm);
  const monthOsAbs = Math.abs(monthDrg?.os.actual ?? 0);
  const monthOsAbsPlanned = Math.abs(monthDrg?.os.planned ?? 0);
  const monthCtActual = (monthRow?.co_actual ?? 0) + monthOsAbs + (monthRow?.ta_actual ?? 0);
  const monthCtPlanned = (monthRow?.co_planned ?? 0) + monthOsAbsPlanned + (monthRow?.ta_planned ?? 0);

  const kpisMonth = {
    vlActual: monthRow?.vl_actual ?? 0,
    vlPlanned: monthRow?.vl_planned ?? 0,
    ctActual: monthCtActual,
    ctPlanned: monthCtPlanned,
    rlActual: monthRow?.rl_actual ?? 0,
    rlPlanned: monthRow?.rl_planned ?? 0,
    mlActualPct: monthRow?.ml_actual_pct ?? 0,
    mlPlannedPct: monthRow?.ml_planned_pct ?? 0,
  };

  const hasMonthRevenue = Math.abs(kpisMonth.vlActual) > 0.005;
  const hasAnyData = results.length > 0;

  // ----- Totais ANUAIS (todos os meses do ano vigente OU "geral do contrato") -----
  const targetYear = Number(monthYm.slice(0, 4));
  const annualResults = useMemo(() => {
    if (showAllPeriods) return results;
    return results.filter((r) => r.competence_month.startsWith(`${targetYear}-`));
  }, [results, showAllPeriods, targetYear]);

  const annual = useMemo(() => {
    const acc = {
      recBrutaPlanned: 0, recBrutaActual: 0,
      impostosPlanned: 0, impostosActual: 0,
      vlPlanned: 0, vlActual: 0,
      coPlanned: 0, coActual: 0,
      mbPlanned: 0, mbActual: 0,
      osPlanned: 0, osActual: 0,
      taPlanned: 0, taActual: 0,
      rlPlanned: 0, rlActual: 0,
    };
    for (const r of annualResults) {
      const m = r.competence_month.slice(0, 7);
      const drg = drgByMonth.get(m);
      acc.vlPlanned += r.vl_planned; acc.vlActual += r.vl_actual;
      acc.coPlanned += r.co_planned; acc.coActual += r.co_actual;
      acc.mbPlanned += r.mb_planned; acc.mbActual += r.mb_actual;
      acc.taPlanned += r.ta_planned; acc.taActual += r.ta_actual;
      acc.rlPlanned += r.rl_planned; acc.rlActual += r.rl_actual;
      if (drg) {
        acc.recBrutaPlanned += drg.recBruta.planned;
        acc.recBrutaActual += drg.recBruta.actual;
        acc.impostosPlanned += Math.abs(drg.impostos.planned);
        acc.impostosActual += Math.abs(drg.impostos.actual);
        acc.osPlanned += Math.abs(drg.os.planned);
        acc.osActual += Math.abs(drg.os.actual);
      }
    }
    const mlPlannedPct = acc.vlPlanned > 0 ? (acc.rlPlanned / acc.vlPlanned) * 100 : 0;
    const mlActualPct = acc.vlActual > 0 ? (acc.rlActual / acc.vlActual) * 100 : 0;
    return { ...acc, mlPlannedPct, mlActualPct };
  }, [annualResults, drgByMonth]);

  // ----- Série mensal para o gráfico (apenas meses com RB Prev OU RB Real > 0) -----
  const chartSeries = useMemo(() => {
    type Row = {
      month: string;
      rbPrev: number | null;
      rbReal: number | null;
      mlPrev: number | null;
      mlReal: number | null;
    };
    const rows: Row[] = [];
    for (const r of results) {
      const m = r.competence_month.slice(0, 7);
      const drg = drgByMonth.get(m);
      const rbPrev = drg?.recBruta.planned ?? r.vl_planned;
      const rbReal = drg?.recBruta.actual ?? r.vl_actual;
      // Só plota mês com receita prevista OU real
      if (!(rbPrev > 0 || rbReal > 0)) continue;
      rows.push({
        month: m,
        rbPrev: rbPrev > 0 ? rbPrev : null,
        rbReal: rbReal > 0 ? rbReal : null,
        mlPrev: r.vl_planned > 0 ? r.ml_planned_pct : null,
        mlReal: r.vl_actual > 0 ? r.ml_actual_pct : null,
      });
    }
    return rows.sort((a, b) => a.month.localeCompare(b.month));
  }, [results, drgByMonth]);

  // ----- Render -----
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8">
      {/* Title */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate">
            {activeContract?.project_name ?? "Contrato"}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {activeContract?.client && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {activeContract.client}
              </span>
            )}
            <span>· {monthLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!hasMonthRevenue && hasAnyData && !showAllPeriods && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
              <AlertTriangle className="w-3 h-3" /> Dados parciais — sem receita lançada no mês
            </Badge>
          )}
          {!hasAnyData && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
              <AlertTriangle className="w-3 h-3" /> Sem realizado importado
            </Badge>
          )}
        </div>
      </header>

      {/* KPIs DO MÊS — 4 cards */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {(() => {
          const noBudgetVL = kpisMonth.vlPlanned === 0;
          const noBudgetCT = kpisMonth.ctPlanned === 0;
          const noBudgetRL = kpisMonth.rlPlanned === 0;
          const noBudgetML = kpisMonth.vlPlanned === 0;
          const subPrev = (v: number, none: boolean) => (none ? "Sem budget" : `Prev ${formatBRL(v)}`);
          const subPrevPct = (v: number, none: boolean) => (none ? "Sem budget" : `Prev ${formatPct(v, 1)}`);
          const noRevenue = !hasMonthRevenue && !showAllPeriods;
          return (
            <>
              <KpiBig
                icon={DollarSign} accent="blue"
                label="Receita Líquida"
                value={noRevenue ? "—" : formatBRL(kpisMonth.vlActual)}
                sub={subPrev(kpisMonth.vlPlanned, noBudgetVL)}
                pendingLabel={noRevenue ? "Sem receita" : undefined}
                pending={noRevenue}
              />
              <KpiBig
                icon={Wallet} accent="orange"
                label="Custo Total"
                value={formatBRL(kpisMonth.ctActual)}
                sub={subPrev(kpisMonth.ctPlanned, noBudgetCT)}
              />
              <KpiBig
                icon={ArrowDownRight} accent="emerald"
                label="Resultado Líquido"
                value={noRevenue ? "—" : formatBRL(kpisMonth.rlActual)}
                sub={subPrev(kpisMonth.rlPlanned, noBudgetRL)}
                isNegative={!noRevenue && kpisMonth.rlActual < 0}
                highlight
                pendingLabel={noRevenue ? "Sem receita" : undefined}
                pending={noRevenue}
              />
              <KpiBig
                icon={Target} accent="emerald"
                label="Margem Líquida"
                value={noRevenue ? "—" : formatPct(kpisMonth.mlActualPct, 1)}
                sub={subPrevPct(kpisMonth.mlPlannedPct, noBudgetML)}
                isNegative={!noRevenue && kpisMonth.mlActualPct < 0}
                pendingLabel={noRevenue ? "Sem receita" : undefined}
                pending={noRevenue}
              />
            </>
          );
        })()}
      </section>

      {/* Dados do contrato */}
      {(activeContract || metadata) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados do contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ContractInfoField icon={Building2} label="Cliente" value={metadata?.client_name ?? activeContract?.client ?? "—"} />
              <ContractInfoField icon={Hash} label="Código (DRG)" value={activeContract?.dept_code ?? "—"} />
              <ContractInfoField icon={User} label="Responsável" value={metadata?.responsible ?? "—"} />
              <ContractInfoField
                icon={DollarSign}
                label="Valor total"
                value={metadata?.contract_total_value ? formatBRL(Number(metadata.contract_total_value)) : "—"}
              />
              <ContractInfoField
                icon={Calendar}
                label="Data início"
                value={metadata?.contract_start_date ? format(new Date(`${metadata.contract_start_date}T00:00:00`), "dd/MM/yyyy") : "—"}
              />
              <ContractInfoField icon={FileText} label="Modalidade" value={metadata?.measurement_modality ?? "—"} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico mensal — Previsto x Real (redesign) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Previsto x Real — {activeContract?.project_name ?? "Contrato"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Receita Bruta (barras) e Margem Líquida % (linhas) por mês
          </p>
        </CardHeader>
        <CardContent>
          {chartSeries.length === 0 ? (
            <EmptyState message="Sem histórico para este contrato. Importe o Budget e o Budget_Acomp." />
          ) : (
            <ResponsiveContainer width="100%" height={320} minHeight={300}>
              <ComposedChart data={chartSeries} barCategoryGap="30%" margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthTick} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[-50, 100]}
                  ticks={[-50, -25, 0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ReferenceLine yAxisId="right" y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => formatMonthTick(label)}
                  formatter={(v: number | null, name: string) => {
                    if (v == null) return ["—", name];
                    if (name.includes("%")) return [`${v.toFixed(1)}%`, name];
                    return [formatBRL(v), name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  iconSize={10}
                />
                <Bar yAxisId="left" dataKey="rbPrev" name="RB Prevista" fill="#4A90D9" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="rbReal" name="RB Realizada" fill="#1E3A5F" radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mlPrev"
                  name="ML% Prevista"
                  stroke="#F5A623"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: "#F5A623" }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mlReal"
                  name="ML% Real"
                  stroke="#27AE60"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#27AE60" }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Resumo financeiro detalhado — totais ANUAIS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Resumo financeiro do contrato
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {showAllPeriods ? "(geral do contrato)" : `(ano ${targetYear})`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="border-b text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left py-2 px-4">Linha</th>
                <th className="text-right py-2 px-4">Previsto</th>
                <th className="text-right py-2 px-4">Realizado</th>
                <th className="text-right py-2 px-4">Desvio</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Receita Bruta" planned={annual.recBrutaPlanned} actual={annual.recBrutaActual} />
              <SummaryRow label="(−) Impostos" planned={annual.impostosPlanned} actual={annual.impostosActual} costlike />
              <SummaryRow label="Receita Líquida" planned={annual.vlPlanned} actual={annual.vlActual} bold />
              <SummaryRow label="(−) Custo Operacional" planned={annual.coPlanned} actual={annual.coActual} costlike />
              <SummaryRow label="Margem Bruta" planned={annual.mbPlanned} actual={annual.mbActual} bold />
              <SummaryRow label="(−) Outras Saídas" planned={annual.osPlanned} actual={annual.osActual} costlike />
              <SummaryRow label="(−) Taxa ADM" planned={annual.taPlanned} actual={annual.taActual} costlike />
              <SummaryRow label="Resultado Líquido" planned={annual.rlPlanned} actual={annual.rlActual} bold />
              <SummaryPctRow
                label="Margem Líquida %"
                plannedPct={annual.mlPlannedPct}
                actualPct={annual.mlActualPct}
              />
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

// ----- Campo informativo do bloco "Dados do contrato" -----
const ContractInfoField = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-2 min-w-0">
    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-sm font-semibold truncate" title={value}>{value}</p>
    </div>
  </div>
);

// ----- Linha de % (margem líquida em pontos percentuais) -----
const SummaryPctRow = ({
  label,
  plannedPct,
  actualPct,
}: {
  label: string;
  plannedPct: number;
  actualPct: number;
}) => {
  const diff = actualPct - plannedPct;
  const isFavorable = diff >= 0;
  return (
    <tr className="border-b font-semibold bg-muted/20">
      <td className="py-2 px-4">{label}</td>
      <td className="text-right py-2 px-4 tabular-nums">{formatPct(plannedPct, 1)}</td>
      <td className="text-right py-2 px-4 tabular-nums">{formatPct(actualPct, 1)}</td>
      <td className={cn(
        "text-right py-2 px-4 tabular-nums",
        plannedPct === 0 && actualPct === 0 ? "text-muted-foreground" : isFavorable ? "text-emerald-600" : "text-destructive",
      )}>
        {diff >= 0 ? "+" : ""}{diff.toFixed(1)} p.p.
      </td>
    </tr>
  );
};


type AccentColor = "blue" | "orange" | "emerald";

const ACCENT_STYLES: Record<AccentColor, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
};

const KpiBig = ({ icon: Icon, label, value, sub, accent, highlight, isNegative, pending, pendingLabel }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: AccentColor;
  highlight?: boolean;
  isNegative?: boolean;
  pending?: boolean;
  pendingLabel?: string;
}) => {
  const styles = ACCENT_STYLES[accent];
  return (
    <Card className={cn("transition-all hover:shadow-md", highlight && "border-primary/30 shadow-sm")}>
      <CardContent className="p-5 h-full flex flex-col gap-4 min-h-[140px]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", styles.bg, styles.text)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-auto space-y-1">
          {pending ? (
            <>
              <p className="text-2xl font-bold text-muted-foreground tabular-nums">—</p>
              <p className="text-xs text-amber-700">{pendingLabel ?? "Pendente"} · {sub}</p>
            </>
          ) : (
            <>
              <p className={cn("text-lg lg:text-xl font-bold tabular-nums leading-none whitespace-nowrap", isNegative ? "text-destructive" : "text-foreground")}>
                {value}
              </p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MiniStat = ({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) => (
  <Card className="bg-muted/30 border-muted">
    <CardContent className="p-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center shrink-0 text-muted-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className={cn(
          "text-sm font-semibold tabular-nums truncate",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-destructive",
        )}>
          {value}
        </p>
      </div>
    </CardContent>
  </Card>
);

const SummaryRow = ({ label, planned, actual, costlike, bold }: {
  label: string;
  planned: number;
  actual: number;
  costlike?: boolean;
  bold?: boolean;
}) => {
  // Sign convention:
  //   - Receita (RB, VL, MB, RL): values stored positive; desvio = real − previsto; verde se > 0
  //   - Custo (TI, CO, OS, TA): values stored positive in DB; exibimos como negativos
  //     com prefixo (–); desvio = |previsto| − |real| (quanto economizou); verde se > 0
  const plannedAbs = Math.abs(planned);
  const actualAbs = Math.abs(actual);
  const diff = costlike ? plannedAbs - actualAbs : actual - planned;
  const isFavorable = diff > 0;
  const isNeutral = plannedAbs === 0 && actualAbs === 0;

  const renderValue = (absV: number, raw: number) => {
    if (costlike) return absV === 0 ? formatBRL(0) : `-${formatBRL(absV)}`;
    return formatBRL(raw);
  };

  return (
    <tr className={cn("border-b hover:bg-muted/30", bold && "font-semibold bg-muted/20")}>
      <td className="py-2 px-4">{label}</td>
      <td className={cn("text-right py-2 px-4 tabular-nums", costlike && plannedAbs > 0 && "text-destructive")}>
        {renderValue(plannedAbs, planned)}
      </td>
      <td className={cn("text-right py-2 px-4 tabular-nums", costlike && actualAbs > 0 && "text-destructive")}>
        {renderValue(actualAbs, actual)}
      </td>
      <td className={cn(
        "text-right py-2 px-4 tabular-nums font-medium",
        isNeutral ? "text-muted-foreground" : isFavorable ? "text-emerald-600" : "text-destructive",
      )}>
        {diff >= 0 ? "+" : ""}{formatBRL(diff)}
      </td>
    </tr>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
    {message}
  </div>
);

export default FinanceiroDashboard;
