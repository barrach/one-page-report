// ============================================================
// useFixedAssetDepreciation — agrega fixed_asset_entries
// ============================================================
// Devolve mapa "YYYY-MM|<conta_pg>" → soma de depreciação para
// um contrato específico. Usado pelo ContractBudgetAcomp para
// SUBSTITUIR o Realizado das linhas PG 7.51..7.66.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useMemo } from "react";

export interface DepreciationCell {
  ym: string;
  conta_pg: string;
  total: number;
}

export const useFixedAssetDepreciation = (params?: { projectId?: string | null }) => {
  const projectId = params?.projectId ?? null;
  const query = useQuery({
    queryKey: ["fixed-asset-depreciation", projectId],
    queryFn: async () => {
      let q = supabase
        .from("fixed_asset_entries")
        .select("competence_month, conta_pg, value, contract_project_id, entry_type")
        .eq("entry_type", "depreciacao");
      if (projectId) q = q.eq("contract_project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: true,
  });

  /** Map "YYYY-MM|7.51" → soma. */
  const byMonthAndAccount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of query.data ?? []) {
      const ym = String(r.competence_month).slice(0, 7);
      const conta = (r.conta_pg ?? "").trim();
      if (!conta) continue;
      const k = `${ym}|${conta}`;
      m.set(k, (m.get(k) ?? 0) + Number(r.value || 0));
    }
    return m;
  }, [query.data]);

  /** Map "YYYY-MM" → soma total (todas as contas). */
  const totalByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of query.data ?? []) {
      const ym = String(r.competence_month).slice(0, 7);
      m.set(ym, (m.get(ym) ?? 0) + Number(r.value || 0));
    }
    return m;
  }, [query.data]);

  return {
    ...query,
    byMonthAndAccount,
    totalByMonth,
  };
};
