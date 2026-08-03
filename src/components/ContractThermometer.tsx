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

  // Gauge geometry (0% .. 120% mapped to 180deg .. 0deg)
  const MIN = 0;
  const MAX = 120;
  const cx = 200;
  const cy = 170;
  const outerR = 140;
  const innerR = 96;

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
    { from: 0, to: 80, color: 'hsl(var(--destructive))', label: 'Atrasado' },
    { from: 80, to: 95, color: 'hsl(var(--warning))', label: 'Em risco' },
    { from: 95, to: 120, color: 'hsl(var(--success))', label: 'No prazo' },
  ];

  const status =
    idp >= 95
      ? { label: 'No Prazo', tone: 'text-success', chip: 'bg-success/15 text-success border-success/30' }
      : idp >= 80
      ? { label: 'Em Risco', tone: 'text-warning', chip: 'bg-warning/15 text-warning border-warning/30' }
      : { label: 'Atrasado', tone: 'text-destructive', chip: 'bg-destructive/15 text-destructive border-destructive/30' };

  const needleAngle = valueToAngle(idp);
  const needleLen = outerR - 16;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Termômetro do Contrato</h3>
          <p className="text-xs text-muted-foreground">
            Índice de desempenho (IDP) · realizado × {hasReplanejado ? 'replanejado' : 'previsto'} acumulado
          </p>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.chip}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-4 items-center">
        <svg viewBox="0 0 400 232" className="w-full max-w-[420px] mx-auto">
          {zones.map((z) => (
            <path key={z.label} d={arcPath(z.from, z.to)} fill={z.color} opacity={0.85} />
          ))}

          {[0, 20, 40, 60, 80, 100, 120].map((tick) => {
            const a = valueToAngle(tick);
            const r1 = outerR + 4;
            const r2 = outerR + 12;
            return (
              <g key={tick}>
                <line
                  x1={cx + r1 * Math.cos(a)}
                  y1={cy - r1 * Math.sin(a)}
                  x2={cx + r2 * Math.cos(a)}
                  y2={cy - r2 * Math.sin(a)}
                  stroke="hsl(var(--border))"
                  strokeWidth="2"
                />
                <text
                  x={cx + (r2 + 10) * Math.cos(a)}
                  y={cy - (r2 + 10) * Math.sin(a)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fill="hsl(var(--muted-foreground))"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="8" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy={cy} r="4" fill="hsl(var(--card))" />

          <text x={cx} y={cy + 30} textAnchor="middle" fontSize="26" fontWeight="700" fill="hsl(var(--foreground))">
            {fmtBR(idp, 1)}%
          </text>
          <text x={cx} y={cy + 46} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
            IDP · DESEMPENHO DE PRAZO
          </text>
        </svg>

        <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado</p>
            <p className="text-base font-bold text-success">{fmtBR(real)}%</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {hasReplanejado ? 'Replanejado' : 'Previsto'}
            </p>
            <p className="text-base font-bold text-primary">{fmtBR(prev)}%</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Desvio</p>
            <p className={`text-base font-bold ${desvio < 0 ? 'text-destructive' : 'text-success'}`}>
              {desvio >= 0 ? '+' : ''}
              {fmtBR(desvio)} pp
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ContractThermometer;
