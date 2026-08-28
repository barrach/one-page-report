import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, TrendingDown, TrendingUp, Minus, ArrowRight, ArrowDown, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import AppSidebar from '@/components/AppSidebar';
import { useProjectStore } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { fmtDinheiro } from '@/lib/eapFinanceira';
import { consolidarObras, ROTULO_STATUS, type StatusObra } from '@/lib/consolidado';
import {
  acoesAbertas, matrizDeVariacao, pesosDasObras, pontePorObra, prioridades,
  projecaoDeEntrega, riscoDasObras, tendenciaConsolidada,
  COLUNAS_MATRIZ, type Severidade,
} from '@/lib/consolidadoAnalise';
import { clienteDaObra, clientesVisiveis } from '@/lib/acesso';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * One Page Consolidado do cliente, nas sete perguntas.
 *
 * RESULTADO → DRIVER → RISCO → AÇÃO. A versão anterior parava no primeiro
 * passo: dizia QUANTO o cliente está atrasado e deixava a reunião descobrir
 * sozinha por quê, onde e o que fazer. Cada bloco daqui para baixo existe para
 * responder UMA pergunta — nenhum está aqui para preencher o painel.
 *
 * É aba própria e não um modo do relatório porque a página de obra tem layout
 * arrastável, export em A4 e cards que só fazem sentido com uma obra por vez.
 */

const CORES_STATUS: Record<StatusObra, string> = {
  ok: 'text-success border-success/40 bg-success/10',
  risco: 'text-amber-600 dark:text-amber-500 border-amber-500/40 bg-amber-500/10',
  atrasada: 'text-destructive border-destructive/40 bg-destructive/10',
  sem_dado: 'text-muted-foreground border-border bg-muted/30',
};

const FUNDO_SEVERIDADE: Record<Severidade, string> = {
  ok: 'bg-success/10 text-success',
  atencao: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ruim: 'bg-destructive/15 text-destructive',
  sem_dado: 'text-muted-foreground',
};

const COR_GRAFICO = {
  previsto: 'hsl(var(--chart-previsto))',
  real: 'hsl(var(--chart-real))',
  ruim: 'hsl(var(--destructive))',
  bom: 'hsl(var(--success))',
  neutro: 'hsl(var(--muted-foreground))',
};

const pct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`;
const pp = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')} p.p.`;

const Kpi = ({ rotulo, valor, detalhe, cor }: {
  rotulo: string; valor: string; detalhe?: string; cor?: string;
}) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3 card-shadow min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{rotulo}</div>
    <div className={cn('text-xl font-bold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
    {detalhe && <div className="text-[11px] text-muted-foreground truncate">{detalhe}</div>}
  </div>
);

/** Cada bloco é uma pergunta numerada — a numeração é o roteiro da reunião. */
const Bloco = ({ n, pergunta, ferramenta, children, aside }: {
  n: number; pergunta: string; ferramenta: string;
  children: ReactNode; aside?: ReactNode;
}) => (
  <section className="rounded-xl border border-border bg-card card-shadow p-4 min-w-0">
    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{pergunta}</h2>
          <p className="text-[11px] text-muted-foreground">{ferramenta}</p>
        </div>
      </div>
      {aside}
    </div>
    {children}
  </section>
);

const Vazio = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground py-6 text-center">{children}</p>
);

const ESTILO_TOOLTIP = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

