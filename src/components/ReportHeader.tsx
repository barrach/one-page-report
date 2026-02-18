import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Minus, Calendar, User, Building2, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const KpiCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  variant = 'default',
  index = 0,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ElementType;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
  index?: number;
}) => {
  const gradientMap = {
    default: 'bg-card border',
    primary: 'gradient-primary text-primary-foreground border-0',
    success: 'gradient-success text-success-foreground border-0',
    danger: 'gradient-danger text-destructive-foreground border-0',
    warning: 'gradient-warning text-warning-foreground border-0',
  };

  const isColored = variant !== 'default';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className={`rounded-xl p-4 card-shadow flex flex-col gap-1 ${gradientMap[variant]}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isColored ? 'opacity-75' : 'text-muted-foreground'}`}>
          {label}
        </span>
        {Icon && (
          <Icon className={`h-4 w-4 ${isColored ? 'opacity-60' : 'text-muted-foreground'}`} />
        )}
      </div>
      <span className={`text-xl font-bold leading-tight ${isColored ? '' : 'text-foreground'}`}>{value}</span>
      {subValue && (
        <span className={`text-xs ${isColored ? 'opacity-70' : 'text-muted-foreground'}`}>{subValue}</span>
      )}
    </motion.div>
  );
};

const ReportHeader = () => {
  const { info } = useCurrentProject();
  const { selectedDate, selectedMonthIndex, clearSelection } = useReportInteraction();
  const hasFilter = selectedDate !== null || selectedMonthIndex !== null;
  const desvio = info.avancoReal - info.avancoPrev;
  const idp = info.avancoPrev > 0 ? ((info.avancoReal / info.avancoPrev) * 100) : 0;

  const DesvioIcon = desvio < 0 ? TrendingDown : desvio > 0 ? TrendingUp : Minus;
  const desvioVariant = desvio < -5 ? 'danger' : desvio < 0 ? 'warning' : 'success';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header band */}
      <div className="gradient-primary rounded-t-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-primary-foreground tracking-widest uppercase">
            One Page Report — MEGASTEAM
          </h1>
          <p className="text-[11px] text-primary-foreground/60 mt-0.5">
            {info.projeto} · {info.cliente}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFilter && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs h-7"
              onClick={clearSelection}
            >
              <X className="h-3 w-3" />
              Limpar Filtro
            </Button>
          )}
          <div className="text-right">
            <div className="text-[10px] text-primary-foreground/50 uppercase tracking-wider">Atualizado em</div>
            <div className="text-xs font-semibold text-primary-foreground">{info.atualizadoEm}</div>
          </div>
        </div>
      </div>

      {/* Info strip */}
      <div className="bg-secondary/60 border-x border-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
        {[
          { label: 'Gestor', value: info.gestor, icon: User },
          { label: 'Início', value: info.inicio, icon: Calendar },
          { label: 'Término LB', value: info.terminoLB, icon: Calendar },
          { label: 'Término Prev.', value: info.terminoPrev, icon: Calendar },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 px-4 py-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-xs font-semibold text-foreground">{value || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="border-x border-b border-border rounded-b-xl bg-background/50 backdrop-blur-sm p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Progress bar card */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2 gradient-primary rounded-xl p-4 card-shadow border-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">
                % Realizado
              </span>
              <BarChart3 className="h-4 w-4 text-primary-foreground/60" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-primary-foreground">{info.avancoReal}%</span>
              <span className="text-sm text-primary-foreground/60 pb-1">/ {info.avancoPrev}% prev.</span>
            </div>
            <div className="relative">
              <div className="h-2.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${info.avancoReal}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-primary-foreground rounded-full"
                />
              </div>
              {/* Previsto marker */}
              <div
                className="absolute top-0 h-2.5 w-0.5 bg-warning rounded-full"
                style={{ left: `${Math.min(info.avancoPrev, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-primary-foreground/50">
              <span>0%</span>
              <span className="text-warning font-medium">Prev: {info.avancoPrev}%</span>
              <span>100%</span>
            </div>
          </div>

          <KpiCard
            label="Avanço Real"
            value={`${info.avancoReal}%`}
            subValue="progresso atual"
            icon={BarChart3}
            variant="primary"
            index={1}
          />

          <KpiCard
            label="Desvio"
            value={`${desvio >= 0 ? '+' : ''}${desvio.toFixed(2)}%`}
            subValue={desvio < 0 ? 'abaixo do previsto' : 'acima do previsto'}
            icon={DesvioIcon}
            variant={desvioVariant}
            index={2}
          />

          <KpiCard
            label="IDP"
            value={`${idp.toFixed(1)}%`}
            subValue="índice de desempenho"
            variant={idp >= 100 ? 'success' : idp >= 85 ? 'warning' : 'danger'}
            index={3}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default ReportHeader;
