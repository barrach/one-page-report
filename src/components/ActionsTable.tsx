import { useProjectStore, useCurrentProject, ActionStatus } from '@/store/projectStore';
import { Trash2, Plus, ClipboardList } from 'lucide-react';

const statusOptions: ActionStatus[] = ['EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'ATRASADO'];

const statusColors: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning/15 text-warning border-warning/30',
  'CONCLUÍDO': 'bg-success/15 text-success border-success/30',
  'CANCELADO': 'bg-muted text-muted-foreground border-border',
  'ATRASADO': 'bg-destructive/15 text-destructive border-destructive/30',
};

const fields = [
  { key: 'problema', label: 'Restrição / Problema', width: '20%' },
  { key: 'causa', label: 'Causa raiz', width: '15%' },
  { key: 'impacto', label: 'Impacto', width: '11%' },
  { key: 'atividade', label: 'Atividade', width: '11%' },
  { key: 'necessidade', label: 'Ação corretiva', width: '19%' },
  { key: 'responsavel', label: 'Responsável', width: '10%' },
  { key: 'prazo', label: 'Prazo', width: '7%' },
] as const;

const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const ActionsTable = () => {
  const { actions } = useCurrentProject();
  const { setActions, addAction, removeAction } = useProjectStore();

  const updateAction = (index: number, field: string, value: string) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const pendentes = actions.filter((a) => a.status !== 'CONCLUÍDO' && a.status !== 'CANCELADO').length;

  return (
    <div className="bg-card rounded-xl card-shadow border overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Pontos de Atenção</h3>
          <p className="text-xs text-muted-foreground">
            {actions.length === 0
              ? 'Restrições e ações corretivas'
              : `${actions.length} registro(s) · ${pendentes} em aberto`}
          </p>
        </div>
        <button
          onClick={addAction}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-6">
          <ClipboardList className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum ponto de atenção registrado</p>
          <p className="text-xs text-muted-foreground/70">Use “Adicionar” para incluir restrições e ações corretivas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '44px' }} />
              {fields.map((f) => (
                <col key={f.key} style={{ width: f.width }} />
              ))}
              <col style={{ width: '120px' }} />
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                {fields.map((f) => (
                  <th key={f.key} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => (
                <tr key={i} className="border-b border-border/60 align-top hover:bg-muted/30 transition-colors group">
                  <td className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground pt-3.5">
                    {String(a.id).padStart(2, '0')}
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className="px-1.5 py-1.5">
                      <textarea
                        className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary outline-none px-2 py-1.5 text-xs rounded-md resize-none overflow-hidden leading-relaxed transition-colors"
                        style={{ minHeight: 32 }}
                        value={String((a as unknown as Record<string, unknown>)[f.key] ?? '')}
                        onChange={(e) => {
                          updateAction(i, f.key, e.target.value);
                          autoGrow(e.target);
                        }}
                        onFocus={(e) => autoGrow(e.target)}
                        placeholder="—"
                        rows={1}
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5">
                    <select
                      className={`w-full text-[11px] font-semibold px-2 py-1.5 rounded-md border outline-none cursor-pointer ${
                        a.status ? statusColors[a.status] : 'bg-transparent border-border text-muted-foreground'
                      }`}
                      value={a.status || ''}
                      onChange={(e) => updateAction(i, 'status', e.target.value)}
                    >
                      <option value="">—</option>
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      onClick={() => removeAction(i)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
