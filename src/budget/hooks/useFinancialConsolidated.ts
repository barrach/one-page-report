import { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useFinancialEntries, useContractRevenues, useFinancialCategories } from "./useFinancial";
import { useBaselines } from "./useFinancial";
import { useDrgLines } from "./useDrgLines";

/**
 * Hook central de consolidação financeira da Megasteam.
 *
 * Fase 3:
 *   - filtros avançados: DRG group, status do contrato, busca textual
 *   - alertas executivos (contratos sem atualização, desvio crítico, burn alto)
 *   - cache híbrido: persiste resultado consolidado em sessionStorage com TTL,
 *     útil quando o número de contratos é grande
 */

export type ContractHealth = "healthy" | "warning" | "critical" | "stale";

export interface ConsolidatedFilters {
  competenceFrom?: string; // 'YYYY-MM'
  competenceTo?: string;   // 'YYYY-MM'
  client?: string;
  projectId?: string;
  scope?: "all" | "operational" | "corporate";
  drgGroup?: string;       // filtra DRG específico
  health?: ContractHealth; // saúde do contrato
  search?: string;         // busca por nome/cliente
}

export interface ConsolidatedKpis {
  revenuePlanned: number;
  revenueActual: number;
  costPlanned: number;
  costActual: number;
  resultPlanned: number;
  resultActual: number;
  marginPlannedPct: number;
  marginActualPct: number;
  variance: number;
  ebitdaEstimated: number;
  activeContracts: number;
  operationalContracts: number;
  corporateContracts: number;
  backlog: number;
  burnRate: number;
  monthsCount: number;
}

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  revenuePlanned: number;
  revenueActual: number;
  costPlanned: number;
  costActual: number;
  margin: number;
}

export interface ContractMonthMatrixCell {
  projectId: string;
  month: string;        // 'YYYY-MM'
  revenuePlanned: number;
  revenue: number;
  costPlanned: number;
  cost: number;
  result: number;
  marginPlannedPct: number | null;
  marginActualPct: number | null;
  plannedRevenueSource?: "measurement" | "planned" | "drg";
  plannedCostSource?: "planned" | "drg";
  actualRevenueSource?: "measurement" | "drg";
  actualCostSource?: "entries" | "drg";
}

export interface ContractMonthMatrix {
  months: { key: string; label: string }[];
  contracts: { projectId: string; name: string; client: string }[];
  cells: Record<string, Record<string, ContractMonthMatrixCell>>; // [projectId][month]
  maxAbs: number;       // para escala de cor
}

export interface ContractRanking {
  projectId: string;
  name: string;
  client: string;
  isCorporate: boolean;
  revenue: number;
  revenuePlanned: number;
  cost: number;
  costPlanned: number;
  result: number;
  resultPlanned: number;
  marginPct: number;
  marginPlannedPct: number;
  variance: number;
  health: ContractHealth;
  lastUpdate?: string | null; // YYYY-MM da última movimentação
}

export interface DrgBreakdown {
  group: string;
  value: number;
  pct: number;
}

export interface ClientRanking {
  client: string;
  revenue: number;
  cost: number;
  result: number;
  contracts: number;
}

export interface ConsolidatedAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  projectId?: string;
}

export interface ContractDrillDown {
  projectId: string;
  monthly: MonthlySeriesPoint[];
  drgBreakdown: DrgBreakdown[];
}

interface ProjectMeta {
  id: string;
  name: string;
  client?: string | null;
  dept_group?: string | null;
  isCorporate: boolean;
}

const PT_MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, março: 3, abr: 4, abril: 4,
  mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9,
  out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

const asYearMonth = (year: number, month: number) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2020 || year > 2100) return "";
  return `${year}-${String(month).padStart(2, "0")}`;
};

