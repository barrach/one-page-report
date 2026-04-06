import { useCurrentProject } from '@/store/projectStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import ChartExpandModal from './ChartExpandModal';

const RestrictionsChart = () => {
  const { actions } = useCurrentProject();

  const total = actions.length;
  const resolvidas = actions.filter(a => a.status === 'CONCLUÍDO').length;
  const pendentes = total - resolvidas;
  const pctResolvidas = total > 0 ? (resolvidas / total) * 100 : 0;
  const pctPendentes = total > 0 ? (pendentes / total) * 100 : 0;
  const taxa = pctResolvidas;

  const data = [
    { name: 'Resolvidas', value: pctResolvidas, fill: 'hsl(var(--success))' },
    { name: 'Pendentes', value: pctPendentes, fill: 'hsl(var(--destructive))' },
  ];

  const taxaColor = taxa > 80 ? 'text-success' : taxa >= 50 ? 'text-warning' : 'text-destructive';

  const TrendIcon = pendentes === 0 ? TrendingUp : pendentes > resolvidas ? TrendingDown : ArrowRight;
  const trendColor = pendentes === 0 ? 'text-success' : pendentes > resolvidas ? 'text-destructive' : 'text-warning';
  const trendText = pendentes === 0 ? 'Todas resolvidas' : pendentes > resolvidas ? 'Pendências predominam' : 'Pendências em queda';

  const renderLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value } = props as { x: number; y: number; width: number; value: number };
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight="bold" fill="hsl(var(--foreground))">
        {`${value.toFixed(0)}%`}
      </text>
    );
  };

  if (total === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Restrições Removidas</h3>
        <p className="text-sm text-muted-foreground">Nenhuma restrição cadastrada</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Restrições Removidas</h3>
          <p className="text-xs text-muted-foreground">Acompanhamento de restrições do projeto</p>
        </div>
        <ChartExpandModal title="Restrições Removidas" subtitle="Acompanhamento de restrições do projeto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={80}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                <LabelList content={renderLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartExpandModal>
      </div>

      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
          <span className="text-xs text-muted-foreground font-medium">Taxa de Resolução:</span>
          <span className={`text-sm font-bold ${taxaColor}`}>{taxa.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{total}</strong></span>
          <span>Resolvidas: <strong className="text-success">{resolvidas}</strong></span>
          <span>Pendentes: <strong className="text-destructive">{pendentes}</strong></span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendText}
        </div>
      </div>

      {/* Inline chart with fixed minimum height */}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={60}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              <LabelList content={renderLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RestrictionsChart;
