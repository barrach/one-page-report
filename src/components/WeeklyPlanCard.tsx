import { useMemo } from 'react';
import { Plus, Trash2, CalendarCheck } from 'lucide-react';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';

const WeeklyPlanCard = () => {
  const current = useCurrentProject();
  const tasks = current?.weeklyPlan ?? [];
  const setWeeklyPlan = useProjectStore((s) => s.setWeeklyPlan);
  const addTask = useProjectStore((s) => s.addWeeklyPlanTask);
  const removeTask = useProjectStore((s) => s.removeWeeklyPlanTask);

  const { total, done, ppc } = useMemo(() => {
    const valid = tasks.filter((t) => t.tarefa.trim() !== '');
    const d = valid.filter((t) => t.concluida).length;
    return { total: valid.length, done: d, ppc: valid.length ? (d / valid.length) * 100 : 0 };
  }, [tasks]);

  const update = (index: number, patch: Partial<(typeof tasks)[number]>) => {
    setWeeklyPlan(tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const ppcColor = ppc >= 85 ? 'text-chart-real' : ppc >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Programação Semanal</h3>
          <p className="text-xs text-muted-foreground">Tarefas programadas × concluídas (PPC)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold leading-none ${ppcColor}`}>{ppc.toFixed(0)}%</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">PPC · {done}/{total}</div>
          </div>
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-chart-real transition-all"
          style={{ width: `${Math.min(ppc, 100)}%` }}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <CalendarCheck className="h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa programada</p>
          <p className="text-xs text-muted-foreground/80">Use “Adicionar” para montar a programação da semana.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 w-8">#</th>
                <th className="py-2">Tarefa</th>
                <th className="py-2 w-32">Responsável</th>
                <th className="py-2 w-20 text-center">Concluída</th>
                <th className="py-2 w-40">Motivo (se não)</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="py-2 text-muted-foreground">{String(i + 1).padStart(2, '0')}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={t.tarefa}
                      onChange={(e) => update(i, { tarefa: e.target.value })}
                      placeholder="Descrição da tarefa"
                      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={t.responsavel}
                      onChange={(e) => update(i, { responsavel: e.target.value })}
                      placeholder="Responsável"
                      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1"
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={t.concluida}
                      onChange={(e) => update(i, { concluida: e.target.checked })}
                      className="h-4 w-4 accent-[hsl(var(--chart-real))] cursor-pointer"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={t.motivo}
                      onChange={(e) => update(i, { motivo: e.target.value })}
                      disabled={t.concluida}
                      placeholder={t.concluida ? '—' : 'Motivo do não cumprimento'}
                      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-1 disabled:opacity-40"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => removeTask(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Remover tarefa"
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

export default WeeklyPlanCard;
