import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════════════════════════════════════
// E-mail de boas-vindas.
//
// Está neste arquivo, e não num módulo ao lado, para a função poder ser
// colada inteira no editor do painel do Supabase — é assim que ela é
// publicada aqui, sem CLI na máquina.
// ════════════════════════════════════════════════════════════════════════

/**
 * Envio do acesso por e-mail.
 *
 * Vai por um provedor externo (Resend) porque o SMTP embutido do Supabase só
 * dispara os fluxos dele — confirmação, recuperação, convite — e nenhum deles
 * carrega a senha provisória que o administrador definiu.
 *
 * Se a chave não estiver configurada, o envio falha SEM derrubar a criação do
 * usuário: a conta é o que importa, e o administrador ainda tem a senha na
 * tela para passar por outro canal. Criar usuário não pode depender de e-mail.
 */

const URL_RESEND = 'https://api.resend.com/emails';

interface DadosBoasVindas {
  para: string;
  nome: string;
  senha: string;
  papel: string;
  urlApp: string;
}

const NOME_DO_PAPEL: Record<string, string> = {
  admin: 'Administrador',
  planejador: 'Planejador',
  gestor: 'Gestor',
  visualizador: 'Visualizador',
  cliente: 'Cliente',
};

const escapar = (t: string) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const corpoBoasVindas = (d: DadosBoasVindas): string => {
  const nome = escapar(d.nome || d.para);
  const papel = escapar(NOME_DO_PAPEL[d.papel] ?? d.papel);
  const url = escapar(d.urlApp);

  // HTML de e-mail é conservador de propósito: tabela, estilo inline e nenhuma
  // imagem externa. Outlook e Gmail ignoram boa parte de CSS moderno, e o que
  // não renderiza num e-mail de senha vira chamado no suporte.
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#002054;padding:20px 24px;">
        <div style="color:#ffffff;font-size:13px;letter-spacing:3px;font-weight:bold;">MEGASTEAM</div>
        <div style="color:#a8b6d1;font-size:12px;margin-top:2px;">One Page Report</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;font-size:16px;">Olá, ${nome}.</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">
          Seu acesso ao One Page Report foi criado. Abaixo estão os dados para o primeiro login.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 16px;">
          <tr><td style="padding:14px 16px;font-size:13px;">
            <div style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Login</div>
            <div style="font-size:15px;font-weight:bold;margin:2px 0 12px;">${escapar(d.para)}</div>

            <div style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Senha provisória</div>
            <div style="font-family:'Courier New',monospace;font-size:17px;font-weight:bold;letter-spacing:1px;margin:2px 0 12px;">${escapar(d.senha)}</div>

            <div style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Perfil</div>
            <div style="font-size:14px;margin-top:2px;">${papel}</div>
          </td></tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
          <tr><td style="background:#002054;border-radius:8px;">
            <a href="${url}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Acessar o One Page Report</a>
          </td></tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#374151;">
          <strong>Troque a senha no primeiro acesso.</strong> Depois de entrar, vá em
          <strong>Configurações</strong> e defina uma senha sua. A senha acima é provisória e
          passou por e-mail — trocá-la é o que a torna só sua.
        </p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
          Se você não esperava este e-mail, avise o administrador do One Page Report e não use o acesso.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
        Mensagem automática do One Page Report — Megasteam. Não responda a este e-mail.
      </td>
    </tr>
  </table>
</body></html>`;
};

const textoBoasVindas = (d: DadosBoasVindas): string =>
  [
    `Olá, ${d.nome || d.para}.`,
    '',
    'Seu acesso ao One Page Report foi criado.',
    '',
    `Endereço: ${d.urlApp}`,
    `Login: ${d.para}`,
    `Senha provisória: ${d.senha}`,
    `Perfil: ${NOME_DO_PAPEL[d.papel] ?? d.papel}`,
    '',
    'Troque a senha no primeiro acesso, em Configurações.',
  ].join('\n');

/** Envia e devolve o erro em vez de lançar: o chamador decide o que fazer. */
const enviarBoasVindas = async (d: DadosBoasVindas): Promise<string | null> => {
  const chave = Deno.env.get('RESEND_API_KEY');
  if (!chave) return 'RESEND_API_KEY não configurada nas variáveis da função';

  const remetente = Deno.env.get('EMAIL_REMETENTE')
    ?? 'One Page Report <onboarding@resend.dev>';

  try {
    const r = await fetch(URL_RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remetente,
        to: [d.para],
        subject: 'Seu acesso ao One Page Report — Megasteam',
        html: corpoBoasVindas(d),
        text: textoBoasVindas(d),
      }),
    });

    if (!r.ok) {
      const detalhe = await r.text();
      return `Resend respondeu ${r.status}: ${detalhe.slice(0, 300)}`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Falha ao chamar o provedor de e-mail';
  }
};

/**
 * Senha provisória legível.
 *
 * Sem I/l/1/O/0: ela vai ser lida de um e-mail e digitada à mão, e um "l"
 * confundido com "1" vira chamado de suporte. O tamanho compensa o alfabeto
 * menor, e ela existe só até a primeira troca.
 */
const senhaProvisoria = (): string => {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
};


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
