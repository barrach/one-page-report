import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@budget/integrations/supabase/types";

export type ScopeItem = Tables<"scope_items">;
export type ScopeComponent = Tables<"scope_components">;
export type ScopeItemInsert = TablesInsert<"scope_items">;
export type ScopeComponentInsert = TablesInsert<"scope_components">;

const SCOPE_CATEGORIES = [
  { key: "atividades_principais", label: "Atividades Principais", icon: "Wrench" },
  { key: "atividades_auxiliares", label: "Atividades Auxiliares", icon: "CheckCircle" },
  { key: "pre_requisitos", label: "Pré-requisitos", icon: "FileText" },
  { key: "materiais", label: "Materiais Necessários", icon: "Package" },
  { key: "recursos_humanos", label: "Recursos Humanos", icon: "Users" },
  { key: "equipamentos", label: "Equipamentos", icon: "Truck" },
  { key: "terceirizados", label: "Serviços Terceirizados", icon: "Users" },
  { key: "riscos", label: "Riscos e Contingências", icon: "AlertTriangle" },
] as const;

export { SCOPE_CATEGORIES };

export function useScopeItems(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["scope_items", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("scope_items")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ScopeItem[];
    },
    enabled: !!scenarioId,
  });
}

export function useScopeComponents(scopeItemId: string | undefined) {
  return useQuery({
    queryKey: ["scope_components", scopeItemId],
    queryFn: async () => {
      if (!scopeItemId) return [];
      const { data, error } = await supabase
        .from("scope_components")
        .select("*")
        .eq("scope_item_id", scopeItemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ScopeComponent[];
    },
    enabled: !!scopeItemId,
  });
}

export function useScopeMutations(scenarioId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addItem = useMutation({
    mutationFn: async (item: Omit<ScopeItemInsert, "user_id" | "scenario_id">) => {
      if (!user || !scenarioId) throw new Error("Missing user or scenario");
      const { data, error } = await supabase
        .from("scope_items")
        .insert({ ...item, user_id: user.id, scenario_id: scenarioId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scope_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
      toast.success("Item adicionado");
    },
    onError: (e) => toast.error("Erro ao adicionar: " + e.message),
  });

  const addItemsBatch = useMutation({
    mutationFn: async (items: Omit<ScopeItemInsert, "user_id" | "scenario_id">[]) => {
      if (!user || !scenarioId) throw new Error("Missing user or scenario");
      const rows = items.map((item, i) => ({
        ...item,
        user_id: user.id,
        scenario_id: scenarioId,
      }));
      const { data, error } = await supabase
        .from("scope_items")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scope_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
      toast.success(`${data.length} item(ns) adicionado(s)`);
    },
    onError: (e) => toast.error("Erro ao adicionar em lote: " + e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"scope_items"> & { id: string }) => {
      const { error } = await supabase.from("scope_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scope_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scope_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scope_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
      toast.success("Item removido");
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const addComponent = useMutation({
    mutationFn: async (comp: Omit<ScopeComponentInsert, "user_id">) => {
      if (!user) throw new Error("Missing user");
      const { data, error } = await supabase
        .from("scope_components")
        .insert({ ...comp, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["scope_components", vars.scope_item_id] });
      if (scenarioId) {
        queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
        queryClient.invalidateQueries({ queryKey: ["scenario_phases", scenarioId] });
      }
      toast.success("Componente adicionado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateComponent = useMutation({
    mutationFn: async ({ id, scope_item_id, ...updates }: TablesUpdate<"scope_components"> & { id: string; scope_item_id: string }) => {
      const { error } = await supabase.from("scope_components").update(updates).eq("id", id);
      if (error) throw error;
      return scope_item_id;
    },
    onSuccess: (scopeItemId) => {
      queryClient.invalidateQueries({ queryKey: ["scope_components", scopeItemId] });
      if (scenarioId) {
        queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
      }
    },
  });

  const removeComponent = useMutation({
    mutationFn: async ({ id, scope_item_id }: { id: string; scope_item_id: string }) => {
      const { error } = await supabase.from("scope_components").delete().eq("id", id);
      if (error) throw error;
      return scope_item_id;
    },
    onSuccess: (scopeItemId) => {
      queryClient.invalidateQueries({ queryKey: ["scope_components", scopeItemId] });
      if (scenarioId) {
        queryClient.invalidateQueries({ queryKey: ["all_scope_components", scenarioId] });
      }
      toast.success("Componente removido");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { addItem, addItemsBatch, updateItem, removeItem, addComponent, updateComponent, removeComponent };
}

export function useActiveScenario(projectId: string | undefined) {
  return useQuery({
    queryKey: ["active_scenario", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("budget_scenarios")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_base", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useUserProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client, version, proposal, unit, location, expected_duration_days, contract_type, status, mobilization_days, demobilization_days, start_date, notes, scope_description")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useEnsureScenario(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user || !projectId) throw new Error("Missing data");
      // Check if base scenario exists
      const { data: existing } = await supabase
        .from("budget_scenarios")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_base", true)
        .maybeSingle();
      if (existing) return existing.id;
      // Create one
      const { data, error } = await supabase
        .from("budget_scenarios")
        .insert({ project_id: projectId, user_id: user.id, name: "Base", is_base: true })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_scenario", projectId] });
    },
  });
}
