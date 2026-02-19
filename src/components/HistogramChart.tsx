import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import ChartInsight from '@/components/ChartInsight';
import ChartExpandModal from '@/components/ChartExpandModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Cell, ReferenceLine,
} from 'recharts';

const HistogramChart = () => {
  const { histogramData, info } = useCurrentProject();
  const { selectedDate, setSelectedDate } = useReportInteraction();

  const data = (histogramData || []).filter(h => h.date);

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'histogram');
  };

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
        <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Histograma MOD</h3>
        <p className="text-xs text-muted-foreground">Nenhum dado de histograma. Adicione dados na aba Dados.</p>
      </div>
    );
  }

  const chartContent = (height: string) => (
    <div className={height} style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [value, name === 'previsto' ? 'MOD Previsto' : 'MOD Real']}
            labelFormatter={(label) => {
              const item = data.find(d => d.date === label);
              return `${label}${item?.semana ? ` (Sem. ${item.semana})` : ''}`;
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 12 }}>
                {value === 'previsto' ? 'MOD Prevista' : 'MOD Real'}
              </span>
            )}
            wrapperStyle={{ paddingTop: 8 }}
            content={({ payload }) => (
              <div className="flex gap-4 justify-center pt-2">
                {(payload || []).map((entry, i) => {
                  const isReal = entry.dataKey === 'real';
                  const color = isReal
                    ? 'hsl(var(--chart-real))'
                    : 'hsl(var(--chart-previsto))';
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground">
                        {isReal ? 'MOD Real' : 'MOD Prevista'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          />

          {selectedDate && data.some(d => d.date === selectedDate) && (
            <ReferenceLine x={selectedDate} stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.5} />
          )}

          <Bar dataKey="previsto" name="previsto" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="previsto" position="top" fontSize={9} fill="hsl(var(--chart-previsto))" />
            {data.map((entry, i) => (
              <Cell key={i}
                fill={selectedDate === null || selectedDate === entry.date
                  ? 'hsl(var(--chart-previsto))'
                  : 'hsl(var(--chart-previsto) / 0.3)'}
              />
            ))}
          </Bar>
          <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="real" position="top" fontSize={9} fill="hsl(var(--chart-real))" formatter={(v: number) => v > 0 ? v : ''} />
            {data.map((entry, i) => (
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
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Histograma MOD</h3>
        <ChartExpandModal
          title="Histograma MOD"
          subtitle="Mão de obra prevista × real por período"
          expandedHeight="h-full"
        >
          {chartContent('h-full')}
        </ChartExpandModal>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Mão de obra prevista × real por período</p>
      {chartContent('h-[250px] sm:h-[320px]')}
      <ChartInsight chartType="histogram" data={data} projectInfo={info} />
    </div>
  );
};

export default HistogramChart;

