import { useCurrentProject } from '@/store/projectStore';
import { useTvMode } from '@/hooks/use-tv-mode';
import { useReportInteraction } from '@/store/reportInteraction';
import { useIsMobile } from '@/hooks/use-mobile';
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

const fmtPct = (v: number | null | undefined) =>
  v == null ? '' : `${v.toFixed(2).replace('.', ',')}%`;

const SCurveChart = () => {
  const { sCurveData, statusDateIndex, info } = useCurrentProject();
  const { tvMode } = useTvMode();
  const { selectedDate, setSelectedDate } = useReportInteraction();
  const isMobile = useIsMobile();
  const labelInterval = isMobile ? 6 : 3;
  const labelFontSize = isMobile ? 9 : 11;

  const cutIndex = Math.min(statusDateIndex, sCurveData.length - 1);
  const statusDate = sCurveData[cutIndex]?.date || null;
  // Real no status: prefere Real Replanejado (row16) quando > 0, senão Real (row12).
  // Usa checagem > 0 (não ??) porque real=0 nas semanas replanejadas.
  const statusReal = (() => {
    const p = sCurveData[cutIndex];
    if (!p) return null;
    if ((p.realReplanejado ?? 0) > 0) return p.realReplanejado!;
    if (p.real > 0) return p.real;
    return null;
  })();
  const hasReplanejado = sCurveData.some(p => (p.replanejado ?? 0) > 0);
  const hasRealReplanejado = sCurveData.some(p => (p.realReplanejado ?? 0) > 0);

  const COLORS = {
    previsto: 'hsl(var(--chart-previsto))', // azul escuro
    real: '#16a34a',                        // verde médio
    tendencia: '#f97316',                   // laranja
    replanejado: '#60a5fa',                 // azul claro — "Prev. Replanejado"
    realReplanejado: '#15803d',             // verde escuro — "Real Replanejado"
  };

  const legendPayload = [
    { value: 'Linha de base', type: 'line' as const, id: 'previsto', color: COLORS.previsto },
    { value: 'Real', type: 'line' as const, id: 'real', color: COLORS.real },
    ...(hasReplanejado ? [{ value: 'Prev. Replanejado', type: 'line' as const, id: 'replanejado', color: COLORS.replanejado }] : []),
    ...(hasRealReplanejado ? [{ value: 'Real Replanejado', type: 'line' as const, id: 'realReplanejado', color: COLORS.realReplanejado }] : []),
    { value: 'Tendência', type: 'line' as const, id: 'tendencia', color: COLORS.tendencia },
  ];

  const chartData = useMemo(() => {
    return sCurveData.map((point) => ({
      ...point,
      previsto: point.previsto > 0 ? point.previsto : undefined,
      real: point.real > 0 ? point.real : undefined,
      tendencia: point.tendencia > 0 ? point.tendencia : undefined,
      replanejado: (point.replanejado ?? 0) > 0 ? point.replanejado : undefined,
      realReplanejado: (point.realReplanejado ?? 0) > 0 ? point.realReplanejado : undefined,
    }));
  }, [sCurveData]);

  // Find last index with a value for each series
  const lastIdx = useMemo(() => {
    const find = (key: 'previsto' | 'real' | 'tendencia' | 'replanejado' | 'realReplanejado') => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        if ((chartData[i] as any)[key] != null) return i;
      }
      return -1;
    };
    return {
      previsto: find('previsto'),
      real: find('real'),
      tendencia: find('tendencia'),
      replanejado: find('replanejado'),
      realReplanejado: find('realReplanejado'),
    };
  }, [chartData]);

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'scurve');
  };

  // Label renderer factory
  const makeLabel = (
    seriesKey: 'previsto' | 'real' | 'tendencia' | 'replanejado' | 'realReplanejado',
    color: string,
    position: 'top' | 'bottom',
  ) => (props: any) => {
    const { x, y, value, index } = props;
    if (value == null || x == null || y == null) return null;
    const isLast = index === lastIdx[seriesKey];
    const showInterval = index % labelInterval === 0;
    if (!isLast && !showInterval) return null;
    const dy = position === 'top' ? -8 : 14;
    return (
      <text
        x={x}
        y={y + dy}
        fill={color}
        fontSize={labelFontSize}
        fontWeight={isLast ? 700 : 500}
        textAnchor="middle"
      >
        {fmtPct(value)}
      </text>
    );
  };

  const chartContent = (height: string) => (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 30, right: 40, bottom: 10, left: 10 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={(value, index) => (index % labelInterval === 0 ? String(value) : '')}
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
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            domain={[0, 100]}
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
            formatter={(value: number) => value != null ? fmtPct(value) : '—'}
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
                value={`Status: ${statusDate}${statusReal != null ? ` — ${fmtPct(statusReal)}` : ''}`}
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

          {/* Linha de base (azul escuro, sólida) — row10 SEM02–19 */}
          <Line type="monotone" dataKey="previsto" name="Linha de base"
            stroke={COLORS.previsto} strokeWidth={2}
            dot={false} activeDot={{ r: 5 }} connectNulls={false}
            label={makeLabel('previsto', COLORS.previsto, 'top')}
            isAnimationActive={false} />
          {/* Real (verde médio, sólida) — row12 SEM02–19 */}
          <Line type="monotone" dataKey="real" name="Real"
            stroke={COLORS.real} strokeWidth={2}
            dot={false} activeDot={{ r: 5 }} connectNulls={false}
            label={makeLabel('real', COLORS.real, 'bottom')}
            isAnimationActive={false} />
          {/* Prev. Replanejado (azul claro, tracejada) — row14 SEM23+ */}
          {hasReplanejado && (
            <Line type="monotone" dataKey="replanejado" name="Prev. Replanejado"
              stroke={COLORS.replanejado} strokeWidth={2} strokeDasharray="6 4"
              dot={false} activeDot={{ r: 5 }} connectNulls={false}
              label={makeLabel('replanejado', COLORS.replanejado, 'top')}
              isAnimationActive={false} />
          )}
          {/* Real Replanejado (verde escuro, sólida) — row12 completa */}
          {hasRealReplanejado && (
            <Line type="monotone" dataKey="realReplanejado" name="Real Replanejado"
              stroke={COLORS.realReplanejado} strokeWidth={2}
              dot={false} activeDot={{ r: 5 }} connectNulls={false}
              label={makeLabel('realReplanejado', COLORS.realReplanejado, 'bottom')}
              isAnimationActive={false} />
          )}
          {/* Tendência (laranja, tracejada) */}
          <Line type="monotone" dataKey="tendencia" name="Tendência"
            stroke={COLORS.tendencia} strokeWidth={2} strokeDasharray="6 3"
            dot={false} activeDot={{ r: 5 }} connectNulls={false}
            label={makeLabel('tendencia', COLORS.tendencia, 'bottom')}
            isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Curva "S"</h3>
        <ChartExpandModal
          title='Curva "S"'
          subtitle="Avanço acumulado previsto × real × tendência"
          expandedHeight="h-full"
        >
          {chartContent('h-full min-h-0')}
        </ChartExpandModal>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Avanço acumulado previsto × real × tendência</p>
      {/* Altura mínima como piso; a sobra da linha do grid é absorvida pelo flex-1.
          Na TV não há piso: o gráfico ocupa exatamente a altura disponível. */}
      {chartContent(tvMode ? 'flex-1 min-h-0' : 'flex-1 min-h-[280px] sm:min-h-[500px]')}
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
