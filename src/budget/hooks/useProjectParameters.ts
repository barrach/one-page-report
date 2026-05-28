import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EncargosPorAno {
  [ano: string]: { cprb: number; inss: number };
}

export interface ProjectParameters {
  id?: string;
  user_id?: string;
  project_id?: string;

  // Bloco 1
  carga_horaria_diaria: number;
  dias_trabalhados_semana: number;
  horas_trabalhadas_mes: number;
  tipo_periodo: string;
  he_seg_sex_pct: number;
  he_sabado_pct: number;
  he_domingo_pct: number;

  // Bloco 2
  sindicato_cct: string | null;
  salario_minimo_regional: number;
  data_dissidio: string | null;
  reajuste_previsto_pct: number;
  insalubridade_pct: number;
  periculosidade_pct: number;
  adicional_noturno_pct: number;
  plr_salarios_ano: number;
  cesta_basica_mensal: number;
  premio_assiduidade_mensal: number;
  convenio_medico_mensal: number;
  folga_campo_diaria: number;

  // Bloco 3
  cafe_manha_unit: number;
  almoco_unit: number;
  jantar_unit: number;
  lanche_unit: number;
  pct_profissionais_locais: number;
  pct_profissionais_transferidos: number;

  // Bloco 4
  preco_co2_m3: number;
  preco_argonio_m3: number;
  preco_oxigenio_m3: number;
  preco_acetileno_kg: number;
  preco_eletrodo_inox_kg: number;
  preco_eletrodo_carbono_kg: number;

  // Bloco 5
  contrato_inicio: string | null;
  contrato_fim: string | null;
  encargos_por_ano: EncargosPorAno;

  notes?: string | null;
}

export const DEFAULT_ENCARGOS: EncargosPorAno = {
  "2025": { cprb: 3.6, inss: 5.0 },
  "2026": { cprb: 2.7, inss: 10.0 },
  "2027": { cprb: 1.8, inss: 15.0 },
};

export const buildDefaultParameters = (
  defaults?: Partial<ProjectParameters> | null
): ProjectParameters => ({
  carga_horaria_diaria: defaults?.carga_horaria_diaria ?? 8.8,
  dias_trabalhados_semana: defaults?.dias_trabalhados_semana ?? 5,
  horas_trabalhadas_mes: defaults?.horas_trabalhadas_mes ?? 176,
  tipo_periodo: defaults?.tipo_periodo ?? "meses",
  he_seg_sex_pct: defaults?.he_seg_sex_pct ?? 60,
  he_sabado_pct: defaults?.he_sabado_pct ?? 60,
  he_domingo_pct: defaults?.he_domingo_pct ?? 100,
  sindicato_cct: defaults?.sindicato_cct ?? null,
  salario_minimo_regional: defaults?.salario_minimo_regional ?? 1621,
  data_dissidio: defaults?.data_dissidio ?? null,
  reajuste_previsto_pct: defaults?.reajuste_previsto_pct ?? 7,
  insalubridade_pct: defaults?.insalubridade_pct ?? 10,
  periculosidade_pct: defaults?.periculosidade_pct ?? 30,
  adicional_noturno_pct: defaults?.adicional_noturno_pct ?? 20,
  plr_salarios_ano: defaults?.plr_salarios_ano ?? 1,
  cesta_basica_mensal: defaults?.cesta_basica_mensal ?? 580,
  premio_assiduidade_mensal: defaults?.premio_assiduidade_mensal ?? 500,
  convenio_medico_mensal: defaults?.convenio_medico_mensal ?? 200,
  folga_campo_diaria: defaults?.folga_campo_diaria ?? 90,
  cafe_manha_unit: defaults?.cafe_manha_unit ?? 0,
  almoco_unit: defaults?.almoco_unit ?? 0,
  jantar_unit: defaults?.jantar_unit ?? 0,
  lanche_unit: defaults?.lanche_unit ?? 0,
  pct_profissionais_locais: defaults?.pct_profissionais_locais ?? 50,
  pct_profissionais_transferidos: defaults?.pct_profissionais_transferidos ?? 50,
  preco_co2_m3: defaults?.preco_co2_m3 ?? 23,
  preco_argonio_m3: defaults?.preco_argonio_m3 ?? 32,
  preco_oxigenio_m3: defaults?.preco_oxigenio_m3 ?? 25,
  preco_acetileno_kg: defaults?.preco_acetileno_kg ?? 75,
  preco_eletrodo_inox_kg: defaults?.preco_eletrodo_inox_kg ?? 90,
  preco_eletrodo_carbono_kg: defaults?.preco_eletrodo_carbono_kg ?? 50,
  contrato_inicio: defaults?.contrato_inicio ?? null,
  contrato_fim: defaults?.contrato_fim ?? null,
  encargos_por_ano: (defaults?.encargos_por_ano as EncargosPorAno) ?? DEFAULT_ENCARGOS,
  notes: defaults?.notes ?? null,
});