const monthKey = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toLowerCase().includes("invalid")) return "";

  const iso = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (iso) return asYearMonth(Number(iso[1]), Number(iso[2]));

  const brNumeric = raw.match(/^(\d{1,2})[/-](\d{2}|\d{4})$/);
  if (brNumeric) {
    const year = Number(brNumeric[2].length === 2 ? `20${brNumeric[2]}` : brNumeric[2]);
    return asYearMonth(year, Number(brNumeric[1]));
  }

  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pt = normalized.match(/^([a-z]{3,})\.?\/?(\d{2}|\d{4})$/);
  if (pt) {
    const year = Number(pt[2].length === 2 ? `20${pt[2]}` : pt[2]);
    return asYearMonth(year, PT_MONTHS[pt[1]] ?? 0);
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return asYearMonth(d.getFullYear(), d.getMonth() + 1);
  }

  return "";
};

const formatMonthLabel = (month: string) => {
  const [year, mm] = month.split("-").map(Number);
  const ym = asYearMonth(year, mm);
  if (!ym) return "";
  return new Date(year, mm - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};

const normalizeCurrency = (value: unknown) => Math.abs(Number(value || 0));
const normalizePct = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n) <= 1 ? n * 100 : n;
};

const DRG_REVENUE_CODES = new Set(["RECEITA_BRUTA", "REC_BRUTA"]);
const DRG_TOTAL_COST_CODES = new Set(["CUSTO_TOTAL"]);
const DRG_MARGIN_CODES = new Set(["PCT_MARGEM_LIQUIDA", "MARG_LIQUIDA"]);

interface PlannedEntryRow {
  project_id: string;
  competence_month: string;
  kind: string;
  planned_value: number;
}

const usePlannedEntries = (projectId?: string) => useQuery({
  queryKey: ["consolidated-planned-entries", projectId ?? "all"],
  queryFn: async (): Promise<PlannedEntryRow[]> => {
    let q = supabase
      .from("financial_planned_entries")
      .select("project_id, competence_month, kind, planned_value")
      .order("competence_month", { ascending: true });
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as PlannedEntryRow[];
  },
});

const inRange = (m: string, from?: string, to?: string) => {
  if (!m) return false;
  if (from && m < from) return false;
  if (to && m > to) return false;
  return true;
};

const useProjectsMeta = () => {
  return useQuery({
    queryKey: ["consolidated-projects-meta"],
    queryFn: async (): Promise<Record<string, ProjectMeta>> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client, dept_group, is_company_entity, status")
        .eq("status", "active");
      if (error) throw error;
      const map: Record<string, ProjectMeta> = {};
      for (const p of data ?? []) {
        const dg = (p.dept_group ?? "").toUpperCase();
        map[p.id] = {
          id: p.id,
          name: p.project_name,
          client: p.client,
          dept_group: p.dept_group,
          isCorporate: p.is_company_entity || dg === "ADMINISTRATIVO" || dg === "CONSOLIDADO",
        };
      }
      return map;
    },
  });
};

const CACHE_KEY = "megasteam:consolidated:cache:v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const HYBRID_THRESHOLD = 30; // contratos: acima disso, ativa cache persistido

const classifyHealth = (
  marginPct: number,
  variancePct: number,
  lastUpdate: string | null,
  competenceTo?: string,
): ContractHealth => {
  // Stale: sem movimentação nos últimos 60 dias relativo a hoje (ou competenceTo)
  const today = competenceTo ? `${competenceTo}-01` : new Date().toISOString().slice(0, 10);
  if (lastUpdate) {
    const last = new Date(`${lastUpdate}-01`);
    const ref = new Date(today);
    const diffDays = (ref.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 75) return "stale";
  }
  if (marginPct < 0 || variancePct < -15) return "critical";
  if (marginPct < 8 || variancePct < -5) return "warning";
  return "healthy";
};

