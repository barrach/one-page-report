import { parseISOLocal, parseWeekLabel } from '@/lib/dateUtils';

/**
 * Prev. × Realizado do mês, tirado da Curva S.
 *
 * O mês é o do "Atualizado em": com status em 20/05/2026, o card mostra maio de
 * 2026. Dentro dele entram as semanas da curva que caem naquele mês — quatro ou
 * cinco, conforme o calendário.
 *
 * Digitar esses números à parte era manter a mesma informação em dois lugares,
 * e os dois divergiam assim que a curva era reimportada.
 */

/** Contra o que o mês é comparado. */
export type BaseMensal = 'linhaBase' | 'tendencia';

export const ROTULO_BASE_MENSAL: Record<BaseMensal, string> = {
  linhaBase: 'Linha de base',
  tendencia: 'Tendência',
};

export interface PontoMensal {
  date: string;
  previsto: number;
  real: number;
  tendencia?: number;
}

export interface SemanaDoMes {
  label: string;
  previsto: number;
  real: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** As semanas da Curva S que caem no mês do "Atualizado em". */
export const visaoMensal = (
  sCurve: PontoMensal[] | undefined,
  atualizadoEm: string,
  base: BaseMensal = 'linhaBase',
): SemanaDoMes[] => {
  const pontos = sCurve ?? [];
  const ref = parseISOLocal(atualizadoEm);
  if (pontos.length === 0 || !ref) return [];

  const anoRef = ref.getFullYear();
  const mes = ref.getMonth();

  return pontos
    .map((p) => ({ ponto: p, data: parseWeekLabel(p.date, anoRef) }))
    .filter(({ data }) => data != null && data.getMonth() === mes && data.getFullYear() === anoRef)
    .map(({ ponto }) => ({
      label: ponto.date,
      previsto: r2(base === 'tendencia' ? (ponto.tendencia ?? 0) : (ponto.previsto ?? 0)),
      real: r2(ponto.real ?? 0),
    }));
};
