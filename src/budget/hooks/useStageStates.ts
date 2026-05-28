import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";

export type StageKey = "escopo" | "cronograma" | "hh" | "custos" | "preco";
export type StageStatus = "draft" | "saved" | "confirmed" | "reopened";

export interface StageState {
  id: string;
  scenario_id: string;
  stage_key: StageKey;
  status: StageStatus;
  confirmed_at: string | null;
  reopened_at: string | null;
}

const STAGE_ORDER: StageKey[] = ["escopo", "cronograma", "hh", "custos", "preco"];

export function useStageStates(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["stage_states", scenarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_stage_states")
        .select("*")
        .eq("scenario_id", scenarioId!);
      if (error) throw error;
      return data as StageState[];
    },
    enabled: !!scenarioId,
  });
}

export function getStageStatus(states: StageState[] | undefined, key: StageKey): StageStatus {
  if (!states) return "draft";
  const found = states.find((s) => s.stage_key === key);
  return (found?.status as StageStatus) ?? "draft";
}

export function isStageConfirmed(states: StageState[] | undefined, key: StageKey): boolean {
  return getStageStatus(states, key) === "confirmed";
}

/** Check if all prerequisite stages are confirmed */
export function canConfirmStage(states: StageState[] | undefined, key: StageKey): boolean {
  const idx = STAGE_ORDER.indexOf(key);
  if (idx <= 0) return true; // escopo has no prerequisites
  for (let i = 0; i < idx; i++) {
    if (!isStageConfirmed(states, STAGE_ORDER[i])) return false;
  }
  return true;
}

/** Get dependent stages that should be reopened when a stage is edited */
function getDependentStages(key: StageKey): StageKey[] {
  const idx = STAGE_ORDER.indexOf(key);
  return STAGE_ORDER.slice(idx + 1);
}

export function useConfirmStage(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (stageKey: StageKey) => {
      if (!scenarioId || !user) throw new Error("Missing scenario or user");
      const { error } = await supabase
        .from("budget_stage_states")
        .upsert(
          {
            scenario_id: scenarioId,
            stage_key: stageKey,
            status: "confirmed" as any,
            confirmed_at: new Date().toISOString(),
            reopened_at: null,
            user_id: user.id,
          },
          { onConflict: "scenario_id,stage_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stage_states", scenarioId] }),
  });
}

export function useReopenStage(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (stageKey: StageKey) => {
      if (!scenarioId || !user) throw new Error("Missing scenario or user");
      const dependents = getDependentStages(stageKey);
      const allKeys = [stageKey, ...dependents];

      // Reopen this stage and all dependents
      for (const key of allKeys) {
        await supabase
          .from("budget_stage_states")
          .upsert(
            {
              scenario_id: scenarioId,
              stage_key: key,
              status: "reopened" as any,
              reopened_at: new Date().toISOString(),
              user_id: user.id,
            },
            { onConflict: "scenario_id,stage_key" }
          );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stage_states", scenarioId] }),
  });
}

export function useMarkStageSaved(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (stageKey: StageKey) => {
      if (!scenarioId || !user) return;
      // Only mark as saved if currently draft
      const { data: existing } = await supabase
        .from("budget_stage_states")
        .select("status")
        .eq("scenario_id", scenarioId)
        .eq("stage_key", stageKey)
        .maybeSingle();

      const currentStatus = existing?.status;
      // If confirmed, reopen it (data changed)
      if (currentStatus === "confirmed") {
        const dependents = getDependentStages(stageKey);
        const allKeys = [stageKey, ...dependents];
        for (const key of allKeys) {
          await supabase
            .from("budget_stage_states")
            .upsert(
              {
                scenario_id: scenarioId,
                stage_key: key,
                status: "reopened" as any,
                reopened_at: new Date().toISOString(),
                user_id: user.id,
              },
              { onConflict: "scenario_id,stage_key" }
            );
        }
      } else if (!currentStatus || currentStatus === "draft") {
        await supabase
          .from("budget_stage_states")
          .upsert(
            {
              scenario_id: scenarioId,
              stage_key: stageKey,
              status: "saved" as any,
              user_id: user.id,
            },
            { onConflict: "scenario_id,stage_key" }
          );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stage_states", scenarioId] }),
  });
}
