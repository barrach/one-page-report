import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import ChartInsight from '@/components/ChartInsight';
import ChartExpandModal from '@/components/ChartExpandModal';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from 'recharts';

const SCurveChart = () => {
  const { sCurveData, statusDateIndex, info } = useCurrentProject();
  const { selectedDate, setSelectedDate } = useReportInteraction();

  const cutIndex = Math.min(statusDateIndex, sCurveData.length - 1);
  const statusDate = sCurveData[cutIndex]?.date || null;
  const statusReal = sCurveData[cutIndex]?.real || 0;

  const chartData = useMemo(() => {
    return sCurveData.map((point, i) => ({
      ...point,
      real: i <= cutIndex ? point.real : undefined,
      tendencia: i >= cutIndex ? point.tendencia : undefined,
    }));
  }, [sCurveData, cutIndex]);

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'scurve');
  };

  const createDot = (color: string) => (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isSelected = selectedDate === payload?.date;
    return (
      <circle
        cx={cx} cy={cy}
        r={isSelected ? 6 : 3}
        fill={color}
        stroke={isSelected ? 'hsl(var(--foreground))' : 'none'}
        strokeWidth={isSelected ? 2 : 0}
        style={{ filter: isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' : 'none' }}
      />
    );
  };

  const chartContent = (height: string) => (
    <div className={height} style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 30, right: 30, bottom: 10, left: 10 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => value != null ? `${value}%` : '—'}
          />
          <Legend />

          {statusDate && (
            <ReferenceLine
              x={statusDate}
              stroke="hsl(var(--chart-cutline))"
              strokeDasharray="8 4"
              strokeWidth={2}
            >
              <Label
                value={`Status: ${statusDate} — ${statusReal}%`}
                position="top"
                fill="hsl(var(--chart-cutline))"
                fontSize={11}
                fontWeight="bold"
                offset={10}
              />
            </ReferenceLine>
          )}

          {selectedDate && sCurveData.some(p => p.date === selectedDate) && (
            <ReferenceLine x={selectedDate} stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.5} />
          )}

          <Line type="monotone" dataKey="previsto" name="Previsto"
            stroke="hsl(var(--chart-previsto))" strokeWidth={2.5}
            dot={createDot('hsl(var(--chart-previsto))')} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="real" name="Real"
            stroke="hsl(var(--chart-real))" strokeWidth={2.5}
            dot={createDot('hsl(var(--chart-real))')} activeDot={{ r: 5 }} connectNulls={false} />
          <Line type="monotone" dataKey="tendencia" name="Tendência"
            stroke="hsl(var(--chart-tendencia))" strokeWidth={2.5} strokeDasharray="6 4"
            dot={createDot('hsl(var(--chart-tendencia))')} activeDot={{ r: 5 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Curva "S"</h3>
        <ChartExpandModal
          title='Curva "S"'
          subtitle="Avanço acumulado previsto × real × tendência"
          expandedHeight="h-full"
        >
          {chartContent('h-full')}
        </ChartExpandModal>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Avanço acumulado previsto × real × tendência</p>
      {chartContent('h-[280px] sm:h-[360px]')}
      {selectedDate && (
        <button
          onClick={() => useReportInteraction.getState().clearSelection()}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Limpar seleção: {selectedDate}
        </button>
      )}
      <ChartInsight chartType="scurve" data={sCurveData} projectInfo={info} />
    </div>
  );
};

export default SCurveChart;
