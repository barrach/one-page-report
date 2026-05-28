import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

/**
 * Catálogo mestre de cargos (job_roles).
 * Editável globalmente em Configurações → Cargos & Salários.
 * Cada or amento usa o cargo + salário base como referência, com possibilidade
 * de override por linha em schedule_workforce.base_salary_override.
 */

export type JobClassification = "MOD" | "MOI_CLT" | "MOI_PJ";

export interface JobRole {
  id: string;
  user_id: string;
  role_code: string;
  role_name: string;
  specialty_code: string | null;
  classification: JobClassification;
  base_salary: number;
  pericul_default: boolean;
  insalub_default: boolean;
  is_supervisor: boolean;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
}

export function useJobRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["job_roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<JobRole[]> => {
      const { data, error } = await supabase
        .from("job_roles")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as JobRole[]) || [];
    },
  });
}

export function useUpdateJobRole() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<JobRole> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("job_roles").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_roles", user?.id] });
      toast.success("Cargo atualizado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useCreateJobRole() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      role: Omit<JobRole, "id" | "user_id"> & { user_id?: string },
    ) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("job_roles").insert({ ...role, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_roles", user?.id] });
      toast.success("Cargo criado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
