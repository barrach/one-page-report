import { useCurrentProject } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import ChartInsight from '@/components/ChartInsight';

const GaugeChart = ({
  metaRealizado,
  selectedIndex,
}: {
  metaRealizado: number;
  selectedIndex: number | null;
}) => {
  const { monthData } = useCurrentProject();
  const { setSelectedMonthIndex } = useReportInteraction();

  const cx = 200;
  const cy = 180;
  const outerR = 150;
  const innerR = 80;
  const labelR = outerR + 20;

  const segments = monthData.filter(m => m.previsto > 0);
  const totalSegments = segments.reduce((s, seg) => s + seg.previsto, 0);

  const needlePercent = totalSegments > 0 ? Math.min(1, Math.max(0, metaRealizado / totalSegments)) : 0;
  const needleAngle = Math.PI - needlePercent * Math.PI;
  const needleLength = outerR - 15;
  const needleEnd = {
    x: cx + needleLength * Math.cos(needleAngle),
    y: cy - needleLength * Math.sin(needleAngle),
  };

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
    <svg viewBox="0 0 400 240" className="w-full max-w-[360px] mx-auto">
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

      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
        stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
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

const MonthChart = () => {
  const { monthData, info } = useCurrentProject();
  const { selectedMonthIndex, setSelectedMonthIndex } = useReportInteraction();

  const totalPrev = monthData.reduce((s, d) => s + d.previsto, 0);
  const totalReal = monthData.reduce((s, d) => s + d.real, 0);

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Prev. × Realizado Mês</h3>
      <p className="text-xs text-muted-foreground mb-4">Meta mensal por semana</p>

      <GaugeChart metaRealizado={totalReal} selectedIndex={selectedMonthIndex} />

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
              <th className="px-3 py-1.5 text-center rounded-tr-lg">TOTAL</th>
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
              <td className="px-3 py-1.5 text-center font-bold">{totalPrev.toFixed(1)}%</td>
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
              <td className="px-3 py-1.5 text-center font-bold">{totalReal.toFixed(1)}%</td>
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
    </div>
  );
};

export default MonthChart;
