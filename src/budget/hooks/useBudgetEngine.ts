import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";
import type { CostStage } from "@budget/hooks/useCostData";

/**
 * Budget Engine: auto-generates cost items from scope components.
 * 
 * Flow: Scope Components (with HH) → Cost Items (in "Salários e Encargos" stage)
 * 
 * Each scope component with calculated_hh > 0 generates a cost item:
 *   Custo = HH × R$/HH (from salary library or default)
 */

const DEFAULT_COST_PER_HH = 76.28; // R$/HH based on OREX reference (MOD+MOI)

export function useGenerateCostsFromScope(scenarioId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stages,
      costPerHH = DEFAULT_COST_PER_HH,
    }: {
      stages: CostStage[];
      costPerHH?: number;
    }) => {
      if (!user || !scenarioId) throw new Error("Missing data");

      // Find the salary stage
      const salaryStage = stages.find((s) => s.stage_code === "salarios");
      if (!salaryStage) throw new Error("Etapa 'Salários e Encargos' não encontrada");

      // Get all scope items for this scenario
      const { data: scopeItems, error: e1 } = await supabase
        .from("scope_items")
        .select("id, title, category")
        .eq("scenario_id", scenarioId);
      if (e1) throw e1;
      if (!scopeItems || scopeItems.length === 0) throw new Error("Nenhum item de escopo encontrado");

      // Get all scope components
      const ids = scopeItems.map((i) => i.id);
      const { data: components, error: e2 } = await supabase
        .from("scope_components")
        .select("*")
        .in("scope_item_id", ids);
      if (e2) throw e2;

      // Filter components with HH > 0
      const withHH = (components || []).filter(
        (c) => Number(c.adjusted_hh) > 0 || Number(c.calculated_hh) > 0
      );
      if (withHH.length === 0) throw new Error("Nenhum componente com HH calculado");

      // Remove existing auto-generated items (origin = 'scope') in salary stage
      const { error: delErr } = await supabase
        .from("cost_items")
        .delete()
        .eq("scenario_id", scenarioId)
        .eq("cost_stage_id", salaryStage.id)
        .eq("origin", "scope");
      if (delErr) throw delErr;

      // Create cost items from scope components
      const itemMap = Object.fromEntries(scopeItems.map((i) => [i.id, i]));
      const rows = withHH.map((c) => {
        const hh = Number(c.adjusted_hh) || Number(c.calculated_hh);
        const parentItem = itemMap[c.scope_item_id];
        return {
          scenario_id: scenarioId,
          user_id: user.id,
          cost_stage_id: salaryStage.id,
          description: `MO: ${c.description}`,
          quantity: hh,
          unit: "HH",
          unit_cost: costPerHH,
          origin: "scope" as const,
          origin_reference: parentItem ? parentItem.title : null,
          scope_item_id: c.scope_item_id,
          scope_component_id: c.id,
          library_item_id: c.library_item_id,
          formula_label: `${hh.toFixed(1)} HH × R$ ${costPerHH.toFixed(2)}/HH`,
          notes: parentItem ? `Cat: ${parentItem.category}` : null,
        };
      });

      const { error: insErr } = await supabase.from("cost_items").insert(rows);
      if (insErr) throw insErr;

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
      toast.success(`${count} itens de custo gerados do escopo`);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

/**
 * Generate cost items from schedule phases (mobilization, hospedagem, etc.)
 */
export function useGenerateCostsFromSchedule(scenarioId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stages,
      phases,
      dailyCostPerPerson = 250, // hospedagem default
    }: {
      stages: CostStage[];
      phases: Array<{ phase_name: string; duration_days: number; team_size: number; calculated_hh: number; id: string }>;
      dailyCostPerPerson?: number;
    }) => {
      if (!user || !scenarioId) throw new Error("Missing data");

      const hospStage = stages.find((s) => s.stage_code === "hospedagem");
      if (!hospStage) throw new Error("Etapa 'Hospedagem' não encontrada");

      // Remove existing schedule-generated items
      const { error: delErr } = await supabase
        .from("cost_items")
        .delete()
        .eq("scenario_id", scenarioId)
        .eq("cost_stage_id", hospStage.id)
        .eq("origin", "schedule");
      if (delErr) throw delErr;

      const rows = phases.map((p) => ({
        scenario_id: scenarioId,
        user_id: user.id,
        cost_stage_id: hospStage.id,
        description: `Hospedagem: ${p.phase_name}`,
        quantity: p.team_size * p.duration_days,
        unit: "diária",
        unit_cost: dailyCostPerPerson,
        origin: "schedule" as const,
        phase_id: p.id,
        formula_label: `${p.team_size} pessoas × ${p.duration_days} dias × R$ ${dailyCostPerPerson}`,
        notes: null,
        origin_reference: p.phase_name,
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from("cost_items").insert(rows);
        if (error) throw error;
      }

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cost_items", scenarioId] });
      toast.success(`${count} itens de hospedagem gerados do cronograma`);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
