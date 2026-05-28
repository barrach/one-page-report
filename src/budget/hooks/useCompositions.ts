import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

export interface Composition {
  id: string;
  user_id: string;
  name: string;
  discipline: string | null;
  base_unit: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompositionItem {
  id: string;
  composition_id: string;
  user_id: string;
  resource_type: string;
  resource_name: string;
  consumption: number;
  unit: string | null;
  unit_cost: number;
  library_item_id: string | null;
  notes: string | null;
  sort_order: number;
}

export function useCompositions(search?: string, discipline?: string) {
  return useQuery({
    queryKey: ["compositions", search, discipline],
    queryFn: async () => {
      let q = supabase
        .from("compositions")
        .select("*")
        .eq("is_active", true)
        .order("discipline")
        .order("name");
      if (search?.trim()) {
        q = q.or(`name.ilike.%${search}%,discipline.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (discipline && discipline !== "all") {
        q = q.eq("discipline", discipline);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Composition[];
    },
  });
}

export function useCompositionItems(compositionId: string | undefined) {
  return useQuery({
    queryKey: ["composition_items", compositionId],
    queryFn: async () => {
      if (!compositionId) return [];
      const { data, error } = await supabase
        .from("composition_items")
        .select("*")
        .eq("composition_id", compositionId)
        .order("sort_order");
      if (error) throw error;
      return data as CompositionItem[];
    },
    enabled: !!compositionId,
  });
}

export function useCompositionMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addComposition = useMutation({
    mutationFn: async (data: { name: string; discipline?: string; base_unit?: string; description?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { data: row, error } = await supabase
        .from("compositions")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compositions"] });
      toast.success("Composição criada");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateComposition = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Composition> & { id: string }) => {
      const { error } = await supabase.from("compositions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compositions"] });
    },
  });

  const removeComposition = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compositions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compositions"] });
      toast.success("Composição excluída");
    },
    onError: (e) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async (data: { composition_id: string; resource_type: string; resource_name: string; consumption: number; unit?: string; unit_cost?: number; library_item_id?: string; notes?: string; sort_order?: number }) => {
      if (!user) throw new Error("Não autenticado");
      const { data: row, error } = await supabase
        .from("composition_items")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["composition_items", vars.composition_id] });
      toast.success("Recurso adicionado");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositionItem> & { id: string }) => {
      const { error } = await supabase.from("composition_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["composition_items"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async ({ id, compositionId }: { id: string; compositionId: string }) => {
      const { error } = await supabase.from("composition_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["composition_items", vars.compositionId] });
      toast.success("Recurso removido");
    },
    onError: (e) => toast.error(e.message),
  });

  return { addComposition, updateComposition, removeComposition, addItem, updateItem, removeItem };
}

// Stage mapping for resource types
const RESOURCE_TYPE_STAGE: Record<string, string> = {
  MOD: "salarios",
  MOI: "salarios",
  MATERIAL: "materiais",
  EQUIPAMENTO: "ferramental",
};

export function getStageCodeForResourceType(type: string): string {
  return RESOURCE_TYPE_STAGE[type] || "outros";
}
