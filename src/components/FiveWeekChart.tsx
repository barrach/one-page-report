import { useMemo } from 'react';
import { useCurrentProject, type WeekData } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { centerWeeklyWindow } from '@/lib/dateUtils';
import ChartInsight from '@/components/ChartInsight';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';

const r2 = (n: number) => Math.round(n * 100) / 100;

const FiveWeekChart = () => {
  const { weeklyData: allWeeklyData, sCurveData, info } = useCurrentProject();
  const { selectedDate, setSelectedDate } = useReportInteraction();

  // Quando o projeto não tem série semanal importada, deriva o resultado da
  // semana a partir da Curva S (semanal = delta do acumulado).
  const sourceWeekly = useMemo<WeekData[]>(() => {
    const hasWeekly = (allWeeklyData ?? []).some(w => w.date && ((w.previsto ?? 0) > 0 || (w.real ?? 0) > 0));
    if (hasWeekly) return allWeeklyData;

    const getPrevAcum = (p: typeof sCurveData[number]) =>
      (p.replanejado ?? 0) > 0 ? (p.replanejado ?? 0) : (p.previsto ?? 0);
    const getRealAcum = (p: typeof sCurveData[number]) =>
      (p.realReplanejado ?? 0) > 0 ? (p.realReplanejado ?? 0) : (p.real ?? 0);

    const out: WeekData[] = [];
    let lastPrev = 0;
    let lastReal = 0;
    for (const p of sCurveData ?? []) {
      if (!p?.date) continue;
      const accPrev = getPrevAcum(p);
      const accReal = getRealAcum(p);
      if (accPrev <= 0 && accReal <= 0) continue;
      out.push({
        date: p.date,
        // max(0, …) protege a virada de linha de base → replanejado, que faz o
        // acumulado "andar para trás" e geraria delta negativo.
        previsto: accPrev > 0 ? r2(Math.max(0, accPrev - lastPrev)) : 0,
        real: accReal > 0 ? r2(Math.max(0, accReal - lastReal)) : 0,
      });
      if (accPrev > 0) lastPrev = accPrev;
      if (accReal > 0) lastReal = accReal;
    }
    return out;
  }, [allWeeklyData, sCurveData]);

  const weeklyData = useMemo(
    () => centerWeeklyWindow(sourceWeekly, info?.atualizadoEm || '', 5),
    [sourceWeekly, info?.atualizadoEm],
  );

  const hasTendencia = weeklyData.some(w => (w.tendencia ?? 0) > 0);
  const statusDate = weeklyData.find(w => w.isStatus)?.date ?? null;

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'fiveweek');
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Visão de 5 Semanas</h3>
      <p className="text-xs text-muted-foreground mb-4">Resultado semanal previsto × real{hasTendencia ? ' × tendência' : ''}</p>
      <div className="h-[240px] sm:h-[380px]">
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

            {/* Status week marker (semana de referência — centro da janela) */}
            {statusDate && (
              <ReferenceLine
                x={statusDate}
                stroke="hsl(var(--chart-cutline))"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: '★', position: 'top', fontSize: 12, fill: 'hsl(var(--chart-cutline))' }}
              />
            )}

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
            {hasTendencia && (
              <Bar dataKey="tendencia" name="Tendência" radius={[4, 4, 0, 0]} fill="#f97316">
                <LabelList dataKey="tendencia" position="top" fontSize={11} fill="#f97316" formatter={(v: number) => v > 0 ? `${v}%` : ''} />
                {weeklyData.map((entry, i) => (
                  <Cell key={i}
                    fill={selectedDate === null || selectedDate === entry.date
                      ? '#f97316'
                      : '#f9731640'}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartInsight chartType="fiveweek" data={weeklyData} projectInfo={info} />
    </div>
  );
};

export default FiveWeekChart;
