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
  const hasReplanejado = sCurveData.some(p => (p.replanejado ?? 0) > 0);
  const legendPayload = [
    { value: 'Linha de base', type: 'line' as const, id: 'previsto', color: 'hsl(var(--chart-previsto))' },
    { value: 'Real', type: 'line' as const, id: 'real', color: 'hsl(var(--chart-real))' },
    { value: 'Tendência', type: 'line' as const, id: 'tendencia', color: 'hsl(var(--chart-tendencia))' },
    ...(hasReplanejado ? [{ value: 'Replanejado', type: 'line' as const, id: 'replanejado', color: '#8b5cf6' }] : []),
  ];

  const chartData = useMemo(() => {
    return sCurveData.map((point) => ({
      ...point,
      previsto: point.previsto > 0 ? point.previsto : undefined,
      real: point.real > 0 ? point.real : undefined,
      tendencia: point.tendencia > 0 ? point.tendencia : undefined,
      replanejado: (point.replanejado ?? 0) > 0 ? point.replanejado : undefined,
    }));
  }, [sCurveData]);

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'scurve');
  };

  const createDot = (color: string, baseR = 3) => (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isSelected = selectedDate === payload?.date;
    return (
      <circle
        cx={cx} cy={cy}
        r={isSelected ? 6 : baseR}
        fill={color}
        stroke={isSelected ? 'hsl(var(--foreground))' : 'none'}
        strokeWidth={isSelected ? 2 : 0}
        style={{ filter: isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' : 'none' }}
      />
    );
  };

  // Highlighted dot for tendência (so a single point is clearly visible)
  const tendenciaDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isSelected = selectedDate === payload?.date;
    return (
      <circle
        cx={cx} cy={cy}
        r={isSelected ? 7 : 5}
        fill="hsl(var(--chart-tendencia))"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.25))' }}
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
            tickFormatter={(value, index) => (index % 4 === 0 ? String(value) : '')}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            minTickGap={12}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            domain={[0, 100]}
            min={0}
            max={100}
            ticks={[0, 20, 40, 60, 80, 100]}
            allowDataOverflow={false}
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
          <Legend payload={legendPayload} />

          {statusDate && (
            <ReferenceLine
              x={statusDate}
              stroke="hsl(var(--chart-cutline))"
              strokeDasharray="8 4"
              strokeWidth={2}
            >
              <Label
                value={`Status: ${statusDate}`}
                position="insideTopRight"
                fill="hsl(var(--chart-cutline))"
                fontSize={11}
                fontWeight="bold"
                offset={8}
              />
            </ReferenceLine>
          )}

          {selectedDate && sCurveData.some(p => p.date === selectedDate) && (
            <ReferenceLine x={selectedDate} stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.5} />
          )}

          <Line type="monotone" dataKey="previsto" name="Linha de base"
            stroke="hsl(var(--chart-previsto))" strokeWidth={2.5}
            dot={createDot('hsl(var(--chart-previsto))')} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="real" name="Real"
            stroke="hsl(var(--chart-real))" strokeWidth={2.5}
            dot={createDot('hsl(var(--chart-real))')} activeDot={{ r: 5 }} connectNulls={false} />
          <Line type="monotone" dataKey="tendencia" name="Tendência"
            stroke="hsl(var(--chart-tendencia))" strokeWidth={2.5} strokeDasharray="6 4"
            dot={tendenciaDot} activeDot={{ r: 7 }} connectNulls={false} isAnimationActive={false} />
          {hasReplanejado && (
            <Line type="monotone" dataKey="replanejado" name="Replanejado"
              stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="4 4"
              dot={createDot('#8b5cf6')} activeDot={{ r: 5 }} connectNulls={false} />
          )}
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
