import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

export interface CpuClientTemplate {
  id: string;
  user_id: string;
  client_name: string;
  description: string | null;
  is_active: boolean;
  storage_path: string;
  original_file_name: string;
  sheet_name: string | null;
  start_row: number;
  col_numero: string;
  col_descricao: string;
  col_quantidade: string;
  col_unidade: string;
  col_valor_unitario: string;
  col_valor_total: string;
  header_mappings: Array<{ cell: string; field: string }>;
  notes: string | null;
}

export function useCpuClientTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cpu_client_templates", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cpu_client_templates")
        .select("*")
        .order("client_name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CpuClientTemplate[];
    },
    enabled: !!user,
  });
}

export function useUpsertCpuClientTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<CpuClientTemplate> & { id?: string }) => {
      if (!user) throw new Error("Não autenticado");
      if (patch.id) {
        const { id, ...rest } = patch;
        const { error } = await supabase
          .from("cpu_client_templates")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      } else {
        const { data, error } = await supabase
          .from("cpu_client_templates")
          .insert({ user_id: user.id, ...patch } as any)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpu_client_templates"] });
      toast.success("Template salvo");
    },
    onError: (e: any) => toast.error("Erro ao salvar template: " + e.message),
  });
}

export function useDeleteCpuClientTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: tpl } = await supabase
        .from("cpu_client_templates")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle();
      if (tpl?.storage_path) {
        await supabase.storage.from("cpu-templates").remove([tpl.storage_path]);
      }
      const { error } = await supabase.from("cpu_client_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpu_client_templates"] });
      toast.success("Template removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });
}

export function useUploadCpuTemplateFile() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ file, templateId }: { file: File; templateId: string }) => {
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop()?.toLowerCase() || "xlsx";
      const path = `${user.id}/templates/${templateId}.${ext}`;
      const { error } = await supabase.storage
        .from("cpu-templates")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await supabase
        .from("cpu_client_templates")
        .update({ storage_path: path, original_file_name: file.name })
        .eq("id", templateId);
      return path;
    },
  });
}
