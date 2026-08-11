import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const geminiModel = chartType === "executive" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: chartType === "executive" ? 800 : 200,
          },
        }),
      }
    );

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
