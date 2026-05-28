import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { toast } from "sonner";

export interface CpuExportRow {
  id: string;
  project_id: string;
  scenario_id: string;
  proposal_number: string | null;
  budget_version: number;
  template_kind: string;
  client_template_id: string | null;
  file_name: string;
  storage_path: string | null;
  total_value: number;
  exported_by_email: string | null;
  created_at: string;
  payload_snapshot: any;
  items_snapshot: any;
}

export function useCpuExports(projectId: string | null) {
  return useQuery({
    queryKey: ["cpu_exports", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("cpu_exports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CpuExportRow[];
    },
    enabled: !!projectId,
  });
}

export function useDownloadCpuExport() {
  return useMutation({
    mutationFn: async (row: CpuExportRow) => {
      // 1) Tenta baixar o arquivo salvo no storage
      if (row.storage_path) {
        const { data, error } = await supabase.storage
          .from("cpu-exports")
          .download(row.storage_path);
        if (!error && data) {
          const url = URL.createObjectURL(data);
          const a = document.createElement("a");
          a.href = url;
          a.download = row.file_name;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
      // 2) Fallback: regenera a partir do snapshot
      if (!row.payload_snapshot || Object.keys(row.payload_snapshot).length === 0) {
        throw new Error("Snapshot indisponível para regerar arquivo");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cpu-xlsx`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...row.payload_snapshot, saveLog: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = row.file_name;
      a.click();
      URL.revokeObjectURL(dlUrl);
    },
    onError: (e: any) => toast.error("Erro ao baixar: " + e.message),
  });
}

export function useDeleteCpuExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: CpuExportRow) => {
      if (row.storage_path) {
        await supabase.storage.from("cpu-exports").remove([row.storage_path]);
      }
      const { error } = await supabase.from("cpu_exports").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpu_exports"] });
      toast.success("Exportação removida");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });
}
