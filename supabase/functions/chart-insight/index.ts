import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Descobre um modelo disponível na conta, em vez de fixar o nome no código.
 *
 * O Google aposenta modelos: `gemini-2.5-flash-lite` passou a responder
 * 404 "no longer available to new users". Fixar outro nome só adia o mesmo
 * problema, então aqui a lista vem do próprio ListModels e a escolha é por
 * preferência: para os cartões, o modelo mais leve (flash); para o resumo
 * executivo, o mais capaz (pro), caindo para flash se não houver.
 */
let cacheModelos: string[] | null = null;

async function modelosDisponiveis(apiKey: string): Promise<string[]> {
  if (cacheModelos) return cacheModelos;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`);
  if (!r.ok) throw new Error(`ListModels respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);

  const j = await r.json();
  const nomes: string[] = (j.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m: { name: string }) => String(m.name).replace(/^models\//, ""))
    // fora o que não serve para gerar texto a partir de texto
    .filter((n: string) => !/embedding|aqa|vision|image|tts|audio|native-audio|live/.test(n));

  cacheModelos = nomes;
  console.log("Modelos disponíveis:", nomes.join(", "));
  return nomes;
}

/**
 * Versão numérica no nome ("gemini-2.5-flash" → 2.5), para preferir a mais nova.
 * Os aliases "-latest" contam como a mais nova de todas de propósito: eles
 * acompanham o modelo atual e não são aposentados, que é o que quebrou aqui.
 */
