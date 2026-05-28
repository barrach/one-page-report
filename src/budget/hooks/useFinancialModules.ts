import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useMemo } from "react";
import { useFinancialEntries, useContractRevenues } from "./useFinancial";

const FINANCIAL_DEPENDENT_KEYS: string[][] = [
  ["financial-baselines"],
  ["financial-entries"],
  ["financial-imports"],
  ["financial-allocations"],
  ["contract-revenues"],
  ["payroll-entries"],
  ["fixed-assets"],
  ["fixed-asset-entries"],
  ["fixed-asset-depreciation"],
];
const invalidateFinancialChain = (qc: QueryClient) => {
  FINANCIAL_DEPENDENT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
};

// ============== PRODUÇÃO (Receita por contrato/mês) ==============
export const useProductionByContract = () => {
  const { data: revenues, isLoading } = useContractRevenues();
  const aggregated = useMemo(() => {
    if (!revenues) return [];
    const map = new Map<string, { projectId: string; projectName: string; client?: string; planned: number; actual: number; months: Set<string> }>();
    for (const r of revenues) {
      const p = (r as { projects?: { project_name?: string; client?: string } }).projects;
      const cur = map.get(r.project_id) ?? {
        projectId: r.project_id, projectName: p?.project_name ?? "—",
        client: p?.client, planned: 0, actual: 0, months: new Set(),
      };
      cur.planned += Number(r.revenue_planned || 0);
      cur.actual += Number(r.revenue_actual || 0);
      cur.months.add(String(r.competence_month).slice(0, 7));
      map.set(r.project_id, cur);
    }
    return Array.from(map.values()).map((v) => ({ ...v, monthsCount: v.months.size }));
  }, [revenues]);
  return { data: aggregated, isLoading };
};

// ============== PESSOAL (Folha) ==============
export const usePayrollEntries = (filters?: { projectId?: string }) => {
  return useQuery({
    queryKey: ["payroll-entries", filters?.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("payroll_entries")
        .select("*, projects(project_name, client)")
        .order("competence_month", { ascending: false });
      if (filters?.projectId) q = q.eq("contract_project_id", filters.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};


export const useUpsertPayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; competence_month: string; contract_project_id?: string | null;
      headcount: number; gross_payroll: number; charges?: number; benefits?: number; notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = { ...input, user_id: user.id };
      const { data, error } = input.id
        ? await supabase.from("payroll_entries").update(payload).eq("id", input.id).select().single()
        : await supabase.from("payroll_entries").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Folha salva" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
};

export const useDeletePayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Registro removido" });
    },
  });
};

