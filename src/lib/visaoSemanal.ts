import { janelaCentradaNaData, type JanelaItem, type Periodicidade } from '@/lib/dateUtils';

/** O mínimo que a Curva S precisa expor para alimentar a visão semanal. */
export interface PontoTendencia {
  date: string;
  tendencia?: number;
}

/**
 * A Visão de 5 Semanas do relatório.
 *
 * Duas regras, as duas vindas de como a obra é acompanhada:
 *
 *  1. A janela é SEMPRE centrada na data de "Atualizado em" — duas semanas
 *     atrás, a semana de status e duas à frente. Quando a série não alcança um
 *     dos lados, o período entra vazio em vez de a janela deslizar.
 *
 *  2. O Previsto não é digitado: vem da Tendência % da Curva S na data
 *     correspondente. A curva é a fonte da verdade do planejado, e manter os
 *     dois lados editáveis em separado só criava divergência entre a tabela e o
 *     gráfico.
 *
 * O Real continua vindo da série semanal, que é onde ele é lançado.
 */
export const visaoCincoSemanas = (
  semanas: JanelaItem[],
  sCurve: PontoTendencia[],
  atualizadoEm: string,
  periodicidade: Periodicidade = 'semanal',
  size = 5,
): JanelaItem[] => {
  const janela = janelaCentradaNaData(semanas ?? [], atualizadoEm, { size, periodicidade });
  return janela.map((semana) => {
    const ponto = (sCurve ?? []).find((p) => p.date === semana.date);
    // Sem ponto na curva para aquela data, fica o que a série semanal tinha —
    // zerar apagaria dado lançado à mão só porque a curva não chega ali.
    return ponto ? { ...semana, previsto: ponto.tendencia ?? 0 } : semana;
  });
};
