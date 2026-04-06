import { useCurrentProject } from '@/store/projectStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import ChartExpandModal from './ChartExpandModal';

const RestrictionsChart = () => {
  const { actions } = useCurrentProject();

  const total = actions.length;
  const resolvidas = actions.filter(a => a.status === 'CONCLUÍDO').length;
  const pendentes = total - resolvidas;
  const taxa = total > 0 ? ((resolvidas / total) * 100) : 0;

  // Build single-bar data for the chart
  const data = [
    { name: 'Restrições', resolvidas, pendentes },
  ];

  const TrendIcon = pendentes === 0 ? TrendingUp : pendentes > resolvidas ? TrendingDown : ArrowRight;
  const trendColor = pendentes === 0
    ? 'text-green-500'
    : pendentes > resolvidas
      ? 'text-red-500'
      : 'text-yellow-500';
  const trendText = pendentes === 0
    ? 'Todas resolvidas'
    : pendentes > resolvidas
      ? 'Pendências predominam'
      : 'Pendências em queda';

  const chartContent = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={8} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Bar dataKey="resolvidas" name="Resolvidas" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
        <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Restrições Removidas</h3>
          <p className="text-xs text-muted-foreground">Acompanhamento de restrições do projeto</p>
        </div>
        <ChartExpandModal title="Restrições Removidas" subtitle="Acompanhamento de restrições do projeto">
          {chartContent}
        </ChartExpandModal>
      </div>

      {/* Taxa de resolução + métricas */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
          <span className="text-xs text-muted-foreground font-medium">Taxa de Resolução:</span>
          <span className={`text-sm font-bold ${taxa >= 70 ? 'text-green-500' : taxa >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
            {taxa.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{total}</strong></span>
          <span>Resolvidas: <strong className="text-green-500">{resolvidas}</strong></span>
          <span>Pendentes: <strong className="text-red-500">{pendentes}</strong></span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendText}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[140px]">
        {chartContent}
      </div>
    </div>
  );
};

export default RestrictionsChart;
