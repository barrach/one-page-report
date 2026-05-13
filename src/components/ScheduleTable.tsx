import { useCurrentProject } from '@/store/projectStore';

const fmtPct = (n: number) => Math.round(n).toString();

const fmtDesvio = (n: number) => {
  if (!n) return '0';
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2).replace('.', ',');
  return n < 0 ? `-${str}` : str;
};

const ScheduleTable = () => {
  const { scheduleData } = useCurrentProject();

  const data = (scheduleData || []).filter(r => r.tarefa);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
        <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Cronograma</h3>
        <p className="text-xs text-muted-foreground text-center py-8">
          Nenhum dado de cronograma. Adicione dados na aba Dados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Cronograma</h3>
      <p className="text-xs text-muted-foreground mb-4">Status das atividades planejadas</p>
      <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-2 py-2 text-center w-16 rounded-tl-lg border border-border/30">+</th>
              <th className="px-2 py-2 text-center w-12 border border-border/30">Id</th>
              <th className="px-2 py-2 text-left border border-border/30 min-w-[220px]">Nome da Tarefa</th>
              <th className="px-2 py-2 text-center border border-border/30 w-20">Prev. %</th>
              <th className="px-2 py-2 text-center border border-border/30 w-20">% Trab.</th>
              <th className="px-2 py-2 text-center border border-border/30 w-20">Desvio</th>
              <th className="px-2 py-2 text-center border border-border/30 w-28">Início</th>
              <th className="px-2 py-2 text-center border border-border/30 w-28">Término</th>
              <th className="px-2 py-2 text-center border border-border/30 w-28">Início Base</th>
              <th className="px-2 py-2 text-center border border-border/30 w-28 rounded-tr-lg">Término Base</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const level = row.outlineLevel ?? 1;
              const isMilestone = !!row.milestone && !row.summary;
              const indentPx = Math.min(level - 1, 4) * 16;

              let rowStyle: React.CSSProperties = {};
              let rowClass = '';
              let nameClass = '';
              if (level === 1) {
                rowStyle = { backgroundColor: '#1a2f4e', color: '#ffffff' };
                nameClass = 'font-bold';
              } else if (level === 2) {
                rowStyle = { backgroundColor: '#f0f4f8' };
                nameClass = 'font-bold';
              } else if (level === 3) {
                rowClass = 'bg-card';
              } else if (level === 4) {
                rowClass = 'bg-card text-muted-foreground';
                nameClass = 'text-[0.9em]';
              } else {
                rowClass = 'bg-card text-muted-foreground';
                nameClass = 'text-[0.85em]';
              }

              const desvioColor =
                row.desvio < 0 ? 'text-destructive' :
                row.desvio > 0 ? 'text-success' :
                'text-muted-foreground';

              const baselineMissingClass = (v: string) =>
                v === 'ND' ? 'italic text-muted-foreground' : '';

              return (
                <tr
                  key={i}
                  style={rowStyle}
                  className={`border-b border-border/30 ${rowClass} ${row.highlight ? 'ring-1 ring-warning/40 ring-inset' : ''}`}
                >
                  <td className="px-2 py-1.5 text-center border border-border/30 font-mono text-[10px] opacity-80">{row.outlineNumber || ''}</td>
                  <td className="px-2 py-1.5 text-center border border-border/30 opacity-80">{row.id}</td>
                  <td className={`px-2 py-1.5 border border-border/30 ${nameClass}`}>
                    <span style={{ paddingLeft: `${indentPx}px` }} className="inline-block">
                      {isMilestone && <span className="mr-1">🔷</span>}
                      {row.tarefa}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 ${nameClass}`}>{fmtPct(row.previsto)}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 ${nameClass}`}>{fmtPct(row.trabalhoConcluido)}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 font-semibold ${desvioColor}`}>
                    {fmtDesvio(row.desvio)}
                  </td>
                  <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.inicio}</td>
                  <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.termino}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 whitespace-nowrap ${baselineMissingClass(row.inicioBase)}`}>{row.inicioBase}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 whitespace-nowrap ${baselineMissingClass(row.terminoBase)}`}>{row.terminoBase}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;
