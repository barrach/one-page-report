import { parseISOLocal, somarDias } from '@/lib/dateUtils';

/**
 * Data de término projetada pelo desempenho da obra.
 *
 * O "Término Prev." do cabeçalho é digitado à mão — é a data em que alguém
 * acredita, não a que o ritmo aponta. Esta é a outra: pega a duração da linha de
 * base e a estica na razão em que a obra está andando.
 *
 *     duração projetada = duração da linha de base ÷ IDP
 *
 * É o mesmo cálculo do SPI no valor agregado. Com IDP de 50%, a obra leva o
 * dobro do planejado; com 100%, termina na data da linha de base.
 */

export interface PrevisaoTermino {
  /** ISO yyyy-mm-dd da data projetada. */
  data: string;
  /** Dias de atraso (positivo) ou adiantamento (negativo) contra a linha de base. */
  desvioDias: number;
  /** Duração da linha de base, em dias. */
  duracaoBase: number;
}

/**
 * `null` quando não dá para projetar honestamente: sem datas, sem linha de base
 * ou com IDP zerado. Chutar uma data nesse caso seria pior que não mostrar —
 * ela viraria compromisso na reunião seguinte.
 */
export const projetarTermino = (
  inicioISO: string,
  terminoBaseISO: string,
  /** IDP em percentual, como o cabeçalho já mostra: 87 = 87%. */
  idpPercentual: number,
): PrevisaoTermino | null => {
  const inicio = parseISOLocal(inicioISO);
  const base = parseISOLocal(terminoBaseISO);
  if (!inicio || !base) return null;

  const duracaoBase = Math.round((base.getTime() - inicio.getTime()) / 86_400_000);
  if (duracaoBase <= 0) return null;

  const idp = idpPercentual / 100;
  // IDP muito baixo projeta uma data absurda (5% de desempenho = 20× a duração).
  // Abaixo disso a obra não tem ritmo do qual extrapolar.
  if (!isFinite(idp) || idp < 0.1) return null;

  const duracaoProjetada = Math.round(duracaoBase / idp);
  const data = somarDias(inicio, duracaoProjetada);

  return {
    data: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`,
    desvioDias: duracaoProjetada - duracaoBase,
    duracaoBase,
  };
};
