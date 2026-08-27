import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUp, ArrowDown, Maximize2, Minimize2, ChevronsUpDown, Eye, EyeOff, GripVertical,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { nomeDoCard, type ItemLayoutRelatorio } from '@/lib/layoutRelatorio';
import { useProjectStore } from '@/store/projectStore';

/**
 * Um card do relatório em modo de arrumação.
 *
 * Fora do modo de edição este componente é transparente: devolve o card como
 * ele é, sem envelope nem controles — o relatório de quem só lê tem que ser
 * exatamente o de sempre, inclusive no PDF.
 *
 * Arrastar usa o drag-and-drop nativo (sem biblioteca nova) e as setas ↑ ↓
 * existem porque arrastar não funciona em toque — e boa parte da obra abre isto
 * no celular.
 */

interface CardArrumavelProps {
  item: ItemLayoutRelatorio;
  editando: boolean;
  primeiro: boolean;
  ultimo: boolean;
  children: ReactNode;
  onMover: (direcao: -1 | 1) => void;
  onLargura: () => void;
  onAltura: (passos: number) => void;
  onOculto: () => void;
  onArrastarInicio: () => void;
  onSoltarSobre: () => void;
}

const CardArrumavel = ({
  item, editando, primeiro, ultimo, children,
  onMover, onLargura, onAltura, onOculto, onArrastarInicio, onSoltarSobre,
}: CardArrumavelProps) => {
  const colSpan = item.largura === 'inteira' ? 'lg:col-span-2' : 'lg:col-span-1';
  const estilo = item.altura ? { minHeight: `${item.altura}px` } : undefined;

  // Fechar um card é conveniência de QUEM ESTÁ LENDO, não arrumação do projeto:
  // fica no navegador de cada um, por projeto, e não mexe no que os outros veem.
  const projetoId = useProjectStore((s) => s.selectedProjectId);
  const chave = `opr_card_fechado_${projetoId}_${item.id}`;
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    try { setFechado(localStorage.getItem(chave) === '1'); } catch { setFechado(false); }
  }, [chave]);

  const alternarFechado = () => {
    setFechado((atual) => {
      const proximo = !atual;
      try { localStorage.setItem(chave, proximo ? '1' : '0'); } catch { /* quota */ }
      return proximo;
    });
  };

  /**
   * Clicar no card recolhe — menos onde o clique já significa outra coisa.
   *
   * Sem essa exceção, clicar numa barra do gráfico para filtrar por data, num
   * campo do Pontos de Atenção ou num filtro do cronograma fecharia o card
   * junto. A regra é: clique em área "morta" do card alterna; clique em algo
   * interativo faz só o que aquilo faz.
   */
  const INTERATIVOS = 'button, a, input, select, textarea, label, table, [role="button"], .recharts-wrapper, svg';

  const aoClicarNoCard = (e: React.MouseEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement | null;
    if (alvo?.closest(INTERATIVOS)) return;
    alternarFechado();
  };

  if (!editando) {
    // Card oculto some do relatório e do papel.
    if (item.oculto) return null;

    // `card-do-relatorio` é o gancho da regra em index.css que some com o card
    // que decide não desenhar nada — o Clima sem cidade, por exemplo. Sem ela o
    // invólucro continuaria ocupando meia linha da grade e abriria um buraco no
    // meio do relatório.
    return (
      <div
        className={cn(colSpan, 'card-do-relatorio relative flex flex-col')}
        style={fechado ? undefined : estilo}
      >
        {fechado ? (
          <button
            onClick={() => alternarFechado()}
            data-pdf-hide
            className="w-full flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-left card-shadow hover:border-primary/40 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-bold text-foreground uppercase tracking-wider truncate">
              {nomeDoCard(item.id)}
            </span>
          </button>
        ) : null}

        {/* Fechado é conveniência de leitura, não decisão sobre o relatório: o
            papel continua saindo com o card inteiro. Esconder no PDF é o que o
            botão do olho (oculto) faz, e esse é do administrador. */}
        {/* `flex-1 min-h-0` repõe a cadeia de altura que o invólucro quebrou.
            O card usa `h-full` e os gráficos usam `flex-1`, e o recharts só
            desenha quando a altura do pai é DEFINIDA — com o conteúdo em altura
            automática ele media zero e o card ficava com título, rodapé e um
            vazio no meio. Antes do layout arrastável o card era filho direto da
            grade e herdava a altura da linha. */}
        <div
          className={cn('conteudo-do-card flex-1 min-h-0 cursor-pointer', fechado && 'hidden')}
          onClick={aoClicarNoCard}
          data-pdf-show
        >
          {children}
        </div>
      </div>
    );
  }

  const botao = 'h-7 w-7 flex items-center justify-center rounded hover:bg-background/70 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      className={cn(colSpan, 'relative rounded-xl ring-2 ring-primary/40 ring-offset-2 ring-offset-background flex flex-col')}
      draggable
      onDragStart={onArrastarInicio}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onSoltarSobre(); }}
      style={estilo}
    >
      <div className="flex items-center gap-1 flex-wrap rounded-t-xl bg-primary/10 border border-primary/30 px-2 py-1">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
        <span className="text-[11px] font-semibold text-foreground mr-auto truncate">
          {nomeDoCard(item.id)}
        </span>

        <button className={botao} onClick={() => onMover(-1)} disabled={primeiro} title="Subir">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button className={botao} onClick={() => onMover(1)} disabled={ultimo} title="Descer">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          className={botao}
          onClick={onLargura}
          title={item.largura === 'meia' ? 'Ocupar a linha inteira' : 'Ocupar meia linha'}
        >
          {item.largura === 'meia' ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
        <button className={botao} onClick={() => onAltura(1)} title="Aumentar a altura">
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
        <button className={botao} onClick={() => onAltura(-1)} title="Diminuir a altura">
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </button>
        <button className={botao} onClick={onOculto} title={item.oculto ? 'Mostrar no relatório' : 'Esconder do relatório'}>
          {item.oculto ? <EyeOff className="h-3.5 w-3.5 text-destructive" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Card oculto continua visível NA EDIÇÃO, apagado: some do relatório, mas
          quem está arrumando precisa poder trazê-lo de volta. */}
      <div className={cn('flex-1 min-h-0', item.oculto && 'opacity-40 grayscale')}>{children}</div>
    </div>
  );
};

export default CardArrumavel;