const versaoDoNome = (n: string): number => {
  if (/latest/.test(n) && !/\d/.test(n)) return 99;
  const m = n.match(/(\d+)\.(\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 10 : 0;
};

/** Candidatos em ordem de preferência para o tipo de análise. */
function candidatos(nomes: string[], executivo: boolean): string[] {
  const peso = (n: string): number => {
    let p = versaoDoNome(n) * 10;
    if (executivo) {
      if (/pro/.test(n)) p += 60;
      else if (/flash/.test(n) && !/lite/.test(n)) p += 40;
      else if (/flash/.test(n)) p += 20;
    } else {
      if (/flash.*lite|lite.*flash/.test(n)) p += 60;
      else if (/flash/.test(n)) p += 40;
      else if (/pro/.test(n)) p += 10;
    }
    // aliases "-latest" envelhecem melhor que nomes de versão fixa
    if (/latest/.test(n)) p += 5;
    // pré-lançamentos ficam para o fim
    if (/preview|exp|experimental/.test(n)) p -= 30;
    return p;
  };
  return [...nomes].sort((a, b) => peso(b) - peso(a)).slice(0, 4);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chartType, data, projectInfo } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada no projeto Supabase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (chartType === "fiveweek") {
      systemPrompt = `Você é um analista de gestão de projetos especialista em acompanhamento de obras e serviços de engenharia. 
Analise dados de resultado semanal (previsto × real) e gere uma observação concisa (máximo 2 frases) em português. 
Seja direto, objetivo e aponte o que mais importa: desvios significativos, tendências, semanas críticas.`;
      userPrompt = `Projeto: ${projectInfo?.projeto || 'N/A'}
Dados das últimas semanas (previsto% × real%):
${JSON.stringify(data)}
Gere uma observação analítica concisa sobre o desempenho semanal.`;
    } else if (chartType === "scurve") {
      systemPrompt = `Você é um analista de gestão de projetos especialista em acompanhamento de curvas de avanço (Curva-S).
Analise os dados de avanço acumulado (previsto × real × tendência) e gere uma observação concisa (máximo 2 frases) em português.
Destaque o desvio atual, se o projeto está adiantado ou atrasado, e o que a tendência indica.`;
      userPrompt = `Projeto: ${projectInfo?.projeto || 'N/A'}
Avanço Previsto Atual: ${projectInfo?.avancoPrev || 0}%
Avanço Real Atual: ${projectInfo?.avancoReal || 0}%
Dados da Curva-S (previsto% acumulado × real%):
${JSON.stringify(data)}
Gere uma observação analítica concisa sobre o avanço do projeto.`;
    } else if (chartType === "histogram") {
      systemPrompt = `Você é um analista de gestão de projetos especialista em controle de mão de obra (MOD).
Analise dados de histograma de MOD (previsto × real por período) e gere uma observação concisa (máximo 2 frases) em português.
Aponte picos de alocação, períodos com maior desvio e o que isso implica para o projeto.`;
      userPrompt = `Projeto: ${projectInfo?.projeto || 'N/A'}
Dados de MOD previsto × real por período:
${JSON.stringify(data)}
Gere uma observação analítica concisa sobre a alocação de mão de obra.`;
    } else if (chartType === "month") {
      systemPrompt = `Você é um analista de gestão de projetos especialista em acompanhamento de metas mensais.
Analise o desempenho mensal (previsto × realizado por semana) e gere uma observação concisa (máximo 2 frases) em português.
Indique se a meta está sendo atingida, qual semana teve melhor/pior desempenho e a perspectiva de fechamento do mês.`;
      userPrompt = `Projeto: ${projectInfo?.projeto || 'N/A'}
Dados mensais por semana (previsto × real):
${JSON.stringify(data)}
Gere uma observação analítica concisa sobre o desempenho mensal.`;
    } else if (chartType === "executive") {
      systemPrompt = `Você é um analista sênior de gestão de projetos especialista em engenharia e obras industriais.
Analise todos os indicadores do projeto (Curva-S, visão semanal, histograma de MOD, resultado mensal, ações e observações) e gere um RESUMO EXECUTIVO completo em português.
O resumo deve ter 4-5 parágrafos curtos cobrindo: situação geral do projeto, desempenho de avanço físico, desempenho de mão de obra, principais riscos/ações e perspectiva de conclusão.
Seja direto, analítico e use linguagem executiva. Use bullet points quando apropriado para facilitar a leitura.`;
      userPrompt = `Projeto: ${projectInfo?.projeto || 'N/A'} | Cliente: ${(projectInfo as any)?.cliente || 'N/A'}
Gestor: ${(projectInfo as any)?.gestor || 'N/A'}
Avanço Previsto: ${projectInfo?.avancoPrev || 0}% | Avanço Real: ${projectInfo?.avancoReal || 0}%
IDP: ${projectInfo?.avancoPrev ? ((projectInfo.avancoReal / projectInfo.avancoPrev) * 100).toFixed(1) : 0}%
Início: ${(projectInfo as any)?.inicio || 'N/A'} | Término Previsto: ${(projectInfo as any)?.terminoPrev || 'N/A'}

Dados da Curva-S: ${JSON.stringify(data?.sCurveData || [])}
Visão Semanal (últimas semanas): ${JSON.stringify(data?.weeklyData || [])}
Histograma MOD: ${JSON.stringify(data?.histogramData || [])}
Resultado Mensal: ${JSON.stringify(data?.monthData || [])}
Ações em andamento: ${JSON.stringify(data?.actions || [])}
Observações: ${JSON.stringify(data?.observations || [])}

Gere um resumo executivo completo e estruturado do projeto.`;
    } else {
      throw new Error("chartType inválido");
    }

    const executivo = chartType === "executive";
    const corpo = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: executivo ? 800 : 200 },
    });

    const lista = await modelosDisponiveis(GEMINI_API_KEY);
    if (lista.length === 0) throw new Error("Nenhum modelo de texto disponível para esta chave");

    // Tenta os candidatos em ordem: se um foi aposentado (404), cai para o próximo
    // em vez de devolver erro para a tela.
    let response!: Response;
    let geminiModel = "";
    for (const modelo of candidatos(lista, executivo)) {
      geminiModel = modelo;
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo },
      );
      if (response.ok) break;
      if (response.status !== 404) break; // 400/403/429 não melhoram trocando de modelo
      console.warn(`Modelo ${modelo} indisponível (404) — tentando o próximo`);
      cacheModelos = null; // a lista envelheceu; recarrega na próxima chamada
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Repassa o que o Gemini respondeu. Engolir isso num "Erro ao consultar IA"
      // genérico deixava a tela sem nenhuma pista do que corrigir — chave inválida,
      // modelo indisponível e cota estourada davam todos a mesma mensagem.
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      let detalhe = t.slice(0, 300);
      try {
        const j = JSON.parse(t);
        detalhe = j?.error?.message || detalhe;
      } catch { /* corpo não é JSON — usa o texto cru */ }
      return new Response(
        JSON.stringify({
          error: `IA (Gemini ${geminiModel}) respondeu ${response.status}: ${detalhe}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const insight = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!insight) {
      // Acontece quando o modelo corta por filtro de conteúdo ou estoura os tokens:
      // 200 com candidates vazio. Sem isso, a tela mostrava um insight em branco.
      const motivo = result.candidates?.[0]?.finishReason || result.promptFeedback?.blockReason || "sem candidatos";
      return new Response(
        JSON.stringify({ error: `IA não retornou texto (${motivo})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chart-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
