import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, TrendingDown, TrendingUp, Minus, ArrowRight, ArrowDown, AlertTriangle, X,
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
import { fmtDinheiro, fmtDinheiroCurto } from '@/lib/eapFinanceira';
import { consolidarObras, ROTULO_STATUS, type StatusObra } from '@/lib/consolidado';
import {
  acoesAbertas, entregaNoPrazo, matrizDeVariacao, pesosDasObras, pontePorObra,
  prioridades, riscoDasObras, tendenciaDePrazo, cascataDaMedicao, semanaDeAnalise,
  COLUNAS_MATRIZ, type Severidade,
} from '@/lib/consolidadoAnalise';
import AnaliseDeRisco from '@/components/AnaliseDeRisco';
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

/**
 * Célula de dinheiro.
 *
 * Zero vira "não lançado", e não "R$ 0,00": as duas coisas se parecem na tela e
 * são opostas — uma é a obra que não mediu nada, a outra é o dado que ninguém
 * preencheu, e só a segunda é problema de cadastro.
 */
const Dinheiro = ({ valor, classe }: { valor: number; classe: string }) => (
  <td className={cn(classe, 'text-right tabular-nums whitespace-nowrap')}>
    {valor > 0
      ? fmtDinheiro(valor)
      : <span className="text-muted-foreground font-normal">não lançado</span>}
  </td>
);

const ESTILO_TOOLTIP = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

