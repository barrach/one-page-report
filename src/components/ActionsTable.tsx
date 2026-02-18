import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { Trash2, Plus } from 'lucide-react';

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
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Ações</h3>
          <p className="text-xs text-muted-foreground">Problema → Causa → Solução</p>
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
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-2 py-2 text-center w-8 rounded-tl-lg">#</th>
              <th className="px-2 py-2 text-left">Problema</th>
              <th className="px-2 py-2 text-left">Causa</th>
              <th className="px-2 py-2 text-left">Solução</th>
              <th className="px-1 py-2 w-7 rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={i} className={`border-b border-border align-top ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                <td className="px-2 py-2 text-center font-bold text-muted-foreground">{a.id}</td>
                {(['problema', 'causa', 'solucao'] as const).map((field) => (
                  <td key={field} className="px-1 py-1">
                    <textarea
                      className="w-full bg-transparent border-none outline-none px-2 py-1 text-xs focus:ring-1 focus:ring-primary rounded resize-none overflow-hidden min-h-[28px]"
                      value={a[field]}
                      onChange={(e) => {
                        updateAction(i, field, e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onFocus={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      placeholder={field === 'problema' ? 'Problema...' : field === 'causa' ? 'Causa...' : 'Solução...'}
                      rows={1}
                    />
                  </td>
                ))}
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
