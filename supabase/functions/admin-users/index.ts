import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarBoasVindas, senhaProvisoria } from "./email.ts";

const URL_APP_PADRAO = "https://one-page-report-megasteam.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").single();
    if (!callerRole) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action, ...params } = await req.json();

    const urlApp = Deno.env.get("APP_URL") ?? URL_APP_PADRAO;

    if (action === "create-user") {
      const { email, password, display_name, role } = params;
      // Senha em branco vira provisória gerada aqui: o administrador não
      // precisa inventar uma, e ela nasce forte.
      const senha = String(password || "").trim() || senhaProvisoria();

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        // A marca de provisória é o que faz o app pedir a troca no primeiro
        // acesso; ela é apagada quando a pessoa troca a senha em Configurações.
        user_metadata: { display_name, senha_provisoria: true },
      });
      if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Assign role
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });

      // E-mail depois da conta, e o erro dele NÃO derruba a criação: a conta é
      // o que importa, e a senha volta na resposta para o administrador passar
      // por outro canal se o envio falhar.
      const erroEmail = await enviarBoasVindas({
        para: email, nome: display_name, senha, papel: role, urlApp,
      });

      return new Response(JSON.stringify({
        user: { id: newUser.user.id, email, display_name, role },
        senha,
        emailEnviado: erroEmail == null,
        emailErro: erroEmail,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    /**
     * Reenviar acesso: gera uma senha provisória NOVA e manda o e-mail de novo.
     *
     * É o que existe no lugar de "ver a senha atual", que é impossível — o
     * Supabase guarda hash, não a senha. Quem esqueceu recebe uma nova; ninguém
     * consegue ler a que estava em uso, nem o administrador.
     */
    if (action === "resend-welcome") {
      const { user_id } = params;

      const { data: alvo, error: buscaErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (buscaErr || !alvo?.user?.email) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const senha = senhaProvisoria();
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: senha,
        user_metadata: { ...(alvo.user.user_metadata ?? {}), senha_provisoria: true },
      });
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: papeis } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id);

      const erroEmail = await enviarBoasVindas({
        para: alvo.user.email,
        nome: String(alvo.user.user_metadata?.display_name ?? ""),
        senha,
        papel: String(papeis?.[0]?.role ?? "visualizador"),
        urlApp,
      });

      return new Response(JSON.stringify({
        senha,
        emailEnviado: erroEmail == null,
        emailErro: erroEmail,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-users") {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
      const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
      const { data: assignments } = await supabaseAdmin.from("project_assignments").select("*");

      const users = (profiles || []).map((p: any) => ({
        ...p,
        roles: (roles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
        assignments: (assignments || []).filter((a: any) => a.user_id === p.user_id).map((a: any) => a.project_id),
      }));

      return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-role") {
      const { user_id, role } = params;
      // Remove existing roles, set new one
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id, role });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "assign-project") {
      const { user_id, project_id } = params;
      await supabaseAdmin.from("project_assignments").upsert({ user_id, project_id }, { onConflict: "user_id,project_id" });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unassign-project") {
      const { user_id, project_id } = params;
      await supabaseAdmin.from("project_assignments").delete().eq("user_id", user_id).eq("project_id", project_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete-user") {
      const { user_id } = params;
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
