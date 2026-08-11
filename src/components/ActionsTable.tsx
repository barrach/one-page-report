import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus, ClipboardList } from 'lucide-react';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

const statusColors: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning text-warning-foreground',
  'CONCLUÍDO': 'bg-success text-white',
  'CANCELADO': 'bg-muted text-muted-foreground',
  'ATRASADO': 'bg-destructive text-white',
};

/**
 * Sete campos em TRÊS colunas: cada coluna tem um campo principal e os
 * complementares abaixo dele, em linha menor. Mesma informação de antes, sem o
 * scroll horizontal que a tabela de nove colunas exigia.
 */
const columns = [
  {
    label: 'Restrição / Problema',
    main: { key: 'problema', placeholder: 'Restrição / problema...' },
    subs: [{ key: 'causa', label: 'Causa raiz' }],
    minW: 240,
  },
  {
    label: 'Impacto',
    main: { key: 'impacto', placeholder: 'Impacto (SSMA/prazo)...' },
    subs: [{ key: 'atividade', label: 'Atividade' }],
    minW: 170,
  },
  {
    label: 'Ação',
    main: { key: 'necessidade', placeholder: 'Ação corretiva...' },
    subs: [
      { key: 'responsavel', label: 'Resp.' },
      { key: 'prazo', label: 'Prazo' },
    ],
    minW: 230,
  },
] as const;

const cellStyle: React.CSSProperties = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  verticalAlign: 'top',
};

const val = (a: unknown, key: string) =>
  String((a as Record<string, unknown>)[key] ?? '');

const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();

  const updateAction = (index: number, field: string, value: string) => {
    const updated = actions.map((a, i) => i === index ? { ...a, [field]: value } : a);
    setActions(updated);
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
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
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
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse" style={{ tableLayout: 'auto' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-3 py-2.5 text-center rounded-tl-lg" style={{ minWidth: 44, ...cellStyle }}>ID</th>
              {columns.map(c => (
                <th key={c.label} className="px-3 py-2.5 text-left" style={{ minWidth: c.minW, ...cellStyle }}>{c.label}</th>
              ))}
              <th className="px-3 py-2.5 text-center" style={{ minWidth: 120, ...cellStyle }}>Status</th>
              <th className="px-2 py-2.5 rounded-tr-lg" style={{ minWidth: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr
                key={i}
                className={`border-b border-border transition-colors hover:bg-muted/40 ${
                  a.status === 'ATRASADO' ? 'bg-destructive/10' : i % 2 === 1 ? 'bg-muted/20' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-center font-bold text-muted-foreground" style={cellStyle}>{String(a.id).padStart(2, '0')}</td>
                {columns.map((c) => (
                  <td key={c.label} className="px-1 py-1" style={{ ...cellStyle, minWidth: c.minW }}>
                    <textarea
                      className="w-full bg-transparent border-none outline-none px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary rounded resize-none overflow-hidden"
                      style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minHeight: 34 }}
                      value={val(a, c.main.key)}
                      onChange={(e) => {
                        updateAction(i, c.main.key, e.target.value);
                        autoGrow(e.target);
                      }}
                      onFocus={(e) => autoGrow(e.target)}
                      placeholder={c.main.placeholder}
                      rows={1}
                    />
                    {c.subs.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 px-2 pb-1">
                        {c.subs.map((sub) => (
                          <label key={sub.key} className="flex items-baseline gap-1 min-w-0 flex-1">
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">{sub.label}</span>
                            <input
                              className="min-w-0 flex-1 bg-transparent border-none outline-none text-[11px] text-muted-foreground focus:text-foreground focus:ring-1 focus:ring-primary rounded px-1"
                              value={val(a, sub.key)}
                              onChange={(e) => updateAction(i, sub.key, e.target.value)}
                              placeholder="—"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-1 py-1" style={cellStyle}>
                  <select
                    className={`w-full text-xs font-bold px-2 py-1.5 rounded border-none outline-none cursor-pointer ${
                      a.status ? statusColors[a.status] || 'bg-muted' : 'bg-transparent'
                    }`}
                    value={a.status || ''}
                    onChange={(e) => updateAction(i, 'status', e.target.value)}
                  >
                    <option value="">—</option>
                    {statusOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5 text-center" style={cellStyle}>
                  <button
                    onClick={() => removeAction(i)}
                    className="text-destructive/40 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default ActionsTable;
