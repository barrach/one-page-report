import { useState, useEffect, useCallback } from "react";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { useToast } from "@budget/hooks/use-toast";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_project_id: string | null;
  related_collaborator_id: string | null;
  sender_id: string;
  status: string;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          toast({ title: (payload.new as Notification).title, description: (payload.new as Notification).message });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const acceptInvite = async (notification: Notification) => {
    if (!notification.related_collaborator_id) return;
    // Update collaborator status
    await supabase
      .from("project_collaborators")
      .update({ status: "active" })
      .eq("id", notification.related_collaborator_id);
    // Update notification
    await supabase
      .from("notifications")
      .update({ status: "accepted" })
      .eq("id", notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, status: "accepted" } : n))
    );
    toast({ title: "Convite aceito!" });
  };

  const declineInvite = async (notification: Notification) => {
    if (!notification.related_collaborator_id) return;
    await supabase
      .from("project_collaborators")
      .update({ status: "declined" })
      .eq("id", notification.related_collaborator_id);
    await supabase
      .from("notifications")
      .update({ status: "declined" })
      .eq("id", notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, status: "declined" } : n))
    );
    toast({ title: "Convite recusado" });
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ status: "read" }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
  };

  return { notifications, loading, unreadCount, acceptInvite, declineInvite, markAsRead, reload: load };
};
