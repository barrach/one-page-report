import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

// ===================================================================
// useContractAdminAllocation
// -------------------------------------------------------------------
// Replica EXATAMENTE a aba "Rateio Administrativo" da planilha Megasteam.
//
// Mecânica:
//   1. POOL ADM do mês = SUM(cost_value) dos lançamentos da SEDE
//      (centro de custo "1.000 - ADMINISTRATIVO" — code = "1001"
//      ou descrição começando com "1.000 - ADMINISTRATIVO").
//
//   2. RECEITA BRUTA de cada contrato no mês =
//      contract_revenues.revenue_actual (linha 1.01 do Acomp Executivo).
//
//   3. Σ(receitas brutas) = base do rateio. Apenas contratos COM
//      receita > 0 entram no rateio (status = "calculado"). Os demais
//      ficam com status = "estimado" (fallback VL × taxa_adm_pct
//      no Acompanhamento Executivo).
//
//   4. participacao_pct = receita_contrato / Σ(receitas)
//      absorcao_R$      = pool_adm × participacao_pct
//
//   5. Recálculo automático: o cache é invalidado por
//      ["contract-revenues"] e ["financial-entries"], então qualquer
//      mudança de receita ou de custo administrativo recalcula tudo.
// ===================================================================

export interface AdminAllocationRow {
  monthKey: string;          // "YYYY-MM"
  monthIso: string;          // "YYYY-MM-01"
  poolAdm: number;           // total ADM da sede no mês
  totalRevenue: number;      // Σ receita bruta de todos os contratos com receita
  myRevenue: number;         // receita bruta DESTE contrato
  participationPct: number;  // 0..100
  absorption: number;        // R$ rateado para este contrato
  status: "calculado" | "estimado" | "sem_pool" | "sem_dados";
  contractsWithRevenue: number;
}

export interface AdminAllocationData {
  rows: AdminAllocationRow[];
  /** Visão cumulativa do contrato (todos os meses com pool ADM e receita). */
  totals: {
    poolAdm: number;
    myRevenue: number;
    totalRevenue: number;
    absorption: number;
    participationPct: number;
  };
}

const monthKey = (iso: string) => String(iso).slice(0, 7);
const monthIsoOf = (iso: string) => `${monthKey(iso)}-01`;

const isAdminCostCenter = (code?: string | null, description?: string | null): boolean => {
  const c = (code ?? "").trim();
  const d = (description ?? "").trim().toLowerCase();
  if (c === "1001") return true;
  if (c.startsWith("1.000")) return true;
  if (d.startsWith("1.000 - administrativo")) return true;
  return false;
};

export const useContractAdminAllocation = (contractId: string | null | undefined) =>
  useQuery({
    queryKey: ["contract-admin-allocation", contractId ?? "none"],
    enabled: !!contractId,
    queryFn: async (): Promise<AdminAllocationData> => {
      if (!contractId) return { rows: [], totals: { poolAdm: 0, myRevenue: 0, totalRevenue: 0, absorption: 0, participationPct: 0 } };

      // 1) POOL ADM por mês (custos da sede)
      const { data: adminEntries, error: e1 } = await supabase
        .from("financial_entries")
        .select("competence, competence_date, cost_value, cost_center_code, cost_center_description")
        .eq("is_excluded", false)
        .eq("is_duplicate", false);
      if (e1) throw e1;

      const poolByMonth = new Map<string, number>();
      for (const e of adminEntries ?? []) {
        if (!isAdminCostCenter(e.cost_center_code, e.cost_center_description)) continue;
        const iso = e.competence_date ?? (e.competence ? `${e.competence}-01` : null);
        if (!iso) continue;
        const k = monthKey(iso);
        poolByMonth.set(k, (poolByMonth.get(k) ?? 0) + Number(e.cost_value || 0));
      }

      // 2) Receitas brutas de TODOS os contratos por mês
      const { data: revenues, error: e2 } = await supabase
        .from("contract_revenues")
        .select("project_id, competence_month, revenue_actual");
      if (e2) throw e2;

      const totalRevByMonth = new Map<string, number>();        // soma de todos
      const countByMonth = new Map<string, number>();           // qtd contratos com receita
      const myRevByMonth = new Map<string, number>();           // só deste contrato
      for (const r of revenues ?? []) {
        const k = monthKey(String(r.competence_month));
        const v = Number(r.revenue_actual || 0);
        if (v > 0.005) {
          totalRevByMonth.set(k, (totalRevByMonth.get(k) ?? 0) + v);
          countByMonth.set(k, (countByMonth.get(k) ?? 0) + 1);
        }
        if (r.project_id === contractId) {
          myRevByMonth.set(k, (myRevByMonth.get(k) ?? 0) + v);
        }
      }

      // 3) União de meses: qualquer mês com pool ADM OU com receita do contrato
      const monthsSet = new Set<string>([...poolByMonth.keys(), ...myRevByMonth.keys()]);
      const months = Array.from(monthsSet).sort();

      const rows: AdminAllocationRow[] = months.map((k) => {
        const poolAdm = poolByMonth.get(k) ?? 0;
        const totalRevenue = totalRevByMonth.get(k) ?? 0;
        const myRevenue = myRevByMonth.get(k) ?? 0;
        const contractsWithRevenue = countByMonth.get(k) ?? 0;

        let participationPct = 0;
        let absorption = 0;
        let status: AdminAllocationRow["status"] = "sem_dados";

        if (poolAdm <= 0.005) {
          status = "sem_pool";
        } else if (myRevenue > 0.005 && totalRevenue > 0.005) {
          participationPct = (myRevenue / totalRevenue) * 100;
          absorption = poolAdm * (myRevenue / totalRevenue);
          status = "calculado";
        } else {
          status = "estimado"; // contrato sem receita no mês — usa fallback VL × taxa_adm_pct no Acomp Exec
        }

        return {
          monthKey: k,
          monthIso: `${k}-01`,
          poolAdm,
          totalRevenue,
          myRevenue,
          participationPct,
          absorption,
          status,
          contractsWithRevenue,
        };
      });

      const totals = rows.reduce(
        (acc, r) => {
          acc.poolAdm += r.poolAdm;
          acc.myRevenue += r.myRevenue;
          acc.totalRevenue += r.totalRevenue;
          acc.absorption += r.absorption;
          return acc;
        },
        { poolAdm: 0, myRevenue: 0, totalRevenue: 0, absorption: 0, participationPct: 0 },
      );
      totals.participationPct = totals.totalRevenue > 0 ? (totals.myRevenue / totals.totalRevenue) * 100 : 0;

      return { rows, totals };
    },
    staleTime: 30 * 1000,
  });
