import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, ArrowRight, AlertTriangle, X, ChevronRight, Pencil,
  ArrowUp, ArrowDown, ChevronUp, ChevronDown, Expand, Shrink, Eye, EyeOff, LayoutGrid, Maximize2,
  MoreVertical, Presentation, Moon, Sun, Smartphone,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import AppSidebar from '@/components/AppSidebar';
import { useProjectStore } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { formatDateBR, formatDateShort } from '@/lib/dateUtils';
import { fmtDinheiro, fmtDinheiroCurto, lerValor } from '@/lib/eapFinanceira';
import { consolidarObras } from '@/lib/consolidado';
import {
  ajustarAltura, alternarLargura, alternarOculto, moverCard, type ItemLayoutRelatorio,
} from '@/lib/layoutRelatorio';
import {
  nomeDoBloco, normalizarLayoutConsolidado, posicoesDoLayout, secaoDeCadaBloco,
  type PosicaoBloco,
} from '@/lib/layoutConsolidado';
import {
  acoesAbertas, entregaNoPrazo, matrizDeVariacao, pesosDasObras, pontePorObra,
  prioridades, riscoDasObras, cascataDaMedicao, semanaDeAnalise,
  problemasPorSemana, tendenciaDeDatas, resultadoProjetado, MAX_SEMANAS,
  COLUNAS_MATRIZ, type Severidade,
} from '@/lib/consolidadoAnalise';
import AnaliseDeRisco from '@/components/AnaliseDeRisco';
import MotivosDoDesvio from '@/components/MotivosDoDesvio';
import TabelaPcs from '@/components/TabelaPcs';
import { clienteDaObra, clientesVisiveis } from '@/lib/acesso';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/hooks/use-theme';

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

/**
 * Uma cor por obra nas cascatas.
 *
 * Tons distintos e não variações do mesmo azul: numa cascata cada degrau é uma
 * obra diferente, e com a mesma cor a leitura vira "olhe o rótulo" — que é
 * exatamente o que a cor deveria dispensar. Ficam fora o azul do previsto, o
 * verde do bom e o vermelho do ruim, que já significam outra coisa aqui.
 */
const CORES_OBRA = [
  'hsl(262 60% 55%)',  // roxo
  'hsl(28 90% 55%)',   // laranja
  'hsl(190 70% 42%)',  // ciano
  'hsl(330 65% 55%)',  // rosa
  'hsl(45 85% 47%)',   // âmbar
  'hsl(160 50% 40%)',  // verde-azulado
  'hsl(210 15% 45%)',  // cinza-azulado
];

const corDaObra = (i: number) => CORES_OBRA[i % CORES_OBRA.length];

/** O seletor de cliente abre em "todos": a carteira antes do cliente. */
const TODOS = '__todos__';

