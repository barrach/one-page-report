import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus, ClipboardList, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

/** Pílula de status — as mesmas cores semânticas dos KPIs do relatório. */
const statusPill: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning text-warning-foreground',
  'CONCLUÍDO': 'bg-success text-white',
  'CANCELADO': 'bg-muted-foreground/20 text-foreground',
  'ATRASADO': 'bg-destructive text-white',
};

/** Faixa lateral que dá o "semáforo" do ponto de atenção. */
const statusAccent: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning',
  'CONCLUÍDO': 'bg-success',
  'CANCELADO': 'bg-muted-foreground/40',
  'ATRASADO': 'bg-destructive',
};

const val = (a: unknown, key: string) => String((a as Record<string, unknown>)[key] ?? '');

const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

/** Rótulo dos campos — escuro e com peso, para não sumir no fundo do card. */
const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">{children}</span>
);

/** Campo curto: linha de base sempre visível, para ler como formulário. */
const Campo = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="flex flex-col gap-1 min-w-0">
    <Rotulo>{label}</Rotulo>
    <input
      className="w-full bg-transparent border-b border-border focus:border-primary outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground/60 placeholder:font-normal pb-1 transition-colors"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="preencher"
    />
  </label>
);

/** Campo longo, que cresce com o texto. */
const CampoLongo = ({
  label,
  value,
  onChange,
  destaque,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  destaque?: boolean;
}) => (
  <label className="flex flex-col gap-1 min-w-0">
    <Rotulo>{label}</Rotulo>
    <textarea
      rows={1}
      className={cn(
        'w-full bg-transparent border-none outline-none resize-none overflow-hidden rounded px-1 -mx-1 py-0.5 focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 placeholder:font-normal',
        destaque
          ? 'text-base font-semibold text-foreground leading-snug'
          : 'text-sm font-medium text-foreground',
      )}
      style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        autoGrow(e.target);
      }}
      onFocus={(e) => autoGrow(e.target)}
      placeholder="preencher"
    />
  </label>
);

/**
 * Pontos de Atenção — lista de cartões, não tabela.
 *
 * Com sete campos por registro, qualquer tabela precisa de rolagem horizontal
 * dentro de um card de meia largura. Em cartão os campos se distribuem em linhas
 * que quebram sozinhas, então tudo fica visível na largura disponível.
 *
 * O visual segue a identidade do relatório: faixa azul-marinho de cabeçalho (a
 * mesma das tabelas), faixa lateral com a cor do status e campos com linha de
 * base visível — nada de cinza sobre cinza.
 */
const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();

  const updateAction = (index: number, field: string, value: string) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col min-h-[440px] sm:min-h-[560px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pontos de Atenção</h3>
          <p className="text-xs text-muted-foreground">Restrições e ações corretivas</p>
        </div>
        <button
          onClick={addAction}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shrink-0 font-semibold"
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
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {actions.map((a, i) => {
            const atrasado = a.status === 'ATRASADO';
            return (
              <div
                key={i}
                className={cn(
                  'relative rounded-lg border overflow-hidden bg-card',
                  atrasado ? 'border-destructive/50 shadow-sm' : 'border-border',
                )}
              >
                {/* Semáforo lateral */}
                <span
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-1',
                    a.status ? statusAccent[a.status] : 'bg-border',
                  )}
                />

                {/* Cabeçalho — mesma faixa azul-marinho das tabelas do relatório */}
                <div className="bg-table-header text-table-header-foreground flex items-center gap-2 pl-4 pr-2 py-1.5">
                  <span className="text-[11px] font-bold tabular-nums opacity-80">
                    {String(a.id).padStart(2, '0')}
                  </span>
                  {atrasado && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  <div className="flex-1" />
                  <select
                    className={cn(
                      'text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer',
                      a.status ? statusPill[a.status] : 'bg-white/15 text-white',
                    )}
                    value={a.status || ''}
                    onChange={(e) => updateAction(i, 'status', e.target.value)}
                  >
                    {/* A cor vem no style porque a <option> nativa herda o branco
                        da pílula e ficaria branco sobre branco na lista. */}
                    <option value="" style={{ color: '#111827', background: '#ffffff' }}>SEM STATUS</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s} style={{ color: '#111827', background: '#ffffff' }}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeAction(i)}
                    className="text-white/50 hover:text-white transition-colors shrink-0 p-1"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Corpo */}
                <div className="pl-4 pr-3 py-3 space-y-3">
                  <CampoLongo
                    label="Restrição / Problema"
                    value={val(a, 'problema')}
                    onChange={(v) => updateAction(i, 'problema', v)}
                    destaque
                  />

                  {/* Contexto — 2 colunas em tela estreita, 3 quando cabe */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5 pt-1">
                    <Campo label="Causa raiz" value={val(a, 'causa')} onChange={(v) => updateAction(i, 'causa', v)} />
                    <Campo label="Atividade" value={val(a, 'atividade')} onChange={(v) => updateAction(i, 'atividade', v)} />
                    <Campo label="Impacto (SSMA/prazo)" value={val(a, 'impacto')} onChange={(v) => updateAction(i, 'impacto', v)} />
                  </div>

                  {/* Ação corretiva — bloco destacado, é a saída do ponto de atenção */}
                  <div className="rounded-md bg-primary/5 border border-primary/15 p-2.5 space-y-2.5">
                    <CampoLongo
                      label="Ação corretiva"
                      value={val(a, 'necessidade')}
                      onChange={(v) => updateAction(i, 'necessidade', v)}
                    />
                    <div className="grid grid-cols-2 gap-x-4">
                      <Campo label="Responsável" value={val(a, 'responsavel')} onChange={(v) => updateAction(i, 'responsavel', v)} />
                      <Campo label="Prazo" value={val(a, 'prazo')} onChange={(v) => updateAction(i, 'prazo', v)} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionsTable;
