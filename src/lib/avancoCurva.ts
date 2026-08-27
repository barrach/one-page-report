import { parseISOLocal, parseWeekLabel } from '@/lib/dateUtils';

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
 * Corta a curva no Término Previsto.
 *
 * O MS Project entrega a escala de tempo inteira, e o rabo depois do término
 * previsto é só a curva repetindo o último valor — no gráfico virava uma reta
 * comprida que achatava a parte que interessa. O corte é só de exibição: a série
 * guardada continua completa, e a tela de Dados mostra tudo.
 */
export const limitarAoTermino = <T extends { date: string }>(
  sCurve: T[] | undefined,
  terminoPrev: string,
): T[] => {
  const pontos = sCurve ?? [];
  const fim = parseISOLocal(terminoPrev);
  if (!fim || pontos.length === 0) return pontos;

  const anoRef = fim.getFullYear();
  const dentro = pontos.filter((p) => {
    const d = parseWeekLabel(p.date, anoRef);
    // Ponto sem data legível fica: sumir com ele seria pior que mostrá-lo.
    return d == null || d.getTime() <= fim.getTime();
  });
  return dentro.length > 0 ? dentro : pontos;
};

/**
 * Qual coluna da Curva S é a data de status.
 *
 * Quem manda é o "Atualizado em": ele é uma data de verdade, enquanto o índice
 * guardado escorrega assim que a curva ganha ou perde períodos. Guardar os dois
 * em separado deixava o marcador apontando para uma semana e o cabeçalho
 * dizendo outra.
 *
 * Casa pela data exata; não havendo, fica na última coluna que já passou. Sem
 * "Atualizado em" legível, devolve o `padrao` recebido.
 */
export const indiceDoStatus = (
  sCurve: { date: string }[] | undefined,
  atualizadoEm: string,
  padrao = 0,
): number => {
  const pontos = sCurve ?? [];
  if (pontos.length === 0) return padrao;

  const ref = parseISOLocal(atualizadoEm);
  if (!ref) return Math.min(padrao, pontos.length - 1);

  const anoRef = ref.getFullYear();
  let melhor = -1;
  let menorDif = Infinity;
  let ultimaPassada = -1;

  pontos.forEach((p, i) => {
    const d = parseWeekLabel(p.date, anoRef);
    if (!d) return;
    const dif = d.getTime() - ref.getTime();
    if (Math.abs(dif) < menorDif) { menorDif = Math.abs(dif); melhor = i; }
    if (dif <= 0) ultimaPassada = i;
  });

  // Um dia de folga cobre o rótulo "dd/mmm" cair na virada do fuso.
  if (melhor >= 0 && menorDif <= 86_400_000) return melhor;
  if (ultimaPassada >= 0) return ultimaPassada;
  if (melhor >= 0) return melhor;
  return Math.min(padrao, pontos.length - 1);
};

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
