/**
 * E-mail de boas-vindas do One Page Report.
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

export interface DadosBoasVindas {
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

export const corpoBoasVindas = (d: DadosBoasVindas): string => {
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

export const textoBoasVindas = (d: DadosBoasVindas): string =>
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
export const enviarBoasVindas = async (d: DadosBoasVindas): Promise<string | null> => {
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
export const senhaProvisoria = (): string => {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
};
