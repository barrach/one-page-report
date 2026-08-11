/**
 * Extrai a mensagem real de um erro de Edge Function.
 *
 * Quando a function responde com status não-2xx, o supabase-js entrega um
 * `FunctionsHttpError` cuja `message` é sempre a genérica "Edge Function returned
 * a non-2xx status code" — o corpo da resposta, que é onde está o motivo, fica
 * guardado em `context`. Sem ler dali, a tela nunca mostra a causa.
 */
export const mensagemDaFunction = async (
  fnError: unknown,
  fallback = 'Erro ao chamar a IA',
): Promise<string> => {
  const ctx = (fnError as { context?: unknown } | null)?.context;

  if (ctx instanceof Response) {
    try {
      const corpo = await ctx.clone().json();
      if (corpo?.error) return String(corpo.error);
    } catch {
      try {
        const texto = await ctx.clone().text();
        if (texto.trim()) return texto.slice(0, 300);
      } catch {
        /* corpo já consumido — cai para a mensagem do erro */
      }
    }
  }

  const msg = (fnError as Error | null)?.message;
  return msg && !/non-2xx/i.test(msg) ? msg : fallback;
};