export function useProjectParameterDefaults() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-parameter-defaults", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProjectParameters | null> => {
      const { data, error } = await supabase
        .from("project_parameter_defaults")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveProjectParameterDefaults() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: ProjectParameters) => {
      if (!user?.id) throw new Error("Não autenticado");
      const payload = { ...params, user_id: user.id };
      delete (payload as any).id;
      delete (payload as any).project_id;
      const { data, error } = await supabase
        .from("project_parameter_defaults")
        .upsert(payload as any, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-parameter-defaults"] });
    },
  });
}

export function useProjectParameters(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-parameters", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectParameters | null> => {
      const { data, error } = await supabase
        .from("project_parameters")
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSaveProjectParameters(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: ProjectParameters) => {
      if (!user?.id || !projectId) throw new Error("Dados ausentes");
      const payload = { ...params, user_id: user.id, project_id: projectId };
      delete (payload as any).id;
      const { data, error } = await supabase
        .from("project_parameters")
        .upsert(payload as any, { onConflict: "project_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-parameters", projectId] });
    },
  });
}

// ============================================================
// Cálculo de encargos médios ponderados pelos meses do contrato
// ============================================================
export interface EncargosCalculados {
  cprbMedio: number;
  inssMedio: number;
  totalMeses: number;
  detalhamento: Array<{ ano: string; meses: number; cprb: number; inss: number }>;
}

export function calcularEncargosPonderados(
  inicio: string | null,
  fim: string | null,
  encargosPorAno: EncargosPorAno
): EncargosCalculados | null {
  if (!inicio || !fim) return null;
  const dInicio = new Date(inicio);
  const dFim = new Date(fim);
  if (isNaN(dInicio.getTime()) || isNaN(dFim.getTime()) || dFim < dInicio) return null;

  const mesesPorAno: Record<string, number> = {};
  const cur = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1);
  const end = new Date(dFim.getFullYear(), dFim.getMonth(), 1);
  while (cur <= end) {
    const ano = String(cur.getFullYear());
    mesesPorAno[ano] = (mesesPorAno[ano] || 0) + 1;
    cur.setMonth(cur.getMonth() + 1);
  }

  const totalMeses = Object.values(mesesPorAno).reduce((a, b) => a + b, 0);
  if (totalMeses === 0) return null;

  let somaCprb = 0;
  let somaInss = 0;
  const detalhamento: EncargosCalculados["detalhamento"] = [];
  for (const [ano, meses] of Object.entries(mesesPorAno)) {
    const enc = encargosPorAno[ano] || { cprb: 0, inss: 0 };
    somaCprb += meses * enc.cprb;
    somaInss += meses * enc.inss;
    detalhamento.push({ ano, meses, cprb: enc.cprb, inss: enc.inss });
  }

  return {
    cprbMedio: somaCprb / totalMeses,
    inssMedio: somaInss / totalMeses,
    totalMeses,
    detalhamento: detalhamento.sort((a, b) => a.ano.localeCompare(b.ano)),
  };
}
