/**
 * Avanço previsto e real do cabeçalho, lidos da Curva S.
 *
 * Os dois KPIs do topo do relatório não são um lançamento à parte: são o ponto
 * da Curva S na data de status. Mantê-los digitados à mão fazia o cabeçalho
 * discordar do próprio gráfico logo abaixo dele.
 *
 * Havendo replanejamento, o previsto que vale é o replanejado — é ele que passa
 * a ser o compromisso. O real vem sempre da linha de Real Acum. %.
 */

export interface PontoAvanco {
  date: string;
  previsto: number;
  real: number;
  replanejado?: number;
  realReplanejado?: number;
}

export interface Avanco {
  previsto: number;
  real: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O avanço na data de status.
 *
 * `null` quando não há ponto ou o ponto está zerado — nesse caso o que já estava
 * no cabeçalho fica, em vez de ser apagado por uma curva ainda vazia.
 */
export const avancoDaCurva = (
  sCurve: PontoAvanco[] | undefined,
  statusIndex: number,
): Avanco | null => {
  const ponto = (sCurve ?? [])[statusIndex];
  if (!ponto) return null;

  const replanejado = ponto.replanejado ?? 0;
  const previsto = replanejado > 0 ? replanejado : (ponto.previsto ?? 0);
  const real = ponto.real ?? 0;

  if (previsto <= 0 && real <= 0) return null;
  return { previsto: r2(previsto), real: r2(real) };
};