/** Tooltip da ponte: mostra o degrau, e não as duas barras que o compõem. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipPonte = ({ active, payload }: any) => {
  const ponto = active ? payload?.[0]?.payload : null;
  if (!ponto) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs card-shadow">
      <div className="font-semibold text-foreground">{ponto.nome}</div>
      <div className="text-muted-foreground">
        {ponto.tipo === 'total'
          ? `Avanço ${pct(ponto.delta)}`
          : `Contribuição ${pp(ponto.delta)}`}
      </div>
    </div>
  );
};

const Consolidado = () => {
  const { projects, selectProject, acessoRestrito } = useProjectStore();
  const { canEdit } = useAuth();

  // `projects` já vem recortado pelo papel: um cliente cujo nome aparece no
  // seletor entrega que ele existe, então a lista sai das obras visíveis.
  const clientes = useMemo(() => clientesVisiveis(projects), [projects]);

  const [cliente, setCliente] = useState<string>(() => clientes[0] ?? '');
  const clienteAtivo = clientes.includes(cliente) ? cliente : (clientes[0] ?? '');

  const doCliente = useMemo(
    () => projects.filter((p) => clienteDaObra(p) === clienteAtivo),
    [projects, clienteAtivo],
  );

  const dados = useMemo(() => consolidarObras(doCliente), [doCliente]);

  const analise = useMemo(() => {
    const pesos = pesosDasObras(dados.obras, dados.ponderacao);
    // A data de status do consolidado é a mais recente entre as obras: é até
    // onde existe realizado em ALGUMA delas.
    const status = dados.obras.map((o) => o.atualizadoEm).filter(Boolean).sort().pop() ?? '';
    const riscos = riscoDasObras(dados.obras, dados.ponderacao);

    return {
      pesos,
      ponte: pontePorObra(dados.obras, dados.ponderacao),
      matriz: matrizDeVariacao(dados.obras, acoesAbertas(doCliente)),
      tendencia: tendenciaConsolidada(doCliente, pesos, status),
      entrega: projecaoDeEntrega(dados.obras, pesos),
      riscos,
      acoes: prioridades(riscos, doCliente, dados.obras),
      status,
    };
  }, [dados, doCliente]);

  /**
   * A ponte, em barras flutuantes.
   *
   * O eixo é recortado em torno dos valores: numa escala de 0 a 100 a
   * contribuição de cada obra — um ou dois pontos percentuais — viraria um
   * traço invisível, e é justamente ela o assunto do gráfico.
   */
  const ponte = useMemo(() => {
    if (analise.ponte.length === 0) return null;

    const marcos: number[] = [dados.avancoPrev, dados.avancoReal];
    let acum = dados.avancoPrev;
    const passos = analise.ponte.map((c) => {
      const fim = acum + c.contribuicao;
      marcos.push(acum, fim);
      const passo = {
        nome: c.nome,
        de: Math.min(acum, fim),
        tamanho: Math.abs(c.contribuicao),
        delta: c.contribuicao,
        tipo: 'obra' as const,
      };
      acum = fim;
      return passo;
    });

    const min = Math.max(0, Math.floor(Math.min(...marcos)) - 2);
    const max = Math.ceil(Math.max(...marcos)) + 2;

    return {
      dominio: [min, max] as [number, number],
      barras: [
        { nome: 'Previsto', de: min, tamanho: dados.avancoPrev - min, delta: dados.avancoPrev, tipo: 'total' as const },
        ...passos,
        { nome: 'Real', de: min, tamanho: dados.avancoReal - min, delta: dados.avancoReal, tipo: 'total' as const },
      ],
    };
  }, [analise.ponte, dados.avancoPrev, dados.avancoReal]);

  const DesvioIcon = dados.desvio < 0 ? TrendingDown : dados.desvio > 0 ? TrendingUp : Minus;
  const corDesvio = dados.desvio < 0 ? 'text-destructive' : dados.desvio > 0 ? 'text-success' : 'text-foreground';

  const th = 'px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap';
  const td = 'px-3 py-2 text-sm border-t border-border';

  const semObras = dados.obras.length === 0;

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />

      <div className="flex-1 min-w-0 p-3 sm:p-5 space-y-4">

        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground uppercase tracking-widest">
              One Page Consolidado
            </h1>
            <p className="text-xs text-muted-foreground">
              Resultado → Driver → Risco → Ação · todas as obras do cliente numa leitura só
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={clienteAtivo} onValueChange={setCliente}>
              <SelectTrigger className="h-9 min-w-[180px] max-w-[280px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Um consolidado parcial apresentado como se fosse o total é pior que
            não ter consolidado: quem lê precisa saber que a conta é só das obras
            liberadas para ele, e não de tudo que o cliente tem com a Megasteam. */}
        {acessoRestrito && !semObras && (
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
            Você está vendo apenas as obras liberadas para o seu acesso. O consolidado soma só elas.
          </p>
        )}

        {semObras ? (
          <div className="rounded-xl border border-border bg-card card-shadow p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma obra para este cliente.</p>
          </div>
        ) : (
          <>
            {/* ── 1. O QUE ACONTECEU ─────────────────────────────────── */}
            <Bloco n={1} pergunta="O que aconteceu?" ferramenta="Indicadores do cliente">
              <div className={cn('grid gap-3 grid-cols-2', canEdit ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
                <Kpi rotulo="Obras" valor={String(dados.obras.length)} detalhe={clienteAtivo} />
                <Kpi rotulo="Avanço previsto" valor={pct(dados.avancoPrev)} />
                <Kpi
                  rotulo="Avanço real"
                  valor={pct(dados.avancoReal)}
                  detalhe={dados.ponderacao === 'contrato'
                    ? 'ponderado pelo valor de contrato'
                    : 'média simples entre as obras'}
                />
                <Kpi rotulo="Desvio" valor={pct(dados.desvio)} cor={corDesvio} />
                {/* Valor de contrato é do mesmo trio que vê o card Financeiro. */}
                {canEdit && (
                  <Kpi
                    rotulo="Contratado"
                    valor={fmtDinheiro(dados.valorContrato)}
                    detalhe={`${fmtDinheiro(dados.realizadoMes)} medidos no mês`}
                  />
                )}
              </div>

              {/* Aviso de ponderação: a diferença entre os dois métodos muda o
                  número, e quem lê precisa saber qual está vendo. */}
              {dados.ponderacao === 'media' && dados.obras.length > 1 && (
                <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3 mt-3">
                  O avanço consolidado está em <strong>média simples</strong> porque nem toda obra
                  deste cliente tem valor de contrato lançado. Média simples dá o mesmo peso a uma
                  obra de R$ 5 milhões e a uma de R$ 50 mil — preencha a EAP financeira das obras
                  para o consolidado passar a ponderar pelo contrato.
                </p>
              )}
            </Bloco>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ── 2. POR QUÊ ───────────────────────────────────────── */}
              <Bloco n={2} pergunta="Por quê?" ferramenta="Ponte do previsto ao real — quanto cada obra explica">
                {!ponte ? (
                  <Vazio>Sem avanço lançado para montar a ponte.</Vazio>
                ) : (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ponte.barras} margin={{ top: 18, right: 8, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="nome" tick={{ fontSize: 10 }} interval={0}
                            angle={-30} textAnchor="end" height={58}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            domain={ponte.dominio} tick={{ fontSize: 11 }}
                            tickFormatter={(v: number) => `${v}%`}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          {/* Conteúdo próprio: a barra-base é só um espaçador, e
                              o tooltip padrão a listaria como se fosse um valor. */}
                          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={TooltipPonte} />
                          {/* A base é transparente: é ela que faz a barra flutuar
                              na altura certa do degrau. */}
                          <Bar dataKey="de" stackId="p" fill="transparent" isAnimationActive={false} />
                          <Bar dataKey="tamanho" stackId="p" radius={[3, 3, 0, 0]}>
                            <LabelList
                              dataKey="delta" position="top" fontSize={10}
                              formatter={(v: number) => (Math.abs(v) >= 0.05 ? v.toFixed(1).replace('.', ',') : '')}
                            />
                            {ponte.barras.map((b, i) => (
                              <Cell
                                key={i}
                                fill={b.tipo === 'total' ? COR_GRAFICO.neutro
                                  : b.delta < 0 ? COR_GRAFICO.ruim : COR_GRAFICO.bom}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      As contribuições somam exatamente o desvio: cada obra entra com o seu atraso
                      multiplicado pelo peso dela no cliente
                      {dados.ponderacao === 'contrato' ? ' (valor de contrato)' : ' (peso igual)'}.
                      Eixo recortado para a variação caber na tela.
                    </p>
                  </>
                )}
              </Bloco>

              {/* ── 3. ONDE ESTÁ O PROBLEMA ──────────────────────────── */}
              <Bloco n={3} pergunta="Onde está o problema?" ferramenta="Matriz de variação por obra">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[26rem]">
                    <thead>
                      <tr className="bg-table-header text-table-header-foreground">
                        <th className={cn(th, 'text-left')}>Obra</th>
                        {COLUNAS_MATRIZ.map((c) => (
                          <th key={c} className={cn(th, 'text-center')}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analise.matriz.map((linha) => (
                        <tr key={linha.id}>
                          <td className={cn(td, 'font-medium text-foreground')}>{linha.nome}</td>
                          {linha.celulas.map((c, i) => (
                            <td key={i} className={cn(td, 'text-center p-1')}>
                              <span className={cn(
                                'block rounded px-2 py-1 text-xs font-semibold tabular-nums',
                                FUNDO_SEVERIDADE[c.severidade],
                              )}>
                                {c.texto}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Quatro problemas diferentes: avançar devagar, estourar a data, não medir o que
                  executou e deixar ação parada. Uma obra pode estar bem em três e mal na quarta.
                </p>
              </Bloco>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ── 4. QUAL A TENDÊNCIA ──────────────────────────────── */}
              <Bloco n={4} pergunta="Qual a tendência?" ferramenta="Avanço consolidado mês a mês">
                {analise.tendencia.length === 0 ? (
                  <Vazio>
                    Nenhuma obra deste cliente tem Curva S com data de início lançada.
                  </Vazio>
                ) : (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analise.tendencia} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip
                            contentStyle={ESTILO_TOOLTIP}
                            formatter={(v: number, n: string) => [v == null ? '—' : pct(v), n === 'previsto' ? 'Previsto' : 'Real']}
                          />
                          <Line type="monotone" dataKey="previsto" stroke={COR_GRAFICO.previsto} strokeWidth={2} dot={false} />
                          {/* connectNulls fica FALSO: a linha do real tem que
                              parar na data de status, e não atravessar o futuro. */}
                          <Line type="monotone" dataKey="real" stroke={COR_GRAFICO.real} strokeWidth={2.5} dot={false} connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Por mês do calendário, e não por semana de obra: as obras do cliente começam
                      em datas diferentes. O real para na data de status — projetar realizado é inventar.
                    </p>
                  </>
                )}
              </Bloco>

              {/* ── 5. VAMOS ENTREGAR ────────────────────────────────── */}
              <Bloco n={5} pergunta="Vamos entregar o contrato?" ferramenta="Real hoje + projeção no ritmo atual">
                {!analise.entrega ? (
                  <Vazio>Sem avanço lançado para projetar a entrega.</Vazio>
                ) : (
                  <>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { nome: 'Real hoje', valor: analise.entrega.hoje, cor: COR_GRAFICO.real },
                            { nome: 'Projetado no término', valor: analise.entrega.projetado, cor: COR_GRAFICO.previsto },
                            { nome: 'Meta', valor: 100, cor: COR_GRAFICO.neutro },
                          ]}
                          margin={{ top: 20, right: 8, left: -12, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number) => [pct(v), 'Avanço']} />
                          <ReferenceLine y={100} stroke={COR_GRAFICO.neutro} strokeDasharray="4 4" />
                          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="valor" position="top" fontSize={11} formatter={(v: number) => `${v.toFixed(1).replace('.', ',')}%`} />
                            {[COR_GRAFICO.real, COR_GRAFICO.previsto, COR_GRAFICO.neutro].map((c, i) => (
                              <Cell key={i} fill={c} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className={cn(
                      'text-xs mt-1 px-3 py-2 rounded-lg border',
                      analise.entrega.lacuna > 0
                        ? 'border-destructive/40 bg-destructive/5 text-foreground'
                        : 'border-success/40 bg-success/5 text-foreground',
                    )}>
                      {analise.entrega.lacuna > 0 ? (
                        <>
                          Mantido o ritmo atual, o cliente fecha em{' '}
                          <strong>{pct(analise.entrega.projetado)}</strong> na data da linha de base —
                          faltam <strong>{pct(analise.entrega.lacuna)}</strong>, com{' '}
                          <strong>{analise.entrega.obrasEmFalta}</strong>{' '}
                          {analise.entrega.obrasEmFalta > 1 ? 'obras' : 'obra'} abaixo do plano.
                        </>
                      ) : (
                        <>No ritmo atual, todas as obras chegam ao término previsto.</>
                      )}
                    </p>
                  </>
                )}
              </Bloco>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ── 6. QUAL O RISCO ──────────────────────────────────── */}
              <Bloco n={6} pergunta="Qual o risco?" ferramenta="Impacto × probabilidade, por obra">
                {analise.riscos.length === 0 ? (
                  <Vazio>Sem avanço lançado para medir risco.</Vazio>
                ) : (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 12, right: 16, left: -12, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            type="number" dataKey="probabilidade" domain={[0, 100]}
                            name="Probabilidade" tick={{ fontSize: 10 }}
                            tickFormatter={(v: number) => `${v}%`}
                            stroke="hsl(var(--muted-foreground))"
                            label={{ value: 'Probabilidade de não entregar', position: 'insideBottom', offset: -12, fontSize: 10 }}
                          />
                          <YAxis
                            type="number" dataKey="impacto" domain={[0, 100]}
                            name="Impacto" tick={{ fontSize: 10 }}
                            tickFormatter={(v: number) => `${v}%`}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <ZAxis range={[120, 120]} />
                          <ReferenceLine x={10} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                          <ReferenceLine y={100 / Math.max(1, dados.obras.length)} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                          <Tooltip
                            contentStyle={ESTILO_TOOLTIP}
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(v: number, n: string) => [`${v.toFixed(0)}%`, n]}
                            labelFormatter={() => ''}
                          />
                          <Scatter data={analise.riscos}>
                            <LabelList dataKey="nome" position="top" fontSize={10} />
                            {analise.riscos.map((r) => (
                              <Cell
                                key={r.id}
                                fill={r.quadrante === 'critico' ? COR_GRAFICO.ruim
                                  : r.quadrante === 'tranquilo' ? COR_GRAFICO.bom
                                    : 'hsl(38 92% 50%)'}
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Impacto = fatia do contrato do cliente que está nesta obra. Probabilidade = o
                      quanto o desempenho até aqui sugere que ela não entrega (100% − IDP). É o risco
                      que os números já demonstram, não um cadastro de riscos.
                    </p>
                  </>
                )}
              </Bloco>

              {/* ── 7. O QUE DEVEMOS FAZER ───────────────────────────── */}
              <Bloco n={7} pergunta="O que devemos fazer?" ferramenta="Prioridades da semana, do maior risco para baixo">
                {analise.acoes.length === 0 ? (
                  <Vazio>Sem obra em risco para priorizar.</Vazio>
                ) : (
                  <ol className="space-y-2.5">
                    {analise.acoes.map((a, i) => (
                      <li key={a.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-foreground">
                              {i + 1}. {a.nome}
                            </span>
                            <p className="text-[11px] text-muted-foreground">{a.motivo}</p>
                          </div>
                          <Link
                            to="/" onClick={() => selectProject(a.id)}
                            className="text-xs text-primary hover:underline whitespace-nowrap shrink-0"
                          >
                            Abrir obra
                          </Link>
                        </div>

                        {/* Obra crítica sem ação lançada não é obra tranquila —
                            é obra sem plano, e essa é a informação acionável. */}
                        {a.semAcao ? (
                          <p className="mt-2 text-xs flex items-start gap-1.5 text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            Nenhuma ação aberta lançada nesta obra.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {a.acoes.map((texto, j) => (
                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                <span className="min-w-0">{texto}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Bloco>
            </div>

            {/* Faixa do método — o mesmo roteiro, na ordem em que se lê. */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-2 flex-wrap justify-center text-center">
              {[
                { t: 'Resultado', s: 'o que aconteceu' },
                { t: 'Driver', s: 'por que aconteceu' },
                { t: 'Risco', s: 'o que pode afetar' },
                { t: 'Ação', s: 'o que vamos fazer' },
              ].map((e, i, arr) => (
                <div key={e.t} className="flex items-center gap-2">
                  <div>
                    <div className="text-xs font-bold text-foreground uppercase tracking-wider">{e.t}</div>
                    <div className="text-[10px] text-muted-foreground">{e.s}</div>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />}
                </div>
              ))}
            </div>

            {/* Detalhe: é para onde se vai depois de decidir onde olhar. */}
            <section className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
              <div className="px-4 pt-3 flex items-center gap-2">
                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Obra a obra</h2>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse min-w-[52rem]">
                  <thead>
                    <tr className="bg-table-header text-table-header-foreground">
                      <th className={cn(th, 'text-left')}>Obra</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, 'text-right')}>Prev.</th>
                      <th className={cn(th, 'text-right')}>Real</th>
                      <th className={cn(th, 'text-right')}>Desvio</th>
                      <th className={cn(th, 'text-right')}>IDP</th>
                      <th className={th}>Término LB</th>
                      <th className={th}>Projetado</th>
                      {canEdit && <th className={cn(th, 'text-right')}>Contrato</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.obras.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                        <td className={cn(td, 'font-medium text-foreground')}>{o.nome}</td>
                        <td className={cn(td, 'text-center')}>
                          <span className={cn(
                            'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                            CORES_STATUS[o.status],
                          )}>
                            {ROTULO_STATUS[o.status]}
                          </span>
                        </td>
                        <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoPrev)}</td>
                        <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoReal)}</td>
                        <td className={cn(
                          td, 'text-right tabular-nums font-semibold',
                          o.desvio < 0 ? 'text-destructive' : o.desvio > 0 ? 'text-success' : '',
                        )}>
                          {pct(o.desvio)}
                        </td>
                        <td className={cn(td, 'text-right tabular-nums')}>{o.idp.toFixed(0)}%</td>
                        <td className={cn(td, 'text-center whitespace-nowrap')}>
                          {formatDateBR(o.terminoBase) || '—'}
                        </td>
                        <td className={cn(td, 'text-center whitespace-nowrap')}>
                          {o.terminoProjetado ? (
                            <span className={cn((o.desvioDias ?? 0) > 0 && 'text-destructive font-semibold')}>
                              {formatDateBR(o.terminoProjetado)}
                              {o.desvioDias != null && o.desvioDias !== 0 && (
                                <span className="block text-[10px] font-normal text-muted-foreground">
                                  {o.desvioDias > 0 ? `+${o.desvioDias}` : o.desvioDias} dias
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        {canEdit && (
                          <td className={cn(td, 'text-right tabular-nums whitespace-nowrap')}>
                            {o.valorContrato > 0 ? fmtDinheiro(o.valorContrato) : '—'}
                          </td>
                        )}
                        <td className={cn(td, 'text-right')}>
                          <Link
                            to="/"
                            onClick={() => selectProject(o.id)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            Abrir <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[11px] text-muted-foreground max-w-[80ch] flex items-start gap-1.5">
              <DesvioIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', corDesvio)} />
              <span>
                O IDP é o avanço real dividido pelo previsto. O término projetado estica a
                duração da linha de base nesse mesmo ritmo — é a data que o desempenho aponta,
                não a que foi digitada na obra.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Consolidado;
