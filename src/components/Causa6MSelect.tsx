import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CAUSAS_6M, COR_CAUSA } from '@/lib/causas6m';
import type { Causa6M } from '@/lib/parseProgramacaoSemanal';
import { cn } from '@/lib/utils';

/**
 * Seletor das causas 6M com a justificativa em texto.
 *
 * Mais de uma causa por atividade é permitido de propósito: uma atividade pode
 * falhar por material E mão de obra, e forçar escolha única distorceria o Pareto.
 */
const Causa6MSelect = ({
  causas,
  justificativa,
  onChange,
  compacto,
}: {
  causas: Causa6M[];
  justificativa: string;
  onChange: (patch: { causas6M?: Causa6M[]; planoAcao?: string }) => void;
  compacto?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const alternar = (c: Causa6M) => {
    const proximas = causas.includes(c) ? causas.filter((x) => x !== c) : [...causas, c];
    onChange({ causas6M: proximas });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-1 rounded border px-1.5 py-1 text-left transition-colors',
            causas.length
              ? 'border-border bg-card hover:bg-muted/40'
              : 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10',
            compacto ? 'text-[10px]' : 'text-xs',
          )}
          title={causas.length ? causas.join(' · ') : 'Sem justificativa — clique para apontar a causa'}
        >
          <span className="flex items-center gap-1 min-w-0 flex-wrap">
            {causas.length === 0 ? (
              <span className="text-destructive font-semibold">justificar</span>
            ) : (
              causas.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 font-semibold text-foreground whitespace-nowrap"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COR_CAUSA[c] }} />
                  {compacto ? c.split(' ')[0] : c}
                </span>
              ))
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-3 space-y-3" align="end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Causa (6M)
          </p>
          <div className="grid grid-cols-2 gap-1">
            {CAUSAS_6M.map((c) => {
              const marcada = causas.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => alternar(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded border px-1.5 py-1 text-[11px] font-medium transition-colors text-left',
                    marcada ? 'border-transparent text-white' : 'border-border hover:bg-muted',
                  )}
                  style={marcada ? { backgroundColor: COR_CAUSA[c] } : undefined}
                >
                  <span className="shrink-0 w-3">
                    {marcada ? <Check className="h-3 w-3" /> : (
                      <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: COR_CAUSA[c] }} />
                    )}
                  </span>
                  <span className="truncate">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Justificativa
          </label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none"
            placeholder="Por que a atividade não foi realizada como programado?"
            value={justificativa}
            onChange={(e) => onChange({ planoAcao: e.target.value })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default Causa6MSelect;
