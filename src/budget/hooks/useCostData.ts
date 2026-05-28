import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@budget/integrations/supabase/types";

export type CostStage = Tables<"cost_stages">;
export type CostItem = Tables<"cost_items">;

// The 13 standard cost stages
export const STANDARD_STAGES = [
  { stage_code: "salarios", label: "Salários e Encargos", cost_class: "service", sort_order: 1 },
  { stage_code: "mobilizacao", label: "Mobilização / Desmobilização", cost_class: "service", sort_order: 2 },
  { stage_code: "epi_epc", label: "EPI e EPC", cost_class: "service", sort_order: 3 },
  { stage_code: "beneficios", label: "Benefícios", cost_class: "service", sort_order: 4 },
  { stage_code: "veiculos_leves", label: "Veículos Leves e Fretamento", cost_class: "service", sort_order: 5 },
  { stage_code: "hospedagem", label: "Hospedagem e Translados", cost_class: "service", sort_order: 6 },
  { stage_code: "canteiro", label: "Canteiro e Infraestrutura", cost_class: "service", sort_order: 7 },
  { stage_code: "ferramental", label: "Equipamentos e Ferramentas", cost_class: "service", sort_order: 8 },
  { stage_code: "pesados", label: "Veículos e Equip. Pesados", cost_class: "service", sort_order: 9 },
  { stage_code: "materiais", label: "Material de Consumo e Aplicação", cost_class: "material", sort_order: 10 },
  { stage_code: "terceirizados", label: "Serviços Terceirizados", cost_class: "service", sort_order: 11 },
  { stage_code: "riscos", label: "Riscos e Contingências", cost_class: "service", sort_order: 12 },
  { stage_code: "outros", label: "Outros Custos", cost_class: "service", sort_order: 13 },
] as const;

export function useCostStages(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["cost_stages", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("cost_stages")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as CostStage[];
    },
    enabled: !!scenarioId,
  });
}

export function useCostItems(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["cost_items", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("cost_items")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CostItem[];
    },
    enabled: !!scenarioId,
  });
}

export function useEnsureCostStages(scenarioId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user || !scenarioId) throw new Error("Missing data");
      const { data: existing } = await supabase
        .from("cost_stages")
        .select("stage_code")
        .eq("scenario_id", scenarioId);
      const existingCodes = new Set((existing || []).map((s) => s.stage_code));
      const toCreate = STANDARD_STAGES.filter((s) => !existingCodes.has(s.stage_code));
      if (toCreate.length === 0) return;
      const rows = toCreate.map((s) => ({
        scenario_id: scenarioId,
        user_id: user.id,
        stage_code: s.stage_code,
        label: s.label,
        cost_class: s.cost_class,
        sort_order: s.sort_order,
      }));
      const { error } = await supabase.from("cost_stages").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_stages", scenarioId] });
    },
  });
}

export function useCostMutations(scenarioId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addItem = useMutation({
    mutationFn: async (item: Omit<TablesInsert<"cost_items">, "user_id" | "scenario_id">) => {
      if (!user || !scenarioId) throw new Error("Missing data");
      const { data, error } = await supabase
        .from("cost_items")
        .insert({ ...item, user_id: user.id, scenario_id: scenarioId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
      toast.success("Item adicionado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"cost_items"> & { id: string }) => {
      const { error } = await supabase.from("cost_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
      toast.success("Item removido");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { addItem, updateItem, removeItem };
}

// Compute totals
export interface StageSummary {
  stage: CostStage;
  items: CostItem[];
  total: number;
}

export function computeStageSummaries(stages: CostStage[], items: CostItem[]): StageSummary[] {
  const itemsByStage: Record<string, CostItem[]> = {};
  for (const item of items) {
    if (!itemsByStage[item.cost_stage_id]) itemsByStage[item.cost_stage_id] = [];
    itemsByStage[item.cost_stage_id].push(item);
  }
  return stages.map((stage) => {
    const stageItems = itemsByStage[stage.id] || [];
    const total = stageItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);
    return { stage, items: stageItems, total };
  });
}
