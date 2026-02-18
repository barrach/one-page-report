import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chartType, data, projectInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
    } else {
      throw new Error("chartType inválido");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para uso da IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const insight = result.choices?.[0]?.message?.content || "";

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