/**
 * Tooltip da cascata.
 *
 * Conteúdo próprio porque a barra-base é só um espaçador: o tooltip padrão a
 * listaria como se fosse um valor, e o degrau apareceria duas vezes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipCascata = ({ active, payload }: any) => {
  const ponto = active ? payload?.[0]?.payload : null;
  if (!ponto) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs card-shadow">
      <div className="font-semibold text-foreground">{ponto.nome}</div>
      {ponto.tipo === 'total' ? (
        <div className="text-muted-foreground">{fmtDinheiro(ponto.delta)}</div>
      ) : (
        <>
          <div className="text-muted-foreground">Previsto {fmtDinheiro(ponto.previsto)}</div>
          <div className="text-muted-foreground">Realizado {fmtDinheiro(ponto.realizado)}</div>
          <div className={ponto.delta < 0 ? 'text-destructive font-semibold' : 'text-success font-semibold'}>
            {ponto.delta > 0 ? '+' : ''}{fmtDinheiro(ponto.delta)}
          </div>
        </>
      )}
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

  /**
   * Foco numa obra.
   *
   * Clicar numa linha da tabela recorta a página inteira para aquela obra: as
   * sete perguntas passam a ser sobre ela. É a mesma leitura, um nível abaixo —
   * e evita ter que sair do consolidado, abrir o relatório da obra e perder o
   * fio da conversa só para responder "e o SPCI, por quê?".
   */
  const [obraFocada, setObraFocada] = useState<string | null>(null);
  // Trocar de cliente limpa o foco: a obra selecionada não existe no outro.
  const foco = obraFocada && doCliente.some((p) => p.id === obraFocada) ? obraFocada : null;

  const emAnalise = useMemo(
    () => (foco ? doCliente.filter((p) => p.id === foco) : doCliente),
    [doCliente, foco],
  );

  /** O cliente inteiro — é o que a tabela do item 1 lista, com foco ou sem. */
  const dadosCliente = useMemo(() => consolidarObras(doCliente), [doCliente]);
  const dados = useMemo(
    () => (foco ? consolidarObras(emAnalise) : dadosCliente),
    [foco, emAnalise, dadosCliente],
  );
  const nomeFocado = foco ? dadosCliente.obras.find((o) => o.id === foco)?.nome ?? '' : '';

  const analise = useMemo(() => {
    const pesos = pesosDasObras(dados.obras, dados.ponderacao);
    // A data de status do consolidado é a mais recente entre as obras: é até
    // onde existe realizado em ALGUMA delas.
    const status = dados.obras.map((o) => o.atualizadoEm).filter(Boolean).sort().pop() ?? '';
    const riscos = riscoDasObras(dados.obras, dados.ponderacao);

    const abertas = acoesAbertas(emAnalise);

    return {
      pesos,
      ponte: pontePorObra(dados.obras, dados.ponderacao),
      matriz: matrizDeVariacao(dados.obras, abertas),
      medicao: cascataDaMedicao(dados.obras),
      semana: semanaDeAnalise(emAnalise),
      prazo: tendenciaDePrazo(emAnalise, pesos, status),
      entregaPrazo: entregaNoPrazo(dados.obras),
      riscos,
      acoes: prioridades(riscos, emAnalise, dados.obras),
      abertas,
      status,
    };
  }, [dados, emAnalise]);

  /** A análise vale para o cliente: fica em todas as obras dele, e a mais recente manda. */
  const riscoSalvo = useMemo(() => {
    const todas = doCliente
      .map((p) => p.riscoConsolidado)
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.texto?.trim()))
      .sort((a, b) => String(a.atualizadoEm).localeCompare(String(b.atualizadoEm)));
    return todas.at(-1) ?? null;
  }, [doCliente]);

  /**
   * O que a IA recebe.
   *
   * São os números que já estão na tela — nada de mandar o projeto inteiro:
   * quanto mais contexto irrelevante, mais o modelo inventa. E o prompt do
   * lado do servidor proíbe usar qualquer coisa fora daqui.
   *
   * Sempre o CLIENTE inteiro, mesmo com foco numa obra: a análise é gravada
   * como a do cliente, e gerá-la olhando uma obra só produziria um texto sobre
   * o SPCI salvo como se fosse o diagnóstico da UNIPAR.
   */
  const dadosParaIa = useMemo(() => ({
    data: {
      obras: dadosCliente.obras.map((o) => ({
        nome: o.nome, prev: o.avancoPrev, real: o.avancoReal, desvio: o.desvio,
        idp: o.idp, diasAlemDaLB: o.desvioDias, contrato: o.valorContrato,
        previstoMes: o.previstoMes, realizadoMes: o.realizadoMes,
      })),
      ponte: pontePorObra(dadosCliente.obras, dadosCliente.ponderacao),
      riscos: riscoDasObras(dadosCliente.obras, dadosCliente.ponderacao),
      entrega: entregaNoPrazo(dadosCliente.obras),
      acoesAbertas: acoesAbertas(doCliente),
    },
    projectInfo: {
      cliente: clienteAtivo,
      atualizadoEm: analise.status,
      avancoPrev: dadosCliente.avancoPrev,
      avancoReal: dadosCliente.avancoReal,
      ponderacao: dadosCliente.ponderacao,
    },
  }), [dadosCliente, doCliente, analise.status, clienteAtivo]);

  /**
   * A cascata da medição do mês, em barras flutuantes.
   *
   * Do previsto do mês ao realizado, com uma parcela por obra. Aqui a cascata
   * funciona e na do avanço não funcionava: lá o total era um NÍVEL (78%) e os
   * degraus eram diferenças de dois pontos — grandezas incomparáveis. Em
   * dinheiro os dois são a mesma grandeza, e o degrau tem tamanho comparável ao
   * do total.
   */
  const cascata = useMemo(() => {
    const c = analise.medicao;
    if (!c) return null;

    let acum = c.previstoTotal;
    const passos = c.passos.map((p) => {
      const fim = acum + p.delta;
      const barra = {
        nome: p.nome,
        de: Math.min(acum, fim),
        tamanho: Math.abs(p.delta),
        delta: p.delta,
        previsto: p.previsto,
        realizado: p.realizado,
        tipo: 'obra' as const,
      };
      acum = fim;
      return barra;
    });

    const topo = Math.max(c.previstoTotal, c.realizadoTotal, acum) * 1.15 || 1;

    return {
      topo,
      barras: [
        {
          nome: 'Previsto do mês', de: 0, tamanho: c.previstoTotal, delta: c.previstoTotal,
          previsto: c.previstoTotal, realizado: 0, tipo: 'total' as const,
        },
        ...passos,
        {
          nome: 'Realizado', de: 0, tamanho: c.realizadoTotal, delta: c.realizadoTotal,
          previsto: 0, realizado: c.realizadoTotal, tipo: 'total' as const,
        },
      ],
    };
  }, [analise.medicao]);

  /** Quem está sem valor — é por elas que a ponderação por contrato não liga. */
  const semValor = useMemo(
    () => dados.obras.filter((o) => o.valorContrato <= 0).map((o) => o.nome),
    [dados.obras],
  );

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
              Resultado → Driver → Risco → Ação ·{' '}
              {foco ? 'recortado numa obra' : 'todas as obras do cliente numa leitura só'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Com foco ativo, o escopo precisa estar visível o tempo todo: um
                número recortado lido como se fosse o do cliente é o erro mais
                caro que esta tela pode causar. */}
            {foco && (
              <button
                onClick={() => setObraFocada(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                title="Voltar ao cliente inteiro"
              >
                Só {nomeFocado}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
            <Bloco
              n={1}
              pergunta="O que aconteceu?"
              ferramenta={foco
                ? `Analisando ${nomeFocado} — clique de novo na linha para voltar ao cliente`
                : 'Clique numa obra para recortar a página inteira nela'}
            >
              {/* Sem cartões de resumo: a linha "Consolidado" ao pé da tabela
                  traz os mesmos números, e ali eles aparecem ao lado das
                  parcelas que os formam — que é o que prova a conta. */}
              <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[52rem]">
                    <thead>
                      <tr className="bg-table-header text-table-header-foreground">
                        <th className={cn(th, 'text-left')}>Obra</th>
                        <th className={cn(th, 'text-right')}>Avanço previsto</th>
                        <th className={cn(th, 'text-right')}>Avanço real</th>
                        <th className={cn(th, 'text-right')}>Desvio</th>
                        {/* As colunas de dinheiro são do mesmo trio que vê o card
                            Financeiro: valor de contrato e medição não se mostram
                            ao cliente da obra. */}
                        {canEdit && <th className={cn(th, 'text-right')}>Valor da obra</th>}
                        {canEdit && <th className={cn(th, 'text-right')}>Medição acumulada</th>}
                        {canEdit && <th className={cn(th, 'text-right')}>Previsto no mês</th>}
                        {canEdit && <th className={cn(th, 'text-right')}>Realizado no mês</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* A tabela lista SEMPRE o cliente inteiro, mesmo com foco
                          numa obra — é ela o seletor, e sumir com as outras
                          linhas tiraria o caminho de volta. */}
                      {dadosCliente.obras.map((o) => {
                        const ativa = o.id === foco;
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setObraFocada(ativa ? null : o.id)}
                            title={ativa ? 'Voltar ao cliente inteiro' : `Analisar só ${o.nome}`}
                            className={cn(
                              'cursor-pointer transition-colors',
                              ativa ? 'bg-primary/10' : 'hover:bg-muted/40',
                              // Com foco, as outras obras ficam apagadas: o que
                              // está na tela abaixo não fala mais delas.
                              foco && !ativa && 'opacity-45',
                            )}
                          >
                            <td className={cn(td, 'font-medium text-foreground')}>
                              <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle', ativa ? 'bg-primary' : 'bg-transparent')} />
                              {o.nome}
                            </td>
                            <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoPrev)}</td>
                            <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoReal)}</td>
                            <td className={cn(
                              td, 'text-right tabular-nums font-semibold',
                              o.desvio < 0 ? 'text-destructive' : o.desvio > 0 ? 'text-success' : '',
                            )}>
                              {pct(o.desvio)}
                            </td>
                            {canEdit && <Dinheiro classe={td} valor={o.valorContrato} />}
                            {canEdit && <Dinheiro classe={td} valor={o.acumulado} />}
                            {canEdit && <Dinheiro classe={td} valor={o.previstoMes} />}
                            {canEdit && (
                              // Realizado abaixo do previsto no mês é medição que
                              // não saiu — o número já diz, a cor faz enxergar.
                              <Dinheiro
                                classe={cn(
                                  td,
                                  o.previstoMes > 0 && o.realizadoMes < o.previstoMes && 'text-destructive',
                                )}
                                valor={o.realizadoMes}
                              />
                            )}
                          </tr>
                        );
                      })}
                      {/* O total do CLIENTE, com foco ou sem: é a referência
                          contra a qual se lê a obra escolhida. */}
                      {dadosCliente.obras.length > 1 && (
                        <tr
                          onClick={() => setObraFocada(null)}
                          title="Ver o cliente inteiro"
                          className={cn(
                            'font-semibold cursor-pointer transition-colors',
                            foco ? 'bg-muted/40 hover:bg-muted/60' : 'bg-primary/10',
                          )}
                        >
                          <td className={cn(td, 'text-foreground')}>
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle', foco ? 'bg-transparent' : 'bg-primary')} />
                            Consolidado
                          </td>
                          <td className={cn(td, 'text-right tabular-nums')}>{pct(dadosCliente.avancoPrev)}</td>
                          <td className={cn(td, 'text-right tabular-nums')}>{pct(dadosCliente.avancoReal)}</td>
                          <td className={cn(
                            td, 'text-right tabular-nums',
                            dadosCliente.desvio < 0 ? 'text-destructive' : dadosCliente.desvio > 0 ? 'text-success' : '',
                          )}>
                            {pct(dadosCliente.desvio)}
                          </td>
                          {canEdit && <Dinheiro classe={td} valor={dadosCliente.valorContrato} />}
                          {canEdit && <Dinheiro classe={td} valor={dadosCliente.acumulado} />}
                          {canEdit && <Dinheiro classe={td} valor={dadosCliente.previstoMes} />}
                          {canEdit && <Dinheiro classe={td} valor={dadosCliente.realizadoMes} />}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              {/* Aviso de ponderação: a diferença entre os dois métodos muda o
                  número, e quem lê precisa saber qual está vendo. Nomear as
                  obras evita a caça ao tesouro que "preencha a EAP" provocava. */}
              {dados.ponderacao === 'media' && dados.obras.length > 1 && (
                <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3 mt-3">
                  O avanço consolidado está em <strong>média simples</strong> porque{' '}
                  {semValor.length === dados.obras.length
                    ? 'nenhuma obra deste cliente tem valor lançado'
                    : <>falta valor em <strong>{semValor.join(', ')}</strong></>}.
                  Média simples dá o mesmo peso a uma obra de R$ 5 milhões e a uma de R$ 50 mil.
                  O valor sai da EAP financeira ou do campo <strong>Custo da obra</strong>, nas
                  Informações do Projeto — o que vier primeiro.
                </p>
              )}
            </Bloco>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ── 2. POR QUÊ ───────────────────────────────────────── */}
              <Bloco
                n={2}
                pergunta="Por quê?"
                ferramenta="Cascata da medição do mês: previsto → realizado, obra a obra"
                aside={analise.semana.texto ? (
                  <span className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
                    analise.semana.divergente
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'border-border bg-muted/40 text-muted-foreground',
                  )}>
                    {analise.semana.texto}
                  </span>
                ) : undefined}
              >
                {!cascata ? (
                  <Vazio>
                    Nenhuma obra deste cliente tem previsto ou realizado do mês lançado na EAP
                    financeira.
                  </Vazio>
                ) : (
                  <>
                    {/* Obras em semanas diferentes não se somam: o consolidado
                        estaria juntando medições de momentos distintos. */}
                    {analise.semana.divergente && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 border-l-2 border-amber-500 pl-3 mb-2">
                        As obras deste cliente estão em <strong>semanas de análise diferentes</strong>.
                        O total abaixo soma medições de momentos distintos — acerte a data de
                        <strong> Atualizado em</strong> das obras antes de usar este número.
                      </p>
                    )}

                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cascata.barras} margin={{ top: 20, right: 8, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="nome" tick={{ fontSize: 10 }} interval={0}
                            angle={-25} textAnchor="end" height={64}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            domain={[0, cascata.topo]} tick={{ fontSize: 10 }}
                            tickFormatter={fmtDinheiroCurto}
                            stroke="hsl(var(--muted-foreground))" width={72}
                          />
                          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={TooltipCascata} />
                          {/* Base transparente: é ela que faz o degrau flutuar
                              na altura em que a obra pega a cascata. */}
                          <Bar dataKey="de" stackId="c" fill="transparent" isAnimationActive={false} />
                          <Bar dataKey="tamanho" stackId="c" radius={[3, 3, 0, 0]}>
                            <LabelList
                              dataKey="delta" position="top" fontSize={10}
                              formatter={(v: number) => fmtDinheiroCurto(v)}
                            />
                            {cascata.barras.map((b, i) => (
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

                    <p className={cn(
                      'text-xs mt-1 px-3 py-2 rounded-lg border',
                      analise.medicao!.realizadoTotal < analise.medicao!.previstoTotal
                        ? 'border-destructive/40 bg-destructive/5 text-foreground'
                        : 'border-success/40 bg-success/5 text-foreground',
                    )}>
                      Previsto <strong>{fmtDinheiro(analise.medicao!.previstoTotal)}</strong> para o mês,
                      medido <strong>{fmtDinheiro(analise.medicao!.realizadoTotal)}</strong> até{' '}
                      {analise.semana.texto ? <strong>{analise.semana.texto}</strong> : 'a data de status'}
                      {' — '}
                      <strong>
                        {fmtDinheiro(analise.medicao!.realizadoTotal - analise.medicao!.previstoTotal)}
                      </strong>.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cada degrau é uma obra: o quanto ela tirou ou devolveu à medição do mês. As
                      parcelas fecham a conta — previsto + degraus = realizado. O realizado é o
                      acumulado do mês somando as obras; o previsto vem do valor de cada uma.
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
              {/* ── 4. TENDÊNCIA DE PRAZO ────────────────────────────── */}
              <Bloco n={4} pergunta="Qual a tendência do prazo?" ferramenta="Dias além da linha de base, mês a mês">
                {analise.prazo.length === 0 ? (
                  <Vazio>
                    Falta Curva S com data de início, término da linha de base ou realizado
                    lançado para projetar prazo.
                  </Vazio>
                ) : (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analise.prazo} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                          <YAxis
                            tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}d`}
                          />
                          <Tooltip
                            contentStyle={ESTILO_TOOLTIP}
                            formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} dias`, 'Desvio de prazo']}
                          />
                          {/* O zero é a linha de base: acima dela é atraso. */}
                          <ReferenceLine y={0} stroke={COR_GRAFICO.neutro} strokeDasharray="4 4" />
                          <Line
                            type="monotone" dataKey="desvioDias" strokeWidth={2.5} dot={false}
                            stroke={(analise.prazo.at(-1)?.desvioDias ?? 0) > 0 ? COR_GRAFICO.ruim : COR_GRAFICO.bom}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cada mês responde: com o ritmo <em>até ali</em>, a obra terminaria quantos dias
                      além da linha de base? A inclinação é o que importa — subindo, o cliente está
                      perdendo prazo mesmo com o avanço crescendo. Meses com menos de 5% planejado
                      ficam de fora: ali um ponto de diferença vira meses de projeção.
                    </p>
                  </>
                )}
              </Bloco>

              {/* ── 5. VAMOS ENTREGAR NO PRAZO ───────────────────────── */}
              <Bloco n={5} pergunta="Vamos entregar no prazo?" ferramenta="Término da linha de base × término projetado">
                {!analise.entregaPrazo ? (
                  <Vazio>Nenhuma obra deste cliente tem término de linha de base lançado.</Vazio>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <Kpi rotulo="Término LB" valor={formatDateBR(analise.entregaPrazo.terminoBase) || '—'} />
                      <Kpi
                        rotulo="Projetado"
                        valor={formatDateBR(analise.entregaPrazo.terminoProjetado) || '—'}
                        detalhe={analise.entregaPrazo.obraCritica ? `por ${analise.entregaPrazo.obraCritica}` : undefined}
                        cor={analise.entregaPrazo.desvioDias > 0 ? 'text-destructive' : 'text-success'}
                      />
                      <Kpi
                        rotulo="Desvio"
                        valor={`${analise.entregaPrazo.desvioDias > 0 ? '+' : ''}${analise.entregaPrazo.desvioDias} d`}
                        cor={analise.entregaPrazo.desvioDias > 0 ? 'text-destructive' : 'text-success'}
                      />
                    </div>

                    <div className="h-[170px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analise.entregaPrazo.porObra}
                          layout="vertical"
                          margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}d`} />
                          <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={90} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} dias`, 'Desvio']} />
                          <ReferenceLine x={0} stroke={COR_GRAFICO.neutro} />
                          <Bar dataKey="dias" radius={[0, 3, 3, 0]}>
                            <LabelList dataKey="dias" position="right" fontSize={10} formatter={(v: number) => `${v > 0 ? '+' : ''}${v}d`} />
                            {analise.entregaPrazo.porObra.map((o) => (
                              <Cell key={o.id} fill={o.dias > 0 ? COR_GRAFICO.ruim : COR_GRAFICO.bom} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <p className={cn(
                      'text-xs mt-2 px-3 py-2 rounded-lg border',
                      analise.entregaPrazo.desvioDias > 0
                        ? 'border-destructive/40 bg-destructive/5 text-foreground'
                        : 'border-success/40 bg-success/5 text-foreground',
                    )}>
                      {analise.entregaPrazo.desvioDias > 0 ? (
                        <>
                          O cliente fecha <strong>{analise.entregaPrazo.desvioDias} dias</strong> depois
                          do previsto, e quem define essa data é a obra{' '}
                          <strong>{analise.entregaPrazo.obraCritica}</strong>.{' '}
                          {analise.entregaPrazo.atrasadas} de {analise.entregaPrazo.porObra.length} obras
                          estão além da linha de base.
                        </>
                      ) : (
                        <>No ritmo atual, todas as obras chegam dentro da linha de base.</>
                      )}
                      {analise.entregaPrazo.semProjecao > 0 && (
                        <> {analise.entregaPrazo.semProjecao} obra(s) sem projeção — falta avanço lançado.</>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      O contrato do cliente termina quando termina a <strong>última</strong> obra.
                      Média de datas de término não corresponde a entrega nenhuma: com uma obra
                      fechando em março e outra em dezembro, a média daria agosto.
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

                {/* A análise escrita é o que o gráfico não diz: risco que se
                    soma entre obras, causa conhecida, decisão da semana. */}
                <AnaliseDeRisco
                  cliente={clienteAtivo}
                  idsDoCliente={doCliente.map((p) => p.id)}
                  salvo={riscoSalvo}
                  dadosParaIa={dadosParaIa}
                />
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
