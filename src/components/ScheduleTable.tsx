import { useCurrentProject } from '@/store/projectStore';

const fmtDateCell = (v: string) => {
  if (!v) return '';
  if (v === 'ND') return 'ND';
  return v;
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
              const isSummary = !!row.summary || level <= 2;
              const isMilestone = !!row.milestone;
              const indentPx = Math.max(0, (level - 1)) * 12;
              const fontSize = level >= 5 ? 'text-[9px]' : level >= 4 ? 'text-[10px]' : '';
              const bold = isSummary || row.bold;
              const rowBg = level === 1
                ? 'bg-primary/10'
                : level === 2
                  ? 'bg-muted/40'
                  : i % 2 === 0 ? '' : 'bg-table-row-alt';
              return (
                <tr
                  key={i}
                  className={`border-b border-border/30 ${rowBg} ${row.highlight ? 'bg-warning/15 ring-1 ring-warning/30 ring-inset' : ''}`}
                >
                  <td className="px-2 py-1.5 text-center border border-border/30 text-muted-foreground font-mono text-[10px]">{row.outlineNumber || ''}</td>
                  <td className="px-2 py-1.5 text-center border border-border/30 text-muted-foreground">{row.id}</td>
                  <td className={`px-2 py-1.5 border border-border/30 ${bold ? 'font-bold' : ''} ${fontSize}`}>
                    <span style={{ paddingLeft: `${indentPx}px` }} className="inline-block">
                      {isMilestone && <span className="mr-1">🔷</span>}
                      {row.tarefa}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 ${bold ? 'font-bold' : ''}`}>{row.previsto > 0 ? `${row.previsto.toFixed(2)}%` : '0%'}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 ${bold ? 'font-bold' : ''}`}>{row.trabalhoConcluido > 0 ? `${row.trabalhoConcluido}%` : '0%'}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 font-semibold ${row.desvio < 0 ? 'text-destructive' : row.desvio > 0 ? 'text-success' : ''}`}>
                    {row.desvio !== 0 ? row.desvio.toFixed(2) : '0'}
                  </td>
                  <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{fmtDateCell(row.inicio)}</td>
                  <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{fmtDateCell(row.termino)}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 whitespace-nowrap ${row.inicioBase === 'ND' ? 'text-muted-foreground italic' : ''}`}>{fmtDateCell(row.inicioBase)}</td>
                  <td className={`px-2 py-1.5 text-center border border-border/30 whitespace-nowrap ${row.terminoBase === 'ND' ? 'text-muted-foreground italic' : ''}`}>{fmtDateCell(row.terminoBase)}</td>
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
