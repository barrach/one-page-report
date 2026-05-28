import { useEffect, useState } from "react";
import { supabase } from "@budget/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAIL = "michel.zabalia@megasteam.com.br";

const syncProfile = async (user: User) => {
  const meta = user.user_metadata || {};
  const isAdmin = user.email === ADMIN_EMAIL;

  // Upsert profile — avoids the check-then-insert race and works even if
  // the SELECT policy hasn't resolved yet (e.g. first login).
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      email: user.email || "",
      full_name: meta.full_name || "",
      company_name: meta.company_name || "",
      role: isAdmin ? "admin" : "user",
      status: isAdmin ? "active" : "pending",
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
  if (error && error.code !== "23505") {
    console.warn("Profile sync error:", error.message);
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) syncProfile(u);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u && _event === "SIGNED_IN") syncProfile(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, signOut };
};
