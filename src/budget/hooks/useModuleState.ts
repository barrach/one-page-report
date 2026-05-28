import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";

export type ModuleKey =
  | "planejado"
  | "real_mensal"
  | "rateios"
  | "rateio_admin"
  | "producao"
  | "pessoal"
  | "imobilizado"
  | "drg"
  | "drg_mensal"
  | "dashboard";

export type ModuleScope = {
  module: ModuleKey;
  competenceMonth?: string | null; // 'YYYY-MM-01'
  projectId?: string | null;
};

const keyOf = (s: ModuleScope) => ["financial-module-state", s.module, s.competenceMonth ?? null, s.projectId ?? null];

/** Lista de módulos que devem revalidar quando algo mudar. */
const CROSS_INVALIDATION_KEYS = [
  ["financial-baselines"],
  ["financial-entries"],
  ["financial-imports"],
  ["financial-allocations"],
  ["contract-revenues"],
  ["payroll-entries"],
  ["fixed-assets"],
  ["production-by-contract"],
  ["admin-allocation"],
  ["drg-monthly"],
  ["financial-dashboard"],
];

export function useInvalidateFinancial() {
  const qc = useQueryClient();
  return () => {
    CROSS_INVALIDATION_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };
}

export function useModuleState(scope: ModuleScope) {
  return useQuery({
    queryKey: keyOf(scope),
    queryFn: async () => {
      let q = supabase
        .from("financial_module_states")
        .select("*")
        .eq("module_key", scope.module)
        .order("version", { ascending: false })
        .limit(1);
      if (scope.competenceMonth) q = q.eq("competence_month", scope.competenceMonth);
      else q = q.is("competence_month", null);
      if (scope.projectId) q = q.eq("scope_project_id", scope.projectId);
      else q = q.is("scope_project_id", null);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConfirmModule() {
  const qc = useQueryClient();
  const invalidateAll = useInvalidateFinancial();
  return useMutation({
    mutationFn: async (scope: ModuleScope & { notes?: string }) => {
      const { data, error } = await supabase.rpc("confirm_financial_module", {
        _module_key: scope.module,
        _competence_month: scope.competenceMonth ?? null,
        _scope_project_id: scope.projectId ?? null,
        _notes: scope.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_id, scope) => {
      qc.invalidateQueries({ queryKey: keyOf(scope) });
      invalidateAll();
      toast.success("Etapa confirmada", { description: "Versão consolidada disponível no dashboard." });
    },
    onError: (e: Error) => toast.error("Erro ao confirmar", { description: e.message }),
  });
}

export function useReopenModule() {
  const qc = useQueryClient();
  const invalidateAll = useInvalidateFinancial();
  return useMutation({
    mutationFn: async (scope: ModuleScope) => {
      const { data, error } = await supabase.rpc("reopen_financial_module", {
        _module_key: scope.module,
        _competence_month: scope.competenceMonth ?? null,
        _scope_project_id: scope.projectId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_id, scope) => {
      qc.invalidateQueries({ queryKey: keyOf(scope) });
      invalidateAll();
      toast("Módulo reaberto", { description: "Edições voltam a contar como rascunho." });
    },
  });
}