const pct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`;


/**
 * Cada bloco é uma pergunta numerada — a numeração é o roteiro da reunião.
 *
 * O título se edita: a pergunta é o roteiro da SUA reunião, e o texto que veio
 * de fábrica é um palpite. Recolhe e abre pelo cabeçalho, como as seções do
 * relatório, para a tela caber no assunto da hora.
 */
const Bloco = ({
  n, titulo, ferramenta, aberto, aoAlternar, podeEditar, aoRenomear, aoRenumerar,
  posicao, arrumar, children, aside,
}: {
  /** O número mostrado no selo — texto, porque é editável. */
  n: string;
  titulo: string;
  ferramenta: string;
  aberto: boolean;
  aoAlternar: () => void;
  podeEditar: boolean;
  aoRenomear: (texto: string) => void;
  aoRenumerar: (numero: string) => void;
  /** Onde ele fica na grade — vem da arrumação. */
  posicao: PosicaoBloco;
  /** Controles de arrumação; ausente fora do modo de arrumar. */
  arrumar?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) => {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(titulo);
  const [editandoN, setEditandoN] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [rascunhoN, setRascunhoN] = useState(n);

  const salvar = () => {
    const limpo = rascunho.trim();
    if (limpo) aoRenomear(limpo);
    setEditando(false);
  };

  const salvarNumero = () => {
    const limpo = rascunhoN.trim();
    if (limpo) aoRenumerar(limpo);
    setEditandoN(false);
  };

  /**
   * Duplo clique no card abre e fecha.
   *
   * Fora dos elementos que já respondem ao duplo clique por conta própria:
   * selecionar uma palavra numa tabela ou num texto não pode fechar a seção
   * inteira embaixo de quem estava lendo.
   */
  const aoDuploClique = (e: React.MouseEvent) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input, textarea, button, a, select, table, .recharts-wrapper, svg')) return;
    aoAlternar();
  };

  return (
    <section
      onDoubleClick={aoDuploClique}
      // `order` e `col-span` saem da arrumação: mover um bloco é mudar o CSS,
      // e não recriar o trecho — recriar remontaria gráficos e perderia a
      // rolagem das tabelas a cada arrastada.
      style={{ order: posicao.ordem, minHeight: aberto ? posicao.altura : undefined }}
      className={cn(
        'rounded-xl border border-border bg-card card-shadow p-4 min-w-0 flex flex-col',
        posicao.inteira && 'lg:col-span-2',
        // Oculto some da tela — MENOS no modo arrumar, onde ele aparece
        // esmaecido. Escondê-lo ali também tirava o único caminho de volta:
        // ocultar viraria uma exclusão sem desfazer.
        posicao.oculto && (arrumar ? 'opacity-40' : 'hidden'),
        arrumar && 'ring-2 ring-primary/40',
      )}
    >
      {arrumar}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* O chevron abre e fecha; clicar no cabeçalho inteiro também. */}
          <button
            type="button"
            onClick={aoAlternar}
            className="shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={aberto ? 'Recolher seção' : 'Abrir seção'}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', aberto && 'rotate-90')} />
          </button>
          {/* O número também se edita: arrumar os blocos faz a numeração
              deixar de seguir a leitura, e um roteiro 1, 5, 2, 3 vira ruído
              justamente onde ele deveria guiar a reunião. */}
          {editandoN ? (
            <input
              autoFocus
              value={rascunhoN}
              onChange={(e) => setRascunhoN(e.target.value.slice(0, 3))}
              onBlur={salvarNumero}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarNumero();
                if (e.key === 'Escape') { setRascunhoN(n); setEditandoN(false); }
              }}
              className="shrink-0 h-6 w-9 rounded-full bg-background text-center text-xs font-bold outline-none ring-1 ring-primary/50"
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (podeEditar) { setRascunhoN(n); setEditandoN(true); } }}
              title={podeEditar ? 'Renumerar' : undefined}
              className={cn(
                'shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center',
                podeEditar && 'hover:ring-2 hover:ring-primary/40',
              )}
            >
              {n}
            </button>
          )}

          {editando ? (
            <input
              autoFocus
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onBlur={salvar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar();
                if (e.key === 'Escape') { setRascunho(titulo); setEditando(false); }
              }}
              className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wider bg-background rounded px-1.5 py-0.5 outline-none ring-1 ring-primary/50"
            />
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2
                  onClick={aoAlternar}
                  className="text-sm font-bold text-foreground uppercase tracking-wider cursor-pointer"
                >
                  {titulo}
                </h2>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => { setRascunho(titulo); setEditando(true); }}
                    className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                    title="Renomear a pergunta"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{ferramenta}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* O seletor do bloco some com a seção fechada: controle de um
              conteúdo que não está na tela só confunde. */}
          {aberto && aside}
          {aberto && (
            <button
              type="button"
              onClick={() => setAmpliado(true)}
              title="Ampliar"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {aberto && children}

      {/* Ampliar: o conteúdo só é montado ao abrir. Deixá-lo montado o tempo
          todo desenharia cada gráfico duas vezes, e são sete blocos. */}
      {ampliado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAmpliado(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col"
            style={{ height: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {n}. {titulo}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{ferramenta}</p>
              </div>
              <button
                onClick={() => setAmpliado(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Rola por dentro: tabela de vinte linhas não pode empurrar a
                janela para fora da tela. */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
              {children}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Vazio = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground py-6 text-center">{children}</p>
);

/** Botão da barra de arrumação — pequeno, para caber seis num bloco estreito. */
const BotaoArrumar = ({ titulo, onClick, children }: {
  titulo: string; onClick: () => void; children: ReactNode;
}) => (
  <button
    type="button"
    title={titulo}
    onClick={onClick}
    className="p-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
  >
    {children}
  </button>
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

/**
 * Célula de dinheiro editável.
 *
 * A linha do consolidado é onde o erro aparece; obrigar a voltar na EAP para
 * corrigir um número que está na frente da pessoa é o caminho mais curto para
 * ninguém corrigir. Só entra em edição no clique — a tabela continua sendo uma
 * tabela, não um formulário de oito campos por linha.
 *
 * O ponto ao lado do valor marca o que foi digitado aqui: valor manual que
 * envelhece escondido depois de uma colagem nova é pior que valor errado.
 */
const DinheiroEditavel = ({ valor, manual, classe, podeEditar, aoSalvar }: {
  valor: number;
  manual: boolean;
  classe: string;
  podeEditar: boolean;
  aoSalvar: (n: number) => void;
}) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');

  if (!podeEditar) return <Dinheiro valor={valor} classe={classe} />;

  const gravar = () => {
    aoSalvar(lerValor(texto));
    setEditando(false);
  };

  return (
    <td className={cn(classe, 'text-right tabular-nums whitespace-nowrap p-1')}>
      {editando ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={gravar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') gravar();
            if (e.key === 'Escape') setEditando(false);
          }}
          className="w-full bg-background text-right text-sm rounded px-1 py-0.5 outline-none ring-1 ring-primary/50"
        />
      ) : (
        <button
          type="button"
          // stopPropagation: a linha inteira é o seletor de obra, e clicar para
          // editar não pode trocar o foco da página junto.
          onClick={(e) => {
            e.stopPropagation();
            setTexto(valor > 0 ? String(valor) : '');
            setEditando(true);
          }}
          title="Clique para editar"
          className="w-full text-right px-1 py-0.5 rounded hover:bg-muted/60 transition-colors"
        >
          {manual && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5 align-middle" title="Valor digitado aqui" />}
          {valor > 0
            ? fmtDinheiro(valor)
            : <span className="text-muted-foreground font-normal">não lançado</span>}
        </button>
      )}
    </td>
  );
};

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

/**
 * Tooltip da cascata do resultado.
 *
 * Separado do da medição: lá cada degrau tem previsto e realizado, aqui tem só
 * o valor do corte. Reaproveitar aquele fazia Impostos e Custo aparecerem como
 * "Previsto R$ 0,00 · Realizado R$ 0,00".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipResultado = ({ active, payload }: any) => {
  const ponto = active ? payload?.[0]?.payload : null;
  if (!ponto) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs card-shadow">
      <div className="font-semibold text-foreground">{ponto.nome}</div>
      <div className={cn(
        'tabular-nums',
        ponto.tipo === 'corte' ? 'text-destructive' : 'text-muted-foreground',
      )}>
        {ponto.delta < 0 ? '−' : ''}{fmtDinheiro(Math.abs(ponto.delta))}
      </div>
    </div>
  );
};

const Consolidado = () => {
  const {
    projects, selectProject, acessoRestrito, setInfoDoProjeto,
    setTituloConsolidado, setNumeroConsolidado, setObraOcultaNoConsolidado,
  } = useProjectStore();
  const { canEdit, isAdmin } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  /**
   * Tela cheia para a reunião.
   *
   * Sai do modo quando a pessoa aperta Esc — o navegador devolve o fullscreen
   * sem avisar a aplicação, e sem este ouvinte a barra ficaria escondida com a
   * tela já normal.
   */
  const [apresentando, setApresentando] = useState(false);
  const alternarApresentacao = () => {
    if (apresentando) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
    setApresentando((v) => !v);
  };

  useEffect(() => {
    const aoSair = () => { if (!document.fullscreenElement) setApresentando(false); };
    document.addEventListener('fullscreenchange', aoSair);
    return () => document.removeEventListener('fullscreenchange', aoSair);
  }, []);

  // `projects` já vem recortado pelo papel: um cliente cujo nome aparece no
  // seletor entrega que ele existe, então a lista sai das obras visíveis.
  const clientes = useMemo(() => clientesVisiveis(projects), [projects]);

  /**
   * A tela abre em TODOS os clientes.
   *
   * Quem entra no consolidado quer saber como está a carteira, não um cliente
   * específico — esse é o segundo passo, depois de ver onde o problema está.
   * Abrir num cliente escolhido pelo alfabeto seria escolher o assunto por ele.
   */
  const [cliente, setCliente] = useState<string>(TODOS);
  const clienteAtivo = cliente === TODOS || clientes.includes(cliente) ? cliente : TODOS;
  const todosOsClientes = clienteAtivo === TODOS;

  /**
   * Obras tiradas da visão.
   *
   * Elas somem da lista E dos totais — é isso que faz o recurso valer alguma
   * coisa: esconder a obra e continuar somando ela seria mostrar um total que
   * não corresponde a nada na tela. Por isso a tela DIZ quantas estão fora e
   * como trazê-las de volta: total que exclui em silêncio é total errado.
   */
  const [mostrarOcultas, setMostrarOcultas] = useState(false);
  const ocultas = useMemo(() => projects.filter((p) => p.ocultoNoConsolidado), [projects]);

  const doCliente = useMemo(() => {
    const daCarteira = todosOsClientes
      ? projects
      : projects.filter((p) => clienteDaObra(p) === clienteAtivo);
    return mostrarOcultas ? daCarteira : daCarteira.filter((p) => !p.ocultoNoConsolidado);
  }, [projects, clienteAtivo, todosOsClientes, mostrarOcultas]);


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
      problemas: problemasPorSemana(emAnalise),
      medicao: cascataDaMedicao(dados.obras),
      semana: semanaDeAnalise(emAnalise),
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
      cliente: todosOsClientes ? 'todos os clientes' : clienteAtivo,
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
    const passos = c.passos.map((p, i) => {
      const fim = acum + p.delta;
      const barra = {
        nome: p.nome,
        de: Math.min(acum, fim),
        tamanho: Math.abs(p.delta),
        delta: p.delta,
        previsto: p.previsto,
        realizado: p.realizado,
        id: p.id,
        tipo: 'obra' as const,
        cor: corDaObra(i),
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
          cor: COR_GRAFICO.previsto,
        },
        ...passos,
        {
          nome: 'Realizado', de: 0, tamanho: c.realizadoTotal, delta: c.realizadoTotal,
          previsto: 0, realizado: c.realizadoTotal, tipo: 'total' as const,
          // Verde quando a medição alcançou o previsto, vermelho quando ficou
          // abaixo: é o veredito do mês, e ele não precisa de leitura de eixo.
          cor: c.realizadoTotal >= c.previstoTotal ? COR_GRAFICO.bom : COR_GRAFICO.ruim,
        },
      ],
    };
  }, [analise.medicao]);

  /**
   * Seções recolhidas.
   *
   * Fica no navegador de cada um: é conveniência de leitura, e recolher uma
   * seção para caber a tela na sua reunião não pode fechá-la para os outros.
   */
  const [secoesFechadas, setSecoesFechadas] = useState<Set<number>>(() => {
    try {
      const bruto = localStorage.getItem('opr_consolidado_fechados');
      return new Set(bruto ? (JSON.parse(bruto) as number[]) : []);
    } catch {
      return new Set();
    }
  });

  /**
   * Arrumação dos blocos.
   *
   * Vale para todas as obras, como o layout do relatório: o consolidado é a
   * mesma tela para qualquer cliente, e duas pessoas na mesma reunião não podem
   * discutir ordens diferentes.
   */
  const setLayoutConsolidado = useProjectStore((s) => s.setLayoutConsolidado);
  const [arrumando, setArrumando] = useState(false);
  const layout = useMemo(
    () => normalizarLayoutConsolidado(projects.find((p) => p.layoutConsolidado)?.layoutConsolidado),
    [projects],
  );
  const posicoes = useMemo(() => posicoesDoLayout(layout), [layout]);
  const secoes = useMemo(() => secaoDeCadaBloco(layout), [layout]);

  /**
   * Fechar um bloco fecha a SEÇÃO dele — a linha inteira da grade.
   *
   * Fechar metade de uma linha deixava a tela torta, com um card sozinho ao
   * lado de um espaço vazio. A seção sai do layout, e não de uma lista fixa:
   * arrumar os blocos muda quem divide a linha com quem.
   */
  const alternarSecao = (n: number) => setSecoesFechadas((atual) => {
    const secao = (secoes[`b${n}`] ?? [`b${n}`]).map((id) => Number(id.slice(1)));
    const fechando = !atual.has(n);
    const proximo = new Set(atual);
    secao.forEach((k) => { if (fechando) proximo.add(k); else proximo.delete(k); });
    try { localStorage.setItem('opr_consolidado_fechados', JSON.stringify([...proximo])); } catch { /* quota */ }
    return proximo;
  });

  /**
   * Título da pergunta.
   *
   * O renomeado vale para todos, como o layout do relatório: é a mesma tela
   * para qualquer cliente, e um título por obra faria a pergunta mudar ao
   * trocar de cliente no seletor.
   */
  const titulos = projects.find((p) => p.titulosConsolidado)?.titulosConsolidado ?? {};
  const numeros = projects.find((p) => p.numerosConsolidado)?.numerosConsolidado ?? {};
  const tituloDoBloco = (n: number, padrao: string) => titulos[`b${n}`]?.trim() || padrao;

  const mexerNoLayout = (novo: ItemLayoutRelatorio[]) => setLayoutConsolidado(novo);

  /** As props de cabeçalho e posição que todo bloco recebe igual. */
  const cabecalho = (n: number) => {
    const id = `b${n}`;
    const pos = posicoes[id] ?? { ordem: n, inteira: false, oculto: false };
    return {
      aberto: !secoesFechadas.has(n),
      aoAlternar: () => alternarSecao(n),
      podeEditar: canEdit,
      aoRenomear: (texto: string) => setTituloConsolidado(id, texto),
      n: numeros[id]?.trim() || String(n),
      aoRenumerar: (numero: string) => setNumeroConsolidado(id, numero),
      posicao: pos,
      arrumar: arrumando ? (
        <div className="flex items-center gap-1 flex-wrap mb-2 pb-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            {nomeDoBloco(id)}
          </span>
          <BotaoArrumar titulo="Subir" onClick={() => mexerNoLayout(moverCard(layout, id, -1))}>
            <ArrowUp className="h-3.5 w-3.5" />
          </BotaoArrumar>
          <BotaoArrumar titulo="Descer" onClick={() => mexerNoLayout(moverCard(layout, id, 1))}>
            <ArrowDown className="h-3.5 w-3.5" />
          </BotaoArrumar>
          <BotaoArrumar
            titulo={pos.inteira ? 'Meia largura' : 'Largura inteira'}
            onClick={() => mexerNoLayout(alternarLargura(layout, id))}
          >
            {pos.inteira ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </BotaoArrumar>
          <BotaoArrumar titulo="Menor" onClick={() => mexerNoLayout(ajustarAltura(layout, id, -1))}>
            <ChevronUp className="h-3.5 w-3.5" />
          </BotaoArrumar>
          <BotaoArrumar titulo="Maior" onClick={() => mexerNoLayout(ajustarAltura(layout, id, 1))}>
            <ChevronDown className="h-3.5 w-3.5" />
          </BotaoArrumar>
          <BotaoArrumar
            titulo={pos.oculto ? 'Mostrar' : 'Ocultar'}
            onClick={() => mexerNoLayout(alternarOculto(layout, id))}
          >
            {pos.oculto ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </BotaoArrumar>
        </div>
      ) : undefined,
    };
  };

  /** Semanas abertas no item 3. Fechadas por padrão: aberto tudo, ninguém lê. */
  const [semanasAbertas, setSemanasAbertas] = useState<Set<string>>(new Set());
  const alternarSemana = (chave: string) => setSemanasAbertas((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });

  /**
   * Obra do gráfico de datas do item 4.
   *
   * Datas de término não se somam nem se fazem média entre obras — cada obra
   * tem a sua —, então este gráfico é sempre de UMA obra. Com foco global
   * ativo, ele segue o foco; sem foco, a pessoa escolhe aqui.
   */
  const [obraDoPrazo, setObraDoPrazo] = useState<string | null>(null);
  const idDoPrazo = foco
    ?? (obraDoPrazo && doCliente.some((p) => p.id === obraDoPrazo) ? obraDoPrazo : doCliente[0]?.id ?? null);

  const datasPrazo = useMemo(() => {
    const projeto = doCliente.find((p) => p.id === idDoPrazo);
    if (!projeto) return null;

    const serie = tendenciaDeDatas(projeto, analise.status);
    if (serie.length === 0) return null;

    const valores = serie.flatMap((s) => [s.base, s.projetado]);
    const folga = 20 * 24 * 60 * 60 * 1000;
    return {
      serie,
      nome: projeto.name,
      dominio: [Math.min(...valores) - folga, Math.max(...valores) + folga] as [number, number],
      ultimo: serie[serie.length - 1],
    };
  }, [doCliente, idDoPrazo, analise.status]);

  /**
   * A cascata do resultado: contrato − impostos − custo = líquido.
   *
   * Os dois totais nascem do zero; os cortes descem do contrato até o líquido.
   * É a mesma mecânica da cascata da medição, e funciona pelo mesmo motivo:
   * tudo em dinheiro, então corte e total têm tamanho comparável.
   */
  /**
   * Escopo do resultado: o cliente inteiro ou uma obra.
   *
   * Seletor próprio porque a pergunta se faz nos dois níveis e em momentos
   * diferentes — "quanto a UNIPAR deixa" e "quanto o SPCI deixa" são duas
   * conversas, e obrigar a recortar a página toda para trocar entre elas
   * levaria junto os outros seis blocos.
   */
  const [obraDoResultado, setObraDoResultado] = useState<string>('todos');
  const idDoResultado = foco
    ?? (obraDoResultado !== 'todos' && doCliente.some((p) => p.id === obraDoResultado)
      ? obraDoResultado
      : null);

  /**
   * O que o seletor do bloco 5 oferece.
   *
   * O nível de baixo do que está na tela: na carteira, os CLIENTES; dentro de
   * um cliente, as obras dele. Oferecer obra na visão de todos daria uma lista
   * de dezenas de nomes sem dizer de quem é cada um.
   */
  const opcoesDoResultado = useMemo(
    () => (todosOsClientes
      ? clientes.map((c) => ({ valor: `cliente:${c}`, rotulo: c }))
      : doCliente.map((p) => ({ valor: p.id, rotulo: p.name }))),
    [todosOsClientes, clientes, doCliente],
  );

  /** As obras que o bloco 5 soma, conforme a escolha do seletor. */
  const obrasDoResultado = useMemo(() => {
    if (idDoResultado) return dadosCliente.obras.filter((o) => o.id === idDoResultado);
    if (obraDoResultado.startsWith('cliente:')) {
      const alvo = obraDoResultado.slice(8);
      const ids = new Set(projects.filter((p) => clienteDaObra(p) === alvo).map((p) => p.id));
      return dadosCliente.obras.filter((o) => ids.has(o.id));
    }
    return dadosCliente.obras;
  }, [idDoResultado, obraDoResultado, dadosCliente.obras, projects]);

  /** O nome do que está sendo somado — a frase de leitura precisa dizer qual é. */
  const nomeDoResultado = idDoResultado
    ? (doCliente.find((p) => p.id === idDoResultado)?.name ?? clienteAtivo)
    : obraDoResultado.startsWith("cliente:") ? obraDoResultado.slice(8)
      : (todosOsClientes ? "Carteira" : clienteAtivo);

  const resultado = useMemo(() => {
    const r = resultadoProjetado(obrasDoResultado);
    if (!r) return null;

    const aposImpostos = r.contrato - r.impostos;
    const topo = Math.max(r.contrato, 1) * 1.15;

    return {
      dados: r,
      topo,
      // Cores distintas por parcela: impostos e custo são dois cortes de
      // natureza diferente — um é imposição, o outro é decisão de execução — e
      // pintá-los igual escondia justamente qual dos dois come a margem.
      barras: [
        { nome: 'Contrato', de: 0, tamanho: r.contrato, delta: r.contrato, tipo: 'total' as const, cor: COR_GRAFICO.previsto },
        { nome: 'Impostos', de: aposImpostos, tamanho: r.impostos, delta: -r.impostos, tipo: 'corte' as const, cor: corDaObra(4) },
        { nome: 'Custo', de: Math.max(0, r.liquido), tamanho: Math.min(r.custo, aposImpostos), delta: -r.custo, tipo: 'corte' as const, cor: corDaObra(1) },
        {
          nome: 'Líquido', de: 0, tamanho: Math.max(0, r.liquido), delta: r.liquido, tipo: 'total' as const,
          cor: r.liquido >= 0 ? COR_GRAFICO.bom : COR_GRAFICO.ruim,
        },
      ],
    };
  }, [obrasDoResultado]);

  /** Quem está sem valor — é por elas que a ponderação por contrato não liga. */
  const semValor = useMemo(
    () => dados.obras.filter((o) => o.valorContrato <= 0).map((o) => o.nome),
    [dados.obras],
  );


  const th = 'px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap';
  const td = 'px-3 py-2 text-sm border-t border-border';

  const semObras = dados.obras.length === 0;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Em apresentação a tela é o painel: o menu lateral só rouba espaço. */}
      {!apresentando && <AppSidebar />}

      <div className="flex-1 min-w-0 p-3 sm:p-5 space-y-4">

        {/* Mesma faixa do relatório: título no topo e os controles logo abaixo
            dele, dentro da barra. Duas telas do mesmo app com cabeçalhos
            diferentes fazem parecer que são dois produtos. */}
        <header className="gradient-primary rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-primary-foreground tracking-widest uppercase">
              One Page Consolidado
            </h1>
            <p className="text-[11px] text-primary-foreground/70">
              Resultado → Driver → Risco → Ação ·{' '}
              {foco ? 'recortado numa obra'
                : todosOsClientes ? 'todas as obras de todos os clientes'
                  : 'todas as obras do cliente numa leitura só'}
            </p>
          </div>

          {/* Sem flex-wrap: com ela o menu caía para uma segunda linha, embaixo
              do seletor, em vez de ficar ao lado dele. O seletor encolhe. */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-end">
            {/* Com foco ativo, o escopo precisa estar visível o tempo todo: um
                número recortado lido como se fosse o do cliente é o erro mais
                caro que esta tela pode causar. */}
            {foco && (
              <button
                onClick={() => setObraFocada(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
                title="Voltar ao cliente inteiro"
              >
                Só {nomeFocado}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Building2 className="h-4 w-4 text-primary-foreground/70 shrink-0" />
            {/* Seletor sobre fundo escuro: o padrão claro sumiria na faixa. */}
            <Select value={clienteAtivo} onValueChange={setCliente}>
              <SelectTrigger className="h-9 min-w-[180px] max-w-[280px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* O mesmo menu do relatório, com o que faz sentido aqui. Ficaram
                de fora "Modo TV" e "Arrumar relatório": um gira entre obras e o
                outro move cards que esta página não tem. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center h-9 w-9 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                  title="Mais opções"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
{/* Arrumar é do administrador: o layout vale para todo mundo. */}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => setArrumando((v) => !v)}>
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    {arrumando ? 'Concluir arrumação' : 'Arrumar consolidado'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={alternarApresentacao}>
                  <Presentation className="h-4 w-4 mr-2" /> Modo apresentação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/install')}>
                  <Smartphone className="h-4 w-4 mr-2" /> Instalar no celular
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            {/* Uma grade só para os sete blocos: a ordem e a largura de cada um
                saem da arrumação, via CSS `order` e `col-span`. */}
            <div className="grid gap-4 lg:grid-cols-2 items-start">
            {/* ── 1. O QUE ACONTECEU ─────────────────────────────────── */}
            <Bloco

              titulo={tituloDoBloco(1, "O que aconteceu?")}
              ferramenta={foco
                ? `Analisando ${nomeFocado} — clique de novo na linha para voltar ao cliente`
                : todosOsClientes
                  ? 'Toda a carteira. Clique num cliente para entrar nele, ou numa obra para recortar a página'
                  : 'Clique numa obra para recortar a página inteira nela'}
              {...cabecalho(1)}
            >
              {/* Sem cartões de resumo: a linha "Consolidado" ao pé da tabela
                  traz os mesmos números, e ali eles aparecem ao lado das
                  parcelas que os formam — que é o que prova a conta. */}
              <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[52rem]">
                    <thead>
                      <tr className="bg-table-header text-table-header-foreground">
                        <th className={cn(th, 'text-left')}>Obra</th>
                        {/* De quem é a obra só importa quando há mais de um
                            cliente na tela; dentro de um, repetir o nome em
                            toda linha é ruído. */}
                        {todosOsClientes && <th className={cn(th, 'text-left')}>Cliente</th>}
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
                        {canEdit && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {/* A tabela lista SEMPRE o cliente inteiro, mesmo com foco
                          numa obra — é ela o seletor, e sumir com as outras
                          linhas tiraria o caminho de volta. */}
                      {dadosCliente.obras.map((o) => {
                        const ativa = o.id === foco;
                        const ocultaAqui = Boolean(doCliente.find((p) => p.id === o.id)?.ocultoNoConsolidado);
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
                            {/* Clicar no cliente entra nele — é o caminho da
                                visão de todos para a de um. Para o clique da
                                LINHA, que foca a obra, não disparar junto. */}
                            {todosOsClientes && (
                              <td className={cn(td, 'text-muted-foreground')}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setCliente(clienteDaObra(doCliente.find((p) => p.id === o.id)!)); }}
                                  className="hover:text-primary hover:underline"
                                  title="Ver só este cliente"
                                >
                                  {clienteDaObra(doCliente.find((p) => p.id === o.id)!)}
                                </button>
                              </td>
                            )}
                            <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoPrev)}</td>
                            <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoReal)}</td>
                            <td className={cn(
                              td, 'text-right tabular-nums font-semibold',
                              o.desvio < 0 ? 'text-destructive' : o.desvio > 0 ? 'text-success' : '',
                            )}>
                              {pct(o.desvio)}
                            </td>
                            {canEdit && (
                              <DinheiroEditavel
                                classe={td} valor={o.valorContrato} manual={o.manuais.valorContrato}
                                podeEditar={canEdit}
                                aoSalvar={(n) => setInfoDoProjeto(o.id, { valorContrato: n })}
                              />
                            )}
                            {canEdit && (
                              <DinheiroEditavel
                                classe={td} valor={o.acumulado} manual={o.manuais.acumulado}
                                podeEditar={canEdit}
                                aoSalvar={(n) => setInfoDoProjeto(o.id, { acumuladoManual: n })}
                              />
                            )}
                            {canEdit && (
                              <DinheiroEditavel
                                classe={td} valor={o.previstoMes} manual={o.manuais.previstoMes}
                                podeEditar={canEdit}
                                aoSalvar={(n) => setInfoDoProjeto(o.id, { previstoMesManual: n })}
                              />
                            )}
                            {canEdit && (
                              // Realizado abaixo do previsto no mês é medição que
                              // não saiu — o número já diz, a cor faz enxergar.
                              <DinheiroEditavel
                                classe={cn(
                                  td,
                                  o.previstoMes > 0 && o.realizadoMes < o.previstoMes && 'text-destructive',
                                )}
                                valor={o.realizadoMes} manual={o.manuais.realizadoMes}
                                podeEditar={canEdit}
                                aoSalvar={(n) => setInfoDoProjeto(o.id, { realizadoMesManual: n })}
                              />
                            )}
                            {/* Tirar a obra da visão. stopPropagation porque a
                                linha inteira é o seletor de foco. */}
                            {canEdit && (
                              <td className={cn(td, 'text-right w-10')}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setObraOcultaNoConsolidado(o.id, !ocultaAqui);
                                  }}
                                  title={ocultaAqui ? 'Trazer de volta' : 'Tirar da visão'}
                                  className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                                >
                                  {ocultaAqui ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Só as colunas de dinheiro somam. Percentual de avanço
                          não se soma nem se faz média simples entre obras — é
                          para isso que existe a ponderação, e o número dela já
                          está no bloco 2. Uma célula vazia diz isso melhor que
                          um número que ninguém saberia interpretar. */}
                      {canEdit && dadosCliente.obras.length > 1 && (
                        <tr className="bg-muted/50 font-semibold">
                          <td className={cn(td, 'text-foreground')}>Total</td>
                          {todosOsClientes && <td className={td} />}
                          <td className={td} />
                          <td className={td} />
                          <td className={td} />
                          <Dinheiro classe={td} valor={dadosCliente.valorContrato} />
                          <Dinheiro classe={td} valor={dadosCliente.acumulado} />
                          <Dinheiro classe={td} valor={dadosCliente.previstoMes} />
                          <Dinheiro classe={td} valor={dadosCliente.realizadoMes} />
                          {canEdit && <td className={td} />}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              {/* Total que exclui em silêncio é total errado: a tela diz
                  quantas obras estão fora e devolve todas num clique. */}
              {ocultas.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{ocultas.length}</strong>{' '}
                    {ocultas.length > 1 ? 'obras estão fora' : 'obra está fora'} desta visão e dos
                    totais: {ocultas.map((p) => p.name).join(', ')}.
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarOcultas((v) => !v)}
                    className="text-primary hover:underline font-semibold"
                  >
                    {mostrarOcultas ? 'Esconder de novo' : 'Mostrar todas'}
                  </button>
                </p>
              )}

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

            <>
              {/* ── 2. POR QUÊ ───────────────────────────────────────── */}
              <Bloco

                titulo={tituloDoBloco(2, "Por quê?")}
                ferramenta="Cascata da medição do mês: previsto → realizado, obra a obra"
                {...cabecalho(2)}
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
                        <BarChart
                          data={cascata.barras}
                          margin={{ top: 20, right: 8, left: 4, bottom: 4 }}
                          style={{ cursor: 'pointer' }}
                          onClick={(e: any) => {
                            // Clicar num degrau recorta a página naquela obra:
                            // é a mesma ação da linha do item 1, feita de onde
                            // a pergunta nasceu.
                            const id = e?.activePayload?.[0]?.payload?.id;
                            if (id) setObraFocada((atual) => (atual === id ? null : id));
                          }}
                        >
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
                              <Cell key={i} fill={b.cor} />
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
              <Bloco

                titulo={tituloDoBloco(3, "Onde está o problema?")}
                ferramenta="Semana a semana — clique para abrir o que não fechou"
                {...cabecalho(3)}
              >
                <div className="space-y-3">
                  {analise.problemas.map((obra) => {
                    const resumo = analise.matriz.find((m) => m.id === obra.id);
                    return (
                      <div key={obra.id} className="rounded-lg border border-border overflow-hidden">
                        {/* Cabeçalho da obra: o resumo de severidade que a matriz
                            já dava, agora como contexto do detalhe que vem abaixo. */}
                        <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{obra.nome}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {resumo?.celulas.map((c, i) => (
                              <span
                                key={i}
                                title={COLUNAS_MATRIZ[i]}
                                className={cn(
                                  'rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap',
                                  FUNDO_SEVERIDADE[c.severidade],
                                )}
                              >
                                {COLUNAS_MATRIZ[i]}: {c.texto}
                              </span>
                            ))}
                          </div>
                        </div>

                        {obra.semProgramacao ? (
                          // Sem a Programação Semanal, a reunião ainda tem
                          // problema para registrar — e sem campo aqui, essa
                          // conversa acontece fora do relatório, onde se perde.
                          <div className="px-3 py-3">
                            <MotivosDoDesvio projeto={doCliente.find((p) => p.id === obra.id)!} />
                          </div>
                        ) : obra.semanas.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhuma semana lançada.</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {obra.semanas.map((s) => {
                              const aberta = semanasAbertas.has(s.chave);
                              return (
                                <div key={s.chave}>
                                  <button
                                    type="button"
                                    onClick={() => alternarSemana(s.chave)}
                                    className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                                  >
                                    <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', aberta && 'rotate-90')} />
                                    <span className="text-xs font-semibold text-foreground w-32 shrink-0">{s.rotulo}</span>
                                    <span className={cn(
                                      'text-xs font-semibold tabular-nums w-16 shrink-0',
                                      s.ppc >= 90 ? 'text-success' : s.ppc >= 70 ? 'text-amber-600 dark:text-amber-500' : 'text-destructive',
                                    )}>
                                      PPC {s.ppc}%
                                    </span>
                                    <span className="text-xs text-muted-foreground w-28 shrink-0">
                                      {s.problemas.length} de {s.totalAtividades} abertas
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate min-w-0">
                                      {s.causasDominantes.join(' · ')}
                                    </span>
                                  </button>

                                  {aberta && (
                                    <div className="px-3 pb-3 pl-9 space-y-2">
                                      {s.problemas.length === 0 ? (
                                        <p className="text-xs text-success">Todas as atividades da semana fecharam.</p>
                                      ) : s.problemas.map((pr) => (
                                        <div key={pr.id} className="rounded border border-border bg-muted/20 px-3 py-2">
                                          <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-foreground min-w-0">
                                              {pr.atividade}
                                            </span>
                                            {pr.aderencia != null && (
                                              <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                                                {pr.aderencia}% de aderência
                                              </span>
                                            )}
                                          </div>
                                          {pr.area && <p className="text-[11px] text-muted-foreground">{pr.area}</p>}

                                          {pr.causas.length > 0 && (
                                            <div className="flex gap-1 flex-wrap mt-1.5">
                                              {pr.causas.map((c) => (
                                                <span key={c} className="rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                                                  {c}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {pr.descricaoCausa && (
                                            <p className="text-[11px] text-foreground mt-1.5">
                                              <span className="text-muted-foreground">Causa: </span>{pr.descricaoCausa}
                                            </p>
                                          )}
                                          {pr.planoAcao && (
                                            <p className="text-[11px] text-foreground mt-0.5">
                                              <span className="text-muted-foreground">Plano: </span>{pr.planoAcao}
                                            </p>
                                          )}
                                          {pr.responsavel && (
                                            <p className="text-[11px] text-muted-foreground mt-0.5">{pr.responsavel}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">
                  Sai da Programação Semanal de cada obra: atividade que não fechou, causa 6M,
                  descrição e plano de ação. Últimas {MAX_SEMANAS} semanas por obra. Os selos no
                  cabeçalho são quatro problemas diferentes — avançar devagar, estourar a data, não
                  medir o que executou e deixar ação parada.
                </p>
              </Bloco>
            </>

            <>
              {/* ── 4. TENDÊNCIA DE PRAZO ────────────────────────────── */}
              <Bloco

                titulo={tituloDoBloco(4, "Qual a tendência do prazo?")}
                ferramenta="Término da linha de base × término projetado, mês a mês"
                {...cabecalho(4)}
                aside={!foco && doCliente.length > 1 ? (
                  // Datas de término não se somam entre obras — este gráfico é
                  // sempre de uma só, e a escolha precisa estar à mão.
                  <Select value={idDoPrazo ?? ''} onValueChange={setObraDoPrazo}>
                    <SelectTrigger className="h-8 min-w-[140px] max-w-[220px] text-xs">
                      <SelectValue placeholder="Obra" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Com vários clientes na tela, a obra sozinha não diz de
                          quem é: "MONTAGEM" pode ser de três contratos. */}
                      {doCliente.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {todosOsClientes ? `${p.name} · ${clienteDaObra(p)}` : p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : undefined}
              >
                {!datasPrazo ? (
                  <Vazio>
                    Falta Curva S com data de início, término da linha de base ou realizado
                    lançado para projetar a data de término.
                  </Vazio>
                ) : (
                  <>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={datasPrazo.serie} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                          <YAxis
                            type="number" domain={datasPrazo.dominio}
                            tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={66}
                            tickFormatter={(v: number) => formatDateShort(new Date(v).toISOString().slice(0, 10))}
                          />
                          <Tooltip
                            contentStyle={ESTILO_TOOLTIP}
                            formatter={(v: number, n: string) => [
                              formatDateBR(new Date(v).toISOString().slice(0, 10)),
                              n === 'base' ? 'Término da linha de base' : 'Término projetado',
                            ]}
                          />
                          {/* A linha de base é reta: ela é a promessa e não muda.
                              O que mexe é a projeção — e a distância entre as
                              duas é o atraso, legível sem legenda. */}
                          <Line
                            type="monotone" dataKey="base" name="base" strokeWidth={2} dot={false}
                            stroke={COR_GRAFICO.neutro} strokeDasharray="5 4"
                          />
                          <Line
                            type="monotone" dataKey="projetado" name="projetado" strokeWidth={2.5} dot={false}
                            stroke={datasPrazo.ultimo.projetado > datasPrazo.ultimo.base ? COR_GRAFICO.ruim : COR_GRAFICO.bom}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <p className={cn(
                      'text-xs mt-1 px-3 py-2 rounded-lg border',
                      datasPrazo.ultimo.projetado > datasPrazo.ultimo.base
                        ? 'border-destructive/40 bg-destructive/5 text-foreground'
                        : 'border-success/40 bg-success/5 text-foreground',
                    )}>
                      <strong>{datasPrazo.nome}</strong>: linha de base em{' '}
                      <strong>{formatDateBR(new Date(datasPrazo.ultimo.base).toISOString().slice(0, 10))}</strong>,
                      o ritmo aponta{' '}
                      <strong>{formatDateBR(new Date(datasPrazo.ultimo.projetado).toISOString().slice(0, 10))}</strong>.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cada mês mostra a data que o ritmo <em>até ali</em> apontava. A tracejada é a
                      linha de base — reta, porque é a promessa. Meses com menos de 5% planejado
                      ficam de fora: ali um ponto de diferença vira anos de projeção.
                    </p>
                  </>
                )}
              </Bloco>

              {/* ── 5. QUANTO VAI SOBRAR ─────────────────────────────── */}
              <Bloco

                titulo={tituloDoBloco(5, "Quanto vai sobrar?")}
                ferramenta="Contrato − impostos − custo = resultado líquido projetado"
                {...cabecalho(5)}
                aside={!foco && doCliente.length > 1 ? (
                  // "Quanto a UNIPAR deixa" e "quanto o SPCI deixa" são duas
                  // conversas. Obrigar a recortar a página inteira para trocar
                  // entre elas levaria junto os outros seis blocos.
                  <Select value={obraDoResultado} onValueChange={setObraDoResultado}>
                    <SelectTrigger className="h-8 min-w-[160px] max-w-[240px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">{todosOsClientes ? "Carteira inteira" : "Cliente inteiro"}</SelectItem>
                      {opcoesDoResultado.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : undefined}
              >
                {!resultado ? (
                  <Vazio>
                    Falta <strong>valor do contrato</strong> ou <strong>custo da obra</strong>{' '}
                    lançado nas Informações do Projeto para calcular o resultado.
                  </Vazio>
                ) : (
                  <>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resultado.barras} margin={{ top: 20, right: 8, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="nome" tick={{ fontSize: 10 }} interval={0}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            domain={[0, resultado.topo]} tick={{ fontSize: 10 }}
                            tickFormatter={fmtDinheiroCurto}
                            stroke="hsl(var(--muted-foreground))" width={72}
                          />
                          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={TooltipResultado} />
                          {/* Base transparente: faz o degrau descer do contrato
                              até o líquido em vez de nascer do zero. */}
                          <Bar dataKey="de" stackId="r" fill="transparent" isAnimationActive={false} />
                          <Bar dataKey="tamanho" stackId="r" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="delta" position="top" fontSize={10} formatter={fmtDinheiroCurto} />
                            {resultado.barras.map((b, i) => (
                              <Cell key={i} fill={b.cor} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <p className={cn(
                      'text-xs mt-1 px-3 py-2 rounded-lg border',
                      resultado.dados.liquido >= 0
                        ? 'border-success/40 bg-success/5 text-foreground'
                        : 'border-destructive/40 bg-destructive/5 text-foreground',
                    )}>
                      <strong>{nomeDoResultado}</strong>:{' '}
                      de {fmtDinheiro(resultado.dados.contrato)} contratados sobram{' '}
                      <strong>{fmtDinheiro(resultado.dados.liquido)}</strong>{' '}
                      ({resultado.dados.margem.toFixed(1).replace('.', ',')}% de margem).
                    </p>

                    {/* Por obra: a margem do cliente pode estar boa com uma obra
                        no vermelho sustentada por outra, e é a do vermelho que
                        precisa de decisão. */}
                    {resultado.dados.porObra.length > 1 && (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full border-collapse min-w-[44rem]">
                          <thead>
                            <tr className="bg-table-header text-table-header-foreground">
                              <th className={cn(th, 'text-left')}>Obra</th>
                              <th className={cn(th, 'text-right')}>Contrato</th>
                              <th className={cn(th, 'text-right')}>Impostos</th>
                              <th className={cn(th, 'text-right')}>Custo</th>
                              <th className={cn(th, 'text-right')}>Líquido</th>
                              <th className={cn(th, 'text-right')}>Margem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultado.dados.porObra.map((r) => (
                              <tr
                                key={r.id}
                                onClick={() => setObraFocada((atual) => (atual === r.id ? null : r.id))}
                                title={`Analisar só ${r.nome}`}
                                className={cn('cursor-pointer hover:bg-muted/40 transition-colors', r.incompleto && 'opacity-50')}
                              >
                                <td className={cn(td, 'font-medium text-foreground')}>{r.nome}</td>
                                <DinheiroEditavel
                                  classe={td} valor={r.contrato} manual={false} podeEditar={canEdit}
                                  aoSalvar={(n) => setInfoDoProjeto(r.id, { valorContrato: n })}
                                />
                                {/* O imposto é guardado como ALÍQUOTA, não como
                                    valor: editando em reais, a taxa volta da
                                    divisão pelo contrato. Sem contrato lançado
                                    não há como derivar, e o campo não grava. */}
                                <DinheiroEditavel
                                  classe={td} valor={r.impostos} manual={false}
                                  podeEditar={canEdit && r.contrato > 0}
                                  aoSalvar={(n) => setInfoDoProjeto(r.id, {
                                    impostoPercentual: r.contrato > 0 ? (n / r.contrato) * 100 : 0,
                                  })}
                                />
                                <DinheiroEditavel
                                  classe={td} valor={r.custo} manual={false} podeEditar={canEdit}
                                  aoSalvar={(n) => setInfoDoProjeto(r.id, { custoObra: n })}
                                />
                                <td className={cn(
                                  td, 'text-right tabular-nums font-semibold whitespace-nowrap',
                                  r.incompleto ? 'text-muted-foreground' : r.liquido >= 0 ? 'text-success' : 'text-destructive',
                                )}>
                                  {r.incompleto ? 'incompleto' : fmtDinheiro(r.liquido)}
                                </td>
                                <td className={cn(
                                  td, 'text-right tabular-nums font-semibold',
                                  r.incompleto ? 'text-muted-foreground' : r.margem >= 0 ? 'text-success' : 'text-destructive',
                                )}>
                                  {r.incompleto ? '—' : `${r.margem.toFixed(1).replace('.', ',')}%`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {resultado.dados.incompletas.length > 0 && (
                      <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3 mt-2">
                        Fora da conta: <strong>{resultado.dados.incompletas.join(', ')}</strong> —
                        falta valor de contrato ou custo lançado. Somá-las entraria com o contrato
                        inteiro e nenhum custo, o que dá 100% de margem e ninguém questiona.
                      </p>
                    )}

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Impostos saem da alíquota lançada em cada obra sobre o valor de contrato dela;
                      alíquotas diferentes não se somam como percentual, só o dinheiro que produzem.
                    </p>
                  </>
                )}
              </Bloco>
            </>

            <>
              {/* ── 6. QUAL O RISCO ──────────────────────────────────── */}
              <Bloco

                titulo={tituloDoBloco(6, "Qual o risco?")}
                ferramenta="Impacto × probabilidade, por obra"
                {...cabecalho(6)}
              >
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
                          <Scatter
                            data={analise.riscos}
                            style={{ cursor: 'pointer' }}
                            onClick={(p: any) => {
                              const id = p?.payload?.id ?? p?.id;
                              if (id) setObraFocada((atual) => (atual === id ? null : id));
                            }}
                          >
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
                    soma entre obras, causa conhecida, decisão da semana.
                    Ela é POR CLIENTE — escrevê-la na visão de todos gravaria o
                    mesmo texto em cima da análise de cada um. */}
                {todosOsClientes ? (
                  <p className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                    A análise de risco é escrita por cliente. Escolha um cliente no topo para
                    ler ou escrever a dele.
                  </p>
                ) : (
                  <AnaliseDeRisco
                    cliente={clienteAtivo}
                    idsDoCliente={doCliente.map((p) => p.id)}
                    salvo={riscoSalvo}
                    dadosParaIa={dadosParaIa}
                  />
                )}
              </Bloco>

              {/* ── 7. O QUE DEVEMOS FAZER ───────────────────────────── */}
              <Bloco

                titulo={tituloDoBloco(7, "O que devemos fazer?")}
                ferramenta="Prioridades da semana, do maior risco para baixo"
                {...cabecalho(7)}
              >
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

                        {/* O plano de ação da obra, em PCS. Substitui a lista
                            solta de atividades: sem responsável e sem prazo,
                            "liberar frente 3" é uma frase, não um compromisso. */}
                        <div className="mt-3">
                          <TabelaPcs
                            projeto={doCliente.find((p) => p.id === a.id)!}
                            dataCorte={analise.status}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Bloco>
            </>
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

          </>
        )}
      </div>
    </div>
  );
};

export default Consolidado;
