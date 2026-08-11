import { useState } from 'react';
import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus, ClipboardList, AlertTriangle, ChevronDown, ChevronRight, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResponsavelSelect from '@/components/ResponsavelSelect';
import { situacaoDoPrazo, corDoPrazo, paraInputDate } from '@/lib/prazoUtils';
import { useExportMode } from '@/hooks/use-export-mode';

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

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">{children}</span>
);

/** Campo curto: linha de base sempre visível, para ler como formulário. */
const Campo = ({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date';
}) => (
  <label className="flex flex-col gap-1 min-w-0">
    <Rotulo>{label}</Rotulo>
    <input
      type={type}
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

/** Célula de leitura usada na versão de exportação. */
const Leitura = ({ label, valor }: { label: string; valor: string }) => (
  <div className="min-w-0">
    <span className="block text-[8px] font-bold uppercase tracking-wider text-foreground/50">{label}</span>
    <span className="block text-[10px] text-foreground leading-snug break-words">{valor || '—'}</span>
  </div>
);

/**
 * Versão de impressão: texto estático, todos os pontos abertos e compacto.
 *
 * Na tela os campos são editáveis, mas o html2canvas corta o valor dos inputs e
 * não desenha o texto dos selects. Aqui tudo é texto comum, e nenhuma gaveta
 * fica fechada — no papel não há como abrir.
 */
const PontosParaImpressao = ({ actions }: { actions: ReturnType<typeof useCurrentProject>['actions'] }) => (
  <div className="bg-card rounded-xl p-4 card-shadow border">
    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pontos de Atenção</h3>
    <p className="text-xs text-muted-foreground mb-3">Restrições e ações corretivas</p>

    {actions.length === 0 ? (
      <p className="text-xs text-muted-foreground py-4 text-center">Nenhum ponto de atenção registrado</p>
    ) : (
      <div className="space-y-1.5">
        {actions.map((a, i) => {
          const prazo = situacaoDoPrazo(val(a, 'prazo'), a.status);
          return (
            <div key={i} className="rounded border border-border overflow-hidden">
              <div className="bg-table-header text-table-header-foreground flex items-center gap-2 px-2 py-1">
                <span className="text-[10px] font-bold tabular-nums">{String(a.id).padStart(2, '0')}</span>
                <span className="text-[10px] font-semibold flex-1 min-w-0 break-words">
                  {val(a, 'problema') || 'sem descrição'}
                </span>
                <span className="text-[9px] font-bold whitespace-nowrap">
                  {a.status || 'SEM STATUS'}
                </span>
              </div>
              <div className="px-2 py-1.5 grid grid-cols-3 gap-x-3 gap-y-1">
                <Leitura label="Causa raiz" valor={val(a, 'causa')} />
                <Leitura label="Atividade" valor={val(a, 'atividade')} />
                <Leitura label="Impacto" valor={val(a, 'impacto')} />
                <div className="col-span-3">
                  <Leitura label="Ação corretiva" valor={val(a, 'necessidade')} />
                </div>
                <Leitura label="Responsável" valor={val(a, 'responsavel')} />
                <Leitura
                  label="Prazo"
                  valor={
                    val(a, 'prazo')
                      ? `${val(a, 'prazo').split('-').reverse().join('/')}${prazo.situacao !== 'sem_prazo' ? ` · ${prazo.label}` : ''}`
                      : ''
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

/**
 * Pontos de Atenção — gavetas recolhíveis.
 *
 * Fechado, cada ponto ocupa uma linha: status, problema, responsável e o
 * indicador de prazo. Abre ao clicar no cabeçalho. Assim o card mostra vários
 * pontos na altura disponível, em vez de um único registro esparramado.
 *
 * O visual segue a identidade do relatório: faixa azul-marinho de cabeçalho (a
 * mesma das tabelas) e faixa lateral com a cor do status.
 */
const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();
  const { exportando } = useExportMode();
  const [aberto, setAberto] = useState<number | null>(0);

  const updateAction = (index: number, field: string, value: string) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  if (exportando) return <PontosParaImpressao actions={actions} />;

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col min-h-[440px] sm:min-h-[560px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pontos de Atenção</h3>
          <p className="text-xs text-muted-foreground">Restrições e ações corretivas</p>
        </div>
        <button
          onClick={() => { addAction(); setAberto(actions.length); }}
          data-pdf-hide
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
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {actions.map((a, i) => {
            const atrasado = a.status === 'ATRASADO';
            const prazo = situacaoDoPrazo(val(a, 'prazo'), a.status);
            const estaAberto = aberto === i;
            const resumo = val(a, 'problema').trim();

            return (
              <div
                key={i}
                className={cn(
                  'relative rounded-lg border overflow-hidden bg-card',
                  atrasado || prazo.situacao === 'atrasado'
                    ? 'border-destructive/50'
                    : 'border-border',
                )}
              >
                {/* Semáforo lateral */}
                <span
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-1 z-10',
                    a.status ? statusAccent[a.status] : 'bg-border',
                  )}
                />

                {/* Cabeçalho — clique abre/fecha a gaveta */}
                <div className="bg-table-header text-table-header-foreground flex items-center gap-2 pl-4 pr-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setAberto(estaAberto ? null : i)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    aria-expanded={estaAberto}
                  >
                    {estaAberto
                      ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                    <span className="text-[11px] font-bold tabular-nums opacity-80 shrink-0">
                      {String(a.id).padStart(2, '0')}
                    </span>
                    {atrasado && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    {/* Fechado, o problema é o rótulo da gaveta */}
                    {!estaAberto && (
                      <span className={cn('text-xs truncate', resumo ? 'text-white/90' : 'text-white/40 italic')}>
                        {resumo || 'sem descrição'}
                      </span>
                    )}
                  </button>

                  {/* Indicador de prazo — some quando a gaveta está aberta, onde já há a data */}
                  {!estaAberto && prazo.situacao !== 'sem_prazo' && (
                    <span
                      className={cn(
                        'shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                        corDoPrazo[prazo.situacao],
                      )}
                      title={`Prazo: ${val(a, 'prazo') || '—'}`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {prazo.label}
                    </span>
                  )}

                  <select
                    className={cn(
                      'text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer shrink-0',
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

                {/* Corpo — só quando a gaveta está aberta */}
                {estaAberto && (
                  <div className="pl-4 pr-3 py-3 space-y-3">
                    <CampoLongo
                      label="Restrição / Problema"
                      value={val(a, 'problema')}
                      onChange={(v) => updateAction(i, 'problema', v)}
                      destaque
                    />

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5 pt-1">
                      <Campo label="Causa raiz" value={val(a, 'causa')} onChange={(v) => updateAction(i, 'causa', v)} />
                      <Campo label="Atividade" value={val(a, 'atividade')} onChange={(v) => updateAction(i, 'atividade', v)} />
                      <Campo label="Impacto (SSMA/prazo)" value={val(a, 'impacto')} onChange={(v) => updateAction(i, 'impacto', v)} />
                    </div>

                    {/* Ação corretiva — a saída do ponto de atenção */}
                    <div className="rounded-md bg-primary/5 border border-primary/15 p-2.5 space-y-2.5">
                      <CampoLongo
                        label="Ação corretiva"
                        value={val(a, 'necessidade')}
                        onChange={(v) => updateAction(i, 'necessidade', v)}
                      />
                      <div className="grid grid-cols-2 gap-x-4 items-end">
                        <label className="flex flex-col gap-1 min-w-0">
                          <Rotulo>Responsável</Rotulo>
                          <ResponsavelSelect
                            value={val(a, 'responsavel')}
                            onChange={(v) => updateAction(i, 'responsavel', v)}
                          />
                        </label>
                        <div className="flex items-end gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <Campo
                              label="Prazo"
                              type="date"
                              value={paraInputDate(val(a, 'prazo'))}
                              onChange={(v) => updateAction(i, 'prazo', v)}
                            />
                          </div>
                          {prazo.situacao !== 'sem_prazo' && (
                            <span
                              className={cn(
                                'shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border mb-1',
                                corDoPrazo[prazo.situacao],
                              )}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {prazo.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionsTable;
