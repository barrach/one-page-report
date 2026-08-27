import { useMemo } from 'react';
import { useCurrentProject, useProjectStore, type MonthWeekData } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import ChartInsight from '@/components/ChartInsight';
import ObservacoesDoCard from '@/components/ObservacoesDoCard';
import ChartExpandModal from '@/components/ChartExpandModal';
import { visaoMensal, ROTULO_BASE_MENSAL, type BaseMensal } from '@/lib/visaoMensal';
import { cn } from '@/lib/utils';
import { parseISOLocal } from '@/lib/dateUtils';

/** Semanas em branco — mantêm o card com a mesma forma quando não há dados. */
const PLACEHOLDER_MONTHS: MonthWeekData[] = [1, 2, 3, 4, 5].map((n) => ({
  label: `Sem. ${n}`,
  previsto: 0,
  real: 0,
}));

/**
 * As semanas do mês, tiradas da Curva S no mês do "Atualizado em".
 *
 * Só cai no `monthData` guardado quando a curva não cobre aquele mês — projeto
 * antigo, que ainda tem o mês digitado à mão.
 */
const useMonthData = (): MonthWeekData[] => {
  const { monthData, sCurveData, info } = useCurrentProject();
  const daCurva = useMemo(
    () => visaoMensal(sCurveData, info?.atualizadoEm || '', info?.mesBase ?? 'linhaBase', { inicio: info?.inicio, periodicidade: info?.curvaPeriodicidade }),
    [sCurveData, info?.atualizadoEm, info?.mesBase, info?.inicio, info?.curvaPeriodicidade],
  );
  if (daCurva.length > 0) return daCurva;
  return monthData && monthData.length > 0 ? monthData : PLACEHOLDER_MONTHS;
};

