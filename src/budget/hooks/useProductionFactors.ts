import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

/**
 * Tabela global de fatores de produção por especialidade.
 * "Fator de produção" = % do tempo efetivamente produtivo (ex: 0,60 = 60%).
 * HH_total = HH_ajustado / fator_produção.
 *
 * Editável em Configurações → Índices de Produção, com override por orçamento
 * via project_parameters.production_factors_override.
 */

export interface ProductionFactor {
  id: string;
  user_id: string;
  specialty_code: string;
  specialty_label: string;
  production_factor: number;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
}

export const DEFAULT_SPECIALTIES: Array<{ code: string; label: string; factor: number; sort: number }> = [
  { code: "tubulacao_fabricacao", label: "Tubulação Fabricação", factor: 0.65, sort: 1 },
  { code: "tubulacao_montagem", label: "Tubulação Montagem", factor: 0.6, sort: 2 },
  { code: "eletrica", label: "Elétrica", factor: 0.6, sort: 3 },
  { code: "instrumentacao", label: "Instrumentação", factor: 0.6, sort: 4 },
  { code: "estrutura_metalica", label: "Estrutura Metálica", factor: 0.6, sort: 5 },
  { code: "andaimes", label: "Andaimes", factor: 0.6, sort: 6 },
  { code: "pintura", label: "Pintura", factor: 0.65, sort: 7 },
  { code: "isolamento_termico", label: "Isolamento Térmico", factor: 0.65, sort: 8 },
  { code: "obras_civis", label: "Obras Civis", factor: 0.7, sort: 9 },
  { code: "refratarios", label: "Refratários", factor: 0.65, sort: 10 },
  { code: "comissionamento", label: "Comissionamento", factor: 0.5, sort: 11 },
  { code: "supervisao", label: "Supervisão", factor: 0.8, sort: 12 },
  { code: "controle_qualidade", label: "Controle de Qualidade", factor: 0.7, sort: 13 },
  { code: "rotina_manutencao", label: "Rotina/Manutenção", factor: 0.85, sort: 14 },
];

export function useProductionFactors() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["production_factors", user?.id],
    queryFn: async (): Promise<ProductionFactor[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("production_factors")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // Auto-seed se vazio (usuário criado depois da migration de seed)
      if (!data || data.length === 0) {
        const rows = DEFAULT_SPECIALTIES.map((s) => ({
          user_id: user.id,
          specialty_code: s.code,
          specialty_label: s.label,
          production_factor: s.factor,
          sort_order: s.sort,
        }));
        const { data: inserted } = await supabase.from("production_factors").insert(rows).select();
        return (inserted as ProductionFactor[]) || [];
      }
      return data as ProductionFactor[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useUpdateProductionFactor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, production_factor }: { id: string; production_factor: number }) => {
      const { error } = await supabase
        .from("production_factors")
        .update({ production_factor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_factors", user?.id] });
      toast.success("Fator de produção atualizado");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

/** Resolve o fator efetivo para uma especialidade considerando override do orçamento. */
export function resolveProductionFactor(
  specialtyCode: string,
  globalFactors: ProductionFactor[],
  overrideMap: Record<string, number> | null | undefined
): number {
  if (overrideMap && typeof overrideMap[specialtyCode] === "number") {
    return overrideMap[specialtyCode];
  }
  const found = globalFactors.find((f) => f.specialty_code === specialtyCode);
  return found ? Number(found.production_factor) : 0.65;
}
