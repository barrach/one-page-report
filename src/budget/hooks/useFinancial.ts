import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { isFinanciallyAvailableContract } from "@budget/hooks/useFinancialContracts";

// Invalida toda a cadeia de queries financeiras dependentes (mantém dashboard/DRG sempre coerentes)
const FINANCIAL_DEPENDENT_KEYS: string[][] = [
  ["financial-baselines"],
  ["financial-entries"],
  ["financial-imports"],
  ["financial-allocations"],
  ["contract-revenues"],
  ["payroll-entries"],
  ["fixed-assets"],
];

const invalidateFinancialChain = (qc: QueryClient) => {
  FINANCIAL_DEPENDENT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
};

// ============== BASELINES ==============
export const useBaselines = (filters?: { projectId?: string }) => {
  return useQuery({
    queryKey: ["financial-baselines", filters?.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("financial_baselines")
        .select("*, projects(project_name, client)")
        .order("created_at", { ascending: false });
      if (filters?.projectId) q = q.eq("project_id", filters.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};


// ============== CATEGORIES ==============
export const useFinancialCategories = () => {
  return useQuery({
    queryKey: ["financial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .order("sort_order")
        .order("code");
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string; name: string; kind: string;
      cost_class?: string; is_excluded_default?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("financial_categories")
        .insert({ ...input, user_id: user.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-categories"] });
      toast({ title: "Categoria criada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-categories"] });
      toast({ title: "Categoria removida" });
    },
  });
};

// ============== CATEGORY RULES ==============
export const useCategoryRules = () => {
  return useQuery({
    queryKey: ["financial-category-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_category_rules")
        .select("*, financial_categories(name, code), projects(project_name)")
        .order("priority");
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      rule_type: string; match_value: string;
      category_id?: string; target_project_id?: string;
      mark_as_excluded?: boolean; priority?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("financial_category_rules")
        .insert({ ...input, user_id: user.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-category-rules"] });
      toast({ title: "Regra criada" });
    },
  });
};

export const useDeleteRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_category_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-category-rules"] }),
  });
};

// ============== IMPORTS ==============
export const useFinancialImports = () => {
  return useQuery({
    queryKey: ["financial-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_imports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// ============== ENTRIES ==============
export const useFinancialEntries = (filters?: { importId?: string; competenceMonth?: string; projectId?: string }) => {
  return useQuery({
    queryKey: ["financial-entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("financial_entries")
        .select("*, financial_categories(name, code, cost_class), projects(project_name, client)")
        .order("issue_date", { ascending: false });
      if (filters?.importId) query = query.eq("import_id", filters.importId);
      if (filters?.projectId) query = query.eq("contract_project_id", filters.projectId);
      if (filters?.competenceMonth) {
        const start = `${filters.competenceMonth}-01`;
        query = query.gte("competence_date", start);
      }
      const { data, error } = await query.limit(2000);
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; [k: string]: unknown }) => {
      const { error } = await supabase.from("financial_entries").update({ ...patch, review_status: "manual_override" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Lançamento atualizado" });
    },
  });
};

export const useBulkUpdateEntries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({ ...patch, review_status: "manual_override" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Lançamentos atualizados" });
    },
  });
};

// Lista combinada (orçamentos contratuais + centros de custo) usada por seletores no módulo Financeiro.
// Une as duas fontes mantendo o módulo Orçamentos isolado da estrutura de centros de custo.
export const useProjectsList = () => {
  return useQuery({
    queryKey: ["financial-projects-list"],
    queryFn: async () => {
      const [projectsRes, ccRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, project_name, client, dept_code, dept_group, status, is_cost_center")
          .eq("status", "active")
          .order("dept_code", { nullsFirst: false })
          .order("project_name"),
        supabase
          .from("financial_cost_centers")
          .select("id, dept_name, client, dept_code, dept_group, status")
          .eq("status", "active")
          .order("dept_code"),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (ccRes.error) throw ccRes.error;

      const projects = (projectsRes.data ?? [])
        .filter((p) => isFinanciallyAvailableContract({ ...p, is_company_entity: false }))
        .map((p) => ({
          id: p.id,
          project_name: p.project_name,
          client: p.client,
          dept_code: p.dept_code,
          dept_group: p.dept_group,
          is_cost_center: p.is_cost_center,
        }));
      const costCenters = (ccRes.data ?? []).map((c) => ({
        id: c.id,
        project_name: c.dept_name,
        client: c.client,
        dept_code: c.dept_code,
        dept_group: c.dept_group,
        is_cost_center: true,
      }));
      // Contratos (projects) primeiro — fonte de verdade. Centros de custo só aparecem se não houver projeto correspondente.
      // Orçamentos novos/rascunho não entram em Custos Mensais; só aparecem após consolidados/ativos.
      const projectCodes = new Set(projects.map((p) => p.dept_code).filter(Boolean));
      const ccFiltered = costCenters.filter((c) => !c.dept_code || !projectCodes.has(c.dept_code));
      return [...projects, ...ccFiltered];
    },
  });
};

export const useCostCenters = () => {
  return useQuery({
    queryKey: ["megasteam-cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_cost_centers")
        .select("id, dept_code, dept_name, client, dept_group, status")
        .order("dept_code");
      if (error) throw error;
      // Mantém compatibilidade com componentes existentes que esperam `project_name`
      return (data ?? []).map((c) => ({
        id: c.id,
        dept_code: c.dept_code,
        project_name: c.dept_name,
        client: c.client,
        dept_group: c.dept_group,
        status: c.status,
        is_cost_center: true,
      }));
    },
  });
};

// ============== SEED MEGASTEAM ==============
export const useSeedFinancialDefaults = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.rpc("seed_financial_defaults", { _user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-categories"] });
      qc.invalidateQueries({ queryKey: ["financial-category-rules"] });
      toast({ title: "Plano de contas Megasteam carregado", description: "65 categorias DRG criadas com regras de classificação." });
    },
    onError: (e: Error) => toast({ title: "Erro no seed", description: e.message, variant: "destructive" }),
  });
};

export const useSeedCostCenters = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.rpc("seed_megasteam_cost_centers", { _user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["megasteam-cost-centers"] });
      qc.invalidateQueries({ queryKey: ["financial-projects-list"] });
      toast({ title: "Centros de custo Megasteam carregados", description: "Estrutura de 49 departamentos importada." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
};

// Sincronização idempotente — atualiza/insere os 49 CCs sem apagar nada
export const useSyncCostCenters = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.rpc("sync_megasteam_cost_centers", { _user_id: user.id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["megasteam-cost-centers"] });
      qc.invalidateQueries({ queryKey: ["financial-projects-list"] });
      toast({
        title: "Centros de custo sincronizados",
        description: `${count ?? 49} departamentos atualizados com o cadastro oficial Megasteam.`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" }),
  });
};


// ============== ALLOCATIONS ==============
export const useAllocations = (entryId?: string) => {
  return useQuery({
    queryKey: ["financial-allocations", entryId],
    queryFn: async () => {
      let q = supabase.from("financial_allocations").select("*, projects(project_name, client)");
      if (entryId) q = q.eq("entry_id", entryId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !entryId || !!entryId,
  });
};

// ============== CONTRACT REVENUES ==============
export const useContractRevenues = (filters?: { projectId?: string }) => {
  return useQuery({
    queryKey: ["contract-revenues", filters?.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from("contract_revenues")
        .select("*, projects(project_name, client)")
        .order("competence_month", { ascending: false });
      if (filters?.projectId) q = q.eq("project_id", filters.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};


export const useUpsertContractRevenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string; competence_month: string;
      revenue_planned?: number; revenue_actual?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("contract_revenues")
        .upsert({ ...input, user_id: user.id }, { onConflict: "project_id,competence_month" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateFinancialChain(qc);
      toast({ title: "Receita salva" });
    },
  });
};
