import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";

// ===================================================================
// CONTRATOS FINANCEIROS
// Reutiliza `projects` (com ou sem is_cost_center) como entidade contrato.
// As tabelas auxiliares financial_contract_files e financial_contract_snapshots
// guardam arquivos importados e snapshots consolidados por competência.
// ===================================================================

export type ContractFileKind =
  | "baseline"
  | "real_mensal"
  | "drg"
  | "producao"
  | "pessoal"
  | "imobilizado"
  | "resumo";

export const CONTRACT_FILE_KIND_LABELS: Record<ContractFileKind, string> = {
  baseline: "Baseline prevista",
  real_mensal: "Custos reais mensais",
  drg: "DRG consolidado",
  producao: "Produção (BM)",
  pessoal: "Pessoal / folha",
  imobilizado: "Imobilizado",
  resumo: "Resumo do resultado",
};

export interface FinancialContract {
  id: string;
  project_name: string;
  client: string | null;
  dept_code: string | null;
  dept_group: string | null;
  status: string | null;
  is_cost_center: boolean;
  is_company_entity: boolean;
}

const HIDDEN_BUDGET_STATUSES = new Set(["draft", "new", "rascunho"]);

export const isFinanciallyAvailableContract = (
  contract: Pick<FinancialContract, "status" | "is_cost_center" | "dept_code" | "is_company_entity">,
  options?: { includeInactive?: boolean; includeCompanyEntity?: boolean },
) => {
  const status = (contract.status ?? "draft").toLowerCase();
  if (HIDDEN_BUDGET_STATUSES.has(status)) return false;
  if (!options?.includeInactive && status === "inactive") return false;
  if (contract.is_company_entity) return options?.includeCompanyEntity ?? false;
  return contract.is_cost_center === true || !!contract.dept_code?.trim();
};

// Lista de CONTRATOS (operacionais). Por padrão exclui entidades de empresa
// (Megasteam, Administrativo, GERAL OH consolidado), que vivem em useCompanyEntities.
export const useFinancialContracts = (filter?: {
  onlyActive?: boolean;
  /** Inclui entidades de empresa na lista (padrão: false) */
  includeCompanyEntities?: boolean;
}) => {
  return useQuery({
    queryKey: ["financial-contracts", filter],
    queryFn: async (): Promise<FinancialContract[]> => {
      // Defesa em SQL: rascunhos de orçamento NUNCA entram no módulo Financeiro/Contratos.
      // Só são considerados "contratos" registros com status diferente de draft/new/rascunho
      // E que sejam centro de custo (is_cost_center=true) OU tenham dept_code preenchido.
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client, dept_code, dept_group, status, is_cost_center, is_company_entity")
        .not("status", "in", "(draft,new,rascunho)")
        .order("is_cost_center", { ascending: false })
        .order("dept_code", { nullsFirst: false })
        .order("project_name");
      if (error) throw error;
      let rows = (data ?? []) as FinancialContract[];
      if (!filter?.includeCompanyEntities) {
        rows = rows.filter((r) => !r.is_company_entity);
      }
      // Segunda camada (front): aplica regra completa de elegibilidade.
      rows = rows.filter((r) =>
        isFinanciallyAvailableContract(r, {
          includeInactive: !filter?.onlyActive,
          includeCompanyEntity: filter?.includeCompanyEntities,
        }),
      );
      return rows;
    },
  });
};

// Entidades de EMPRESA (Megasteam, Administrativo, GERAL OH consolidado).
// Sempre separadas dos contratos operacionais.
export type CompanyEntityKind = "megasteam" | "administrativo" | "consolidado" | "outro";

export interface CompanyEntity extends FinancialContract {
  entity_kind: CompanyEntityKind;
}

const classifyCompanyEntity = (c: FinancialContract): CompanyEntityKind => {
  const code = (c.dept_code ?? "").toUpperCase();
  if (code === "GERAL_OH" || (c.dept_group ?? "").toUpperCase() === "CONSOLIDADO") return "consolidado";
  if (code === "ADM") return "megasteam";
  if (code === "DRG-ADMINISTRATIVO") return "administrativo";
  return "outro";
};

export const COMPANY_ENTITY_LABELS: Record<CompanyEntityKind, string> = {
  megasteam: "Megasteam",
  administrativo: "Administrativo",
  consolidado: "GERAL OH (Consolidado)",
  outro: "Empresa",
};

export const useCompanyEntities = () => {
  return useQuery({
    queryKey: ["financial-company-entities"],
    queryFn: async (): Promise<CompanyEntity[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client, dept_code, dept_group, status, is_cost_center, is_company_entity")
        .eq("is_company_entity", true)
        .order("dept_code", { nullsFirst: false });
      if (error) throw error;
      const rows = (data ?? []) as FinancialContract[];
      const order: CompanyEntityKind[] = ["megasteam", "administrativo", "consolidado", "outro"];
      return rows
        .map((r) => ({ ...r, entity_kind: classifyCompanyEntity(r) }))
        .sort((a, b) => order.indexOf(a.entity_kind) - order.indexOf(b.entity_kind));
    },
  });
};

// Arquivos importados de um contrato (auditoria)
export const useContractFiles = (projectId?: string) => {
  return useQuery({
    queryKey: ["financial-contract-files", projectId],
    queryFn: async () => {
      let q = supabase
        .from("financial_contract_files")
        .select("*, projects(project_name, client, dept_code)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};

export const useRegisterContractFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      file_kind: ContractFileKind;
      file_name: string;
      sheet_name?: string;
      competence_month?: string;
      row_count?: number;
      total_value?: number;
      import_id?: string;
      storage_path?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        ...input,
        user_id: user.id,
        status: "imported",
        metadata: (input.metadata ?? {}) as never,
      };
      const { data, error } = await supabase
        .from("financial_contract_files")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-contract-files"] });
    },
  });
};

export const useDeleteContractFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_contract_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-contract-files"] });
      toast({ title: "Arquivo removido do histórico" });
    },
  });
};

// Snapshots mensais consolidados de um contrato
export const useContractSnapshots = (projectId?: string) => {
  return useQuery({
    queryKey: ["financial-contract-snapshots", projectId],
    queryFn: async () => {
      let q = supabase
        .from("financial_contract_snapshots")
        .select("*")
        .order("competence_month", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};
