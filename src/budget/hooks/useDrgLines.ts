import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

export interface DrgLineRow {
  id: string;
  project_id: string;
  competence_month: string;
  line_code: string;
  line_label: string;
  is_percentage: boolean;
  sort_order: number;
  planned_value: number;
  actual_value: number;
  valor_financeiro: number;
  valor_transf_gerencial: number;
  valor_ajuste_contabil: number;
  source: string;
  projects?: { project_name?: string; client?: string; dept_code?: string | null };
}

export const useDrgLines = (projectId?: string) => {
  return useQuery({
    queryKey: ["financial-drg-lines", projectId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("financial_drg_lines")
        .select("*, projects(project_name, client, dept_code)")
        .order("competence_month", { ascending: true })
        .order("sort_order", { ascending: true });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DrgLineRow[];
    },
  });
};
