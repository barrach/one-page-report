import { useMemo } from 'react';
import { useCurrentProject } from '@/store/projectStore';
import { centerWeeklyWindow } from '@/lib/dateUtils';

const WeeklyResultTable = () => {
  const { weeklyData: allWeeklyData, info } = useCurrentProject();
  const weeklyData = useMemo(
    () => centerWeeklyWindow(allWeeklyData, info?.atualizadoEm || '', 5),
    [allWeeklyData, info?.atualizadoEm],
  );

  const totalPrev = weeklyData.reduce((s, w) => s + w.previsto, 0);
  const totalReal = weeklyData.reduce((s, w) => s + w.real, 0);
  const totalAssert = totalPrev > 0 ? ((totalReal / totalPrev) * 100) : 0;

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Resultado Semanal</h3>
      <p className="text-xs text-muted-foreground mb-4">Assertividade por semana</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-3 py-2 text-left rounded-tl-lg">RESULTADO</th>
              {weeklyData.map((w, i) => (
                <th key={i} className="px-3 py-2 text-center">{w.date}</th>
              ))}
              <th className="px-3 py-2 text-center rounded-tr-lg">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-semibold text-muted-foreground">Previsto</td>
              {weeklyData.map((w, i) => (
                <td key={i} className="px-3 py-2 text-center">{w.previsto}</td>
              ))}
              <td className="px-3 py-2 text-center font-bold">{totalPrev.toFixed(2)}%</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2 font-semibold text-muted-foreground">Real</td>
              {weeklyData.map((w, i) => (
                <td key={i} className="px-3 py-2 text-center">{w.real}</td>
              ))}
              <td className="px-3 py-2 text-center font-bold">{totalReal.toFixed(2)}%</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold text-muted-foreground">% Assert.</td>
              {weeklyData.map((w, i) => {
                const val = w.previsto > 0 ? ((w.real / w.previsto) * 100) : 0;
                return (
                  <td key={i}
                    className={`px-3 py-2 text-center font-bold ${val > 100 ? 'text-success' : val > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {w.real > 0 ? `${val.toFixed(0)}%` : '—'}
                  </td>
                );
              })}
              <td className={`px-3 py-2 text-center font-bold ${totalAssert < 100 ? 'text-destructive' : 'text-success'}`}>
                {totalAssert.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WeeklyResultTable;
