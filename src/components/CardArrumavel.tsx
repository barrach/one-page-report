import { type ReactNode } from 'react';
import {
  ArrowUp, ArrowDown, Maximize2, Minimize2, ChevronsUpDown, Eye, EyeOff, GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { nomeDoCard, type ItemLayoutRelatorio } from '@/lib/layoutRelatorio';

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

  if (!editando) {
    // Card oculto some do relatório e do papel.
    if (item.oculto) return null;
    // `empty:hidden` cobre o card que decide não desenhar nada — o Clima sem
    // cidade, por exemplo. Sem isso o invólucro continuaria ocupando meia linha
    // da grade e abriria um buraco no meio do relatório.
    return <div className={cn(colSpan, 'empty:hidden')} style={estilo}>{children}</div>;
  }

  const botao = 'h-7 w-7 flex items-center justify-center rounded hover:bg-background/70 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      className={cn(colSpan, 'relative rounded-xl ring-2 ring-primary/40 ring-offset-2 ring-offset-background')}
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
      <div className={cn(item.oculto && 'opacity-40 grayscale')}>{children}</div>
    </div>
  );
};

export default CardArrumavel;
