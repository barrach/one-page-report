import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import ChartInsight from '@/components/ChartInsight';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';

const FiveWeekChart = () => {
  const { weeklyData, info } = useCurrentProject();
  const { selectedDate, setSelectedDate } = useReportInteraction();

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'fiveweek');
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Visão de 5 Semanas</h3>
      <p className="text-xs text-muted-foreground mb-4">Resultado semanal previsto × real</p>
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
