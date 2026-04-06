import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus } from 'lucide-react';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

const statusColors: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning text-warning-foreground',
  'CONCLUÍDO': 'bg-success text-white',
  'CANCELADO': 'bg-muted text-muted-foreground',
  'ATRASADO': 'bg-destructive text-white',
};

const colWidths: Record<string, string> = {
  problema: 'min-w-[180px] w-[20%]',
  causa: 'min-w-[140px] w-[14%]',
  impacto: 'min-w-[120px] w-[12%]',
  atividade: 'min-w-[140px] w-[14%]',
  responsavel: 'min-w-[90px] w-[8%]',
  prazo: 'min-w-[80px] w-[7%]',
  necessidade: 'min-w-[180px] w-[18%]',
};

const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();

  const updateAction = (index: number, field: string, value: string) => {
    const updated = actions.map((a, i) => i === index ? { ...a, [field]: value } : a);
    setActions(updated);
  };

  const fields = [
    { key: 'problema', label: 'Restrição / Problema' },
    { key: 'causa', label: 'Causa Raiz' },
    { key: 'impacto', label: 'Impacto (SSMA/Prazo)' },
    { key: 'atividade', label: 'Atividade' },
    { key: 'responsavel', label: 'Responsável' },
    { key: 'prazo', label: 'Prazo' },
    { key: 'necessidade', label: 'Necessidade' },
  ] as const;

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
        <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-2 py-2.5 text-center w-10 rounded-tl-lg">ID</th>
              {fields.map(f => (
                <th key={f.key} className={`px-2 py-2.5 text-left ${colWidths[f.key] || ''}`} style={{ whiteSpace: 'normal' }}>{f.label}</th>
              ))}
              <th className="px-2 py-2.5 text-center min-w-[110px] w-[7%]">Status</th>
              <th className="px-1 py-2.5 w-8 rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr
                key={i}
                className={`border-b border-border align-top transition-colors hover:bg-muted/40 ${
                  a.status === 'ATRASADO' ? 'bg-destructive/10' : i % 2 === 1 ? 'bg-muted/20' : ''
                }`}
              >
                <td className="px-2 py-2 text-center font-bold text-muted-foreground">{String(a.id).padStart(2, '0')}</td>
                {fields.map((f) => (
                  <td key={f.key} className={`px-1 py-1 ${colWidths[f.key] || ''}`}>
                    <textarea
                      className="w-full bg-transparent border-none outline-none px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary rounded resize-none overflow-hidden min-h-[32px]"
                      style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
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
                <td className="px-1 py-1">
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
                <td className="px-1 py-2 text-center">
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
