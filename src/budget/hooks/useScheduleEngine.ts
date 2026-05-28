import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
export type RowType = "total" | "group" | "subgroup" | "function";
export type ResourceType = "MOI" | "MOD" | "ADM" | "FERRAMENTA" | "LOCADO";

export interface WorkforceRow {
  id: string;
  scenario_id: string;
  user_id: string;
  row_code: string | null;
  label: string;
  row_type: RowType;
  resource_type: ResourceType | null;
  sector: string | null;
  weekly_values: number[];
  parent_code: string | null;
  sort_order: number;
}

export interface TimelinePhase {
  id: string;
  scenario_id: string;
  user_id: string;
  phase_name: string;
  start_week: number;
  duration_weeks: number;
  color_token: string | null;
  sort_order: number;
}

// ─── Computed indicators ─────────────────────────────────────────────
export interface ScheduleIndicators {
  totalHH: number;
  peakEffective: number;
  totalWeeks: number;
  weeklyTotals: number[];
  modHH: number;
  moiHH: number;
  weeklyMOD: number[];
  weeklyMOI: number[];
}

const WEEKLY_HOURS = 44; // jornada semanal padrão

export function computeScheduleIndicators(rows: WorkforceRow[]): ScheduleIndicators {
  const functions = rows.filter((r) => r.row_type === "function");
  const maxWeeks = Math.max(...functions.map((f) => f.weekly_values.length), 0);

  const weeklyMOD = new Array(maxWeeks).fill(0);
  const weeklyMOI = new Array(maxWeeks).fill(0);
  const weeklyTotals = new Array(maxWeeks).fill(0);

  let modHH = 0;
  let moiHH = 0;

  for (const fn of functions) {
    const isMOD = fn.resource_type === "MOD";
    const isMOI = fn.resource_type === "MOI";
    const isLabor = isMOD || isMOI;

    for (let w = 0; w < fn.weekly_values.length; w++) {
      const val = fn.weekly_values[w] || 0;
      weeklyTotals[w] += val;
      if (isMOD) weeklyMOD[w] += val;
      if (isMOI) weeklyMOI[w] += val;
      if (isLabor) {
        if (isMOD) modHH += val * WEEKLY_HOURS;
        else moiHH += val * WEEKLY_HOURS;
      }
    }
  }

  const totalHH = modHH + moiHH;
  const peakEffective = Math.max(...weeklyTotals, 0);

  return { totalHH, peakEffective, totalWeeks: maxWeeks, weeklyTotals, modHH, moiHH, weeklyMOD, weeklyMOI };
}

// ─── Queries ─────────────────────────────────────────────────────────
export function useWorkforceRows(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["schedule_workforce", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("schedule_workforce")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        weekly_values: Array.isArray(d.weekly_values) ? d.weekly_values : [],
      })) as WorkforceRow[];
    },
    enabled: !!scenarioId,
  });
}

export function useTimelinePhases(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["schedule_timeline_phases", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from("schedule_timeline_phases")
        .select("*")
        .eq("scenario_id", scenarioId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as TimelinePhase[];
    },
    enabled: !!scenarioId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────
export function useWorkforceMutations(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["schedule_workforce", scenarioId];

  const upsertRow = useMutation({
    mutationFn: async (row: Partial<WorkforceRow> & { label: string }) => {
      if (!user || !scenarioId) throw new Error("Missing context");
      const payload = {
        ...row,
        scenario_id: scenarioId,
        user_id: user.id,
        weekly_values: row.weekly_values || [],
      };
      if (row.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("schedule_workforce").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedule_workforce").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateWeeklyValue = useMutation({
    mutationFn: async ({ rowId, weekIndex, value }: { rowId: string; weekIndex: number; value: number }) => {
      // First get current values
      const { data, error: fetchErr } = await supabase
        .from("schedule_workforce")
        .select("weekly_values")
        .eq("id", rowId)
        .single();
      if (fetchErr) throw fetchErr;
      const values = Array.isArray(data.weekly_values) ? [...(data.weekly_values as number[])] : [];
      // Extend array if needed
      while (values.length <= weekIndex) values.push(0);
      values[weekIndex] = value;
      const { error } = await supabase.from("schedule_workforce").update({ weekly_values: values }).eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const current = qc.getQueryData<WorkforceRow[]>(key) || [];
      const target = current.find(r => r.id === id);
      const idsToDelete = new Set<string>([id]);

      if (target) {
        const collectDescendants = (parentCode: string) => {
          const children = current.filter(r => r.parent_code === parentCode);
          for (const child of children) {
            idsToDelete.add(child.id);
            collectDescendants(child.row_code || child.id);
          }
        };
        collectDescendants(target.row_code || target.id);
      }

      for (const rowId of Array.from(idsToDelete).reverse()) {
        const { error } = await supabase.from("schedule_workforce").delete().eq("id", rowId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Linha removida");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const bulkInsert = useMutation({
    mutationFn: async (rows: Array<Omit<WorkforceRow, "id" | "scenario_id" | "user_id">>) => {
      if (!user || !scenarioId) throw new Error("Missing context");
      const payload = rows.map((r) => ({ ...r, scenario_id: scenarioId, user_id: user.id }));
      const { error } = await supabase.from("schedule_workforce").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Dados inseridos com sucesso");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { upsertRow, updateWeeklyValue, deleteRow, bulkInsert };
}

export function useTimelinePhaseMutations(scenarioId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["schedule_timeline_phases", scenarioId];

  const upsertPhase = useMutation({
    mutationFn: async (phase: Partial<TimelinePhase> & { phase_name: string }) => {
      if (!user || !scenarioId) throw new Error("Missing context");
      const payload = { ...phase, scenario_id: scenarioId, user_id: user.id };
      if (phase.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("schedule_timeline_phases").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedule_timeline_phases").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_timeline_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Fase removida");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const bulkInsert = useMutation({
    mutationFn: async (phases: Array<Omit<TimelinePhase, "id" | "scenario_id" | "user_id">>) => {
      if (!user || !scenarioId) throw new Error("Missing context");
      const payload = phases.map((p) => ({ ...p, scenario_id: scenarioId, user_id: user.id }));
      const { error } = await supabase.from("schedule_timeline_phases").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return { upsertPhase, deletePhase, bulkInsert };
}
