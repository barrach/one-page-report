// ============================================================
// useConsolidatedFromResults — Dashboard Geral consolidando
// diretamente da tabela `contract_results` (fonte única de verdade).
// ============================================================
// Lê uma única tabela (já com VL, CO, MB, TA, RL, ML% previsto e
// realizado + farol "saude") e produz:
//   - kpis consolidados (Receita Real/Prev, Custo Real/Prev, RL, ML%)
//   - série mensal (RB Prev/Real + ML% Prev/Real)
//   - tabela "Todos os contratos no escopo" (com saúde + competência)
//   - ranking de clientes (agrupando contratos)
// ============================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import type { ContractSaude } from "./useContractResults";

// ---------- Tipos ----------
export interface ConsolidatedResultsFilters {
  competenceFrom?: string; // 'YYYY-MM'
  competenceTo?: string;   // 'YYYY-MM'
  client?: string;
  scope?: "all" | "operational" | "corporate";
  health?: ContractSaude | "all";
  search?: string;
}

export interface ConsolidatedResultsKpis {
  // Receita Bruta (RB = SUM 1.01 por contrato) — somatória, nunca calculada com média
  grossRevenueActual: number;
  grossRevenuePlanned: number;
  // Total Impostos (TI = SUM 2.01..2.06 por contrato com alíquotas específicas)
  taxesActual: number;
  taxesPlanned: number;
  // Receita Líquida (VL = RB − |TI|)
  revenueActual: number;
  revenuePlanned: number;
  // Custos / Margens
  costActual: number;
  costPlanned: number;
  resultActual: number;
  resultPlanned: number;
  marginActualPct: number;
  marginPlannedPct: number;
  variance: number;
  contracts: number;
  monthsCount: number;
}

export interface ConsolidatedMonthlyPoint {
  month: string;               // 'YYYY-MM'
  label: string;               // "jan/25"
  revenuePlanned: number;
  revenueActual: number;
  costPlanned: number;
  costActual: number;
  resultPlanned: number;
  resultActual: number;
  marginPlannedPct: number | null;
  marginActualPct: number | null;
}

export interface ConsolidatedContractRow {
  projectId: string;
  client: string;
  name: string;
  isCorporate: boolean;
  saude: ContractSaude;
  revenueActual: number;
  revenuePlanned: number;
  costActual: number;
  costPlanned: number;
  resultActual: number;
  resultPlanned: number;
  marginActualPct: number;
  marginPlannedPct: number;
  lastCompetence: string | null; // YYYY-MM-DD
}

export interface ConsolidatedClientRow {
  client: string;
  contracts: number;
  revenueActual: number;
  costActual: number;
  resultActual: number;
  marginActualPct: number;
}

// ---------- Linha bruta da tabela ----------
interface RawResultRow {
  project_id: string;
  competence_month: string; // YYYY-MM-DD
  rb_actual: number;
  rb_planned: number;
  ti_actual: number;
  ti_planned: number;
  vl_actual: number;
  vl_planned: number;
  co_actual: number;
  co_planned: number;
  rl_actual: number;
  rl_planned: number;
  ml_actual_pct: number;
  ml_planned_pct: number;
  saude: ContractSaude;
}

interface ProjectMeta {
  id: string;
  name: string;
  client: string;
  isCorporate: boolean;
  status: string;
}

// ---------- Helpers ----------
const monthKey = (iso: string) => iso.slice(0, 7); // 'YYYY-MM'
const PT = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
};
const inRange = (m: string, from?: string, to?: string) => {
  if (from && m < from) return false;
  if (to && m > to) return false;
  return true;
};

