import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@budget/integrations/supabase/types";

export type ScenarioPhase = Tables<"scenario_phases">;

export function useScenarioPhases(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["scenario_phases", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("scenario_phases")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ScenarioPhase[];
    },
    enabled: !!scenarioId,
  });
}

export function useAllScopeComponents(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["all_scope_components", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      // Get all scope_items for this scenario, then get all components
      const { data: items, error: e1 } = await supabase
        .from("scope_items")
        .select("id")
        .eq("scenario_id", scenarioId);
      if (e1) throw e1;
      if (!items || items.length === 0) return [];
      const ids = items.map((i) => i.id);
      const { data, error } = await supabase
        .from("scope_components")
        .select("*")
        .in("scope_item_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: !!scenarioId,
  });
}

export function usePhaseMutations(scenarioId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addPhase = useMutation({
    mutationFn: async (phase: Omit<TablesInsert<"scenario_phases">, "user_id" | "scenario_id">) => {
      if (!user || !scenarioId) throw new Error("Missing data");
      const { data, error } = await supabase
        .from("scenario_phases")
        .insert({ ...phase, user_id: user.id, scenario_id: scenarioId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario_phases", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      toast.success("Fase adicionada");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"scenario_phases"> & { id: string }) => {
      const { error } = await supabase.from("scenario_phases").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario_phases", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
    },
  });

  const removePhase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenario_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario_phases", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      toast.success("Fase removida");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { addPhase, updatePhase, removePhase };
}

// Productivity calculation engine
export interface ProductivitySummary {
  totalBaseHH: number;
  totalAdjustedHH: number;
  totalAdjustmentFactor: number;
  byCategory: Record<string, { baseHH: number; adjustedHH: number; count: number }>;
}

export function computeProductivitySummary(components: any[]): ProductivitySummary {
  const byCategory: Record<string, { baseHH: number; adjustedHH: number; count: number }> = {};
  let totalBaseHH = 0;
  let totalAdjustedHH = 0;

  for (const c of components) {
    const baseHH = Number(c.calculated_hh) || 0;
    const adjustedHH = Number(c.adjusted_hh) || baseHH;
    totalBaseHH += baseHH;
    totalAdjustedHH += adjustedHH;

    const cat = c.resource_type || "Geral";
    if (!byCategory[cat]) byCategory[cat] = { baseHH: 0, adjustedHH: 0, count: 0 };
    byCategory[cat].baseHH += baseHH;
    byCategory[cat].adjustedHH += adjustedHH;
    byCategory[cat].count += 1;
  }

  return {
    totalBaseHH,
    totalAdjustedHH,
    totalAdjustmentFactor: totalBaseHH > 0 ? totalAdjustedHH / totalBaseHH : 1,
    byCategory,
  };
}

export function computeAdjustedHH(
  baseHH: number,
  factors: {
    factor_complexity: number;
    factor_interference: number;
    factor_access: number;
    factor_climate: number;
    factor_shift: number;
    factor_restriction: number;
  }
): number {
  const combined =
    factors.factor_complexity *
    factors.factor_interference *
    factors.factor_access *
    factors.factor_climate *
    factors.factor_shift *
    factors.factor_restriction;
  return baseHH * combined;
}

// Team sizing: given total adjusted HH, daily hours, and available days → team size
export function computeTeamSize(adjustedHH: number, durationDays: number, dailyHours: number): number {
  if (durationDays <= 0 || dailyHours <= 0) return 0;
  return Math.ceil(adjustedHH / (durationDays * dailyHours));
}

// Histogram computation from phases
export interface HistogramPoint {
  month: string;
  monthIndex: number;
  mod: number;
  moi: number;
  total: number;
}

export function computeHistogram(phases: ScenarioPhase[], totalMonths: number): HistogramPoint[] {
  const result: HistogramPoint[] = [];
  for (let m = 0; m < Math.max(totalMonths, 1); m++) {
    const monthStart = m * 30;
    const monthEnd = (m + 1) * 30;
    let total = 0;
    for (const p of phases) {
      const phaseEnd = p.start_day + p.duration_days;
      if (p.start_day < monthEnd && phaseEnd > monthStart) {
        total += p.team_size;
      }
    }
    const mod = Math.round(total * 0.85);
    const moi = total - mod;
    result.push({ month: `M${m + 1}`, monthIndex: m, mod, moi, total });
  }
  return result;
}
