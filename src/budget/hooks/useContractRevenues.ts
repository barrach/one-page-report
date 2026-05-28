import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

export interface ContractRevenueRow {
  id: string;
  project_id: string;
  competence_month: string;
  revenue_planned: number;
  revenue_actual: number;
  pending_balance: number;
  observation: string | null;
  notes: string | null;
  projects?: { project_name?: string; client?: string; dept_code?: string | null };
}

export const useContractRevenues = (projectId?: string) =>
  useQuery({
    queryKey: ["contract-revenues", projectId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("contract_revenues")
        .select("*, projects(project_name, client, dept_code)")
        .order("competence_month", { ascending: true });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ContractRevenueRow[];
    },
  });
