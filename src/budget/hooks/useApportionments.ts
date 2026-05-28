import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

export interface ApportionmentRow {
  id: string;
  user_id: string;
  target_project_id: string;
  competence_month: string;
  apportioned_value: number;
  apportionment_percent: number;
  rule_type: string;
  rule_name: string | null;
  notes: string | null;
  projects?: { project_name?: string; dept_code?: string | null };
}

export const useApportionments = (ruleName?: string) => {
  return useQuery({
    queryKey: ["financial-apportionments", ruleName ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("financial_apportionments")
        .select("*, projects:target_project_id(project_name, dept_code)")
        .order("competence_month", { ascending: true });
      if (ruleName) q = q.eq("rule_name", ruleName);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ApportionmentRow[];
    },
  });
};