// ============== IMOBILIZADO ==============
export const useFixedAssets = (filters?: { projectId?: string }) => {
  return useQuery({
    queryKey: ["fixed-assets", filters?.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("fixed_assets")
        .select("*, projects(project_name, client)")
        .order("acquisition_date", { ascending: false });
      if (filters?.projectId) q = q.eq("contract_project_id", filters.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};


// Lista lançamentos mensais (depreciação) — opcionalmente filtrados por contrato.
export const useFixedAssetEntries = (filters?: { projectId?: string }) => {
  return useQuery({
    queryKey: ["fixed-asset-entries", filters?.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("fixed_asset_entries")
        .select("*")
        .order("competence_month", { ascending: true });
      if (filters?.projectId) q = q.eq("contract_project_id", filters.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};

// Gera as linhas de depreciação a partir de um ativo (auto-spread linear).
function buildDepreciationEntries(asset: {
  id: string; user_id: string; contract_project_id: string | null;
  acquisition_date: string; acquisition_value: number; amortization_months: number;
  conta_pg: string | null;
}) {
  const months = Math.max(1, Number(asset.amortization_months || 1));
  const total = Math.abs(Number(asset.acquisition_value || 0));
  const quota = total / months;
  const start = new Date(asset.acquisition_date + "T00:00:00");
  const rows = [] as Array<{
    user_id: string; asset_id: string; contract_project_id: string | null;
    entry_type: "depreciacao"; entry_date: string; competence_month: string;
    conta_pg: string | null; value: number; installment_index: number; installment_total: number;
  }>;
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    rows.push({
      user_id: asset.user_id,
      asset_id: asset.id,
      contract_project_id: asset.contract_project_id,
      entry_type: "depreciacao",
      entry_date: ym,
      competence_month: ym,
      conta_pg: asset.conta_pg,
      value: quota,
      installment_index: i + 1,
      installment_total: months,
    });
  }
  return rows;
}

export const useUpsertFixedAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; description: string; supplier?: string;
      contract_project_id?: string | null; acquisition_value: number;
      acquisition_date: string; amortization_months: number; notes?: string;
      conta_pg?: string | null; nf?: string | null; depto?: string | null;
      status?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const months = Math.max(1, Number(input.amortization_months || 1));
      const quota = Math.abs(Number(input.acquisition_value || 0)) / months;
      const payload = { ...input, quota_mensal: quota, user_id: user.id };
      const { data, error } = input.id
        ? await supabase.from("fixed_assets").update(payload).eq("id", input.id).select().single()
        : await supabase.from("fixed_assets").insert(payload).select().single();
      if (error) throw error;

      // Re-gera entries de depreciação (idempotente).
      await supabase.from("fixed_asset_entries").delete().eq("asset_id", data.id).eq("entry_type", "depreciacao");
      const rows = buildDepreciationEntries({
        id: data.id, user_id: user.id,
        contract_project_id: input.contract_project_id ?? null,
        acquisition_date: input.acquisition_date,
        acquisition_value: input.acquisition_value,
        amortization_months: months,
        conta_pg: input.conta_pg ?? null,
      });
      if (rows.length) {
        const { error: eErr } = await supabase.from("fixed_asset_entries").insert(rows);
        if (eErr) throw eErr;
      }
      return data;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Ativo salvo" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteFixedAsset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // entries são removidas em cascata? Não — não há FK. Limpamos manualmente.
      await supabase.from("fixed_asset_entries").delete().eq("asset_id", id);
      const { error } = await supabase.from("fixed_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Ativo removido" });
    },
  });
};

// Importação bulk: substitui (por external_item_id) ativos + entries.
export const useImportFixedAssets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assets: Array<{
        external_item_id: number; description: string; supplier: string | null;
        nf: string | null; conta_pg: string; depto: number | null;
        contract_project_id: string | null; is_headquarters: boolean;
        acquisition_date: string; acquisition_value: number;
        amortization_months: number; quota_mensal: number;
      }>;
      entries: Array<{
        external_item_id: number; entry_type: "aquisicao" | "depreciacao";
        competence_month: string; entry_date: string; conta_pg: string;
        value: number; installment_index: number | null;
      }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1) Carrega mapping external_item_id → existing fixed_assets.id (do usuário)
      const { data: existing, error: e0 } = await supabase
        .from("fixed_assets").select("id, external_item_id")
        .eq("user_id", user.id).not("external_item_id", "is", null);
      if (e0) throw e0;
      const existingMap = new Map<number, string>();
      (existing ?? []).forEach((r) => {
        if (r.external_item_id != null) existingMap.set(Number(r.external_item_id), r.id);
      });

      // 2) Upsert ativos (descartando id antigo se houver — atualizamos in-place)
      const idByExternal = new Map<number, string>();
      let inserted = 0, updated = 0;
      for (const a of input.assets) {
        const payload = {
          user_id: user.id,
          external_item_id: a.external_item_id,
          description: a.description,
          supplier: a.supplier,
          nf: a.nf,
          conta_pg: a.conta_pg,
          depto: a.depto != null ? String(a.depto) : null,
          contract_project_id: a.contract_project_id,
          acquisition_date: a.acquisition_date,
          acquisition_value: a.acquisition_value,
          amortization_months: a.amortization_months,
          quota_mensal: a.quota_mensal,
          status: "active",
        };
        const existingId = existingMap.get(a.external_item_id);
        if (existingId) {
          const { error } = await supabase.from("fixed_assets").update(payload).eq("id", existingId);
          if (error) throw error;
          idByExternal.set(a.external_item_id, existingId);
          updated++;
        } else {
          const { data: ins, error } = await supabase.from("fixed_assets").insert(payload).select("id").single();
          if (error) throw error;
          idByExternal.set(a.external_item_id, ins.id);
          inserted++;
        }
      }

      // 3) Limpa entries antigas dos ativos importados
      const assetIds = [...idByExternal.values()];
      if (assetIds.length) {
        const { error } = await supabase.from("fixed_asset_entries").delete().in("asset_id", assetIds);
        if (error) throw error;
      }

      // 4) Insere entries (em chunks)
      const rows = input.entries
        .map((e) => {
          const aid = idByExternal.get(e.external_item_id);
          const a = input.assets.find((x) => x.external_item_id === e.external_item_id);
          if (!aid || !a) return null;
          return {
            user_id: user.id,
            asset_id: aid,
            contract_project_id: a.contract_project_id,
            entry_type: e.entry_type,
            entry_date: e.entry_date,
            competence_month: e.competence_month,
            conta_pg: e.conta_pg,
            value: e.value,
            installment_index: e.installment_index,
            installment_total: a.amortization_months,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const CHUNK = 500;
      let entryCount = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("fixed_asset_entries").insert(slice);
        if (error) throw error;
        entryCount += slice.length;
      }

      return { inserted, updated, entries: entryCount };
    },
    onSuccess: (res) => {
      invalidateFinancialChain(qc);
      toast({
        title: "Imobilizado importado",
        description: `${res.inserted} novos · ${res.updated} atualizados · ${res.entries} lançamentos.`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });
};

// ============== RATEIO ADMINISTRATIVO ==============
// Calcula a distribuição proporcional dos lançamentos sem contrato
// usando como base a participação de cada contrato na receita total realizada.
export const useAdminAllocation = () => {
  const { data: entries, isLoading: loadingEntries } = useFinancialEntries();
  const { data: revenues, isLoading: loadingRevs } = useContractRevenues();

  const result = useMemo(() => {
    const valid = (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate);
    const unallocated = valid.filter((e) => !e.contract_project_id);
    const totalToAllocate = unallocated.reduce((s, e) => s + Number(e.cost_value || 0), 0);

    const revMap = new Map<string, { name: string; revenue: number }>();
    for (const r of revenues ?? []) {
      const p = (r as { projects?: { project_name?: string } }).projects;
      const cur = revMap.get(r.project_id) ?? { name: p?.project_name ?? "—", revenue: 0 };
      cur.revenue += Number(r.revenue_actual || 0);
      revMap.set(r.project_id, cur);
    }
    const totalRevenue = Array.from(revMap.values()).reduce((s, v) => s + v.revenue, 0);
    const distribution = Array.from(revMap.entries()).map(([projectId, v]) => {
      const sharePct = totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0;
      const allocated = (sharePct / 100) * totalToAllocate;
      const directCost = valid
        .filter((e) => e.contract_project_id === projectId)
        .reduce((s, e) => s + Number(e.cost_value || 0), 0);
      return {
        projectId, name: v.name, revenue: v.revenue,
        sharePct, directCost, adminAllocated: allocated,
        totalCost: directCost + allocated, margin: v.revenue - (directCost + allocated),
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return { distribution, totalToAllocate, totalRevenue, unallocatedCount: unallocated.length };
  }, [entries, revenues]);

  return { ...result, isLoading: loadingEntries || loadingRevs };
};

// ============== DRG MENSAL CONSOLIDADO ==============
type CellByMonth = Record<string, number>;
export interface DrgMonthlyRow {
  key: string;
  label: string;
  costClass: string;
  byMonth: CellByMonth;
  total: number;
}

export const useDrgMonthly = (projectId?: string) => {
  const { data: entries, isLoading } = useFinancialEntries({ projectId });
  const { data: revenues } = useContractRevenues();

  const result = useMemo(() => {
    const months = new Set<string>();
    const valid = (entries ?? [])
      .filter((e) => !e.is_excluded && !e.is_duplicate)
      .filter((e) => !projectId || e.contract_project_id === projectId);

    // Linhas de custo por categoria
    const rows = new Map<string, DrgMonthlyRow>();
    for (const e of valid) {
      const cat = (e as { financial_categories?: { name?: string; code?: string; cost_class?: string } }).financial_categories;
      const key = cat?.code ?? "uncategorized";
      const month = e.competence ?? (e.competence_date ? String(e.competence_date).slice(0, 7) : "—");
      months.add(month);
      const cur = rows.get(key) ?? {
        key, label: cat?.name ?? "Sem categoria",
        costClass: cat?.cost_class ?? "—",
        byMonth: {}, total: 0,
      };
      const v = Number(e.cost_value || 0);
      cur.byMonth[month] = (cur.byMonth[month] ?? 0) + v;
      cur.total += v;
      rows.set(key, cur);
    }

    // Receita por mês
    const revenueByMonth: CellByMonth = {};
    for (const r of revenues ?? []) {
      if (projectId && r.project_id !== projectId) continue;
      const m = String(r.competence_month).slice(0, 7);
      months.add(m);
      revenueByMonth[m] = (revenueByMonth[m] ?? 0) + Number(r.revenue_actual || 0);
    }

    const sortedMonths = Array.from(months).filter((m) => m !== "—").sort();
    const sortedRows = Array.from(rows.values()).sort((a, b) => b.total - a.total);
    const totalRevenue = Object.values(revenueByMonth).reduce((s, v) => s + v, 0);
    const totalCost = sortedRows.reduce((s, r) => s + r.total, 0);

    return {
      months: sortedMonths,
      rows: sortedRows,
      revenueByMonth,
      totalRevenue,
      totalCost,
      result: totalRevenue - totalCost,
    };
  }, [entries, revenues, projectId]);

  return { ...result, isLoading };
};
