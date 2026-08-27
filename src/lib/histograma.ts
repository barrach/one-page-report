import { parseISOLocal, parseWeekLabel, somarDias } from '@/lib/dateUtils';

/**
 * Histograma de MOD: recorte de período e alinhamento com a Curva S.
 *
 * O histograma tem que cobrir a obra inteira, semana a semana, do início ao
 * fim — as semanas vêm da Curva S, que é quem já sabe esse calendário. No
 * relatório, olhar a obra inteira de uma vez raramente é o que se quer: daí o
 * recorte de 15 ou 30 dias em torno da data de status.
 */

const MESES_ABREV: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  feb: 1, apr: 3, may: 4, aug: 7, sep: 8, oct: 9, dec: 11,
};

/**
 * Data de um rótulo do histograma.
 *
 * Aceita os dois formatos que circulam aqui: "08/dez" (o mesmo da Curva S) e
 * "Dez/25 S2", que é como a importação da planilha nomeia as semanas do mês.
 */
export const dataDoRotulo = (rotulo: string, anoRef: number): Date | null => {
  const txt = String(rotulo ?? '').trim();
  if (!txt) return null;

  const mesSemana = /^([a-zç]{3})[a-zç]*\/(\d{2,4})\s*s\s*(\d)$/i.exec(txt);
  if (mesSemana) {
    const mes = MESES_ABREV[mesSemana[1].toLowerCase()];
    if (mes == null) return null;
    let ano = parseInt(mesSemana[2], 10);
    if (ano < 100) ano += 2000;
    const semana = parseInt(mesSemana[3], 10);
    // A semana N do mês começa por volta do dia (N-1)*7+1.
    return new Date(ano, mes, Math.min(28, (semana - 1) * 7 + 1));
  }

  return parseWeekLabel(txt, anoRef);
};

const chaveDoDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export interface PontoHistograma {
  date: string;
  semana: string;
  previsto: number;
  real: number;
  /** MOD replanejada — preenchida à mão quando há replanejamento. */
  replanejado?: number;
}

/**
 * Colagem do Excel no histograma: uma linha por série, na ordem
 * previsto → real → replanejado.
 *
 * Os valores caem nas colunas que já estão na tela, pela posição — as semanas
 * vêm da Curva S, então a planilha de origem só precisa estar na mesma ordem.
 * Uma primeira célula de texto é rótulo e sai fora.
 */
export const lerColagemHistograma = (
  texto: string,
): { previsto: number[]; real: number[]; replanejado: number[] } => {
  const numero = (c: string): number | null => {
    const t = String(c ?? '').trim();
    if (!t) return null;
    const n = parseFloat(t.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : null;
  };

  const linhas = String(texto ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (l.includes('\t') ? l.split('\t') : l.trim().split(/\s+/)))
    .filter((c) => c.some((v) => numero(v) != null))
    .map((celulas) => {
      const semRotulo = numero(celulas[0]) == null ? celulas.slice(1) : celulas;
      return semRotulo.map((c) => numero(c) ?? 0);
    });

  return {
    previsto: linhas[0] ?? [],
    real: linhas[1] ?? [],
    replanejado: linhas[2] ?? [],
  };
};

/**
 * Estende o histograma para todas as semanas da obra.
 *
 * As colunas passam a ser as da Curva S — início ao fim do projeto — e o que já
 * estava lançado é reaproveitado casando pela DATA, não pelo texto: a planilha
 * nomeia as semanas de um jeito ("Dez/25 S2") e a curva de outro ("08/dez"), e
 * casar por texto perderia tudo que já havia sido preenchido.
 */
export const alinharComCurva = (
  historico: PontoHistograma[] | undefined,
  curva: { date: string }[] | undefined,
  anoRef: number,
): PontoHistograma[] => {
  const hist = historico ?? [];
  const semanas = (curva ?? []).filter((c) => c.date);
  if (semanas.length === 0) return hist;

  const porDia = new Map<string, PontoHistograma>();
  hist.forEach((h) => {
    const d = dataDoRotulo(h.date, anoRef);
    if (d) porDia.set(chaveDoDia(d), h);
  });

  return semanas.map((c) => {
    const d = parseWeekLabel(c.date, anoRef);
    const achado = d ? porDia.get(chaveDoDia(d)) : undefined;
    return achado ?? { date: c.date, semana: '', previsto: 0, real: 0 };
  });
};

export type PeriodoHistograma = 'tudo' | '15' | '30';

export const ROTULO_PERIODO: Record<PeriodoHistograma, string> = {
  tudo: 'Projeto inteiro',
  '15': '15 dias',
  '30': '30 dias',
};

/**
 * Recorte em torno da data de status — metade para trás, metade para frente,
 * para o card mostrar o que acabou de acontecer e o que vem pela frente.
 *
 * Recorte que não sobra nada devolve a série inteira: card vazio esconderia o
 * dado sem explicar por quê.
 */
export const filtrarPeriodo = <T extends { date: string }>(
  dados: T[],
  atualizadoEm: string,
  periodo: PeriodoHistograma,
): T[] => {
  if (periodo === 'tudo') return dados;
  const ref = parseISOLocal(atualizadoEm);
  if (!ref) return dados;

  const meia = (periodo === '15' ? 15 : 30) / 2;
  const inicio = somarDias(ref, -meia).getTime();
  const fim = somarDias(ref, meia).getTime();
  const anoRef = ref.getFullYear();

  const recorte = dados.filter((d) => {
    const dt = dataDoRotulo(d.date, anoRef);
    return dt != null && dt.getTime() >= inicio && dt.getTime() <= fim;
  });
  return recorte.length > 0 ? recorte : dados;
};

/** Índice da coluna da data de status — para onde a planilha deve rolar. */
export const indiceDaSemanaDeStatus = (
  dados: { date: string }[],
  atualizadoEm: string,
): number => {
  const ref = parseISOLocal(atualizadoEm);
  if (!ref || dados.length === 0) return -1;
  const anoRef = ref.getFullYear();

  let melhor = -1;
  let menor = Infinity;
  dados.forEach((d, i) => {
    const dt = dataDoRotulo(d.date, anoRef);
    if (!dt) return;
    const dif = Math.abs(dt.getTime() - ref.getTime());
    if (dif < menor) { menor = dif; melhor = i; }
  });
  return melhor;
};
