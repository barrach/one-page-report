import { useMemo } from 'react';
import { useCurrentProject } from '@/store/projectStore';

const fmtBR = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Termômetro do contrato — gauge semicircular com o IDP (Índice de Desempenho de Prazo).
 * Zonas: < 80% Atrasado · 80–95% Em risco · >= 95% No prazo.
 */
const ContractThermometer = () => {
  const { sCurveData, info } = useCurrentProject();

  const model = useMemo(() => {
    let ultIdx = -1;
    for (let i = sCurveData.length - 1; i >= 0; i--) {
      if ((sCurveData[i]?.real ?? 0) > 0) { ultIdx = i; break; }
    }
    const ultPoint = ultIdx >= 0 ? sCurveData[ultIdx] : null;
    const hasReplanejado = sCurveData.some(
      (p) => (p as unknown as Record<string, unknown>).replanejado != null && (p as unknown as Record<string, unknown>).replanejado !== 0
    );

    const real = info.realAcumulado ?? (ultPoint?.real ?? 0);
    const prev =
      info.prevAcumulado ??
      (ultPoint
        ? hasReplanejado && (ultPoint as unknown as Record<string, unknown>).replanejado != null
          ? Number((ultPoint as unknown as Record<string, unknown>).replanejado)
          : ultPoint.previsto ?? 0
        : 0);

    const desvio = info.desvioAcumulado ?? real - prev;
    const idp = prev > 0 ? (real / prev) * 100 : 0;
    return { real, prev, desvio, idp, hasReplanejado };
  }, [sCurveData, info]);

  if (!(model.prev > 0) && !(model.real > 0)) return null;

  const { real, prev, desvio, idp, hasReplanejado } = model;

  // Gauge geometry (0% .. 120% mapped to 180deg .. 0deg) — mesmo padrão do "Prev. × Realizado Mês"
  const MIN = 0;
  const MAX = 120;
  const cx = 200;
  const cy = 180;
  const outerR = 150;
  const innerR = 80;
  const labelR = outerR + 20;

  const valueToAngle = (v: number) => {
    const t = Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN)));
    return Math.PI - t * Math.PI;
  };

  const arcPath = (from: number, to: number) => {
    const a1 = valueToAngle(from);
    const a2 = valueToAngle(to);
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
    return [
      `M ${p(outerR, a1)}`,
      `A ${outerR} ${outerR} 0 0 1 ${p(outerR, a2)}`,
      `L ${p(innerR, a2)}`,
      `A ${innerR} ${innerR} 0 0 0 ${p(innerR, a1)}`,
      'Z',
    ].join(' ');
  };

  const zones = [
    { from: 0, to: 80, color: 'hsl(3, 80%, 52%)', label: 'Atrasado' },
    { from: 80, to: 95, color: 'hsl(50, 95%, 55%)', label: 'Em risco' },
    { from: 95, to: 120, color: 'hsl(145, 63%, 42%)', label: 'No prazo' },
  ];

  const status =
    idp >= 95
      ? { label: 'No Prazo', chip: 'bg-success/15 text-success border-success/30' }
      : idp >= 80
      ? { label: 'Em Risco', chip: 'bg-warning/15 text-warning border-warning/30' }
      : { label: 'Atrasado', chip: 'bg-destructive/15 text-destructive border-destructive/30' };

  const needleAngle = valueToAngle(idp);
  const needleLen = outerR - 15;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Termômetro do Contrato</h3>
          <p className="text-xs text-muted-foreground mb-4">
            IDP · realizado × {hasReplanejado ? 'replanejado' : 'previsto'} acumulado
          </p>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.chip}`}>
          {status.label}
        </span>
      </div>

      <svg viewBox="0 0 400 240" className="w-full max-w-[360px] mx-auto">
        {zones.map((z) => (
          <g key={z.label}>
            <path d={arcPath(z.from, z.to)} fill={z.color} stroke="hsl(var(--card))" strokeWidth="3" />
            <text
              x={cx + labelR * Math.cos(valueToAngle((z.from + z.to) / 2))}
              y={cy - labelR * Math.sin(valueToAngle((z.from + z.to) / 2))}
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
              fontWeight="600"
            >
              {z.label}
            </text>
          </g>
        ))}

        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="hsl(var(--foreground))" />
        <circle cx={cx} cy={cy} r="4" fill="hsl(var(--card))" />

        <text x={cx} y={cy + 26} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="22" fontWeight="bold">
          {fmtBR(idp, 1)}%
        </text>
        <text x={cx} y={cy + 42} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">
          IDP · DESEMPENHO DE PRAZO
        </text>
      </svg>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className="px-3 py-1.5 text-left rounded-tl-lg"></th>
              <th className="px-3 py-1.5 text-center">Realizado</th>
              <th className="px-3 py-1.5 text-center">{hasReplanejado ? 'Replanejado' : 'Previsto'}</th>
              <th className="px-3 py-1.5 text-center rounded-tr-lg">Desvio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-1.5 font-semibold text-muted-foreground">ACUM.</td>
              <td className="px-3 py-1.5 text-center font-bold text-success">{fmtBR(real)}%</td>
              <td className="px-3 py-1.5 text-center font-bold text-primary">{fmtBR(prev)}%</td>
              <td className={`px-3 py-1.5 text-center font-bold ${desvio < 0 ? 'text-destructive' : 'text-success'}`}>
                {desvio >= 0 ? '+' : ''}{fmtBR(desvio)} pp
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};


export default ContractThermometer;
