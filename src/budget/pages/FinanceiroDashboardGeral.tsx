import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Input } from "@budget/components/ui/input";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@budget/components/ui/dialog";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, Building2, Briefcase,
  Target, AlertTriangle, BarChart3, PieChart as PieIcon,
  Users, Search, Database, RotateCw, ChevronRight, X,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart,
} from "recharts";
import { cn } from "@budget/lib/utils";
import { formatBRL, formatPct, formatCompactBRL } from "@budget/lib/format";
import {
  useFinancialConsolidated,
  type ConsolidatedFilters,
  type ContractHealth,
  type ContractRanking,
} from "@budget/hooks/useFinancialConsolidated";
import { useQueryClient } from "@tanstack/react-query";
import { useContractCompetences, formatCompetenceShort } from "@budget/hooks/useContractCompetences";
import { SAUDE_LABEL, SAUDE_CLASS, type ContractSaude } from "@budget/hooks/useContractResults";
import { useConsolidatedFromResults } from "@budget/hooks/useConsolidatedFromResults";

interface KpiCardProps {
  label: string;
  value: string;
  fullValue?: string; // valor completo para tooltip (ex.: R$ 8.177.436,50)
  subtitle?: string;
  ytdNote?: string;
  badge?: { label: string; tone: "negative" | "neutral" };
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "positive" | "negative" | "primary" | "accent";
  valueMuted?: boolean;
  onClick?: () => void;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, { border: string; iconBg: string }> = {
  neutral:  { border: "border-border",       iconBg: "bg-muted text-muted-foreground" },
  positive: { border: "border-success/30",   iconBg: "bg-success/15 text-success" },
  negative: { border: "border-destructive/30", iconBg: "bg-destructive/15 text-destructive" },
  primary:  { border: "border-primary/30",   iconBg: "bg-primary/15 text-primary" },
  accent:   { border: "border-accent/30",    iconBg: "bg-accent/15 text-accent" },
};

const KpiCard = ({ label, value, fullValue, subtitle, ytdNote, badge, icon: Icon, tone = "neutral", valueMuted, onClick }: KpiCardProps) => {
  const t = toneStyles[tone];
  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        t.border,
        onClick && "cursor-pointer hover:border-primary/40",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              {badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-4",
                    badge.tone === "negative"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {badge.label}
                </Badge>
              )}
            </div>
            <p
              title={fullValue ?? value}
              className={cn(
                "text-base lg:text-lg font-bold tabular-nums whitespace-nowrap",
                valueMuted ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {value}
            </p>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            {ytdNote && <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">{ytdNote}</p>}
          </div>
          <div className={cn("p-2 rounded-lg flex-shrink-0", t.iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const healthBadge = (h: ContractHealth) => {
  const map: Record<ContractHealth, { label: string; className: string }> = {
    healthy:  { label: "Saudável", className: "bg-success/15 text-success border-success/30" },
    warning:  { label: "Atenção",  className: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400" },
    critical: { label: "Crítico",  className: "bg-destructive/15 text-destructive border-destructive/30" },
    stale:    { label: "Sem dados", className: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[h];
  return <Badge variant="outline" className={cn("text-[10px] font-medium", m.className)}>{m.label}</Badge>;
};

const FinanceiroDashboardGeral = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [topCostExpanded, setTopCostExpanded] = useState(false);
  const [scopeSort, setScopeSort] = useState<{ key: "client" | "isCorporate" | "costActual" | "marginActualPct" | "saude"; dir: "asc" | "desc" }>({ key: "costActual", dir: "desc" });
  const [scope, setScope] = useState<NonNullable<ConsolidatedFilters["scope"]>>("all");
  const [client, setClient] = useState<string>("all");
  const [competenceFrom, setCompetenceFrom] = useState<string>("");
  const [competenceTo, setCompetenceTo] = useState<string>("");
  const [drgGroup, setDrgGroup] = useState<string>("all");
  const [health, setHealth] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [evolutionContractId, setEvolutionContractId] = useState<string>("all");
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [filterNoRevenueOnly, setFilterNoRevenueOnly] = useState<boolean>(false);
  // Competência INDIVIDUAL por contrato (hierarquia: real → acomp → drg → planned)
  const { data: contractCompetences } = useContractCompetences();

  const filters: ConsolidatedFilters = useMemo(() => ({
    scope,
    client: client === "all" ? undefined : client,
    competenceFrom: competenceFrom || undefined,
    competenceTo: competenceTo || undefined,
    drgGroup: drgGroup === "all" ? undefined : drgGroup,
    health: health === "all" ? undefined : (health as ContractHealth),
    search: search.trim() || undefined,
  }), [scope, client, competenceFrom, competenceTo, drgGroup, health, search]);

  const {
    contractMonthMatrix, contractRanking, drgBreakdown, drgGroups,
    alerts, buildDrilldown, cacheInfo, isLoading: isLoadingLegacy,
  } = useFinancialConsolidated(filters);

  // === Nova fonte de verdade: contract_results (Etapas 1-2 já persistidas) ===
  const {
    isLoading: isLoadingResults,
    kpis: resultsKpis,
    ytd: resultsYtd,
    monthlySeries: resultsMonthlySeries,
    contracts: resultsContracts,
    clientRanking: resultsClientRanking,
    clients,
    rows: resultsRows,
    effectiveCompetence,
    latestAvailableCompetence,
  } = useConsolidatedFromResults({
    scope,
    client: client === "all" ? undefined : client,
    competenceFrom: competenceFrom || undefined,
    competenceTo: competenceTo || undefined,
    health: health === "all" ? undefined : (health as ContractSaude),
    search: search.trim() || undefined,
  });

  const isLoading = isLoadingLegacy || isLoadingResults;

  // === Mapeamento para nomes legados consumidos pelo restante da página ===
  // KPIs financeiros vêm de contract_results (fonte única de verdade).
  // Métricas operacionais (contratos ativos, backlog) seguem do hook legado.
  const kpis = useMemo(() => {
    const operationalContracts = resultsContracts.filter((c) => !c.isCorporate).length;
    const corporateContracts = resultsContracts.filter((c) => c.isCorporate).length;
    return {
      // financeiros (consolidado de contract_results)
      revenueActual: resultsKpis.revenueActual,
      revenuePlanned: resultsKpis.revenuePlanned,
      costActual: resultsKpis.costActual,
      costPlanned: resultsKpis.costPlanned,
      resultActual: resultsKpis.resultActual,
      resultPlanned: resultsKpis.resultPlanned,
      marginActualPct: resultsKpis.marginActualPct,
      marginPlannedPct: resultsKpis.marginPlannedPct,
      variance: resultsKpis.variance,
      // operacionais
      activeContracts: resultsKpis.contracts,
      operationalContracts,
      corporateContracts,
      monthsCount: resultsKpis.monthsCount,
      backlog: Math.max(0, resultsKpis.revenuePlanned - resultsKpis.revenueActual),
      burnRate: resultsKpis.costActual / Math.max(1, resultsKpis.monthsCount),
      ebitdaEstimated: resultsKpis.resultActual,
    };
  }, [resultsKpis, resultsContracts]);

  // Saúde por contrato (último mês com dado, conforme escopo + competência aplicados)
  const contractsSaude = useMemo(() => {
    const map: Record<string, { saude: ContractSaude; competence_month: string; ml_actual_pct: number }> = {};
    for (const c of resultsContracts) {
      map[c.projectId] = {
        saude: c.saude,
        competence_month: c.lastCompetence ?? "",
        ml_actual_pct: c.marginActualPct,
      };
    }
    return map;
  }, [resultsContracts]);

  // Resumo por cliente — agregação a partir dos contratos no escopo do mês.
  // Deduplica por nome do cliente (case-insensitive), conta apenas contratos ativos
  // do escopo atual e soma custo/receita do mês selecionado.
  const clientSummary = useMemo(() => {
    const map = new Map<
      string,
      { client: string; contracts: number; cost: number; revenue: number }
    >();
    for (const c of resultsContracts) {
      const name = (c.client || "—").trim();
      const key = name.toLocaleLowerCase("pt-BR");
      const cur = map.get(key) ?? { client: name, contracts: 0, cost: 0, revenue: 0 };
      cur.contracts += 1;
      cur.cost += c.costActual ?? 0;
      cur.revenue += c.revenueActual ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((c) => ({
        ...c,
        hasRevenue: c.revenue > 0,
        result: c.revenue > 0 ? c.revenue - c.cost : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [resultsContracts]);

  const clientSummaryTotals = useMemo(
    () => ({
      clients: clientSummary.length,
      contracts: clientSummary.reduce((s, c) => s + c.contracts, 0),
    }),
    [clientSummary],
  );

  const palette = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];

  // Escala financeira inteligente: k / M / B
  const compactBRL = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const top10Contracts = useMemo(() => contractRanking.slice(0, 10), [contractRanking]);

  // Top contratos por custo real do mês (filtrado pelo escopo + competência atuais)
  const topCostRanking = useMemo(
    () => [...contractRanking].filter((c) => c.cost > 0).sort((a, b) => b.cost - a.cost),
    [contractRanking],
  );
  const topCostTotal = useMemo(
    () => topCostRanking.reduce((s, c) => s + c.cost, 0),
    [topCostRanking],
  );
  const topCostMax = topCostRanking[0]?.cost ?? 0;
  const topCostVisible = useMemo(
    () => (topCostExpanded ? topCostRanking : topCostRanking.slice(0, 8)),
    [topCostRanking, topCostExpanded],
  );
  const topCostCompetenceLabel = effectiveCompetence?.from
    ? formatCompetenceShort(effectiveCompetence.from + "-01")
    : "";

  // Tabela "Contratos no escopo" — ordenação dinâmica
  const SAUDE_RANK: Record<string, number> = { saudavel: 0, atencao: 1, critico: 2, sem_dados: 3 };
  // Contratos sem receita lançada no mês (revenueActual = 0 mas com algum custo ou planejado)
  const noRevenueContracts = useMemo(
    () => resultsContracts.filter((c) => (c.revenueActual ?? 0) <= 0 && ((c.costActual ?? 0) > 0 || (c.revenuePlanned ?? 0) > 0)),
    [resultsContracts],
  );
  const noRevenueCount = noRevenueContracts.length;

  const scopeContractsSorted = useMemo(() => {
    const base = filterNoRevenueOnly
      ? resultsContracts.filter((c) => (c.revenueActual ?? 0) <= 0)
      : [...resultsContracts];
    const arr = [...base];
    const { key, dir } = scopeSort;
    const mult = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (key === "client") { av = a.client || ""; bv = b.client || ""; return av.toString().localeCompare(bv.toString()) * mult; }
      if (key === "isCorporate") { av = a.isCorporate ? 1 : 0; bv = b.isCorporate ? 1 : 0; }
      if (key === "costActual") { av = a.costActual; bv = b.costActual; }
      if (key === "marginActualPct") {
        av = a.revenueActual > 0 ? a.marginActualPct : Number.NEGATIVE_INFINITY;
        bv = b.revenueActual > 0 ? b.marginActualPct : Number.NEGATIVE_INFINITY;
      }
      if (key === "saude") { av = SAUDE_RANK[a.saude] ?? 9; bv = SAUDE_RANK[b.saude] ?? 9; }
      return ((av as number) - (bv as number)) * mult;
    });
    return arr;
  }, [resultsContracts, scopeSort, filterNoRevenueOnly]);

  const toggleScopeSort = (key: typeof scopeSort.key) => {
    setScopeSort((s) => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "client" ? "asc" : "desc" });
  };

  const SAUDE_DOT: Record<string, string> = {
    saudavel: "bg-success",
    atencao: "bg-warning",
    critico: "bg-destructive",
    sem_dados: "bg-muted-foreground/40",
  };


  // Série mensal (RB Prev/Real + ML% Prev/Real) — fonte: contract_results
  // Quando "Consolidado" (all) → usa monthlySeries do hook (já agregado).
  // Quando contrato específico → filtra rows por project_id e agrega no mês.
  const evolutionSeries = useMemo(() => {
    type Pt = {
      label: string;
      month: string;
      revenuePlanned: number;
      revenueActual: number;
      costPlanned: number;
      costActual: number;
      marginPlannedPct: number | null;
      marginActualPct: number | null;
    };
    const isAll = evolutionContractId === "all";
    let list: Pt[];
    if (isAll) {
      list = resultsMonthlySeries.map<Pt>((m) => ({
        label: m.label,
        month: m.month,
        revenuePlanned: m.revenuePlanned,
        revenueActual: m.revenueActual,
        costPlanned: m.costPlanned,
        costActual: m.costActual,
        marginPlannedPct: m.marginPlannedPct,
        marginActualPct: m.marginActualPct,
      }));
    } else {
      // Contrato específico
      const map = new Map<string, Pt>();
      const PT_LABEL = (m: string) => {
        const [y, mm] = m.split("-").map(Number);
        if (!y || !mm) return m;
        return new Date(y, mm - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
      };
      for (const r of resultsRows) {
        if (r.project_id !== evolutionContractId) continue;
        const mk = r.competence_month.slice(0, 7);
        let p = map.get(mk);
        if (!p) {
          p = { label: PT_LABEL(mk), month: mk, revenuePlanned: 0, revenueActual: 0, costPlanned: 0, costActual: 0, marginPlannedPct: null, marginActualPct: null };
          map.set(mk, p);
        }
        p.revenuePlanned += Number(r.vl_planned || 0);
        p.revenueActual += Number(r.vl_actual || 0);
        p.costPlanned += Number(r.co_planned || 0);
        p.costActual += Number(r.co_actual || 0);
      }
      list = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }
    // Filtro de período: ago/25 → dez/26 + sanity cap (descarta valores corrompidos > R$ 30M/mês)
    const MIN_MONTH = "2025-08";
    const MAX_MONTH = "2026-12";
    const SANITY_CAP = 30_000_000;
    // Sanitização: descarta valores absurdos e trata custos negativos (bug de dados) como 0
    const sanitizeRevenue = (v: number) => (Math.abs(v) > SANITY_CAP ? 0 : Math.max(0, v));
    const sanitizeCost = (v: number) => {
      if (Math.abs(v) > SANITY_CAP) return 0;
      // co_planned/co_actual nunca devem ser negativos — sinal indica erro de origem
      return v < 0 ? 0 : v;
    };
    const cleaned = list
      .filter((p) => p.month >= MIN_MONTH && p.month <= MAX_MONTH)
      .map((p) => ({
        ...p,
        revenuePlanned: sanitizeRevenue(p.revenuePlanned),
        revenueActual: sanitizeRevenue(p.revenueActual),
        costPlanned: sanitizeCost(p.costPlanned),
        costActual: sanitizeCost(p.costActual),
      }));
    // Recalcular margens — só calcula quando há receita E custo (>0); evita "100%" falso
    const clampPct = (v: number | null) => {
      if (v === null || !Number.isFinite(v)) return null;
      return Math.max(-50, Math.min(100, v));
    };
    cleaned.forEach((p) => {
      const hasPlanned = p.revenuePlanned > 0 && p.costPlanned > 0;
      const hasActual = p.revenueActual > 0 && p.costActual > 0;
      const mp = hasPlanned ? ((p.revenuePlanned - p.costPlanned) / p.revenuePlanned) * 100 : null;
      const ma = hasActual ? ((p.revenueActual - p.costActual) / p.revenueActual) * 100 : null;
      p.marginPlannedPct = clampPct(mp);
      p.marginActualPct = clampPct(ma);
    });
    return cleaned;
  }, [evolutionContractId, resultsMonthlySeries, resultsRows]);

  // Lista de contratos para o seletor (ordem alfabética por cliente · contrato)
  const evolutionContractOptions = useMemo(() => {
    return [...resultsContracts]
      .map((c) => ({ projectId: c.projectId, name: c.name, client: c.client }))
      .sort((a, b) => `${a.client} ${a.name}`.localeCompare(`${b.client} ${b.name}`, "pt-BR"));
  }, [resultsContracts]);

  const evolutionContractLabel = useMemo(() => {
    if (evolutionContractId === "all") return "Consolidado · Todos os contratos";
    const c = resultsContracts.find((x) => x.projectId === evolutionContractId);
    return c ? `${c.client} · ${c.name}` : "—";
  }, [evolutionContractId, resultsContracts]);

  // Tooltip do gráfico combinado
  const EvolutionComboTooltip = ({
    active, payload, label,
  }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string; payload?: Record<string, number | null> }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload ?? {};
    const rp = Number(row.revenuePlanned ?? 0);
    const ra = Number(row.revenueActual ?? 0);
    const ca = Number(row.costActual ?? 0);
    const desvio = ra - rp;
    const mp = row.marginPlannedPct;
    const ma = row.marginActualPct;
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur shadow-xl p-3 min-w-[240px] text-xs">
        <p className="font-bold text-foreground capitalize mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-muted-foreground">RB Prev.</span>
          <span className="text-right tabular-nums">{formatBRL(rp)}</span>
          <span className="text-muted-foreground">RB Real</span>
          <span className="text-right tabular-nums font-semibold">{formatBRL(ra)}</span>
          <span className="text-muted-foreground">Desvio</span>
          <span className={cn("text-right tabular-nums font-semibold", desvio >= 0 ? "text-success" : "text-destructive")}>
            {desvio >= 0 ? "+" : ""}{formatBRL(desvio)}
          </span>
          {mp != null && (
            <>
              <span className="text-muted-foreground">ML% Prev.</span>
              <span className="text-right tabular-nums">{formatPct(Number(mp), 1)}</span>
            </>
          )}
          {ma != null && (
            <>
              <span className="text-muted-foreground">ML% Real</span>
              <span className={cn("text-right tabular-nums font-semibold", Number(ma) >= 0 ? "text-success" : "text-destructive")}>
                {formatPct(Number(ma), 1)}
              </span>
            </>
          )}
          <span className="text-muted-foreground pt-1 border-t border-border/40 mt-1">Custo Real</span>
          <span className="text-right tabular-nums pt-1 border-t border-border/40 mt-1">{formatBRL(ca)}</span>
        </div>
      </div>
    );
  };


  const drilldown = useMemo(() => (drillId ? buildDrilldown(drillId) : null), [drillId, buildDrilldown]);
  const drillContract = useMemo<ContractRanking | undefined>(
    () => contractRanking.find((c) => c.projectId === drillId),
    [drillId, contractRanking],
  );

  // Tooltip executivo reutilizável (estilo Power BI)
  type ExecPayload = { payload: ContractRanking };
  const ExecutiveContractTooltip = ({ active, payload }: { active?: boolean; payload?: ExecPayload[] }) => {
    if (!active || !payload?.length) return null;
    const c = payload[0].payload;
    const healthLabel = { healthy: "Saudável", warning: "Atenção", critical: "Crítico", stale: "Sem dados" }[c.health];
    const healthColor = { healthy: "text-success", warning: "text-amber-500", critical: "text-destructive", stale: "text-muted-foreground" }[c.health];
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur shadow-xl p-3 min-w-[260px] text-xs">
        <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-border/60">
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{c.client}</p>
            <p className="text-[10px] text-muted-foreground truncate">Contrato: {c.name}</p>
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", healthColor)}>{healthLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <span className="text-muted-foreground">Receita Prev.</span>
          <span className="text-right tabular-nums">{formatBRL(c.revenuePlanned)}</span>
          <span className="text-muted-foreground">Receita Real</span>
          <span className="text-right tabular-nums font-semibold text-primary">{formatBRL(c.revenue)}</span>
          <span className="text-muted-foreground">Custo Prev.</span>
          <span className="text-right tabular-nums">{formatBRL(c.costPlanned)}</span>
          <span className="text-muted-foreground">Custo Real</span>
          <span className="text-right tabular-nums font-semibold text-destructive">{formatBRL(c.cost)}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-border/60 grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-muted-foreground">Resultado</span>
          <span className={cn("text-right tabular-nums font-bold", c.result >= 0 ? "text-success" : "text-destructive")}>
            {formatBRL(c.result)}
          </span>
          <span className="text-muted-foreground">Margem</span>
          <span className={cn("text-right tabular-nums font-bold", c.marginPct >= 0 ? "text-success" : "text-destructive")}>
            {formatPct(c.marginPct, 1)}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground italic">Clique para abrir detalhes →</p>
      </div>
    );
  };

  // Tooltip executivo para série mensal
  const ExecutiveMonthlyTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur shadow-xl p-3 min-w-[200px] text-xs">
        <p className="font-bold text-foreground mb-2 capitalize">{label}</p>
        <div className="space-y-1">
          {payload.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className="text-muted-foreground">{p.name}</span>
              </div>
              <span className="tabular-nums font-semibold">{formatBRL(Number(p.value))}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tooltip DRG
  const ExecutiveDrgTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { group: string; value: number; pct: number } }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-popover/95 backdrop-blur shadow-xl p-3 min-w-[180px] text-xs">
        <p className="font-bold text-foreground mb-1.5">{d.group}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Custo</span>
          <span className="tabular-nums font-semibold">{formatBRL(d.value)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">% do total</span>
          <span className="tabular-nums font-bold text-primary">{formatPct(d.pct, 1)}</span>
        </div>
      </div>
    );
  };

  const resultTone = kpis.resultActual >= 0 ? "positive" : "negative";
  const varianceTone = kpis.variance >= 0 ? "positive" : "negative";

  const clearFilters = () => {
    setScope("all"); setClient("all"); setCompetenceFrom(""); setCompetenceTo("");
    setDrgGroup("all"); setHealth("all"); setSearch("");
  };

  const refresh = () => {
    // Hooks reais usados pelo dashboard
    qc.invalidateQueries({ queryKey: ["consolidated-projects-meta"] });
    qc.invalidateQueries({ queryKey: ["consolidated-planned-entries"] });
    qc.invalidateQueries({ queryKey: ["consolidated-from-results:rows"] });
    qc.invalidateQueries({ queryKey: ["consolidated-from-results:latest-real-competence"] });
    qc.invalidateQueries({ queryKey: ["consolidated-from-results:projects"] });
    qc.invalidateQueries({ queryKey: ["contract-competences"] });
    // Legados (caso outros componentes/abas dependam)
    qc.invalidateQueries({ queryKey: ["financial_entries"] });
    qc.invalidateQueries({ queryKey: ["contract_revenues"] });
    qc.invalidateQueries({ queryKey: ["financial_baselines"] });
  };

  const activeFiltersCount = [
    scope !== "all", client !== "all", !!competenceFrom, !!competenceTo,
    drgGroup !== "all", health !== "all", !!search,
  ].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className="text-xs uppercase tracking-wide">Executivo</Badge>
              {cacheInfo.enabled && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Database className="w-3 h-3" /> Cache híbrido ativo
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Geral — Megasteam</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão executiva consolidada de todos os contratos + estrutura corporativa.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isLoading && (
              <Badge variant="outline" className="text-[11px] gap-1.5 h-7 px-2.5">
                <Briefcase className="w-3 h-3" />
                {kpis.activeContracts} contratos ativos · {kpis.operationalContracts} oper. + {kpis.corporateContracts} corp.
              </Badge>
            )}
            {effectiveCompetence?.from && (
              <Badge variant="secondary" className="text-[11px] h-7 px-2.5">
                Competência: {effectiveCompetence.from === effectiveCompetence.to
                  ? formatCompetenceShort(effectiveCompetence.from + "-01")
                  : `${formatCompetenceShort(effectiveCompetence.from + "-01")} → ${formatCompetenceShort((effectiveCompetence.to ?? effectiveCompetence.from) + "-01")}`}
                {!competenceFrom && !competenceTo && latestAvailableCompetence && (
                  <span className="ml-1.5 text-muted-foreground/80">· auto · último CUSTOS_MES</span>
                )}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
              <RotateCw className={cn("w-4 h-4 mr-1.5", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Alertas executivos removidos a pedido do usuário */}

        {/* Filtros avançados */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Filtros {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{activeFiltersCount} ativo(s)</Badge>}
              </CardTitle>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  <X className="w-3 h-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Escopo</label>
                <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tudo (Operacional + Corporativo)</SelectItem>
                    <SelectItem value="operational">Apenas Operacional</SelectItem>
                    <SelectItem value="corporate">Apenas Corporativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Cliente</label>
                <Select value={client} onValueChange={setClient}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Categoria DRG</label>
                <Select value={drgGroup} onValueChange={setDrgGroup}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {drgGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Saúde do contrato</label>
                <Select value={health} onValueChange={setHealth}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="healthy">Saudáveis</SelectItem>
                    <SelectItem value="warning">Em atenção</SelectItem>
                    <SelectItem value="critical">Críticos</SelectItem>
                    <SelectItem value="stale">Sem atualização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Competência de</label>
                <Input type="month" className="h-9" value={competenceFrom} onChange={(e) => setCompetenceFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Competência até</label>
                <Input type="month" className="h-9" value={competenceTo} onChange={(e) => setCompetenceTo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Buscar contrato/cliente</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="h-9 pl-8" placeholder="Digite o nome do contrato ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs principais — sempre referentes ao MÊS efetivamente filtrado (nunca acumulado).
            YTD aparece como nota terciária dentro de cada card. */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resultado do Mês</h2>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            (() => {
              const ytdRange = effectiveCompetence?.to
                ? `YTD jan–${formatCompetenceShort(effectiveCompetence.to + "-01")}`
                : "YTD";
              const ytdMargin =
                resultsYtd.revenueActual > 0
                  ? formatPct((resultsYtd.resultActual / resultsYtd.revenueActual) * 100, 1)
                  : "—";
              const revenuePending = kpis.revenueActual <= 0;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    label="Receita Bruta"
                    value={formatCompactBRL(kpis.revenueActual)}
                    fullValue={formatBRL(kpis.revenueActual)}
                    subtitle={revenuePending ? "Pendente de lançamento" : `Prev.: ${formatCompactBRL(kpis.revenuePlanned)}`}
                    ytdNote={`${ytdRange}: ${formatCompactBRL(resultsYtd.revenueActual)}`}
                    badge={revenuePending ? { label: "Receita pendente", tone: "negative" } : undefined}
                    icon={DollarSign}
                    tone={revenuePending ? "negative" : "primary"}
                    valueMuted={revenuePending}
                    onClick={
                      revenuePending && noRevenueCount > 0
                        ? () => {
                            setFilterNoRevenueOnly(true);
                            document.getElementById("scope-contracts-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        : undefined
                    }
                  />
                  <KpiCard
                    label="Custo Operacional"
                    value={formatCompactBRL(kpis.costActual)}
                    fullValue={formatBRL(kpis.costActual)}
                    subtitle={`Prev.: ${formatCompactBRL(kpis.costPlanned)}`}
                    ytdNote={`${ytdRange}: ${formatCompactBRL(resultsYtd.costActual)}`}
                    icon={Wallet}
                    tone="neutral"
                  />
                  <KpiCard
                    label="Resultado Líquido"
                    value={formatCompactBRL(kpis.resultActual)}
                    fullValue={formatBRL(kpis.resultActual)}
                    subtitle={`Prev.: ${formatCompactBRL(kpis.resultPlanned)}`}
                    ytdNote={`${ytdRange}: ${formatCompactBRL(resultsYtd.resultActual)}`}
                    icon={kpis.resultActual >= 0 ? TrendingUp : TrendingDown}
                    tone={resultTone}
                  />
                  <KpiCard
                    label="Margem Líquida %"
                    value={formatPct(kpis.marginActualPct, 1)}
                    subtitle={`Prev.: ${formatPct(kpis.marginPlannedPct, 1)}`}
                    ytdNote={`${ytdRange}: ${ytdMargin}`}
                    icon={Target}
                    tone={kpis.marginActualPct >= 0 ? "accent" : "negative"}
                  />
                </div>
              );
            })()
          )}
        </section>

        {/* Banner contextual: receita pendente em todos/maioria dos contratos */}
        {!isLoading && !bannerDismissed && kpis.revenueActual <= 0 && kpis.costActual > 0 && noRevenueCount > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-md border border-warning/40 bg-warning/10 text-sm">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                Receita pendente de lançamento em {noRevenueCount} {noRevenueCount === 1 ? "contrato" : "contratos"}
                {effectiveCompetence?.to ? ` para ${formatCompetenceShort(effectiveCompetence.to + "-01")}` : ""}.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Para ver o resultado real, acesse cada contrato e lance a Receita Bruta na aba Acompanhamento Executivo, linha 1.01.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs"
                onClick={() => {
                  setFilterNoRevenueOnly(true);
                  document.getElementById("scope-contracts-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Lançar receita agora →
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Barra de Desvio — substitui o card "Desvio Financeiro Consolidado" */}
        {!isLoading && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-md border bg-card text-sm",
              varianceTone === "positive" ? "border-success/30" : "border-destructive/30",
            )}
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {varianceTone === "positive" ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
              <span className="text-xs uppercase tracking-wide font-medium">Desvio do mês</span>
            </span>
            <span className="text-muted-foreground">
              Resultado Previsto:{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatBRL(kpis.resultPlanned)}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Resultado Real:{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatBRL(kpis.resultActual)}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Desvio:{" "}
              <span
                className={cn(
                  "font-bold tabular-nums",
                  varianceTone === "positive" ? "text-success" : "text-destructive",
                )}
              >
                {kpis.variance >= 0 ? "+" : ""}
                {formatBRL(kpis.variance)}
              </span>
            </span>
          </div>
        )}

        {/* === Resultados e Budgets (combo: barras RB + linhas ML%) === */}
        <section>
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resultados e Budgets
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{evolutionContractLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Contrato</span>
              <Select value={evolutionContractId} onValueChange={setEvolutionContractId}>
                <SelectTrigger className="h-8 text-xs w-[280px]">
                  <SelectValue placeholder="Selecionar contrato" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="all">Consolidado · Todos os contratos</SelectItem>
                  {evolutionContractOptions.map((c) => (
                    <SelectItem key={c.projectId} value={c.projectId}>
                      <span className="truncate">{c.client} · {c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardContent className="p-2 sm:p-4">
              {isLoading ? (
                <Skeleton className="h-[260px] sm:h-[320px] w-full" />
              ) : evolutionSeries.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados no período selecionado.
                </div>
              ) : (
                <div className="w-full min-w-0 h-[260px] sm:h-[300px] lg:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolutionSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={compactBRL}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      domain={[-50, 100]}
                      ticks={[-50, -25, 0, 25, 50, 75, 100]}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                      tickLine={false}
                      axisLine={false}
                      allowDataOverflow
                    />
                    <Tooltip content={<EvolutionComboTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    <Bar
                      yAxisId="left"
                      dataKey="revenuePlanned"
                      name="RB Prev"
                      fill="hsl(var(--chart-1))"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={42}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="revenueActual"
                      name="RB Real"
                      fill="hsl(var(--chart-2))"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={42}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="marginPlannedPct"
                      name="ML% Prev"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 2.5 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="marginActualPct"
                      name="ML% Real"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* === Ranking contratos + DRG === */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Top contratos por custo
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground">
                  {topCostCompetenceLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : topCostVisible.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
                  Sem custo realizado neste mês.
                </div>
              ) : (
                <>
                  <div
                    className="grid items-end gap-2 h-72 px-1"
                    style={{ gridTemplateColumns: `repeat(${topCostVisible.length}, minmax(0, 1fr))` }}
                  >
                    {topCostVisible.map((c) => {
                      const pct = topCostMax > 0 ? (c.cost / topCostMax) * 100 : 0;
                      const sharePct = topCostTotal > 0 ? (c.cost / topCostTotal) * 100 : 0;
                      const barClass = c.isCorporate ? "bg-muted-foreground/60" : "bg-primary/80";
                      return (
                        <button
                          key={c.projectId}
                          type="button"
                          onClick={() => navigate(`/financeiro/contrato/${c.projectId}`)}
                          title={`${c.name} — ${formatBRL(c.cost)} (${sharePct.toFixed(1)}% do custo total)`}
                          className="group h-full flex flex-col items-center justify-end gap-1.5 rounded-md px-1 py-1 hover:bg-muted/40 transition-colors text-center"
                        >
                          <span className="text-[11px] font-semibold tabular-nums text-foreground">
                            {compactBRL(c.cost)}
                          </span>
                          <div className="relative w-full flex-1 flex items-end bg-muted/40 rounded-sm overflow-hidden min-h-[8px]">
                            <div
                              className={cn("w-full rounded-sm transition-all", barClass, "group-hover:opacity-90")}
                              style={{ height: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                          <span
                            className="text-[11px] font-medium text-foreground truncate w-full"
                            title={c.name}
                          >
                            {c.client || c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Custo total do mês: <span className="font-medium text-foreground">{compactBRL(topCostTotal)}</span> · {topCostRanking.length} {topCostRanking.length === 1 ? "contrato" : "contratos"}
                    </span>
                    {topCostRanking.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setTopCostExpanded((v) => !v)}
                        className="text-primary hover:underline font-medium"
                      >
                        {topCostExpanded ? "Mostrar top 8 ←" : "Ver todos →"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card id="scope-contracts-panel">
            <CardHeader className="pb-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Contratos no escopo
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  {resultsContracts.length} {resultsContracts.length === 1 ? "contrato" : "contratos"} · clique para detalhes
                </span>
              </div>
              {noRevenueCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFilterNoRevenueOnly((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border transition-colors",
                      filterNoRevenueOnly
                        ? "bg-warning/15 border-warning/40 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    Sem receita ({noRevenueCount})
                  </button>
                  {filterNoRevenueOnly && (
                    <button
                      type="button"
                      onClick={() => setFilterNoRevenueOnly(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      limpar filtro
                    </button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4"><Skeleton className="h-72 w-full" /></div>
              ) : scopeContractsSorted.length === 0 ? (
                <div className="h-72 flex items-center justify-center px-4 text-sm text-muted-foreground text-center">
                  Nenhum contrato encontrado para os filtros selecionados
                </div>
              ) : (
                <>
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead className="w-7 px-2">
                            <button onClick={() => toggleScopeSort("saude")} className="hover:text-foreground" title="Ordenar por saúde">
                              <span className="sr-only">Saúde</span>
                              <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
                            </button>
                          </TableHead>
                          <TableHead className="px-2">
                            <button onClick={() => toggleScopeSort("client")} className="hover:text-foreground text-xs font-medium">
                              Cliente {scopeSort.key === "client" && (scopeSort.dir === "asc" ? "↑" : "↓")}
                            </button>
                          </TableHead>
                          <TableHead className="px-2 w-16">
                            <button onClick={() => toggleScopeSort("isCorporate")} className="hover:text-foreground text-xs font-medium">
                              Tipo {scopeSort.key === "isCorporate" && (scopeSort.dir === "asc" ? "↑" : "↓")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right px-2">
                            <button onClick={() => toggleScopeSort("costActual")} className="hover:text-foreground text-xs font-medium">
                              Custo real {scopeSort.key === "costActual" && (scopeSort.dir === "asc" ? "↑" : "↓")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right px-2 w-20">
                            <button onClick={() => toggleScopeSort("marginActualPct")} className="hover:text-foreground text-xs font-medium">
                              Margem {scopeSort.key === "marginActualPct" && (scopeSort.dir === "asc" ? "↑" : "↓")}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scopeContractsSorted.map((c) => {
                          const noRevenue = c.saude === "sem_dados" || c.revenueActual <= 0;
                          return (
                            <TableRow
                              key={c.projectId}
                              className={cn(
                                "cursor-pointer hover:bg-muted/50 transition-colors",
                                noRevenue && "opacity-60",
                              )}
                              onClick={() => navigate(`/financeiro/contrato/${c.projectId}`)}
                            >
                              <TableCell className="px-2 py-2">
                                <span
                                  className={cn("inline-block w-2.5 h-2.5 rounded-full", SAUDE_DOT[c.saude] ?? "bg-muted-foreground/40")}
                                  title={`${SAUDE_LABEL[c.saude]} · ML% ${noRevenue ? "—" : formatPct(c.marginActualPct, 1)}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium max-w-[180px] truncate px-2 py-2 text-xs" title={c.client}>
                                {c.client}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                  {c.isCorporate ? "Corp" : "Oper"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs px-2 py-2 font-medium">
                                {compactBRL(c.costActual)}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right tabular-nums text-xs px-2 py-2 font-semibold",
                                noRevenue ? "text-muted-foreground" : c.marginActualPct >= 0 ? "text-foreground" : "text-destructive",
                              )}>
                                {noRevenue ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 h-4 bg-warning/15 text-foreground border-warning/40"
                                  >
                                    Receita pendente
                                  </Badge>
                                ) : (
                                  formatPct(c.marginActualPct, 1)
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-2.5 border-t border-border flex items-center justify-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> ≥10%</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> 0–10%</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> &lt;0%</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> sem receita</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* === Resumo por cliente === */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Resumo por cliente
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground">
                  {topCostCompetenceLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4"><Skeleton className="h-48 w-full" /></div>
              ) : clientSummary.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  Nenhum cliente no escopo selecionado.
                </div>
              ) : (
                <>
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead className="px-3">Cliente</TableHead>
                          <TableHead className="text-right px-3 w-24">Contratos</TableHead>
                          <TableHead className="text-right px-3">Custo real</TableHead>
                          <TableHead className="text-right px-3">Receita real</TableHead>
                          <TableHead className="text-right px-3">Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientSummary.map((c) => (
                          <TableRow key={c.client} className={cn(!c.hasRevenue && "opacity-70")}>
                            <TableCell className="font-medium px-3 py-2 text-xs max-w-[220px] truncate" title={c.client}>
                              {c.client}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2 text-xs">
                              {c.contracts}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2 text-xs font-medium">
                              {compactBRL(c.cost)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums px-3 py-2 text-xs">
                              {c.hasRevenue ? compactBRL(c.revenue) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums px-3 py-2 text-xs font-semibold",
                              !c.hasRevenue ? "text-muted-foreground" : c.result >= 0 ? "text-success" : "text-destructive",
                            )}>
                              {c.hasRevenue ? compactBRL(c.result) : <span className="font-normal">—</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
                    Mostrando <span className="font-medium text-foreground">{clientSummaryTotals.clients}</span>{" "}
                    {clientSummaryTotals.clients === 1 ? "cliente" : "clientes"} ·{" "}
                    <span className="font-medium text-foreground">{clientSummaryTotals.contracts}</span>{" "}
                    {clientSummaryTotals.contracts === 1 ? "contrato" : "contratos"} no total
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Cache info footer */}
        <Card className="border-dashed">
          <CardContent className="p-3 flex items-center gap-3 text-xs text-muted-foreground">
            <Database className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong className="text-foreground">Cache:</strong>{" "}
              {cacheInfo.enabled
                ? `Ativo — ${cacheInfo.totalContracts} contratos (limite: ${cacheInfo.threshold}). Snapshot persistido em sessão.`
                : `Tempo real — ${cacheInfo.totalContracts} contratos (abaixo do limite ${cacheInfo.threshold} para cache híbrido).`
              }
            </span>
          </CardContent>
        </Card>
      </div>

      {/* === Drill-down Modal === */}
      <Dialog open={!!drillId} onOpenChange={(o) => !o && setDrillId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drillContract?.name ?? "Contrato"}
              {drillContract && healthBadge(drillContract.health)}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 text-xs">
              <span>{drillContract?.client}</span>
              <span>·</span>
              <span>{drillContract?.isCorporate ? "Corporativo" : "Operacional"}</span>
              {drillId && contractCompetences?.[drillId]?.lastCompetence && (
                <>
                  <span>·</span>
                  <span>
                    Última competência: <strong className="text-foreground">{formatCompetenceShort(contractCompetences[drillId].lastCompetence)}</strong>
                    {contractCompetences[drillId].source && (
                      <span className="ml-1 opacity-70">({contractCompetences[drillId].source})</span>
                    )}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {drillContract && (
            <div className="space-y-4">
              {/* KPIs do contrato */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Receita</p>
                  <p className="text-lg font-bold">{formatBRL(drillContract.revenue)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Custo</p>
                  <p className="text-lg font-bold">{formatBRL(drillContract.cost)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Resultado</p>
                  <p className={cn("text-lg font-bold", drillContract.result >= 0 ? "text-success" : "text-destructive")}>
                    {formatBRL(drillContract.result)}
                  </p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Margem</p>
                  <p className={cn("text-lg font-bold", drillContract.marginPct >= 0 ? "text-foreground" : "text-destructive")}>
                    {formatPct(drillContract.marginPct, 1)}
                  </p>
                </CardContent></Card>
              </div>

              {/* Evolução mensal do contrato */}
              {drilldown && drilldown.monthly.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Evolução Mensal</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={drilldown.monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={compactBRL} />
                        <Tooltip content={<ExecutiveMonthlyTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="revenueActual" name="Receita" stroke={palette[0]} fill={palette[0]} fillOpacity={0.2} strokeWidth={2} />
                        <Area type="monotone" dataKey="costActual" name="Custo" stroke={palette[3]} fill={palette[3]} fillOpacity={0.15} strokeWidth={2} />
                        <Line type="monotone" dataKey="margin" name="Margem" stroke={palette[2]} strokeWidth={2} dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* DRG do contrato */}
              {drilldown && drilldown.drgBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Distribuição de Custos (DRG)</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">% do Custo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldown.drgBreakdown.map((d, i) => (
                          <TableRow key={d.group}>
                            <TableCell className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette[i % palette.length] }} />
                              {d.group}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatBRL(d.value)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPct(d.pct, 1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default FinanceiroDashboardGeral;
