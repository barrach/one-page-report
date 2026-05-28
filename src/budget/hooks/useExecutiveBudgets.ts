import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

export type ExecutiveBudgetStatus =
  | "rascunho"
  | "em_aprovacao"
  | "aprovado"
  | "em_execucao"
  | "concluido";

export interface ExecutiveBudget {
  id: string;
  user_id: string;
  project_id: string;
  scenario_id: string;
  document_number: string;
  version: number;
  status: ExecutiveBudgetStatus;
  title: string;
  snapshot_data: any;
  complementary_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  execution_started_at: string | null;
  completed_at: string | null;
  parent_executive_id: string | null;
  is_simulation: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExecutiveBudgetRevision {
  id: string;
  executive_budget_id: string;
  user_id: string;
  author_email: string | null;
  previous_content: string | null;
  new_content: string | null;
  change_summary: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<ExecutiveBudgetStatus, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em Aprovação",
  aprovado: "Aprovado",
  em_execucao: "Em Execução",
  concluido: "Concluído",
};

export const STATUS_FLOW: ExecutiveBudgetStatus[] = [
  "rascunho",
  "em_aprovacao",
  "aprovado",
  "em_execucao",
  "concluido",
];

export const isLocked = (status: ExecutiveBudgetStatus) =>
  status === "aprovado" || status === "em_execucao" || status === "concluido";

// ── Lista por projeto
export function useExecutiveBudgets(projectId?: string) {
  return useQuery({
    queryKey: ["executive_budgets", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExecutiveBudget[];
    },
  });
}

// ── Detalhe
export function useExecutiveBudget(id?: string) {
  return useQuery({
    queryKey: ["executive_budget", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ExecutiveBudget | null;
    },
  });
}

// ── Revisões
export function useExecutiveBudgetRevisions(executiveBudgetId?: string) {
  return useQuery({
    queryKey: ["executive_budget_revisions", executiveBudgetId],
    enabled: !!executiveBudgetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_budget_revisions" as any)
        .select("*")
        .eq("executive_budget_id", executiveBudgetId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExecutiveBudgetRevision[];
    },
  });
}

// ── Simulações filhas
export function useExecutiveBudgetSimulations(parentId?: string) {
  return useQuery({
    queryKey: ["executive_budget_simulations", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .select("*")
        .eq("parent_executive_id", parentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExecutiveBudget[];
    },
  });
}

// ── Atualizar snapshot (usado pela edição de simulação)
export function useUpdateExecutiveSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; snapshotData: any; title?: string }) => {
      const patch: any = { snapshot_data: input.snapshotData };
      if (input.title) patch.title = input.title;
      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExecutiveBudget;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["executive_budget", row.id] });
      qc.invalidateQueries({ queryKey: ["executive_budgets", row.project_id] });
      if (row.parent_executive_id) {
        qc.invalidateQueries({ queryKey: ["executive_budget_simulations", row.parent_executive_id] });
      }
    },
  });
}

// ── Criar
export function useCreateExecutiveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      scenarioId: string;
      title?: string;
      snapshotData: any;
      parentExecutiveId?: string;
      isSimulation?: boolean;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .insert({
          user_id: userId,
          project_id: input.projectId,
          scenario_id: input.scenarioId,
          title: input.title || "Orçamento Executivo",
          snapshot_data: input.snapshotData,
          parent_executive_id: input.parentExecutiveId || null,
          is_simulation: !!input.isSimulation,
          status: "rascunho",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExecutiveBudget;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["executive_budgets", row.project_id] });
    },
  });
}

// ── Atualizar status (com travamento de snapshot quando aprovado)
export function useUpdateExecutiveBudgetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: ExecutiveBudgetStatus;
      snapshotRefresh?: any; // se aprovando, podemos atualizar o snapshot final
    }) => {
      const patch: any = { status: input.status };
      const now = new Date().toISOString();

      if (input.status === "aprovado") {
        const { data: auth } = await supabase.auth.getUser();
        patch.approved_at = now;
        patch.approved_by = auth?.user?.id || null;
        if (input.snapshotRefresh) patch.snapshot_data = input.snapshotRefresh;
      }
      if (input.status === "em_execucao") patch.execution_started_at = now;
      if (input.status === "concluido") patch.completed_at = now;

      const { data, error } = await supabase
        .from("executive_budgets" as any)
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExecutiveBudget;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["executive_budget", row.id] });
      qc.invalidateQueries({ queryKey: ["executive_budgets", row.project_id] });
    },
  });
}

// ── Atualizar dados complementares (sempre permitido) + log
export function useUpdateComplementaryNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      previousContent: string | null;
      newContent: string;
      changeSummary?: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      const userEmail = auth?.user?.email || null;
      if (!userId) throw new Error("Usuário não autenticado");

      // 1) atualizar campo no documento
      const { error: upErr } = await supabase
        .from("executive_budgets" as any)
        .update({ complementary_notes: input.newContent })
        .eq("id", input.id);
      if (upErr) throw upErr;

      // 2) inserir revisão
      const { error: revErr } = await supabase
        .from("executive_budget_revisions" as any)
        .insert({
          executive_budget_id: input.id,
          user_id: userId,
          author_email: userEmail,
          previous_content: input.previousContent,
          new_content: input.newContent,
          change_summary: input.changeSummary || null,
        } as any);
      if (revErr) throw revErr;

      return { id: input.id };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["executive_budget", res.id] });
      qc.invalidateQueries({ queryKey: ["executive_budget_revisions", res.id] });
    },
  });
}