const GaugeChart = ({
  metaRealizado,
  selectedIndex,
}: {
  metaRealizado: number;
  selectedIndex: number | null;
}) => {
  const monthData = useMonthData();
  const { setSelectedMonthIndex } = useReportInteraction();

  // Mês ativo = último mês com Real > 0 (calculado a partir do MESMO monthData
  // que monta os arcos, evitando descasamento de prop / render stale).
  let activeIndex = -1;
  monthData.forEach((d, i) => { if (Number(d.real || 0) > 0) activeIndex = i; });

  const cx = 200;
  const cy = 180;
  const outerR = 150;
  const innerR = 80;
  const labelR = outerR + 20;

  const segments = monthData.filter(m => m.previsto > 0);
  const totalSegments = segments.reduce((s, seg) => s + seg.previsto, 0);

  const needleLength = outerR - 15;

  const segmentColors = [
    'hsl(3, 80%, 52%)',
    'hsl(25, 90%, 55%)',
    'hsl(50, 95%, 55%)',
    'hsl(195, 80%, 60%)',
    'hsl(210, 80%, 55%)',
  ];

  const dimmedColors = [
    'hsl(3, 30%, 75%)',
    'hsl(25, 40%, 78%)',
    'hsl(50, 40%, 80%)',
    'hsl(195, 30%, 80%)',
    'hsl(210, 30%, 78%)',
  ];

  const arcs: { d: string; color: string; dimColor: string; prevLabel: string; semLabel: string; midAngle: number; originalIndex: number }[] = [];
  let currentAngle = Math.PI;
  let segIdx = 0;

  monthData.forEach((seg, origIdx) => {
    if (seg.previsto <= 0) return;
    if (totalSegments === 0) return;
    const sweepAngle = (seg.previsto / totalSegments) * Math.PI;
    const segEndAngle = currentAngle - sweepAngle;

    const outerStart = { x: cx + outerR * Math.cos(currentAngle), y: cy - outerR * Math.sin(currentAngle) };
    const outerEnd = { x: cx + outerR * Math.cos(segEndAngle), y: cy - outerR * Math.sin(segEndAngle) };
    const innerStart = { x: cx + innerR * Math.cos(segEndAngle), y: cy - innerR * Math.sin(segEndAngle) };
    const innerEnd = { x: cx + innerR * Math.cos(currentAngle), y: cy - innerR * Math.sin(currentAngle) };

    const largeArc = sweepAngle > Math.PI ? 1 : 0;
    const d = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');

    const midAngle = currentAngle - sweepAngle / 2;
    arcs.push({
      d,
      color: segmentColors[segIdx % segmentColors.length],
      dimColor: dimmedColors[segIdx % dimmedColors.length],
      prevLabel: seg.previsto.toFixed(1),
      semLabel: seg.label || `Sem. ${segIdx + 1}`,
      midAngle,
      originalIndex: origIdx,
    });

    segIdx++;
    currentAngle = segEndAngle;
  });

  return (
    <svg viewBox="0 0 400 240" className="gauge-svg w-full h-full max-w-[460px] mx-auto">
      {arcs.map((arc, i) => {
        const isSelected = selectedIndex === null || selectedIndex === arc.originalIndex;
        return (
          <g key={i} onClick={() => setSelectedMonthIndex(arc.originalIndex, 'gauge')} style={{ cursor: 'pointer' }}>
            <path
              d={arc.d}
              fill={isSelected ? arc.color : arc.dimColor}
              stroke="hsl(var(--card))"
              strokeWidth="3"
              className="transition-all duration-200"
            />
            <text
              x={cx + ((outerR + innerR) / 2) * Math.cos(arc.midAngle)}
              y={cy - ((outerR + innerR) / 2) * Math.sin(arc.midAngle)}
              textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize="11" fontWeight="bold"
            >
              {arc.prevLabel}
            </text>
            <text
              x={cx + labelR * Math.cos(arc.midAngle)}
              y={cy - labelR * Math.sin(arc.midAngle)}
              textAnchor="middle" dominantBaseline="central"
              fill="hsl(var(--muted-foreground))" fontSize="10" fontWeight="600"
            >
              {arc.semLabel}
            </text>
          </g>
        );
      })}

      {(() => {
        const activeArc = arcs.find(a => a.originalIndex === activeIndex) ?? arcs[arcs.length - 1];
        const angle = activeArc ? activeArc.midAngle : Math.PI / 2;
        const nx = cx + needleLength * Math.cos(angle);
        const ny = cy - needleLength * Math.sin(angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />;
      })()}
      <circle cx={cx} cy={cy} r="7" fill="hsl(var(--foreground))" />
      <circle cx={cx} cy={cy} r="4" fill="hsl(var(--card))" />

      <text x={cx} y={cy + 26} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="22" fontWeight="bold">
        {metaRealizado.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 42} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">
        % META REALIZADO
      </text>
    </svg>
  );
};

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const MonthChart = () => {
  const { info } = useCurrentProject();
  const setInfo = useProjectStore((s) => s.setInfo);
  const monthData = useMonthData();
  const { selectedMonthIndex, setSelectedMonthIndex } = useReportInteraction();

  const baseMensal: BaseMensal = info?.mesBase ?? 'linhaBase';
  const mesRotulo = useMemo(() => {
    const d = parseISOLocal(info?.atualizadoEm || '');
    return d ? `${MESES_PT[d.getMonth()]}/${d.getFullYear()}` : 'mês';
  }, [info?.atualizadoEm]);

  const totalPrev = monthData.reduce((s, d) => s + Number(d.previsto || 0), 0);
  const totalReal = monthData.reduce((s, d) => s + Number(d.real || 0), 0);

  // % Meta Realizado = Real / Prev do último mês com Real > 0
  let lastWithReal = -1;
  monthData.forEach((d, i) => { if (Number(d.real || 0) > 0) lastWithReal = i; });
  const metaRealizado =
    lastWithReal >= 0 && Number(monthData[lastWithReal].previsto || 0) > 0
      ? (Number(monthData[lastWithReal].real) / Number(monthData[lastWithReal].previsto)) * 100
      : 0;
  

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Prev. × Realizado Mês</h3>
          <p className="text-xs text-muted-foreground">
            Semanas de {mesRotulo} · previsto pela {ROTULO_BASE_MENSAL[baseMensal].toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChartExpandModal
            title="Prev. × Realizado Mês"
            subtitle={`Semanas de ${mesRotulo} · previsto pela ${ROTULO_BASE_MENSAL[baseMensal].toLowerCase()}`}
            expandedHeight="h-full"
          >
            <div className="h-full flex items-center justify-center">
              <GaugeChart metaRealizado={metaRealizado} selectedIndex={selectedMonthIndex} />
            </div>
          </ChartExpandModal>
        </div>
        {/* Escolha de contra o que o mês é comparado. Fora do papel: no PDF o
            que importa é a série escolhida, não o seletor. */}
        <div className="flex gap-1 shrink-0 print:hidden" data-html2canvas-ignore>
          {(['linhaBase', 'tendencia'] as BaseMensal[]).map((b) => (
            <button
              key={b}
              onClick={() => setInfo({ mesBase: b })}
              className={cn(
                'px-2 py-1 rounded border text-[11px] font-medium transition-colors',
                baseMensal === b
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {ROTULO_BASE_MENSAL[b]}
            </button>
          ))}
        </div>
      </div>

      {/* O medidor ocupa a sobra vertical do card, para acompanhar a altura do
          gráfico vizinho em vez de deixar um vazio embaixo. */}
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <GaugeChart metaRealizado={metaRealizado} selectedIndex={selectedMonthIndex} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-3 py-1.5 text-left rounded-tl-lg"></th>
              {monthData.map((d, i) => (
                <th
                  key={i}
                  className={`px-3 py-1.5 text-center cursor-pointer transition-all ${
                    selectedMonthIndex === i ? 'ring-2 ring-primary-foreground ring-inset bg-primary/20' : 'hover:bg-primary/10'
                  }`}
                  onClick={() => setSelectedMonthIndex(i, 'monthtable')}
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-1.5 font-semibold text-muted-foreground">PREV.</td>
              {monthData.map((d, i) => (
                <td key={i}
                  className={`px-3 py-1.5 text-center cursor-pointer transition-all ${selectedMonthIndex === i ? 'bg-primary/10 font-bold' : ''}`}
                  onClick={() => setSelectedMonthIndex(i, 'monthtable')}>
                  {d.previsto}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-semibold text-muted-foreground">REAL.</td>
              {monthData.map((d, i) => (
                <td key={i}
                  className={`px-3 py-1.5 text-center cursor-pointer transition-all ${selectedMonthIndex === i ? 'bg-primary/10 font-bold' : ''}`}
                  onClick={() => setSelectedMonthIndex(i, 'monthtable')}>
                  {d.real || '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {selectedMonthIndex !== null && (
        <button
          onClick={() => useReportInteraction.getState().clearSelection()}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Limpar seleção
        </button>
      )}
      <ChartInsight chartType="month" data={monthData} projectInfo={info} />
      <ObservacoesDoCard card="month" />
    </div>
  );
};

export default MonthChart;
