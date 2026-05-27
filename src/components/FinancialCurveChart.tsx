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

const fmtBRL = (v: number): string => {
  if (v == null || !isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v.toFixed(0)}`;
};
const fmtBRLFull = (v: number): string =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const FinancialCurveChart = () => {
  const { curvaSFinanceira, sCurveData, statusDateIndex, info } = useCurrentProject();
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    return (curvaSFinanceira || []).map((p) => ({
      mes: fmtMonth(p.date),
      date: p.date,
      prevAcum: p.prevAcum > 0 ? p.prevAcum : undefined,
      realAcum: p.realAcum > 0 ? p.realAcum : undefined,
    }));
  }, [curvaSFinanceira]);

  // Match status date (from sCurve) to a financial month bucket
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

  const COLORS = {
    prev: '#3b82f6',
    real: '#22c55e',
  };

  const labelInterval = isMobile ? 3 : 1;

  const chartContent = (height: string) => (
    <div className={height} style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 24, right: 40, bottom: 10, left: 20 }}>
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
            tickFormatter={fmtBRL}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={70}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => fmtBRLFull(value)}
          />
          <Legend />
          {statusMes && (
            <ReferenceLine
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
          <Line type="monotone" dataKey="prevAcum" name="Previsto Acumulado"
            stroke={COLORS.prev} strokeWidth={2} dot={false} activeDot={{ r: 5 }}
            connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="realAcum" name="Realizado Acumulado"
            stroke={COLORS.real} strokeWidth={2} dot={false} activeDot={{ r: 5 }}
            connectNulls={false} isAnimationActive={false} />
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