export const useFinancialConsolidated = (filters: ConsolidatedFilters = {}) => {
  const {
    competenceFrom, competenceTo, client, projectId, scope = "all",
    drgGroup, health, search,
  } = filters;

  const { data: entries, isLoading: loadingEntries } = useFinancialEntries(
    projectId ? { projectId } : undefined,
  );
  const { data: revenues, isLoading: loadingRevs } = useContractRevenues(
    projectId ? { projectId } : undefined,
  );
  const { data: baselines, isLoading: loadingBaselines } = useBaselines(
    projectId ? { projectId } : undefined,
  );
  const { data: plannedEntries, isLoading: loadingPlanned } = usePlannedEntries(projectId);
  const { data: drgLines, isLoading: loadingDrg } = useDrgLines(projectId);
  const { data: projectsMeta, isLoading: loadingMeta } = useProjectsMeta();
  const { data: categories } = useFinancialCategories();

  const isLoading = loadingEntries || loadingRevs || loadingBaselines || loadingPlanned || loadingDrg || loadingMeta;

  const categoryDrgMap = useMemo(() => {
    const m: Record<string, string> = {};
    (categories ?? []).forEach((c) => {
      m[c.id] = (c.drg_group || c.cost_class || "Sem grupo").toString();
    });
    return m;
  }, [categories]);

  const isCorporateEntry = (projId?: string | null) => {
    if (!projId) return true;
    return projectsMeta?.[projId]?.isCorporate ?? false;
  };

  const passesScope = (projId?: string | null) => {
    if (scope === "all") return true;
    const corp = isCorporateEntry(projId);
    return scope === "corporate" ? corp : !corp;
  };

  const passesClient = (projId?: string | null) => {
    if (!client) return true;
    const meta = projId ? projectsMeta?.[projId] : null;
    return (meta?.client ?? "").toLowerCase() === client.toLowerCase();
  };

  const passesDrg = (categoryId?: string | null) => {
    if (!drgGroup) return true;
    const grp = (categoryId && categoryDrgMap[categoryId]) || "Sem grupo";
    return grp === drgGroup;
  };

  // === KPIs ===
  const kpis = useMemo<ConsolidatedKpis>(() => {
    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    let costActual = 0;
    const monthsTouched = new Set<string>();
    for (const e of validEntries) {
      const mk = monthKey(e.competence ?? e.competence_date);
      if (!inRange(mk, competenceFrom, competenceTo)) continue;
      if (!passesScope(e.contract_project_id) || !passesClient(e.contract_project_id)) continue;
      if (!passesDrg(e.category_id)) continue;
      costActual += Number(e.cost_value || 0);
      if (mk) monthsTouched.add(mk);
    }

    let revenuePlanned = 0;
    let revenueActual = 0;
    for (const r of revenues ?? []) {
      const mk = monthKey(r.competence_month);
      if (!inRange(mk, competenceFrom, competenceTo)) continue;
      if (!passesScope(r.project_id) || !passesClient(r.project_id)) continue;
      revenuePlanned += Number(r.revenue_planned || 0);
      revenueActual += Number(r.revenue_actual || 0);
      if (mk) monthsTouched.add(mk);
    }

    let costPlanned = 0;
    for (const b of baselines ?? []) {
      if (!passesScope(b.project_id) || !passesClient(b.project_id)) continue;
      if (b.status !== "active") continue;
      costPlanned += Number(b.total_direct_cost || 0) + Number(b.total_indirect_cost || 0);
    }

    const allProjects = Object.values(projectsMeta ?? {});
    const inScopeProjects = allProjects
      .filter((p) => scope === "all" ? true : (scope === "corporate" ? p.isCorporate : !p.isCorporate))
      .filter((p) => !client || (p.client ?? "").toLowerCase() === client.toLowerCase());

    const operationalContracts = inScopeProjects.filter((p) => !p.isCorporate).length;
    const corporateContracts = inScopeProjects.filter((p) => p.isCorporate).length;
    const resultPlanned = revenuePlanned - costPlanned;
    const resultActual = revenueActual - costActual;
    const marginPlannedPct = revenuePlanned > 0 ? (resultPlanned / revenuePlanned) * 100 : 0;
    const marginActualPct = revenueActual > 0 ? (resultActual / revenueActual) * 100 : 0;
    const monthsCount = monthsTouched.size || 1;
    const backlog = Math.max(0, revenuePlanned - revenueActual);

    return {
      revenuePlanned, revenueActual, costPlanned, costActual,
      resultPlanned, resultActual, marginPlannedPct, marginActualPct,
      variance: resultActual - resultPlanned,
      ebitdaEstimated: resultActual,
      activeContracts: inScopeProjects.length,
      operationalContracts, corporateContracts,
      backlog, burnRate: costActual / monthsCount, monthsCount,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revenues, baselines, projectsMeta, competenceFrom, competenceTo, client, projectId, scope, drgGroup]);

  // === Série mensal ===
  const monthlySeries = useMemo<MonthlySeriesPoint[]>(() => {
    const map = new Map<string, MonthlySeriesPoint>();
    const ensure = (m: string): MonthlySeriesPoint => {
      let p = map.get(m);
      if (!p) {
        p = {
          month: m,
          label: formatMonthLabel(m),
          revenuePlanned: 0, revenueActual: 0, costPlanned: 0, costActual: 0, margin: 0,
        };
        map.set(m, p);
      }
      return p;
    };

    for (const r of revenues ?? []) {
      const mk = monthKey(r.competence_month);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      if (!passesScope(r.project_id) || !passesClient(r.project_id)) continue;
      const p = ensure(mk);
      p.revenuePlanned += Number(r.revenue_planned || 0);
      p.revenueActual += Number(r.revenue_actual || 0);
    }

    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      const mk = monthKey(e.competence ?? e.competence_date);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      if (!passesScope(e.contract_project_id) || !passesClient(e.contract_project_id)) continue;
      if (!passesDrg(e.category_id)) continue;
      const p = ensure(mk);
      p.costActual += Number(e.cost_value || 0);
    }

    const monthsList = Array.from(map.keys()).sort();
    if (monthsList.length > 0) {
      let costPlannedTotal = 0;
      for (const b of baselines ?? []) {
        if (!passesScope(b.project_id) || !passesClient(b.project_id)) continue;
        if (b.status !== "active") continue;
        costPlannedTotal += Number(b.total_direct_cost || 0) + Number(b.total_indirect_cost || 0);
      }
      const perMonth = costPlannedTotal / monthsList.length;
      for (const m of monthsList) ensure(m).costPlanned = perMonth;
    }

    const list = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    list.forEach((p) => { p.margin = p.revenueActual - p.costActual; });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revenues, baselines, projectsMeta, competenceFrom, competenceTo, client, projectId, scope, drgGroup]);

  // === Ranking de contratos (com saúde) ===
  const contractRanking = useMemo<ContractRanking[]>(() => {
    const acc = new Map<string, { revenue: number; cost: number; planned: number; plannedRev: number; lastMonth?: string }>();
    const ensure = (id: string) => {
      let v = acc.get(id);
      if (!v) { v = { revenue: 0, cost: 0, planned: 0, plannedRev: 0 }; acc.set(id, v); }
      return v;
    };

    for (const r of revenues ?? []) {
      const mk = monthKey(r.competence_month);
      if (!inRange(mk, competenceFrom, competenceTo)) continue;
      if (!r.project_id) continue;
      if (!passesScope(r.project_id) || !passesClient(r.project_id)) continue;
      const v = ensure(r.project_id);
      v.revenue += Number(r.revenue_actual || 0);
      v.plannedRev += Number(r.revenue_planned || 0);
      if (mk && (!v.lastMonth || mk > v.lastMonth)) v.lastMonth = mk;
    }

    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      const mk = monthKey(e.competence ?? e.competence_date);
      if (!inRange(mk, competenceFrom, competenceTo)) continue;
      const id = e.contract_project_id;
      if (!id) continue;
      if (!passesScope(id) || !passesClient(id)) continue;
      if (!passesDrg(e.category_id)) continue;
      const v = ensure(id);
      v.cost += Number(e.cost_value || 0);
      if (mk && (!v.lastMonth || mk > v.lastMonth)) v.lastMonth = mk;
    }

    for (const b of baselines ?? []) {
      if (!b.project_id) continue;
      if (!passesScope(b.project_id) || !passesClient(b.project_id)) continue;
      if (b.status !== "active") continue;
      const v = ensure(b.project_id);
      v.planned += Number(b.total_direct_cost || 0) + Number(b.total_indirect_cost || 0);
    }

    const list: ContractRanking[] = [];
    acc.forEach((v, id) => {
      const meta = projectsMeta?.[id];
      const result = v.revenue - v.cost;
      const plannedResult = v.plannedRev - v.planned;
      const marginPct = v.revenue > 0 ? (result / v.revenue) * 100 : 0;
      const variance = result - plannedResult;
      const variancePct = Math.abs(plannedResult) > 0 ? (variance / Math.abs(plannedResult)) * 100 : 0;
      list.push({
        projectId: id,
        name: meta?.name ?? "—",
        client: meta?.client ?? "—",
        isCorporate: meta?.isCorporate ?? false,
        revenue: v.revenue,
        revenuePlanned: v.plannedRev,
        cost: v.cost,
        costPlanned: v.planned,
        result,
        resultPlanned: plannedResult,
        marginPct,
        marginPlannedPct: v.plannedRev > 0 ? (plannedResult / v.plannedRev) * 100 : 0,
        variance,
        health: classifyHealth(marginPct, variancePct, v.lastMonth ?? null, competenceTo),
        lastUpdate: v.lastMonth ?? null,
      });
    });

    // aplica filtros de saúde e busca textual
    return list
      .filter((c) => !health || c.health === health)
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.client.toLowerCase().includes(q);
      })
      .sort((a, b) => b.revenue - a.revenue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revenues, baselines, projectsMeta, competenceFrom, competenceTo, client, projectId, scope, drgGroup, health, search]);

  // === DRG consolidado ===
  const drgBreakdown = useMemo<DrgBreakdown[]>(() => {
    const groups = new Map<string, number>();
    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      const mk = monthKey(e.competence ?? e.competence_date);
      if (!inRange(mk, competenceFrom, competenceTo)) continue;
      if (!passesScope(e.contract_project_id) || !passesClient(e.contract_project_id)) continue;
      const grp = (e.category_id && categoryDrgMap[e.category_id]) || "Sem grupo";
      groups.set(grp, (groups.get(grp) || 0) + Number(e.cost_value || 0));
    }
    const total = Array.from(groups.values()).reduce((s, v) => s + v, 0);
    return Array.from(groups.entries())
      .map(([group, value]) => ({ group, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, categoryDrgMap, competenceFrom, competenceTo, client, projectId, scope]);

  // Lista de DRGs disponíveis (para o filtro)
  const drgGroups = useMemo(() => {
    const set = new Set<string>();
    drgBreakdown.forEach((d) => set.add(d.group));
    Object.values(categoryDrgMap).forEach((g) => set.add(g));
    return Array.from(set).sort();
  }, [drgBreakdown, categoryDrgMap]);

  // === Ranking por cliente ===
  const clientRanking = useMemo<ClientRanking[]>(() => {
    const acc = new Map<string, ClientRanking>();
    const ensure = (c: string): ClientRanking => {
      let v = acc.get(c);
      if (!v) { v = { client: c, revenue: 0, cost: 0, result: 0, contracts: 0 }; acc.set(c, v); }
      return v;
    };
    contractRanking.forEach((c) => {
      if (!c.client || c.client === "—") return;
      const v = ensure(c.client);
      v.revenue += c.revenue;
      v.cost += c.cost;
      v.result += c.result;
      v.contracts += 1;
    });
    return Array.from(acc.values()).sort((a, b) => b.revenue - a.revenue);
  }, [contractRanking]);

  // === Alertas executivos ===
  const alerts = useMemo<ConsolidatedAlert[]>(() => {
    const out: ConsolidatedAlert[] = [];
    const critical = contractRanking.filter((c) => c.health === "critical");
    const stale = contractRanking.filter((c) => c.health === "stale");
    const warning = contractRanking.filter((c) => c.health === "warning");

    if (critical.length > 0) {
      out.push({
        id: "critical-contracts",
        level: "critical",
        title: `${critical.length} contrato(s) em situação crítica`,
        message: `Resultado negativo ou desvio acima de 15%. Revisar urgentemente: ${critical.slice(0, 3).map((c) => c.name).join(", ")}${critical.length > 3 ? "..." : ""}`,
      });
    }
    if (stale.length > 0) {
      out.push({
        id: "stale-contracts",
        level: "warning",
        title: `${stale.length} contrato(s) sem atualização recente`,
        message: `Mais de 75 dias sem movimentação. Verificar: ${stale.slice(0, 3).map((c) => c.name).join(", ")}${stale.length > 3 ? "..." : ""}`,
      });
    }
    if (warning.length > 0) {
      out.push({
        id: "warning-contracts",
        level: "warning",
        title: `${warning.length} contrato(s) em atenção`,
        message: `Margem baixa (<8%) ou desvio entre -5% e -15%.`,
      });
    }
    if (kpis.marginActualPct < 5 && kpis.revenueActual > 0) {
      out.push({
        id: "low-consolidated-margin",
        level: "warning",
        title: "Margem consolidada baixa",
        message: `Margem real de ${kpis.marginActualPct.toFixed(1)}% — abaixo do alvo executivo (8%+).`,
      });
    }
    if (kpis.burnRate > 0 && kpis.revenueActual / kpis.monthsCount < kpis.burnRate) {
      out.push({
        id: "burn-rate-high",
        level: "warning",
        title: "Burn rate acima da receita média",
        message: `Custo médio mensal supera a receita média mensal — fluxo de caixa pressionado.`,
      });
    }
    return out;
  }, [contractRanking, kpis]);

  // === Drill-down por contrato ===
  const buildDrilldown = useMemo(() => {
    return (drillProjectId: string): ContractDrillDown => {
      const map = new Map<string, MonthlySeriesPoint>();
      const ensure = (m: string): MonthlySeriesPoint => {
        let p = map.get(m);
        if (!p) {
          p = {
            month: m,
          label: formatMonthLabel(m),
            revenuePlanned: 0, revenueActual: 0, costPlanned: 0, costActual: 0, margin: 0,
          };
          map.set(m, p);
        }
        return p;
      };

      for (const r of revenues ?? []) {
        if (r.project_id !== drillProjectId) continue;
        const mk = monthKey(r.competence_month);
        if (!mk) continue;
        const p = ensure(mk);
        p.revenuePlanned += Number(r.revenue_planned || 0);
        p.revenueActual += Number(r.revenue_actual || 0);
      }

      const groups = new Map<string, number>();
      for (const e of entries ?? []) {
        if (e.is_excluded || e.is_duplicate) continue;
        if (e.contract_project_id !== drillProjectId) continue;
        const mk = monthKey(e.competence ?? e.competence_date);
        if (!mk) continue;
        const p = ensure(mk);
        p.costActual += Number(e.cost_value || 0);
        const grp = (e.category_id && categoryDrgMap[e.category_id]) || "Sem grupo";
        groups.set(grp, (groups.get(grp) || 0) + Number(e.cost_value || 0));
      }

      const monthly = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
      monthly.forEach((p) => { p.margin = p.revenueActual - p.costActual; });

      const total = Array.from(groups.values()).reduce((s, v) => s + v, 0);
      const drg = Array.from(groups.entries())
        .map(([group, value]) => ({ group, value, pct: total > 0 ? (value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

      return { projectId: drillProjectId, monthly, drgBreakdown: drg };
    };
  }, [entries, revenues, categoryDrgMap]);

  // Lista de clientes
  const clients = useMemo(() => {
    const set = new Set<string>();
    Object.values(projectsMeta ?? {}).forEach((p) => { if (p.client) set.add(p.client); });
    return Array.from(set).sort();
  }, [projectsMeta]);

  // === Cache híbrido ===
  // Quando há muitos contratos, persiste o último resultado em sessionStorage
  // para acelerar mudanças de filtros leves (volta visual instantânea enquanto recalcula).
  const totalContracts = Object.keys(projectsMeta ?? {}).length;
  const useHybridCache = totalContracts >= HYBRID_THRESHOLD;
  const lastSnapshotRef = useRef<{ key: string; ts: number; payload: unknown } | null>(null);

  useEffect(() => {
    if (!useHybridCache || isLoading) return;
    try {
      const payload = { kpis, monthlySeries, contractRanking, drgBreakdown, clientRanking, alerts };
      const key = JSON.stringify({ scope, client, competenceFrom, competenceTo, drgGroup, health, search });
      const snap = { key, ts: Date.now(), payload };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(snap));
      lastSnapshotRef.current = snap;
    } catch {
      // sessionStorage cheio/indisponível — ignora silenciosamente
    }
  }, [useHybridCache, isLoading, kpis, monthlySeries, contractRanking, drgBreakdown, clientRanking, alerts, scope, client, competenceFrom, competenceTo, drgGroup, health, search]);

  const cacheInfo = {
    enabled: useHybridCache,
    totalContracts,
    threshold: HYBRID_THRESHOLD,
    ttlMs: CACHE_TTL_MS,
    lastSnapshotAt: lastSnapshotRef.current?.ts ?? null,
  };

  // === Matriz Contrato × Competência ===
  const contractMonthMatrix = useMemo<ContractMonthMatrix>(() => {
    const monthsSet = new Set<string>();
    const cells: Record<string, Record<string, ContractMonthMatrixCell>> = {};
    const contractIds = new Set<string>();

    const ensure = (pid: string, mk: string): ContractMonthMatrixCell => {
      if (!cells[pid]) cells[pid] = {};
      if (!cells[pid][mk]) {
        cells[pid][mk] = {
          projectId: pid,
          month: mk,
          revenuePlanned: 0,
          revenue: 0,
          costPlanned: 0,
          cost: 0,
          result: 0,
          marginPlannedPct: null,
          marginActualPct: null,
        };
      }
      return cells[pid][mk];
    };

    for (const r of revenues ?? []) {
      const mk = monthKey(r.competence_month);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      if (!r.project_id) continue;
      if (!passesScope(r.project_id) || !passesClient(r.project_id)) continue;
      const planned = normalizeCurrency(r.revenue_planned);
      const actual = normalizeCurrency(r.revenue_actual);
      if (planned === 0 && actual === 0) continue;
      monthsSet.add(mk);
      contractIds.add(r.project_id);
      const c = ensure(r.project_id, mk);
      c.revenuePlanned += planned;
      c.revenue += actual;
      if (planned > 0) c.plannedRevenueSource = "measurement";
      if (actual > 0) c.actualRevenueSource = "measurement";
    }

    const validEntries = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    for (const e of validEntries) {
      const mk = monthKey(e.competence ?? e.competence_date);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      const id = e.contract_project_id;
      if (!id) continue;
      if (!passesScope(id) || !passesClient(id)) continue;
      if (!passesDrg(e.category_id)) continue;
      monthsSet.add(mk);
      contractIds.add(id);
      const c = ensure(id, mk);
      c.cost += Number(e.cost_value || 0);
      c.actualCostSource = "entries";
    }

    for (const p of plannedEntries ?? []) {
      const mk = monthKey(p.competence_month);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      if (!p.project_id || !passesScope(p.project_id) || !passesClient(p.project_id)) continue;
      const plannedValue = normalizeCurrency(p.planned_value);
      if (plannedValue === 0) continue;

      monthsSet.add(mk);
      contractIds.add(p.project_id);
      const c = ensure(p.project_id, mk);
      if (String(p.kind).toLowerCase() === "revenue") {
        c.revenuePlanned += plannedValue;
        c.plannedRevenueSource = "planned";
      } else {
        c.costPlanned += plannedValue;
        c.plannedCostSource = "planned";
      }
    }

    for (const line of drgLines ?? []) {
      const mk = monthKey(line.competence_month);
      if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;
      if (!line.project_id || !passesScope(line.project_id) || !passesClient(line.project_id)) continue;
      const code = String(line.line_code || "").toUpperCase();
      if (!DRG_REVENUE_CODES.has(code) && !DRG_TOTAL_COST_CODES.has(code) && !DRG_MARGIN_CODES.has(code)) continue;

      monthsSet.add(mk);
      contractIds.add(line.project_id);
      const c = ensure(line.project_id, mk);

      if (DRG_REVENUE_CODES.has(code)) {
        const planned = normalizeCurrency(line.planned_value);
        const actual = normalizeCurrency(line.actual_value);
        if (planned > 0 && c.plannedRevenueSource !== "measurement" && c.plannedRevenueSource !== "planned") {
          c.revenuePlanned = planned;
          c.plannedRevenueSource = "drg";
        }
        if (actual > 0 && c.actualRevenueSource !== "measurement") {
          c.revenue = actual;
          c.actualRevenueSource = "drg";
        }
      }

      if (DRG_TOTAL_COST_CODES.has(code)) {
        const planned = normalizeCurrency(line.planned_value);
        const actual = normalizeCurrency(line.actual_value);
        if (planned > 0) {
          c.costPlanned = planned;
          c.plannedCostSource = "drg";
        }
        if (actual > 0) {
          c.cost = actual;
          c.actualCostSource = "drg";
        }
      }

      if (DRG_MARGIN_CODES.has(code)) {
        c.marginPlannedPct = normalizePct(line.planned_value) ?? c.marginPlannedPct;
        c.marginActualPct = normalizePct(line.actual_value) ?? c.marginActualPct;
      }
    }

    for (const b of baselines ?? []) {
      if (!b.project_id || b.status !== "active") continue;
      if (!passesScope(b.project_id) || !passesClient(b.project_id)) continue;

      const breakdown = Array.isArray(b.monthly_breakdown) ? b.monthly_breakdown : [];
      for (const row of breakdown as Array<{ month?: string; revenue?: number; direct_cost?: number; indirect_cost?: number }>) {
        const mk = monthKey(row.month);
        if (!mk || !inRange(mk, competenceFrom, competenceTo)) continue;

        const plannedRevenue = normalizeCurrency(row.revenue);
        const plannedCost = normalizeCurrency(row.direct_cost) + normalizeCurrency(row.indirect_cost);
        if (plannedRevenue === 0 && plannedCost === 0) continue;

        monthsSet.add(mk);
        contractIds.add(b.project_id);
        const c = ensure(b.project_id, mk);
        if (plannedRevenue > 0 && !c.plannedRevenueSource) c.revenuePlanned = plannedRevenue;
        if (plannedCost > 0 && !c.plannedCostSource) c.costPlanned += plannedCost;
      }
    }

    let maxAbs = 0;
    for (const pid of contractIds) {
      for (const mk of monthsSet) {
        const c = cells[pid]?.[mk];
        if (!c) continue;
        c.result = c.revenue - c.cost;
        if (c.marginPlannedPct == null && c.revenuePlanned > 0) {
          c.marginPlannedPct = ((c.revenuePlanned - c.costPlanned) / c.revenuePlanned) * 100;
        }
        if (c.marginActualPct == null && c.revenue > 0) {
          c.marginActualPct = ((c.revenue - c.cost) / c.revenue) * 100;
        }
        const a = Math.abs(c.result);
        if (a > maxAbs) maxAbs = a;
      }
    }

    const months = Array.from(monthsSet).sort().map((m) => ({ key: m, label: formatMonthLabel(m) })).filter((m) => m.label);

    const contracts = Array.from(contractIds)
      .map((id) => {
        const meta = projectsMeta?.[id];
        const total = Object.values(cells[id] ?? {}).reduce((s, c) => s + Math.abs(c.result), 0);
        return { projectId: id, name: meta?.name ?? "—", client: meta?.client ?? "—", _total: total };
      })
      .sort((a, b) => b._total - a._total)
      .map(({ projectId, name, client }) => ({ projectId, name, client }));

    return { months, contracts, cells, maxAbs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, revenues, plannedEntries, drgLines, baselines, projectsMeta, competenceFrom, competenceTo, client, projectId, scope, drgGroup]);

  return {
    kpis, clients, monthlySeries, contractMonthMatrix, contractRanking, drgBreakdown, drgGroups,
    clientRanking, alerts, buildDrilldown, cacheInfo, isLoading,
  };
};
