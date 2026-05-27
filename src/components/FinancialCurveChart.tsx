import { useCurrentProject } from '@/store/projectStore';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartExpandModal from '@/components/ChartExpandModal';
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
  const { curvaSFinanceira } = useCurrentProject();
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    return (curvaSFinanceira || []).map((p) => ({
      mes: fmtMonth(p.date),
      prevAcum: p.prevAcum > 0 ? p.prevAcum : undefined,
      realAcum: p.realAcum > 0 ? p.realAcum : undefined,
    }));
  }, [curvaSFinanceira]);

  if (!curvaSFinanceira || curvaSFinanceira.length === 0) return null;

  const COLORS = {
    prev: 'hsl(var(--chart-previsto))',
    real: '#16a34a',
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
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Curva S Financeira</h3>
        <ChartExpandModal
          title="Curva S Financeira"
          subtitle="Medição prevista × realizada acumulada"
          expandedHeight="h-full"
        >
          {chartContent('h-full')}
        </ChartExpandModal>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Medição prevista × realizada acumulada</p>
      {chartContent('h-[280px] sm:h-[420px]')}
    </div>
  );
};

export default FinancialCurveChart;
