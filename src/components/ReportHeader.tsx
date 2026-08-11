import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Minus, Calendar, User, Building2, BarChart3, ShieldCheck, ShieldAlert, ShieldX, ArrowUpRight, ArrowDownRight, ArrowRight, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateBR, formatDateShort } from '@/lib/dateUtils';
import { useContractPerformance } from '@/hooks/use-contract-performance';
import { useTvMode } from '@/hooks/use-tv-mode';
import { ppcDaSemana, ultimaSemana } from '@/lib/ppc';


const KpiCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  index = 0,
  trend,
  valueColor = 'text-primary-foreground',
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ElementType;
  index?: number;
  trend?: { current: number; previous: number; suffix?: string };
  valueColor?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="gradient-primary rounded-xl p-3 sm:p-4 card-shadow border-0 flex flex-col gap-1 min-h-[90px] sm:min-h-0 justify-between"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">
          {label}
        </span>
        {Icon && (
          <Icon className="h-4 w-4 text-primary-foreground/50" />
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={`text-lg sm:text-xl font-bold leading-tight ${valueColor}`}>{value}</span>
        {trend && <TrendIndicator current={trend.current} previous={trend.previous} suffix={trend.suffix} />}
      </div>
      {subValue && (
        <span className="text-[11px] sm:text-xs text-primary-foreground/60 leading-tight">{subValue}</span>
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

const fmtBR = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

interface ReportHeaderProps {
  /** Controles da barra de ações (seletor de projeto, exportar, menu) exibidos dentro da faixa
   *  do cabeçalho. Não entram no PDF nem na impressão. */
  actions?: React.ReactNode;
}

const ReportHeader = ({ actions }: ReportHeaderProps) => {
  const { info, sCurveData, programacaoSemanal } = useCurrentProject();
  const { tvMode } = useTvMode();
  const { selectedDate, selectedMonthIndex, clearSelection } = useReportInteraction();
  const hasFilter = selectedDate !== null || selectedMonthIndex !== null;

  const {
    ultIdx, penIdx, penPoint,
    hasReplanejado, refLabel, getRealAt,
    avancoReal, refPrev, prevAvancoReal,
    desvio, idp, prevIdp, status, statusLabel,
  } = useContractPerformance();

  // Weekly Real % derived from accumulated delta.
  // Quando há replanejamento, ignorar info.desvioSemana/desvioAcumulado (vêm do RESUMO,
  // relativos à LB) e calcular sempre da Curva S (Real Replanejado).
  const realSemUltCalc = ultIdx > 0 ? avancoReal - getRealAt(sCurveData[ultIdx - 1]) : avancoReal;
  const realSemUlt = hasReplanejado ? realSemUltCalc : (info.desvioSemana ?? realSemUltCalc);
  const realSemPen = penIdx > 0
    ? prevAvancoReal - getRealAt(sCurveData[penIdx - 1])
    : prevAvancoReal;

  const DesvioIcon = desvio < 0 ? TrendingDown : desvio > 0 ? TrendingUp : Minus;

  // Health badge
  const healthConfig = status === 'ok'
    ? { label: statusLabel, Icon: ShieldCheck, cls: 'bg-success/20 text-success border-success/30' }
    : status === 'risk'
    ? { label: statusLabel, Icon: ShieldAlert, cls: 'bg-warning/20 text-warning border-warning/30' }
    : { label: statusLabel, Icon: ShieldX, cls: 'bg-destructive/20 text-destructive border-destructive/30' };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header band */}
      <div className="gradient-primary rounded-t-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* No modo TV a sidebar não existe, então a marca entra aqui, ao lado do
            título, como o timbre do painel. */}
        {tvMode && (
          <img
            src="/megasteam-vertical-branca.png"
            alt="Megasteam"
            className="h-12 w-auto shrink-0 sm:mr-5 sm:border-r sm:border-primary-foreground/20 sm:pr-5"
          />
        )}
        {/* Na TV o título e o nome do projeto ficam centralizados entre si. */}
        <div className={tvMode ? 'min-w-0 text-center' : 'min-w-0'}>
          <h1 className="text-base sm:text-lg font-bold text-primary-foreground tracking-widest uppercase">
            One Page Report
          </h1>
          {/* Os controles ficam logo abaixo do título: o próprio dropdown já mostra
              qual é o contrato selecionado, então não há linha de texto repetindo o
              nome do projeto. Contrato e cliente foram para a faixa de informações. */}
          {actions ? (
            <div
              data-html2canvas-ignore
              className="hidden sm:flex items-center gap-2 mt-1.5 print:hidden"
            >
              {actions}
            </div>
          ) : (
            <p className="text-[11px] text-primary-foreground/60 mt-0.5">{info.projeto}</p>
          )}
          {/* No mobile o dropdown vive na barra superior, então o nome continua aqui. */}
          {actions && (
            <p className="text-[11px] text-primary-foreground/60 mt-0.5 sm:hidden">{info.projeto}</p>
          )}
        </div>
        <div className="flex items-center flex-wrap justify-end gap-x-3 gap-y-2">
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
      <div className="bg-secondary/60 border-x border-border grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border">
        {([
          // Cliente entra aqui, no lugar da linha que havia sob o título; o número do
          // contrato vem como segunda linha da mesma célula.
          { label: 'Cliente', value: info.cliente, sub: info.contrato, icon: Building2 },
          { label: 'Gestor', value: info.gestor, icon: User },
          { label: 'Início', value: formatDateBR(info.inicio), icon: Calendar },
          { label: 'Término LB', value: formatDateBR(info.terminoLB), icon: Calendar },
          { label: 'Término Prev.', value: formatDateBR(info.terminoPrev), icon: Calendar },
        ] as { label: string; value?: string; sub?: string; icon: React.ElementType }[]).map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 px-4 py-2 min-w-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-xs font-semibold text-foreground truncate">{value || '—'}</div>
              {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="border-x border-b border-border rounded-b-xl bg-background/50 backdrop-blur-sm p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">

          {/* Card 1 — % Realizado (equal weight, compact) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.35 }}
            className="gradient-primary rounded-xl p-3 sm:p-4 card-shadow border-0 flex flex-col gap-2 justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">
                % Realizado
              </span>
              <BarChart3 className="h-4 w-4 text-primary-foreground/50" />
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className={`text-xl font-bold leading-tight ${avancoReal >= refPrev ? 'text-success' : 'text-destructive'}`}>
                {fmtBR(avancoReal)}%
              </span>
              <span className="text-[11px] text-primary-foreground/60 pb-0.5">/ {fmtBR(refPrev)}% {refLabel}</span>
            </div>
            <div className="relative">
              <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(avancoReal, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-primary-foreground rounded-full"
                />
              </div>
              <div
                className="absolute top-0 h-2 w-0.5 bg-warning rounded-full"
                style={{ left: `${Math.min(refPrev, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-primary-foreground/50">
              <span>0%</span>
              <span className={`font-semibold ${desvio < 0 ? 'text-destructive' : 'text-success'}`}>
                {desvio >= 0 ? '+' : ''}{desvio.toFixed(1)}%
              </span>
              <span>100%</span>
            </div>
          </motion.div>

          {/* Card 2 — Evolução Semanal */}
          {(() => {
            const evolColor = realSemUlt > 0 ? 'text-success' : realSemUlt < 0 ? 'text-destructive' : 'text-warning';
            const EvolIcon = realSemUlt > 0 ? TrendingUp : realSemUlt < 0 ? TrendingDown : ArrowRight;
            return (
              <KpiCard
                label="Evolução Semanal"
                value={`${realSemUlt >= 0 ? '+' : ''}${fmtBR(realSemUlt)}%`}
                subValue={`vs semana anterior: ${fmtBR(realSemPen)}%`}
                icon={EvolIcon}
                valueColor={evolColor}
                index={1}
              />
            );
          })()}

          {/* Card 3 — Desvio */}
          <KpiCard
            label="Desvio"
            value={`${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}%`}
            subValue={
              Math.abs(desvio) < 0.05
                ? 'no prazo'
                : desvio < 0
                  ? `abaixo do ${hasReplanejado ? 'replanejado' : 'previsto'}`
                  : `acima do ${hasReplanejado ? 'replanejado' : 'previsto'}`
            }
            icon={DesvioIcon}
            valueColor={desvio < 0 ? 'text-destructive' : desvio > 0 ? 'text-success' : 'text-muted-foreground'}
            index={2}
          />

          {/* Card 4 — Prazo Restante */}
          {(() => {
            const terminoStr = info.terminoPrev || info.terminoLB;
            let diasRestantes = 0;
            let prazoLabel = '—';
            if (terminoStr) {
              const hoje = new Date();
              const termino = new Date(terminoStr);
              diasRestantes = Math.ceil((termino.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
              const abs = Math.abs(diasRestantes);
              const formatted = abs >= 30 ? `${Math.round(abs / 7)} sem` : `${abs}d`;
              prazoLabel = diasRestantes >= 0 ? formatted : `${formatted} atrás`;
            }
            const prazoColor = diasRestantes < 0 ? 'text-destructive' : diasRestantes <= 30 ? 'text-warning' : 'text-success';
            return (
              <KpiCard
                label="Prazo Restante"
                value={prazoLabel}
                subValue={terminoStr ? `término: ${formatDateShort(terminoStr)}` : 'sem data'}
                icon={Calendar}
                valueColor={prazoColor}
                index={3}
              />
            );
          })()}

          {/* Card 5 — PPC Semanal */}
          {(() => {
            // PPC binário (Last Planner): concluídas ÷ programadas, contado a partir
            // da baixa dada no card da Programação Semanal.
            const ultima = ultimaSemana(programacaoSemanal);
            const resumo = ppcDaSemana(ultima);
            const ppc = ultima ? resumo.pct : null;
            const ppcOk = ppc !== null && ppc >= 80;
            const ppcColor = ppc === null
              ? 'text-muted-foreground'
              : ppcOk ? 'text-success' : 'text-destructive';
            const ppcLabel = ppc !== null ? `${Math.round(ppc)}%` : '—';
            const subInfo = ultima
              ? `Sem. ${ultima.semana} · ${resumo.concluidas}/${resumo.programadas} atividades`
              : 'Nenhuma semana importada';
            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 4 * 0.06, duration: 0.35 }}
                className="gradient-primary rounded-xl p-3 sm:p-4 card-shadow border-0 flex flex-col gap-1 min-h-[90px] sm:min-h-0 justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">
                    PPC Semanal
                  </span>
                  <ClipboardCheck className="h-4 w-4 text-primary-foreground/50" />
                </div>
                <span className={`text-lg sm:text-xl font-bold leading-tight ${ppcColor}`}>
                  {ppcLabel}
                </span>
                <span className="text-[11px] text-primary-foreground/60 leading-tight">
                  {subInfo}
                </span>
                <span className="text-[10px] text-primary-foreground/40">
                  Meta: 80%
                </span>
              </motion.div>
            );
          })()}

          {/* Card 6 — IDP */}
          <KpiCard
            label="IDP"
            value={`${fmtBR(idp, 1)}%`}
            subValue="índice de desempenho"
            valueColor={idp < 90 ? 'text-destructive' : idp < 100 ? 'text-warning' : 'text-success'}
            index={5}
            trend={penPoint ? { current: idp, previous: prevIdp } : undefined}
          />

        </div>
      </div>
    </motion.div>
  );
};

export default ReportHeader;
