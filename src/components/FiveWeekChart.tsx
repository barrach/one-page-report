import { useMemo } from 'react';
import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { centerWeeklyWindow } from '@/lib/dateUtils';
import ChartInsight from '@/components/ChartInsight';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';

const FiveWeekChart = () => {
  const { weeklyData: allWeeklyData, sCurveData, info } = useCurrentProject();
  const { selectedDate, setSelectedDate } = useReportInteraction();

  // Fallback: derive weekly increments from the S-Curve when weeklyData is empty
  const sourceWeekly = useMemo(() => {
    const hasWeekly = Array.isArray(allWeeklyData) && allWeeklyData.some(
      (w: any) => w && (Number(w.previsto) > 0 || Number(w.real) > 0),
    );
    if (hasWeekly) return allWeeklyData;
    if (!Array.isArray(sCurveData) || sCurveData.length === 0) return allWeeklyData;

    const round = (n: number) => Math.round(n * 100) / 100;
    return sCurveData.map((p: any, i: number) => {
      const prev = i > 0 ? sCurveData[i - 1] : null;
      const dPrev = Number(p.previsto ?? 0) - Number(prev?.previsto ?? 0);
      const dReal = p.real === null || p.real === undefined
        ? 0
        : Number(p.real) - Number(prev?.real ?? 0);
      return {
        date: p.date,
        previsto: round(Math.max(dPrev, 0)),
        real: round(Math.max(dReal, 0)),
      };
    });
  }, [allWeeklyData, sCurveData]);

  const weeklyData = useMemo(
    () => centerWeeklyWindow(sourceWeekly, info?.atualizadoEm || '', 5),
    [sourceWeekly, info?.atualizadoEm],
  );


  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'fiveweek');
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Visão de 5 Semanas</h3>
      <p className="text-xs text-muted-foreground mb-4">Resultado semanal previsto × real</p>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData} onClick={handleClick} style={{ cursor: 'pointer' }} barCategoryGap="15%" barGap={4} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => `${value}%`}
            />
            <Legend />

            {selectedDate && weeklyData.some(w => w.date === selectedDate) && (
              <ReferenceLine x={selectedDate} stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.5} />
            )}

            <Bar dataKey="previsto" name="Previsto" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-previsto))">
              <LabelList dataKey="previsto" position="top" fontSize={11} fill="hsl(var(--chart-previsto))" formatter={(v: number) => v > 0 ? `${v}%` : ''} />
              {weeklyData.map((entry, i) => (
                <Cell key={i}
                  fill={selectedDate === null || selectedDate === entry.date
                    ? 'hsl(var(--chart-previsto))'
                    : 'hsl(var(--chart-previsto) / 0.3)'}
                />
              ))}
            </Bar>
            <Bar dataKey="real" name="Real" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-real))">
              <LabelList dataKey="real" position="top" fontSize={11} fill="hsl(var(--chart-real))" formatter={(v: number) => v > 0 ? `${v}%` : ''} />
              {weeklyData.map((entry, i) => (
                <Cell key={i}
                  fill={selectedDate === null || selectedDate === entry.date
                    ? 'hsl(var(--chart-real))'
                    : 'hsl(var(--chart-real) / 0.3)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartInsight chartType="fiveweek" data={weeklyData} projectInfo={info} />
    </div>
  );
};

export default FiveWeekChart;
