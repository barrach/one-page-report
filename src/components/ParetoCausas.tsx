import TituloCard from '@/components/TituloCard';
import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { AlertTriangle, Target } from 'lucide-react';
import { useCurrentProject } from '@/store/projectStore';
import { resumo6M, COR_CAUSA } from '@/lib/causas6m';
import type { Causa6M } from '@/lib/parseProgramacaoSemanal';
import { cn } from '@/lib/utils';

/**
 * Pareto das causas 6M — por que a programação não foi cumprida.
 *
 * Ocupa a largura toda do relatório: à esquerda o gráfico (barras por causa +
 * a linha de acumulado), à direita as justificativas agrupadas por M. A leitura
 * pretendida é "quais poucas causas respondem pela maior parte das falhas, e o
 * que exatamente aconteceu em cada uma".
 */
const ParetoCausas = () => {
  const { programacaoSemanal } = useCurrentProject();
  const dados = useMemo(() => resumo6M(programacaoSemanal), [programacaoSemanal]);

  const { pareto, ocorrencias, aJustificar, justificadas, itens } = dados;

  // Justificativas agrupadas por causa, na ordem do Pareto.
  const porCausa = useMemo(() => {
    const mapa = new Map<Causa6M, typeof itens>();
    for (const it of itens) {
      for (const c of it.causas) {
        if (!mapa.has(c)) mapa.set(c, []);
        mapa.get(c)!.push(it);
      }
    }
    return pareto.map((p) => ({ ...p, itens: mapa.get(p.causa) ?? [] }));
  }, [itens, pareto]);

  const semDados = pareto.length === 0;

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            <TituloCard id='pareto' padrao='Pareto de Causas — 6M' />
          </h3>
          <p className="text-xs text-muted-foreground">
            Por que a programação semanal não foi cumprida
          </p>
        </div>

        {/* Cobertura das justificativas: sem isso o Pareto engana */}
        {aJustificar > 0 && (
          <div className="flex items-center gap-3 text-right shrink-0">
            <div>
              <div className="text-xl font-bold leading-none text-foreground">
                {justificadas}/{aJustificar}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">atividades justificadas</div>
            </div>
            {justificadas < aJustificar && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-warning/20 text-warning-foreground border border-warning/40">
                <AlertTriangle className="h-3 w-3" />
                {aJustificar - justificadas} sem causa
              </span>
            )}
          </div>
        )}
      </div>

      {semDados ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Target className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {aJustificar > 0
              ? 'Nenhuma causa apontada ainda'
              : 'Nenhuma atividade fora do programado'}
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-[420px]">
            {aJustificar > 0
              ? `Há ${aJustificar} atividade(s) com aderência abaixo de 90%. Aponte a causa 6M na aba “Atividades” da Programação Semanal para o Pareto se formar.`
              : 'Quando uma atividade programada ficar abaixo de 90% de aderência, a causa aparece aqui.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Gráfico */}
          <div className="lg:col-span-3">
            <div className="h-[300px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pareto} margin={{ top: 24, right: 48, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="causa"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    interval={0}
                  />
                  <YAxis
                    yAxisId="qtd"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'Acumulado' ? `${value}%` : `${value} ocorrência(s)`
                    }
                  />

                  <Bar yAxisId="qtd" dataKey="total" name="Ocorrências" radius={[4, 4, 0, 0]} barSize={54}>
                    <LabelList
                      dataKey="pct"
                      position="top"
                      fontSize={11}
                      fontWeight={700}
                      fill="hsl(var(--foreground))"
                      formatter={(v: number) => `${v}%`}
                    />
                    {pareto.map((p) => (
                      <Cell key={p.causa} fill={p.cor} />
                    ))}
                  </Bar>

                  {/* A linha de Pareto: percentual acumulado */}
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="acumulado"
                    name="Acumulado"
                    stroke="hsl(var(--chart-cutline))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'hsl(var(--chart-cutline))' }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="acumulado"
                      position="top"
                      fontSize={10}
                      fill="hsl(var(--chart-cutline))"
                      formatter={(v: number) => `${v}%`}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-muted-foreground mt-1">
              {ocorrencias} ocorrência(s) apontada(s) · a causa líder responde por {pareto[0].pct}% das falhas
            </p>
          </div>

          {/* Justificativas por M */}
          <div className="lg:col-span-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Justificativas por causa
            </p>
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {porCausa.map((c) => (
                <div key={c.causa} className="rounded-lg border border-border overflow-hidden">
                  <div
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-white"
                    style={{ backgroundColor: c.cor }}
                  >
                    <span className="text-xs font-bold truncate">{c.causa}</span>
                    <span className="text-[10px] font-bold tabular-nums shrink-0">
                      {c.total} · {c.pct}%
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {c.itens.map((it, i) => (
                      <li key={`${it.semana}-${it.atividade}-${i}`} className="px-2.5 py-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
                            S{it.semana}
                          </span>
                          <span className="text-xs font-medium text-foreground min-w-0 break-words">
                            {it.atividade}
                          </span>
                          {it.aderencia != null && (
                            <span
                              className={cn(
                                'ml-auto text-[10px] font-bold shrink-0',
                                it.aderencia === 0 ? 'text-destructive' : 'text-warning-foreground',
                              )}
                            >
                              {Math.round(it.aderencia * 100)}%
                            </span>
                          )}
                        </div>
                        {it.justificativa ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                            {it.justificativa}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">
                            sem justificativa escrita
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParetoCausas;
