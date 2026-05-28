import { useState, useEffect, useCallback } from "react";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { useToast } from "@budget/hooks/use-toast";

export interface Collaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by: string;
  created_at: string;
  // joined from profiles
  email?: string;
  full_name?: string;
  company_name?: string;
}

export const useCollaboration = (projectId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    // Load collaborators with profile info
    const { data } = await supabase
      .from("project_collaborators")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch profile info for each collaborator
      const userIds = data.map((c: any) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, company_name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const enriched = data.map((c: any) => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          email: profile?.email || "",
          full_name: profile?.full_name || "",
          company_name: profile?.company_name || "",
        };
      });
      setCollaborators(enriched);
    } else {
      setCollaborators([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const invite = async (email: string, role: "editor" | "viewer") => {
    if (!user) return { error: "Não autenticado" };

    // Can't invite yourself
    if (email === user.email) return { error: "Você não pode convidar a si mesmo" };

    // Find user by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("email", email)
      .maybeSingle();

    if (!profile) return { error: "Usuário não encontrado no sistema" };

    // Check for duplicate
    const { data: existing } = await supabase
      .from("project_collaborators")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (existing && existing.status !== "declined") {
      return { error: "Este usuário já foi convidado" };
    }

    // If previously declined, remove old entry
    if (existing && existing.status === "declined") {
      await supabase.from("project_collaborators").delete().eq("id", existing.id);
    }

    // Get project name
    const { data: project } = await supabase
      .from("projects")
      .select("project_name")
      .eq("id", projectId)
      .single();

    // Create collaborator entry
    const { data: collab, error: collabErr } = await supabase
      .from("project_collaborators")
      .insert({
        project_id: projectId,
        user_id: profile.user_id,
        role,
        status: "pending",
        invited_by: user.id,
      })
      .select("id")
      .single();

    if (collabErr) return { error: collabErr.message };

    // Create notification
    await supabase.from("notifications").insert({
      user_id: profile.user_id,
      sender_id: user.id,
      type: "convite_projeto",
       title: "Convite para orçamento",
       message: `Você foi convidado para participar do orçamento "${project?.project_name || ""}". Acesso: ${role === "editor" ? "Editor" : "Visualizador"}.`,
      related_project_id: projectId,
      related_collaborator_id: collab.id,
    });

    toast({ title: "Convite enviado", description: `Convite enviado para ${email}` });
    await load();
    return { error: null };
  };

  const removeCollaborator = async (collaboratorId: string) => {
    await supabase.from("project_collaborators").delete().eq("id", collaboratorId);
    toast({ title: "Colaborador removido" });
    await load();
  };

  const updateRole = async (collaboratorId: string, newRole: "editor" | "viewer") => {
    await supabase.from("project_collaborators").update({ role: newRole }).eq("id", collaboratorId);
    toast({ title: "Papel atualizado" });
    await load();
  };

  return { collaborators, loading, invite, removeCollaborator, updateRole, reload: load };
};
