import { useCurrentProject } from '@/store/projectStore';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartExpandModal from '@/components/ChartExpandModal';
import ChartInsight from '@/components/ChartInsight';
import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Label, LabelList,
} from 'recharts';

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const fmtMonth = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
};

const fmtBRLShort = (v: number | null | undefined): string => {
  if (v == null || !isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const fmtBRLFull = (v: number | null | undefined): string =>
  v == null || !isFinite(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const COLORS = {
  prevBar: '#9ca3af',
  realBar: '#22c55e',
  prevLine: '#1f2937',
  realLine: '#f97316',
};

const FinancialCurveChart = () => {
  const { curvaSFinanceira, sCurveData, statusDateIndex, info } = useCurrentProject();
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    return (curvaSFinanceira || []).map((p) => ({
      mes: fmtMonth(p.date),
      date: p.date,
      previstoMensal: p.previsto > 0 ? p.previsto : null,
      realMensal: p.real != null && p.real > 0 ? p.real : null,
      prevAcum: p.prevAcum > 0 ? p.prevAcum : null,
      realAcum: p.realAcum != null && p.realAcum > 0 ? p.realAcum : null,
    }));
  }, [curvaSFinanceira]);

  const roundUpToNice = (value: number): number => {
    if (value <= 0) return 10000;
    const step =
      value < 100_000 ? 10_000 :
      value < 1_000_000 ? 100_000 :
      value < 10_000_000 ? 500_000 :
      value < 100_000_000 ? 5_000_000 :
      10_000_000;
    return Math.ceil(value / step) * step;
  };

  const { leftMax, rightMax, LEFT_TICKS, RIGHT_TICKS } = useMemo(() => {
    const maxMensal = Math.max(0, ...chartData.map(d => d.previstoMensal ?? 0), ...chartData.map(d => d.realMensal ?? 0));
    const maxAcum = Math.max(0, ...chartData.map(d => d.prevAcum ?? 0), ...chartData.map(d => d.realAcum ?? 0));
    const lMax = roundUpToNice(maxMensal * 1.2) || 100_000;
    const rMax = roundUpToNice(maxAcum * 1.1) || 1_000_000;
    const ticks = (max: number) => Array.from({ length: 6 }, (_, i) => Math.round((max / 5) * i));
    return { leftMax: lMax, rightMax: rMax, LEFT_TICKS: ticks(lMax), RIGHT_TICKS: ticks(rMax) };
  }, [chartData]);

  const fmtTickLeft = (v: number) => fmtBRLShort(v);
  const fmtTickRight = (v: number) => (v === 0 ? 'R$ -' : fmtBRLShort(v));


  const statusMes = useMemo(() => {
    const cut = Math.min(statusDateIndex, (sCurveData?.length || 1) - 1);
    const sd = sCurveData?.[cut]?.date;
    if (!sd) return null;
    const d = new Date(sd + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const hit = chartData.find((p) => p.date?.startsWith(target));
    return hit?.mes ?? null;
  }, [sCurveData, statusDateIndex, chartData]);

  if (!curvaSFinanceira || curvaSFinanceira.length === 0) return null;

  const labelInterval = isMobile ? 3 : (chartData.length > 14 ? 2 : 1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload ?? {};
    const { previstoMensal, realMensal, prevAcum, realAcum } = row;
    const desvioR = prevAcum != null && realAcum != null ? realAcum - prevAcum : null;
    const desvioP = prevAcum != null && realAcum != null && prevAcum !== 0 ? ((realAcum - prevAcum) / prevAcum) * 100 : null;
    return (
      <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-xl">
        <div className="font-semibold text-foreground mb-1">{label}</div>
        <div className="flex justify-between gap-4">
          <span style={{ color: COLORS.prevBar }}>Previsto mensal</span>
          <span className="font-mono">{fmtBRLFull(previstoMensal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: COLORS.realBar }}>Real mensal</span>
          <span className="font-mono">{fmtBRLFull(realMensal)}</span>
        </div>
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-border">
          <span style={{ color: COLORS.prevLine }}>Previsto Acum.</span>
          <span className="font-mono">{fmtBRLFull(prevAcum)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: COLORS.realLine }}>Realizado Acum.</span>
          <span className="font-mono">{fmtBRLFull(realAcum)}</span>
        </div>
        <div className="mt-1 pt-1 border-t border-border flex justify-between gap-4">
          <span className="text-muted-foreground">Desvio acum. R$</span>
          <span className="font-mono">{desvioR != null ? fmtBRLFull(desvioR) : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Desvio acum. %</span>
          <span className="font-mono">{desvioP != null ? `${desvioP.toFixed(2).replace('.', ',')}%` : '—'}</span>
        </div>
      </div>
    );
  };

  const chartContent = (height: string) => (
    <div className={height} style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 30, right: 70, bottom: 10, left: 10 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tickFormatter={(v, i) => (i % labelInterval === 0 ? String(v) : '')}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            domain={[0, 600000]}
            ticks={LEFT_TICKS}
            tickFormatter={fmtTickLeft}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={100}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 140000000]}
            ticks={RIGHT_TICKS}
            tickFormatter={fmtTickRight}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={130}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {statusMes && (
            <ReferenceLine
              yAxisId="left"
              x={statusMes}
              stroke="hsl(var(--chart-cutline))"
              strokeDasharray="8 4"
              strokeWidth={2}
            >
              <Label
                value={`Status: ${statusMes}`}
                position="insideTopRight"
                fill="hsl(var(--chart-cutline))"
                fontSize={11}
                fontWeight="bold"
                offset={8}
              />
            </ReferenceLine>
          )}
          <Bar yAxisId="left" dataKey="previstoMensal" name="Medição Prevista (R$)" fill={COLORS.prevBar} isAnimationActive={false}>
            <LabelList dataKey="previstoMensal" position="top" fontSize={9} fill={COLORS.prevBar} formatter={(v: number) => fmtBRLFull(v)} />
          </Bar>
          <Bar yAxisId="left" dataKey="realMensal" name="Medição Real (R$)" fill={COLORS.realBar} isAnimationActive={false}>
            <LabelList dataKey="realMensal" position="top" fontSize={9} fill={COLORS.realBar} formatter={(v: number) => fmtBRLFull(v)} />
          </Bar>
          <Line
            yAxisId="right" type="monotone" dataKey="prevAcum" name="Medição Prevista Acumulada (R$)"
            stroke={COLORS.prevLine} strokeWidth={2} dot={{ r: 3, fill: COLORS.prevLine }}
            connectNulls={false} isAnimationActive={false}
          >
            <LabelList dataKey="prevAcum" position="top" fontSize={9} fill={COLORS.prevLine} formatter={(v: number) => fmtBRLFull(v)} />
          </Line>
          <Line
            yAxisId="right" type="monotone" dataKey="realAcum" name="Medição Real Acumulada (R$)"
            stroke={COLORS.realLine} strokeWidth={2} dot={{ r: 3, fill: COLORS.realLine }}
            connectNulls={false} isAnimationActive={false}
          >
            <LabelList dataKey="realAcum" position="bottom" fontSize={9} fill={COLORS.realLine} formatter={(v: number) => fmtBRLFull(v)} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">CURVA S FINANCEIRA</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-600 text-white">R$</span>
        </div>
        <ChartExpandModal
          title="CURVA S FINANCEIRA"
          subtitle="Medição prevista × realizada acumulada (R$)"
          expandedHeight="h-full"
        >
          {chartContent('h-full')}
        </ChartExpandModal>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Medição prevista × realizada acumulada (R$)</p>
      {chartContent('h-[320px] sm:h-[520px]')}
      <ChartInsight chartType="financialcurve" data={curvaSFinanceira} projectInfo={info} />
    </div>
  );
};

export default FinancialCurveChart;
