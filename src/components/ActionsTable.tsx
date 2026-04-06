import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus } from 'lucide-react';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

const statusColors: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning text-warning-foreground',
  'CONCLUÍDO': 'bg-success text-white',
  'CANCELADO': 'bg-muted text-muted-foreground',
  'ATRASADO': 'bg-destructive text-white',
};

const fields = [
  { key: 'problema', label: 'Restrição / Problema', minW: 250 },
  { key: 'causa', label: 'Causa Raiz', minW: 200 },
  { key: 'impacto', label: 'Impacto (SSMA/Prazo)', minW: 150 },
  { key: 'atividade', label: 'Atividade', minW: 150 },
  { key: 'responsavel', label: 'Responsável', minW: 120 },
  { key: 'prazo', label: 'Prazo', minW: 100 },
  { key: 'necessidade', label: 'Necessidade', minW: 300 },
] as const;

const cellStyle: React.CSSProperties = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  verticalAlign: 'top',
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
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Ponto de Atenção</h3>
          <p className="text-xs text-muted-foreground">Restrições e ações corretivas</p>
        </div>
        <button
          onClick={addAction}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3 w-3" />
          Ação
        </button>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse" style={{ tableLayout: 'auto' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-3 py-2.5 text-center rounded-tl-lg" style={{ minWidth: 50, ...cellStyle }}>ID</th>
              {fields.map(f => (
                <th key={f.key} className="px-3 py-2.5 text-left" style={{ minWidth: f.minW, ...cellStyle }}>{f.label}</th>
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
                {fields.map((f) => (
                  <td key={f.key} className="px-1 py-1" style={{ ...cellStyle, minWidth: f.minW }}>
                    <textarea
                      className="w-full bg-transparent border-none outline-none px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary rounded resize-none overflow-hidden"
                      style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minHeight: 34 }}
                      value={String((a as unknown as Record<string, unknown>)[f.key] ?? '')}
                      onChange={(e) => {
                        updateAction(i, f.key, e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onFocus={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      placeholder={f.label + '...'}
                      rows={1}
                    />
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
    </div>
  );
};

export default ActionsTable;
