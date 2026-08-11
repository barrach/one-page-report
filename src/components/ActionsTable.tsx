import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

const statusColors: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning text-warning-foreground',
  'CONCLUÍDO': 'bg-success text-white',
  'CANCELADO': 'bg-muted text-muted-foreground',
  'ATRASADO': 'bg-destructive text-white',
};

const val = (a: unknown, key: string) => String((a as Record<string, unknown>)[key] ?? '');

const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

/** Campo curto, com rótulo acima em caixa alta. */
const Campo = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <input
      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-xs text-foreground placeholder:text-muted-foreground/50 pb-0.5 transition-colors"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
    />
  </label>
);

/** Campo longo, que cresce com o texto. */
const CampoLongo = ({
  label,
  value,
  onChange,
  strong,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  strong?: boolean;
}) => (
  <label className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <textarea
      rows={1}
      className={cn(
        'w-full bg-transparent border-none outline-none resize-none overflow-hidden text-xs rounded px-1 -mx-1 py-0.5 focus:ring-1 focus:ring-primary',
        strong ? 'font-semibold text-foreground' : 'text-foreground',
      )}
      style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        autoGrow(e.target);
      }}
      onFocus={(e) => autoGrow(e.target)}
      placeholder="—"
    />
  </label>
);

/**
 * Pontos de Atenção — lista de cartões, não tabela.
 *
 * Com sete campos por registro, qualquer tabela precisa de rolagem horizontal
 * dentro de um card de meia largura. Em cartão os campos se distribuem em linhas
 * que quebram sozinhas, então tudo fica visível na largura disponível.
 */
const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();

  const updateAction = (index: number, field: string, value: string) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pontos de Atenção</h3>
          <p className="text-xs text-muted-foreground">Restrições e ações corretivas</p>
        </div>
        <button
          onClick={addAction}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum ponto de atenção registrado</p>
          <p className="text-xs text-muted-foreground/70 max-w-[280px]">
            Use “Adicionar” para incluir restrições e ações corretivas.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {actions.map((a, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                a.status === 'ATRASADO'
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-border bg-muted/20 hover:bg-muted/30',
              )}
            >
              {/* Identificação, status e excluir */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">
                  {String(a.id).padStart(2, '0')}
                </span>
                <select
                  className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer',
                    a.status ? statusColors[a.status] || 'bg-muted' : 'bg-muted text-muted-foreground',
                  )}
                  value={a.status || ''}
                  onChange={(e) => updateAction(i, 'status', e.target.value)}
                >
                  <option value="">SEM STATUS</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <button
                  onClick={() => removeAction(i)}
                  className="text-destructive/40 hover:text-destructive transition-colors shrink-0"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* O problema */}
              <CampoLongo
                label="Restrição / Problema"
                value={val(a, 'problema')}
                onChange={(v) => updateAction(i, 'problema', v)}
                strong
              />

              {/* Contexto — 2 colunas em tela estreita, 3 quando cabe */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1.5 mt-2">
                <Campo label="Causa raiz" value={val(a, 'causa')} onChange={(v) => updateAction(i, 'causa', v)} />
                <Campo label="Atividade" value={val(a, 'atividade')} onChange={(v) => updateAction(i, 'atividade', v)} />
                <Campo label="Impacto (SSMA/prazo)" value={val(a, 'impacto')} onChange={(v) => updateAction(i, 'impacto', v)} />
              </div>

              {/* A ação corretiva e seus responsáveis */}
              <div className="mt-2 pt-2 border-t border-border/60">
                <CampoLongo
                  label="Ação corretiva"
                  value={val(a, 'necessidade')}
                  onChange={(v) => updateAction(i, 'necessidade', v)}
                />
                <div className="grid grid-cols-2 gap-x-3 mt-1.5">
                  <Campo label="Responsável" value={val(a, 'responsavel')} onChange={(v) => updateAction(i, 'responsavel', v)} />
                  <Campo label="Prazo" value={val(a, 'prazo')} onChange={(v) => updateAction(i, 'prazo', v)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionsTable;