// ---------- Queries base ----------
const useAllContractResults = () =>
  useQuery({
    queryKey: ["consolidated-from-results:rows"],
    queryFn: async (): Promise<RawResultRow[]> => {
      const { data, error } = await supabase
        .from("contract_results")
        .select(
          "project_id, competence_month, rb_actual, rb_planned, ti_actual, ti_planned, vl_actual, vl_planned, co_actual, co_planned, rl_actual, rl_planned, ml_actual_pct, ml_planned_pct, saude",
        )
        .order("competence_month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RawResultRow[];
    },
    staleTime: 60 * 1000,
  });

// Último mês com dados REAIS — combina duas fontes:
//   1. financial_entries.competence_date  (CUSTOS_MES já importado)
//   2. contract_revenues.competence_month (Receita manual lançada na Acomp.)
// NUNCA usa Budget/previsto. Se nenhuma fonte tiver dado, retorna null.
const useLatestRealCompetence = () =>
  useQuery({
    queryKey: ["consolidated-from-results:latest-real-competence"],
    queryFn: async (): Promise<string | null> => {
      const [entriesRes, revenuesRes] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("competence_date")
          .not("competence_date", "is", null)
          .order("competence_date", { ascending: false })
          .limit(1),
        supabase
          .from("contract_revenues")
          .select("competence_month")
          .gt("revenue_actual", 0)
          .order("competence_month", { ascending: false })
          .limit(1),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (revenuesRes.error) throw revenuesRes.error;
      const fromEntries = entriesRes.data?.[0]?.competence_date as string | undefined;
      const fromRevenues = revenuesRes.data?.[0]?.competence_month as string | undefined;
      const candidates = [fromEntries, fromRevenues].filter(Boolean) as string[];
      if (candidates.length === 0) return null;
      // MAX entre as duas fontes
      const max = candidates.reduce((a, b) => (a > b ? a : b));
      return max.slice(0, 7); // YYYY-MM
    },
    staleTime: 60 * 1000,
  });

const useProjectMetaMap = () =>
  useQuery({
    queryKey: ["consolidated-from-results:projects"],
    queryFn: async (): Promise<Record<string, ProjectMeta>> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client, dept_group, is_company_entity, status");
      if (error) throw error;
      const map: Record<string, ProjectMeta> = {};
      for (const p of data ?? []) {
        const dg = (p.dept_group ?? "").toString().toUpperCase();
        map[p.id] = {
          id: p.id,
          name: p.project_name ?? "—",
          client: (p.client ?? "—").toString(),
          isCorporate: !!p.is_company_entity || dg === "ADMINISTRATIVO" || dg === "CONSOLIDADO",
          status: p.status ?? "active",
        };
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

// ---------- Hook principal ----------
export const useConsolidatedFromResults = (filters: ConsolidatedResultsFilters = {}) => {
  const { data: rows, isLoading: loadingRows } = useAllContractResults();
  const { data: projectsMeta, isLoading: loadingMeta } = useProjectMetaMap();
  const { data: latestRealCompetence } = useLatestRealCompetence();

  const isLoading = loadingRows || loadingMeta;

  // Filtros: scope, client, health, search → produz set de project_ids elegíveis
  // IMPORTANTE: entidades corporativas (is_company_entity = true: GERAL_OH,
  // Megasteam, Administrativo) NUNCA entram na consolidação geral por padrão —
  // elas representam visões consolidadas/admin que duplicariam os contratos
  // operacionais. Só aparecem quando scope === "corporate".
  const eligibleIds = useMemo(() => {
    const out = new Set<string>();
    const all = projectsMeta ?? {};
    const scope = filters.scope ?? "all";
    const search = filters.search?.trim().toLowerCase();
    for (const id of Object.keys(all)) {
      const m = all[id];
      if (m.status !== "active") continue;
      // Excluir corporativos por padrão (scope "all" e "operational")
      if (scope !== "corporate" && m.isCorporate) continue;
      if (scope === "corporate" && !m.isCorporate) continue;
      if (filters.client && m.client.toLowerCase() !== filters.client.toLowerCase()) continue;
      if (search && !`${m.client} ${m.name}`.toLowerCase().includes(search)) continue;
      out.add(id);
    }
    return out;
  }, [projectsMeta, filters.scope, filters.client, filters.search]);

  // Linhas do escopo (sem filtro de competência) — base para a série mensal e
  // para descobrir a "última competência com dados" quando o usuário não filtra.
  // Também filtra meses fora de 2020-2030 (defesa contra dados corrompidos
  // provenientes de importações antigas).
  const scopedRows = useMemo(() => {
    if (!rows) return [] as RawResultRow[];
    return rows.filter((r) => {
      if (!eligibleIds.has(r.project_id)) return false;
      const mk = monthKey(r.competence_month);
      const y = Number(mk.slice(0, 4));
      return Number.isFinite(y) && y >= 2020 && y <= 2030;
    });
  }, [rows, eligibleIds]);

  // Competência efetiva — regras:
  //  1. Se o usuário definiu filtro manual, respeitar.
  //  2. Caso contrário, usar o último mês com lançamento REAL em
  //     financial_entries (CUSTOS_MES). NUNCA usar Budget/previsto.
  //  3. Se não houver nenhum lançamento real ainda, cair para o mês atual.
  const { effectiveFrom, effectiveTo, latestAvailable } = useMemo(() => {
    const userFrom = filters.competenceFrom?.trim();
    const userTo = filters.competenceTo?.trim();

    // Última competência real (CUSTOS_MES) — fonte oficial do default.
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const latest = latestRealCompetence ?? currentMonth;

    if (!userFrom && !userTo) {
      return { effectiveFrom: latest, effectiveTo: latest, latestAvailable: latest };
    }
    return { effectiveFrom: userFrom || undefined, effectiveTo: userTo || undefined, latestAvailable: latest };
  }, [latestRealCompetence, filters.competenceFrom, filters.competenceTo]);

  // Linhas filtradas pela competência efetiva — base dos KPIs do mês.
  const filteredRows = useMemo(() => {
    return scopedRows.filter((r) => inRange(monthKey(r.competence_month), effectiveFrom, effectiveTo));
  }, [scopedRows, effectiveFrom, effectiveTo]);

  // ---------- KPIs do mês selecionado (NÃO acumulado) ----------
  // Princípio: o consolidado é SEMPRE a soma dos valores individuais por contrato.
  // Nada é recalculado com alíquotas médias — TI vem somado de cada contrato
  // (que usa as suas alíquotas específicas de PIS/COFINS/ISS).
  const kpis = useMemo<ConsolidatedResultsKpis>(() => {
    let rbA = 0, rbP = 0, tiA = 0, tiP = 0;
    let vlA = 0, vlP = 0, coA = 0, coP = 0, rlA = 0, rlP = 0;
    const months = new Set<string>();
    const contracts = new Set<string>();
    for (const r of filteredRows) {
      rbA += Number(r.rb_actual || 0);
      rbP += Number(r.rb_planned || 0);
      tiA += Number(r.ti_actual || 0);
      tiP += Number(r.ti_planned || 0);
      vlA += Number(r.vl_actual || 0);
      vlP += Number(r.vl_planned || 0);
      coA += Number(r.co_actual || 0);
      coP += Number(r.co_planned || 0);
      rlA += Number(r.rl_actual || 0);
      rlP += Number(r.rl_planned || 0);
      months.add(monthKey(r.competence_month));
      contracts.add(r.project_id);
    }
    return {
      grossRevenueActual: rbA,
      grossRevenuePlanned: rbP,
      taxesActual: tiA,
      taxesPlanned: tiP,
      revenueActual: vlA,
      revenuePlanned: vlP,
      costActual: coA,
      costPlanned: coP,
      resultActual: rlA,
      resultPlanned: rlP,
      marginActualPct: vlA > 0 ? (rlA / vlA) * 100 : 0,
      marginPlannedPct: vlP > 0 ? (rlP / vlP) * 100 : 0,
      variance: rlA - rlP,
      contracts: contracts.size,
      monthsCount: months.size || 1,
    };
  }, [filteredRows]);

  // ---------- YTD: acumulado do ano corrente até a competência efetiva ----------
  // Usa o ano da competência efetiva. Se nenhum dado, retorna zeros.
  const ytd = useMemo(() => {
    let vlA = 0, vlP = 0, coA = 0, coP = 0, rlA = 0, rlP = 0;
    const ref = effectiveTo ?? effectiveFrom ?? latestAvailable ?? null;
    if (!ref) return { revenueActual: 0, revenuePlanned: 0, costActual: 0, costPlanned: 0, resultActual: 0, resultPlanned: 0 };
    const year = ref.slice(0, 4);
    const yearStart = `${year}-01`;
    for (const r of scopedRows) {
      const mk = monthKey(r.competence_month);
      if (mk < yearStart || mk > ref) continue;
      vlA += Number(r.vl_actual || 0);
      vlP += Number(r.vl_planned || 0);
      coA += Number(r.co_actual || 0);
      coP += Number(r.co_planned || 0);
      rlA += Number(r.rl_actual || 0);
      rlP += Number(r.rl_planned || 0);
    }
    return { revenueActual: vlA, revenuePlanned: vlP, costActual: coA, costPlanned: coP, resultActual: rlA, resultPlanned: rlP };
  }, [scopedRows, effectiveFrom, effectiveTo, latestAvailable]);

  // ---------- Série mensal (NÃO afetada pelo filtro de competência) ----------
  // Cada barra = um mês. Aqui usamos scopedRows para mostrar todo o histórico.
  const monthlySeries = useMemo<ConsolidatedMonthlyPoint[]>(() => {
    const map = new Map<string, ConsolidatedMonthlyPoint>();
    for (const r of scopedRows) {
      const mk = monthKey(r.competence_month);
      let p = map.get(mk);
      if (!p) {
        p = {
          month: mk,
          label: PT(mk),
          revenuePlanned: 0,
          revenueActual: 0,
          costPlanned: 0,
          costActual: 0,
          resultPlanned: 0,
          resultActual: 0,
          marginPlannedPct: null,
          marginActualPct: null,
        };
        map.set(mk, p);
      }
      p.revenuePlanned += Number(r.vl_planned || 0);
      p.revenueActual += Number(r.vl_actual || 0);
      p.costPlanned += Number(r.co_planned || 0);
      p.costActual += Number(r.co_actual || 0);
      p.resultPlanned += Number(r.rl_planned || 0);
      p.resultActual += Number(r.rl_actual || 0);
    }
    const list = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    list.forEach((p) => {
      p.marginPlannedPct = p.revenuePlanned > 0 ? (p.resultPlanned / p.revenuePlanned) * 100 : null;
      p.marginActualPct = p.revenueActual > 0 ? (p.resultActual / p.revenueActual) * 100 : null;
    });
    return list;
  }, [scopedRows]);

  // ---------- Tabela "Todos os contratos no escopo" ----------
  const contracts = useMemo<ConsolidatedContractRow[]>(() => {
    type Acc = {
      vlA: number; vlP: number; coA: number; coP: number;
      rlA: number; rlP: number;
      lastMonth: string | null;
      lastSaude: ContractSaude;
    };
    const acc = new Map<string, Acc>();

    for (const r of filteredRows) {
      let v = acc.get(r.project_id);
      if (!v) {
        v = { vlA: 0, vlP: 0, coA: 0, coP: 0, rlA: 0, rlP: 0, lastMonth: null, lastSaude: "sem_dados" };
        acc.set(r.project_id, v);
      }
      v.vlA += Number(r.vl_actual || 0);
      v.vlP += Number(r.vl_planned || 0);
      v.coA += Number(r.co_actual || 0);
      v.coP += Number(r.co_planned || 0);
      v.rlA += Number(r.rl_actual || 0);
      v.rlP += Number(r.rl_planned || 0);
      // Última competência do contrato no escopo é a maior data
      if (!v.lastMonth || r.competence_month > v.lastMonth) {
        v.lastMonth = r.competence_month;
        v.lastSaude = r.saude ?? "sem_dados";
      }
    }

    const meta = projectsMeta ?? {};
    const filterHealth = filters.health && filters.health !== "all" ? filters.health : null;

    const out: ConsolidatedContractRow[] = [];
    acc.forEach((v, projectId) => {
      const m = meta[projectId];
      if (!m) return;
      if (filterHealth && v.lastSaude !== filterHealth) return;
      out.push({
        projectId,
        client: m.client,
        name: m.name,
        isCorporate: m.isCorporate,
        saude: v.lastSaude,
        revenueActual: v.vlA,
        revenuePlanned: v.vlP,
        costActual: v.coA,
        costPlanned: v.coP,
        resultActual: v.rlA,
        resultPlanned: v.rlP,
        marginActualPct: v.vlA > 0 ? (v.rlA / v.vlA) * 100 : 0,
        marginPlannedPct: v.vlP > 0 ? (v.rlP / v.vlP) * 100 : 0,
        lastCompetence: v.lastMonth,
      });
    });
    // Ordenação padrão: Custo Real decrescente (alinhado ao "Resumo do Resultado"
    // da planilha Megasteam — quem mais consome custo aparece primeiro).
    out.sort((a, b) => b.costActual - a.costActual);
    return out;
  }, [filteredRows, projectsMeta, filters.health]);

  // ---------- Ranking de clientes (real) ----------
  const clientRanking = useMemo<ConsolidatedClientRow[]>(() => {
    type Acc = { contracts: Set<string>; vlA: number; coA: number; rlA: number };
    const map = new Map<string, Acc>();
    for (const c of contracts) {
      let v = map.get(c.client);
      if (!v) {
        v = { contracts: new Set(), vlA: 0, coA: 0, rlA: 0 };
        map.set(c.client, v);
      }
      v.contracts.add(c.projectId);
      v.vlA += c.revenueActual;
      v.coA += c.costActual;
      v.rlA += c.resultActual;
    }
    const out: ConsolidatedClientRow[] = [];
    map.forEach((v, client) => {
      out.push({
        client,
        contracts: v.contracts.size,
        revenueActual: v.vlA,
        costActual: v.coA,
        resultActual: v.rlA,
        marginActualPct: v.vlA > 0 ? (v.rlA / v.vlA) * 100 : 0,
      });
    });
    out.sort((a, b) => b.revenueActual - a.revenueActual);
    return out;
  }, [contracts]);

  // Lista de clientes (para popular o dropdown de filtro)
  const clients = useMemo(() => {
    const set = new Set<string>();
    Object.values(projectsMeta ?? {}).forEach((m) => {
      if (m.status === "active" && m.client) set.add(m.client);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projectsMeta]);

  return {
    isLoading,
    kpis,
    /** YTD: acumulado do ano da competência efetiva (claramente separado dos KPIs do mês). */
    ytd,
    monthlySeries,
    contracts,
    clientRanking,
    clients,
    /** Linhas brutas de contract_results já filtradas por escopo/cliente/competência. */
    rows: filteredRows,
    /** Competência efetivamente aplicada (mês mais recente quando o usuário não filtra). */
    effectiveCompetence: { from: effectiveFrom ?? null, to: effectiveTo ?? null },
    /** Último mês com dados no escopo (independente de filtro). */
    latestAvailableCompetence: latestAvailable,
  };
};
