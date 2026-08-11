import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { useContractPerformance } from '@/hooks/use-contract-performance';

const fmtBR = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

// Escala do velocímetro: IDP de 0 a 120%
const MAX = 120;
const ZONES = [
  { from: 0, to: 80, color: 'hsl(var(--destructive))', label: 'Atrasado' },
  { from: 80, to: 95, color: 'hsl(var(--warning))', label: 'Em risco' },
  { from: 95, to: MAX, color: 'hsl(var(--success))', label: 'No prazo' },
];

const CX = 200;
const CY = 190;
const OUTER_R = 145;
const INNER_R = 88;
const LABEL_R = OUTER_R + 20;

/** Converte um valor da escala (0..MAX) para o ângulo do semicírculo (π..0). */
const toAngle = (value: number) => Math.PI - (Math.min(Math.max(value, 0), MAX) / MAX) * Math.PI;

const arcPath = (from: number, to: number) => {
  const a0 = toAngle(from);
  const a1 = toAngle(to);
  const outerStart = { x: CX + OUTER_R * Math.cos(a0), y: CY - OUTER_R * Math.sin(a0) };
  const outerEnd = { x: CX + OUTER_R * Math.cos(a1), y: CY - OUTER_R * Math.sin(a1) };
  const innerStart = { x: CX + INNER_R * Math.cos(a1), y: CY - INNER_R * Math.sin(a1) };
  const innerEnd = { x: CX + INNER_R * Math.cos(a0), y: CY - INNER_R * Math.sin(a0) };
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${INNER_R} ${INNER_R} 0 0 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
};

const ContractThermometer = () => {
  const { idp, avancoReal, refPrev, desvio, hasReplanejado, status, statusLabel } = useContractPerformance();

  const badge = status === 'ok'
    ? { Icon: ShieldCheck, cls: 'bg-success/15 text-success border-success/30' }
    : status === 'risk'
      ? { Icon: ShieldAlert, cls: 'bg-warning/15 text-warning border-warning/30' }
      : { Icon: ShieldX, cls: 'bg-destructive/15 text-destructive border-destructive/30' };

  const idpColor = status === 'ok' ? 'hsl(var(--success))' : status === 'risk' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  const needleAngle = toAngle(idp);
  const needleLen = OUTER_R - 25;
  const needleTip = {
    x: CX + needleLen * Math.cos(needleAngle),
    y: CY - needleLen * Math.sin(needleAngle),
  };

  const refColLabel = hasReplanejado ? 'Replanejado' : 'Previsto';

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Termômetro do Contrato</h3>
          <p className="text-xs text-muted-foreground">
            IDP · realizado × {hasReplanejado ? 'replanejado' : 'previsto'} acumulado
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${badge.cls}`}>
          <badge.Icon className="h-3.5 w-3.5" />
          {statusLabel}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 400 250" className="w-full max-w-[380px]">
          {ZONES.map((z) => (
            <path key={z.label} d={arcPath(z.from, z.to)} fill={z.color} stroke="hsl(var(--card))" strokeWidth="2" />
          ))}

          {ZONES.map((z) => {
            const mid = toAngle((z.from + z.to) / 2);
            return (
              <text
                key={`${z.label}-lbl`}
                x={CX + LABEL_R * Math.cos(mid)}
                y={CY - LABEL_R * Math.sin(mid)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
                fontWeight="600"
              >
                {z.label}
              </text>
            );
          })}

          {/* Ponteiro */}
          <motion.line
            initial={{ x2: CX + needleLen * Math.cos(Math.PI), y2: CY }}
            animate={{ x2: needleTip.x, y2: needleTip.y }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            x1={CX}
            y1={CY}
            stroke="hsl(var(--foreground))"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r="8" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="3" />

          <text x={CX} y={CY + 42} textAnchor="middle" fill={idpColor} fontSize="26" fontWeight="bold">
            {fmtBR(idp, 1)}%
          </text>
          <text x={CX} y={CY + 62} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10" fontWeight="600" letterSpacing="1">
            IDP · DESEMPENHO DE PRAZO
          </text>
        </svg>
      </div>

      <table className="w-full text-xs border-collapse mt-2">
        <thead>
          <tr className="bg-table-header text-table-header-foreground">
            <th className="px-3 py-2.5 text-left font-semibold rounded-tl-lg" />
            <th className="px-3 py-2.5 text-center font-semibold">Realizado</th>
            <th className="px-3 py-2.5 text-center font-semibold">{refColLabel}</th>
            <th className="px-3 py-2.5 text-center font-semibold rounded-tr-lg">Desvio</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-3 py-2.5 font-bold text-foreground">ACUM.</td>
            <td className={`px-3 py-2.5 text-center font-semibold ${avancoReal >= refPrev ? 'text-success' : 'text-destructive'}`}>
              {fmtBR(avancoReal)}%
            </td>
            <td className="px-3 py-2.5 text-center font-semibold text-foreground">{fmtBR(refPrev)}%</td>
            <td className={`px-3 py-2.5 text-center font-semibold ${desvio < 0 ? 'text-destructive' : 'text-success'}`}>
              {desvio >= 0 ? '+' : ''}{fmtBR(desvio)} pp
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ContractThermometer;
