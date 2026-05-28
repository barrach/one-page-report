// ============================================================
// useContractResults — leitura/recálculo das linhas-resultado
// ============================================================
// Encapsula a tabela `contract_results` (VL, CO, MB, TA, RL, ML%
// + previsto + diferença + farol) e as configurações por contrato
// (`contract_settings.taxa_adm_pct`).
//
// Uso típico:
//   const { results, isLoading, recompute } = useContractResults(contractId, year);
//   const { data: settings, save } = useContractSettings(contractId);
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";

export type ContractSaude = "saudavel" | "atencao" | "critico" | "sem_dados";

export interface ContractResultRow {
  id: string;
  project_id: string;
  competence_month: string; // YYYY-MM-DD
  taxa_adm_pct: number;

  vl_actual: number;
  co_actual: number;
  mb_actual: number;
  ta_actual: number;
  rl_actual: number;
  ml_actual_pct: number;

  vl_planned: number;
  co_planned: number;
  mb_planned: number;
  ta_planned: number;
  rl_planned: number;
  ml_planned_pct: number;

  vl_diff: number;
  co_diff: number;
  mb_diff: number;
  ta_diff: number;
  rl_diff: number;
  ml_diff_pct: number;

  saude: ContractSaude;
  computed_at: string;
}

export interface ContractSettings {
  id: string;
  project_id: string;
  taxa_adm_pct: number;
  iss_pct: number;
  pis_pct: number;
  cofins_pct: number;
  csll_pct: number;
  inss_fat_pct: number;
  icms_pct: number;
  pet_pct: number;
  notes: string | null;
}

export interface FinancialGlobalSettings {
  id: string;
  user_id: string;
  iss_pct: number;
  pis_pct: number;
  cofins_pct: number;
  csll_pct: number;
  inss_fat_pct: number;
  icms_pct: number;
  taxa_adm_pct: number;
  pet_pct: number;
  notes: string | null;
}

export const FINANCIAL_DEFAULTS = {
  iss_pct: 5.0,
  pis_pct: 0.65,
  cofins_pct: 3.0,
  csll_pct: 0.0,
  inss_fat_pct: 0.0,
  icms_pct: 0.0,
  taxa_adm_pct: 8.0,
  pet_pct: 80.06,
} as const;

// ------------------------------------------------------------
// Resultados (uma linha por mês)
// ------------------------------------------------------------
export const useContractResults = (projectId?: string, year?: number) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["contract-results", projectId ?? "all", year ?? "all"],
    enabled: !!projectId,
    queryFn: async (): Promise<ContractResultRow[]> => {
      if (!projectId) return [];
      let q = supabase
        .from("contract_results")
        .select("*")
        .eq("project_id", projectId)
        .order("competence_month", { ascending: true });
      if (year) {
        q = q
          .gte("competence_month", `${year}-01-01`)
          .lte("competence_month", `${year}-12-31`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContractResultRow[];
    },
  });

  const recompute = useMutation({
    mutationFn: async (opts?: { year?: number }) => {
      if (!projectId) throw new Error("Sem contrato");
      const { data, error } = await supabase.rpc("recompute_contract_results", {
        _project_id: projectId,
        _year: opts?.year ?? year ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const months = Array.isArray(data) ? data[0]?.months_processed : 0;
      qc.invalidateQueries({ queryKey: ["contract-results", projectId] });
      qc.invalidateQueries({ queryKey: ["contract-results-all"] });
      toast.success("Resultados recalculados", {
        description: `${months ?? 0} mês(es) atualizado(s).`,
      });
    },
    onError: (err: Error) =>
      toast.error("Erro ao recalcular", { description: err.message }),
  });

  return { ...query, results: query.data ?? [], recompute };
};

// ------------------------------------------------------------
// Saúde de TODOS os contratos (último mês registrado por contrato)
// ------------------------------------------------------------
export interface ContractSaudeRow {
  project_id: string;
  saude: ContractSaude;
  competence_month: string;
  ml_actual_pct: number;
  rl_actual: number;
}

export const useAllContractsSaude = () =>
  useQuery({
    queryKey: ["contract-results-all"],
    queryFn: async (): Promise<Record<string, ContractSaudeRow>> => {
      const { data, error } = await supabase
        .from("contract_results")
        .select("project_id, saude, competence_month, ml_actual_pct, rl_actual")
        .order("competence_month", { ascending: false });
      if (error) throw error;
      const map: Record<string, ContractSaudeRow> = {};
      for (const row of data ?? []) {
        if (!map[row.project_id]) {
          map[row.project_id] = row as ContractSaudeRow;
        }
      }
      return map;
    },
    staleTime: 60 * 1000,
  });

// ------------------------------------------------------------
// Configurações por contrato (taxa_adm_pct etc.)
// ------------------------------------------------------------
export const useContractSettings = (projectId?: string) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["contract-settings", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ContractSettings | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("contract_settings")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data as ContractSettings | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<Omit<ContractSettings, "id" | "project_id">>) => {
      if (!projectId) throw new Error("Sem contrato");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const payload = {
        user_id: uid,
        project_id: projectId,
        ...input,
      };
      const { error } = await supabase
        .from("contract_settings")
        .upsert(payload, { onConflict: "project_id" });
      if (error) throw error;

      // Recompute all months immediately
      await supabase.rpc("recompute_contract_results", {
        _project_id: projectId,
        _year: null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-settings", projectId] });
      qc.invalidateQueries({ queryKey: ["contract-results", projectId] });
      qc.invalidateQueries({ queryKey: ["contract-results-all"] });
      toast.success("Configuração salva e resultados recalculados.");
    },
    onError: (err: Error) =>
      toast.error("Erro ao salvar", { description: err.message }),
  });

  return { ...query, settings: query.data, save };
};

// ------------------------------------------------------------
// Global financial settings (fallback when contract has no own config)
// ------------------------------------------------------------
export const useFinancialGlobalSettings = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["financial-global-settings"],
    queryFn: async (): Promise<FinancialGlobalSettings | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("financial_global_settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as FinancialGlobalSettings | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<Omit<FinancialGlobalSettings, "id" | "user_id">>) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const payload = { user_id: uid, ...input };
      const { error } = await supabase
        .from("financial_global_settings")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-global-settings"] });
      toast.success("Parâmetros globais salvos");
    },
    onError: (err: Error) =>
      toast.error("Erro ao salvar", { description: err.message }),
  });

  return { ...query, settings: query.data, save };
};

// Helpers de UI ---------------------------------------------------------
export const SAUDE_LABEL: Record<ContractSaude, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  critico: "Crítico",
  sem_dados: "Sem dados",
};

export const SAUDE_CLASS: Record<ContractSaude, string> = {
  saudavel: "bg-success/15 text-success border-success/30",
  atencao: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  critico: "bg-destructive/15 text-destructive border-destructive/30",
  sem_dados: "bg-muted text-muted-foreground border-border",
};
