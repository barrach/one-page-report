import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

export function useCompanySettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["company_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpsertCompanySettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!user) throw new Error("Não autenticado");
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("company_settings")
          .update(patch as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert({ user_id: user.id, ...patch } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });
}

export function useUploadCompanyLogo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("company-assets").getPublicUrl(path);
      const logo_url = `${pub.publicUrl}?t=${Date.now()}`;
      // upsert na tabela
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        await supabase.from("company_settings")
          .update({ logo_url, logo_storage_path: path })
          .eq("id", existing.id);
      } else {
        await supabase.from("company_settings")
          .insert({ user_id: user.id, logo_url, logo_storage_path: path });
      }
      return logo_url;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      toast.success("Logo atualizado");
    },
    onError: (e: any) => toast.error("Erro ao enviar logo: " + e.message),
  });
}
