import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * Card de seção que abre e fecha, com a escolha lembrada por seção.
 *
 * A página de Dados é longa: quem só vem lançar a Curva S não precisa rolar por
 * cronograma, histograma e programação semanal. O estado vai para o
 * localStorage por `id`, então a tela reabre do jeito que a pessoa deixou.
 *
 * O gatilho é só o título — as ações do cabeçalho (limpar, mostrar linhas
 * extras) ficam fora dele para o clique nelas não fechar a seção.
 */

const chave = (id: string) => `opr_secao_${id}`;

interface SecaoRecolhivelProps {
  /** Identificador estável — é a chave do localStorage. */
  id: string;
  titulo: string;
  descricao?: string;
  /** Botões do cabeçalho (limpar dados, alternar linhas...). */
  acoes?: ReactNode;
  /** Informação curta que continua visível com a seção fechada. */
  resumo?: ReactNode;
  /** Como a seção nasce quando ainda não há escolha salva. */
  padrao?: boolean;
  children: ReactNode;
}

const SecaoRecolhivel = ({
  id,
  titulo,
  descricao,
  acoes,
  resumo,
  padrao = true,
  children,
}: SecaoRecolhivelProps) => {
  const [aberta, setAberta] = useState(() => {
    try {
      const salvo = localStorage.getItem(chave(id));
      return salvo === null ? padrao : salvo === '1';
    } catch {
      return padrao;
    }
  });

  const alternar = (valor: boolean) => {
    setAberta(valor);
    try { localStorage.setItem(chave(id), valor ? '1' : '0'); } catch { /* quota/ignore */ }
  };

  return (
    <Collapsible open={aberta} onOpenChange={alternar} className="bg-card rounded-lg shadow-sm border">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
        <CollapsibleTrigger className="group flex items-center gap-2 min-w-0 flex-1 text-left">
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              !aberta && '-rotate-90',
            )}
          />
          {/* Spans e não h2/p: o gatilho do Radix é um <button>, que só aceita
              conteúdo em linha. A semântica de título vem do role/aria-level. */}
          <span className="min-w-0 block">
            <span
              role="heading"
              aria-level={2}
              className="block text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors"
            >
              {titulo}
            </span>
            {descricao && (
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">{descricao}</span>
            )}
          </span>
        </CollapsibleTrigger>

        <div className="flex items-center gap-3 shrink-0">
          {resumo}
          {acoes}
        </div>
      </div>

      <CollapsibleContent>
        <div className="px-4 sm:px-6 pb-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SecaoRecolhivel;
