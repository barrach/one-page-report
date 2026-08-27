import { datasDaCurva, parseISOLocal, parseWeekLabel, type Periodicidade } from '@/lib/dateUtils';

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

/**
 * As semanas da Curva S que caem no mês do "Atualizado em".
 *
 * Quando o início da obra é conhecido, a data de cada ponto vem da POSIÇÃO na
 * curva (início + n períodos) e não do rótulo. Os rótulos não têm ano, e numa
 * obra de mais de um ano isso trazia agosto de dois anos diferentes para o mesmo
 * card. Sem o início, cai na leitura do rótulo, que é o melhor possível ali.
 *
 * Numa curva semanal que começa numa segunda, as semanas do mês são exatamente
 * as segundas — a primeira delas é a primeira segunda-feira do mês.
 */
export const visaoMensal = (
  sCurve: PontoMensal[] | undefined,
  atualizadoEm: string,
  base: BaseMensal = 'linhaBase',
  opts: { inicio?: string; periodicidade?: Periodicidade } = {},
): SemanaDoMes[] => {
  const pontos = sCurve ?? [];
  const ref = parseISOLocal(atualizadoEm);
  if (pontos.length === 0 || !ref) return [];

  const anoRef = ref.getFullYear();
  const mes = ref.getMonth();
  const porPosicao = opts.inicio
    ? datasDaCurva(pontos.length, opts.inicio, opts.periodicidade ?? 'semanal')
    : null;

  return pontos
    .map((p, i) => ({ ponto: p, data: porPosicao ? porPosicao[i] : parseWeekLabel(p.date, anoRef) }))
    .filter(({ data }) => data != null && data.getMonth() === mes && data.getFullYear() === anoRef)
    .map(({ ponto }) => ({
      label: ponto.date,
      previsto: r2(base === 'tendencia' ? (ponto.tendencia ?? 0) : (ponto.previsto ?? 0)),
      real: r2(ponto.real ?? 0),
    }));
};
