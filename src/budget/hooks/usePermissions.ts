import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";

export type PermissionKey =
  | "projetos"
  | "criar_orcamentos"
  | "excluir_orcamentos"
  | "propostas"
  | "gerar_propostas_pdf"
  | "custos"
  | "financeiro"
  | "biblioteca"
  | "importar_planilhas"
  | "cronograma";

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  projetos: "Acesso a Orçamentos",
  criar_orcamentos: "Criar/Editar Orçamentos",
  excluir_orcamentos: "Excluir Orçamentos",
  propostas: "Acesso a Propostas",
  gerar_propostas_pdf: "Gerar Propostas (PDF)",
  custos: "Acesso a Custos",
  financeiro: "Visualizar Dados Financeiros",
  biblioteca: "Acesso à Biblioteca Técnica",
  importar_planilhas: "Importar Planilhas",
  cronograma: "Acesso ao Cronograma",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

const ADMIN_EMAIL = "michel.zabalia@megasteam.com.br";

export const usePermissions = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Get user's profile to know their role
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    retry: 3,
    retryDelay: 1000,
  });

  const userRole = profile?.role || "user";

  // Get permissions for this role
  const { data: rolePerms } = useQuery({
    queryKey: ["role-permissions", userRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permissions")
        .eq("role", userRole)
        .single();
      if (error) return null;
      return data?.permissions as Record<string, boolean> | null;
    },
    enabled: !!userRole,
  });

  const hasPermission = (key: PermissionKey): boolean => {
    // Admin always has all permissions
    if (isAdmin) return true;
    if (!rolePerms) return false;
    return rolePerms[key] === true;
  };

  return { hasPermission, isAdmin, userRole, permissions: rolePerms };
};
