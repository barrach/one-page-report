import { useState } from 'react';
import { MessageSquarePlus, Trash2, ChevronDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { useTvMode } from '@/hooks/use-tv-mode';
import { cn } from '@/lib/utils';

/**
 * Anotações de reunião presas a um card do relatório.
 *
 * Cada anotação guarda a data em que foi escrita, então o card vira o histórico
 * do que foi dito ali — semana a semana — em vez de um campo de texto que a
 * reunião seguinte sobrescreve.
 *
 * O que já foi anotado VAI para o PDF: é o registro da reunião. Só os controles
 * de escrever e apagar ficam de fora (`data-pdf-hide`).
 */

const fmtQuando = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ObservacoesDoCard = ({ card }: { card: string }) => {
  const { observacoesCards } = useCurrentProject();
  const addObservacao = useProjectStore((s) => s.addObservacaoCard);
  const removeObservacao = useProjectStore((s) => s.removeObservacaoCard);
  const { user, canEdit } = useAuth();
  const { tvMode } = useTvMode();

  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');

  // Mais recente em cima: numa reunião o que interessa é a última leitura.
  const anotacoes = [...((observacoesCards || {})[card] || [])].reverse();

  // Na TV o painel é só para olhar de longe — anotação ali só rouba espaço.
  if (tvMode) return null;
  // Quem só lê e não tem o que ler: o bloco inteiro sai do card.
  if (!canEdit && anotacoes.length === 0) return null;

  const registrar = () => {
    if (!texto.trim()) return;
    addObservacao(card, texto, user?.email ?? undefined);
    setTexto('');
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        data-pdf-hide
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !aberto && '-rotate-90')} />
        Observações da reunião
        {anotacoes.length > 0 && (
          <span className="ml-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px]">
            {anotacoes.length}
          </span>
        )}
      </button>

      {/* As anotações ficam sempre no papel; na tela seguem o botão. */}
      {anotacoes.length > 0 && (
        <ul className={cn('space-y-1.5 mt-2', !aberto && 'hidden print:block')} data-pdf-show>
          {anotacoes.map((o) => (
            <li key={o.id} className="text-xs rounded-md bg-muted/40 border border-border px-2.5 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground whitespace-pre-wrap break-words min-w-0">{o.texto}</p>
                {canEdit && (
                  <button
                    onClick={() => removeObservacao(card, o.id)}
                    className="text-destructive/60 hover:text-destructive shrink-0"
                    title="Apagar anotação"
                    data-pdf-hide
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {fmtQuando(o.data)}{o.autor ? ` · ${o.autor}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {aberto && canEdit && (
        <div className="mt-2 space-y-1.5" data-pdf-hide>
          <Textarea
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O que foi dito sobre este indicador na reunião…"
            className="text-xs"
          />
          <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={registrar} disabled={!texto.trim()}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> Registrar
          </Button>
        </div>
      )}
    </div>
  );
};

export default ObservacoesDoCard;
