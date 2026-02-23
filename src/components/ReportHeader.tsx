import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Minus, Calendar, User, Building2, BarChart3, ShieldCheck, ShieldAlert, ShieldX, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateBR, formatDateShort, getWeekOfYear } from '@/lib/dateUtils';


const KpiCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  variant = 'default',
  index = 0,
  trend,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ElementType;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
  index?: number;
  trend?: { current: number; previous: number; suffix?: string };
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
      <div className="flex items-end gap-1.5">
        <span className={`text-xl font-bold leading-tight ${isColored ? '' : 'text-foreground'}`}>{value}</span>
        {trend && <TrendIndicator current={trend.current} previous={trend.previous} suffix={trend.suffix} />}
      </div>
      {subValue && (
        <span className={`text-xs ${isColored ? 'opacity-70' : 'text-muted-foreground'}`}>{subValue}</span>
      )}
    </motion.div>
  );
};

const TrendIndicator = ({ current, previous, suffix = '%' }: { current: number; previous: number; suffix?: string }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return null;
  const isUp = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isUp ? 'text-success' : 'text-destructive'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{diff.toFixed(1)}{suffix}
    </span>
  );
};

const ReportHeader = () => {
  const { info, sCurveData, statusDateIndex, weeklyData } = useCurrentProject();
  const { selectedDate, selectedMonthIndex, clearSelection } = useReportInteraction();
  const hasFilter = selectedDate !== null || selectedMonthIndex !== null;

  // Pega o ponto da data de status na Curva S
  const cutIndex = Math.min(statusDateIndex, sCurveData.length - 1);
  const statusPoint = sCurveData[cutIndex];
  const prevPoint = cutIndex > 0 ? sCurveData[cutIndex - 1] : null;

  // Avanço Real: usa o valor da Curva S na data de status (se disponível), senão usa info manual
  const avancoReal = (statusPoint?.real != null && statusPoint.real > 0)
    ? statusPoint.real
    : info.avancoReal;
  const prevAvancoReal = prevPoint?.real ?? 0;

  // Replanejado: se houver, usar como referência de comparação em vez do previsto
  const hasReplanejado = sCurveData.some(p => p.replanejado != null && p.replanejado !== 0);
  const refPrev = hasReplanejado && statusPoint?.replanejado != null
    ? statusPoint.replanejado
    : (statusPoint?.previsto != null && statusPoint.previsto > 0 ? statusPoint.previsto : info.avancoPrev);
  const refLabel = hasReplanejado ? 'replan.' : 'prev.';

  const desvio = avancoReal - refPrev;
  const idp = refPrev > 0 ? ((avancoReal / refPrev) * 100) : 0;

  // Previous period calcs for trend indicators
  const prevRefPrev = hasReplanejado && prevPoint?.replanejado != null
    ? prevPoint.replanejado
    : (prevPoint?.previsto ?? 0);
  const prevDesvio = prevAvancoReal - prevRefPrev;
  const prevIdp = prevRefPrev > 0 ? ((prevAvancoReal / prevRefPrev) * 100) : 0;

  const DesvioIcon = desvio < 0 ? TrendingDown : desvio > 0 ? TrendingUp : Minus;
  const desvioVariant = desvio < -5 ? 'danger' : desvio < 0 ? 'warning' : 'success';

  // Health badge
  const healthConfig = idp >= 95
    ? { label: 'No Prazo', Icon: ShieldCheck, cls: 'bg-success/20 text-success border-success/30' }
    : idp >= 80
    ? { label: 'Em Risco', Icon: ShieldAlert, cls: 'bg-warning/20 text-warning border-warning/30' }
    : { label: 'Atrasado', Icon: ShieldX, cls: 'bg-destructive/20 text-destructive border-destructive/30' };

  // Auto executive summary (2-3 lines)
  const summaryParts: string[] = [];
  const statusLabel = healthConfig.label;



  // Propósito do relatório
  const inicioFmt = formatDateShort(info.inicio);
  const terminoFmt = formatDateShort(info.terminoPrev || info.terminoLB);
  const periodoInfo = [inicioFmt, terminoFmt].filter(Boolean).join(' a ');
  const semanaAtual = info.atualizadoEm ? getWeekOfYear(info.atualizadoEm) : '';
  summaryParts.push(`Este relatório apresenta o acompanhamento de desempenho físico do projeto ${info.projeto || 'em andamento'}${info.cliente ? ` (cliente: ${info.cliente})` : ''}${periodoInfo ? `, período de ${periodoInfo}` : ''}${semanaAtual ? ` (${semanaAtual})` : ''}, com o objetivo de fornecer visibilidade sobre o progresso, identificar desvios e apoiar a tomada de decisão.`);

  // Status atual
  summaryParts.push(`Situação atual: projeto ${statusLabel.toLowerCase()}, com ${avancoReal}% de avanço real contra ${refPrev}% ${hasReplanejado ? 'replanejado' : 'previsto'} (desvio de ${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}pp, IDP ${idp.toFixed(0)}%).`);
  
  // Weekly performance
  const lastWeek = weeklyData.length >= 1 ? weeklyData[weeklyData.length - 1] : null;
  if (lastWeek && lastWeek.date) {
    const weekDiff = lastWeek.real - lastWeek.previsto;
    summaryParts.push(`Na semana ${lastWeek.date}, o realizado foi de ${lastWeek.real}% vs ${lastWeek.previsto}% previsto (${weekDiff >= 0 ? '+' : ''}${weekDiff.toFixed(1)}pp).`);
  }

  // Trend
  if (prevPoint && prevAvancoReal > 0) {
    const trendDir = desvio > prevDesvio ? 'melhora' : desvio < prevDesvio ? 'piora' : 'estabilidade';
    summaryParts.push(`Tendência de ${trendDir} em relação ao período anterior.`);
  }

  const executiveSummaryText = summaryParts.join(' ');

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
          {/* Health badge */}
          {info.avancoPrev > 0 && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${healthConfig.cls}`}>
              <healthConfig.Icon className="h-3.5 w-3.5" />
              {healthConfig.label}
            </div>
          )}
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
            <div className="text-xs font-semibold text-primary-foreground">{formatDateBR(info.atualizadoEm)}</div>
          </div>
        </div>
      </div>

      {/* Info strip */}
      <div className="bg-secondary/60 border-x border-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
        {[
          { label: 'Gestor', value: info.gestor, icon: User },
          { label: 'Início', value: formatDateBR(info.inicio), icon: Calendar },
          { label: 'Término LB', value: formatDateBR(info.terminoLB), icon: Calendar },
          { label: 'Término Prev.', value: formatDateBR(info.terminoPrev), icon: Calendar },
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

      {/* Executive Summary Strip */}
      <div className="bg-muted/50 border-x border-border px-5 py-2.5">
        <p className="text-xs text-foreground leading-relaxed">
          <span className="font-semibold text-primary mr-1.5">Resumo:</span>
          {executiveSummaryText}
        </p>
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
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-primary-foreground">{avancoReal}%</span>
                {prevPoint && <TrendIndicator current={avancoReal} previous={prevAvancoReal} />}
              </div>
              <span className="text-sm text-primary-foreground/60 pb-1">/ {refPrev}% {refLabel}</span>
            </div>
            <div className="relative">
              <div className="h-2.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${avancoReal}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-primary-foreground rounded-full"
                />
              </div>
              {/* Marker */}
              <div
                className="absolute top-0 h-2.5 w-0.5 bg-warning rounded-full"
                style={{ left: `${Math.min(refPrev, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-primary-foreground/50">
              <span>0%</span>
              <span className="text-warning font-medium">{hasReplanejado ? 'Replan' : 'Prev'}: {refPrev}%</span>
              <span>100%</span>
            </div>
          </div>

          <KpiCard
            label="Avanço Real"
            value={`${avancoReal}%`}
            subValue="progresso atual"
            icon={BarChart3}
            variant="primary"
            index={1}
            trend={prevPoint ? { current: avancoReal, previous: prevAvancoReal } : undefined}
          />

          <KpiCard
            label="Desvio"
            value={`${desvio >= 0 ? '+' : ''}${desvio.toFixed(2)}%`}
            subValue={desvio < 0 ? `abaixo do ${refLabel === 'replan.' ? 'replanejado' : 'previsto'}` : `acima do ${refLabel === 'replan.' ? 'replanejado' : 'previsto'}`}
            icon={DesvioIcon}
            variant={desvioVariant}
            index={2}
            trend={prevPoint ? { current: desvio, previous: prevDesvio, suffix: 'pp' } : undefined}
          />

          <KpiCard
            label="IDP"
            value={`${idp.toFixed(1)}%`}
            subValue="índice de desempenho"
            variant={idp >= 100 ? 'success' : idp >= 85 ? 'warning' : 'danger'}
            index={3}
            trend={prevPoint ? { current: idp, previous: prevIdp } : undefined}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default ReportHeader;
