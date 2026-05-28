import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";

export interface Proposal {
  id: string;
  user_id: string;
  project_id: string;
  scenario_id: string | null;
  proposal_number: string;
  revision: number;
  parent_proposal_id: string | null;
  status: string;
  client: string;
  object: string | null;
  scope_summary: string | null;
  premises: string | null;
  exclusions: string | null;
  validity_days: number | null;
  execution_days: number | null;
  payment_conditions: string | null;
  tax_notes: string | null;
  commercial_notes: string | null;
  internal_notes: string | null;
  responsible: string | null;
  signature: string | null;
  location: string | null;
  sale_price: number;
  direct_cost: number;
  indirect_cost: number;
  taxes: number;
  profit: number;
  total_hh: number;
  peak_team: number;
  snapshot_data: any;
  generated_at: string;
  created_at: string;
  updated_at: string;
  // joined
  project_name?: string;
}

export function useProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, projects(project_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        project_name: p.projects?.project_name,
      })) as Proposal[];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("proposals")
        .select("*, projects(project_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return { ...data, project_name: (data as any).projects?.project_name } as Proposal;
    },
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      scenarioId: string;
      client: string;
      proposalNumber: string;
      location?: string;
      executionDays?: number;
      salePrice: number;
      directCost: number;
      indirectCost: number;
      taxes: number;
      profit: number;
      totalHH: number;
      peakTeam: number;
      snapshotData: any;
      scopeSummary?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Count existing proposals for this project to determine revision
      const { count } = await supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.projectId);

      const { data, error } = await supabase
        .from("proposals")
        .insert({
          user_id: user.id,
          project_id: input.projectId,
          scenario_id: input.scenarioId,
          proposal_number: input.proposalNumber,
          revision: count || 0,
          client: input.client,
          location: input.location,
          execution_days: input.executionDays,
          sale_price: input.salePrice,
          direct_cost: input.directCost,
          indirect_cost: input.indirectCost,
          taxes: input.taxes,
          profit: input.profit,
          total_hh: input.totalHH,
          peak_team: input.peakTeam,
          snapshot_data: input.snapshotData,
          scope_summary: input.scopeSummary,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("proposals")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposal", vars.id] });
    },
  });
}

export const PROPOSAL_STATUSES = [
  { value: "draft", label: "Rascunho", color: "bg-muted text-muted-foreground" },
  { value: "review", label: "Em Revisão", color: "bg-primary/10 text-primary" },
  { value: "approved", label: "Aprovada", color: "bg-green-500/10 text-green-500" },
  { value: "sent", label: "Enviada", color: "bg-accent/10 text-accent" },
  { value: "rejected", label: "Recusada", color: "bg-destructive/10 text-destructive" },
  { value: "converted", label: "Convertida", color: "bg-green-600/10 text-green-600" },
  { value: "archived", label: "Arquivada", color: "bg-muted text-muted-foreground" },
] as const;

export function getStatusInfo(status: string) {
  return PROPOSAL_STATUSES.find((s) => s.value === status) || PROPOSAL_STATUSES[0];
}
