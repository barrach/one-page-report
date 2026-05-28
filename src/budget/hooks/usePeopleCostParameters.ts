import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DEFAULT_PEOPLE_COST_PARAMS, type PeopleCostParams } from "@budget/lib/peopleCostsEngine";

export interface PeopleCostParametersRow extends PeopleCostParams {
  id: string;
  scenario_id: string;
  user_id: string;
  notes: string | null;
}

export function usePeopleCostParameters(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["people_cost_parameters", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return null;
      const { data, error } = await supabase
        .from("people_cost_parameters" as any)
        .select("*")
        .eq("scenario_id", scenarioId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as PeopleCostParametersRow | null;
    },
    enabled: !!scenarioId,
  });
}

export function useUpsertPeopleCostParameters(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<PeopleCostParams> & { notes?: string | null }) => {
      if (!scenarioId || !user?.id) throw new Error("Cenário ou usuário ausente");

      const { data: existing } = await supabase
        .from("people_cost_parameters" as any)
        .select("id")
        .eq("scenario_id", scenarioId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("people_cost_parameters" as any)
          .update(patch as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const payload = {
          ...DEFAULT_PEOPLE_COST_PARAMS,
          ...patch,
          scenario_id: scenarioId,
          user_id: user.id,
        };
        const { error } = await supabase
          .from("people_cost_parameters" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people_cost_parameters", scenarioId] });
    },
  });
}

export function getEffectiveParams(row: PeopleCostParametersRow | null | undefined): PeopleCostParams {
  if (!row) return DEFAULT_PEOPLE_COST_PARAMS;
  const out: any = { ...DEFAULT_PEOPLE_COST_PARAMS };
  for (const k of Object.keys(DEFAULT_PEOPLE_COST_PARAMS)) {
    if ((row as any)[k] !== undefined && (row as any)[k] !== null) out[k] = (row as any)[k];
  }
  return out as PeopleCostParams;
}
