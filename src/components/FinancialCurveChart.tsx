import { useCurrentProject } from '@/store/projectStore';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartExpandModal from '@/components/ChartExpandModal';
import ChartInsight from '@/components/ChartInsight';
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Label,
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

const FinancialCurveChart = () => {
  const { curvaSFinanceira, sCurveData, statusDateIndex, info } = useCurrentProject();
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    return (curvaSFinanceira || []).map((p) => ({
      mes: fmtMonth(p.date),
      date: p.date,
      previstoMensal: p.previsto > 0 ? p.previsto : undefined,
      realMensal: p.real != null && p.real > 0 ? p.real : undefined,
      prevAcum: p.prevAcum > 0 ? p.prevAcum : undefined,
      realAcum: p.realAcum != null && p.realAcum > 0 ? p.realAcum : undefined,
    }));
  }, [curvaSFinanceira]);

  const lastIdx = useMemo(() => {
    const find = (key: 'prevAcum' | 'realAcum') => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        if ((chartData[i] as any)[key] != null) return i;
      }
      return -1;
    };
    return { prevAcum: find('prevAcum'), realAcum: find('realAcum') };
  }, [chartData]);

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

  const statusRealAcum = useMemo(() => {
    if (!statusMes) return null;
    const hit = chartData.find((p) => p.mes === statusMes);
    return hit?.realAcum ?? null;
  }, [statusMes, chartData]);

  if (!curvaSFinanceira || curvaSFinanceira.length === 0) return null;

  const COLORS = {
    prev: 'hsl(var(--chart-previsto))',
    real: '#16a34a',
  };

  const labelInterval = isMobile ? 3 : (chartData.length > 14 ? 2 : 1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload ?? {};
    const prev = row.prevAcum;
    const real = row.realAcum;
    const desvioR = prev != null && real != null ? real - prev : null;
    const desvioP = prev != null && real != null && prev !== 0 ? ((real - prev) / prev) * 100 : null;
    return (
      <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-xl">
        <div className="font-semibold text-foreground mb-1">{label}</div>
        <div className="flex justify-between gap-4">
          <span style={{ color: COLORS.prev }}>Previsto Acum.</span>
          <span className="font-mono">{fmtBRLFull(prev)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: COLORS.real }}>Realizado Acum.</span>
          <span className="font-mono">{fmtBRLFull(real)}</span>
        </div>
        <div className="mt-1 pt-1 border-t border-border flex justify-between gap-4">
          <span className="text-muted-foreground">Desvio R$</span>
          <span className="font-mono">{desvioR != null ? fmtBRLFull(desvioR) : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Desvio %</span>
          <span className="font-mono">{desvioP != null ? `${desvioP.toFixed(2).replace('.', ',')}%` : '—'}</span>
        </div>
      </div>
    );
  };

  const makeEndLabel = (key: 'prevAcum' | 'realAcum', color: string, position: 'top' | 'bottom') =>
    (props: any) => {
      const { x, y, value, index } = props;
      if (value == null || x == null || y == null) return null;
      if (index !== lastIdx[key]) return null;
      const mes = chartData[index]?.mes ?? '';
      const dy = position === 'top' ? -10 : 16;
      return (
        <text x={x} y={y + dy} fill={color} fontSize={11} fontWeight={700} textAnchor="end">
          {`${fmtBRLShort(value)} · ${mes}`}
        </text>
      );
    };

  const chartContent = (height: string) => (
    <div className={height} style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 30, right: 60, bottom: 10, left: 10 }}>
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
            tickFormatter={(v) => fmtBRLShort(v)}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {statusMes && (
            <ReferenceLine
              x={statusMes}
              stroke="hsl(var(--chart-cutline))"
              strokeDasharray="8 4"
              strokeWidth={2}
            >
              <Label
                value={`Status: ${statusMes}${statusRealAcum != null ? ` — ${fmtBRLShort(statusRealAcum)}` : ''}`}
                position="insideTopRight"
                fill="hsl(var(--chart-cutline))"
                fontSize={11}
                fontWeight="bold"
                offset={8}
              />
            </ReferenceLine>
          )}
          <Line
            type="monotone" dataKey="prevAcum" name="Previsto Acumulado"
            stroke={COLORS.prev} strokeWidth={2} dot={false} activeDot={{ r: 5 }}
            connectNulls={false} isAnimationActive={false}
            label={makeEndLabel('prevAcum', COLORS.prev, 'top')}
          />
          <Line
            type="monotone" dataKey="realAcum" name="Realizado Acumulado"
            stroke={COLORS.real} strokeWidth={2} dot={false} activeDot={{ r: 5 }}
            connectNulls={false} isAnimationActive={false}
            label={makeEndLabel('realAcum', COLORS.real, 'bottom')}
          />
        </LineChart>
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
      {chartContent('h-[280px] sm:h-[500px]')}
      <ChartInsight chartType="financialcurve" data={curvaSFinanceira} projectInfo={info} />
    </div>
  );
};

export default FinancialCurveChart;
