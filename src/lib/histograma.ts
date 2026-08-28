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
  /** MOD prevista. */
  previsto: number;
  /** MOD real. */
  real: number;
  /** MOD replanejada — preenchida à mão quando há replanejamento. */
  replanejado?: number;
  /** MOI — a indireta: encarregado, segurança, apontador, almoxarife. */
  moiPrevisto?: number;
  moiReal?: number;
  moiReplanejado?: number;
}

/** As seis séries que a planilha pode trazer. */
export type SerieHistograma =
  | 'previsto' | 'real' | 'replanejado'
  | 'moiPrevisto' | 'moiReal' | 'moiReplanejado';

export type SeriesColadas = Partial<Record<SerieHistograma, number[]>>;

/**
 * Qual série é a linha, pelo rótulo da primeira célula.
 *
 * A ordem dos testes importa: "replanejado" é checado antes de "previsto"
 * porque na planilha a linha costuma vir como "MOD Previsto Replanejado", e
 * quem manda ali é o replanejamento.
 */
export const serieDoRotulo = (rotulo: string): SerieHistograma | null => {
  const t = String(rotulo ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();
  if (!t) return null;

  const indireta = /\bmoi\b|indiret/.test(t);
  const direta = /\bmod\b|diret/.test(t);
  // Sem MOD nem MOI escrito, a linha é da direta: era o único conteúdo do
  // histograma antes de a MOI existir, e nenhuma planilha antiga muda de
  // significado por causa desta versão.
  if (!indireta && !direta && !/prev|real|replan/.test(t)) return null;

  const qual = /replan/.test(t) ? 'replanejado' : /real/.test(t) ? 'real' : /prev/.test(t) ? 'previsto' : null;
  if (!qual) return null;

  if (!indireta) return qual;
  return qual === 'previsto' ? 'moiPrevisto' : qual === 'real' ? 'moiReal' : 'moiReplanejado';
};

/** Ordem posicional de quando a colagem não traz rótulo nenhum. */
const ORDEM_SEM_ROTULO: SerieHistograma[] = ['previsto', 'real', 'replanejado'];

/**
 * Colagem do Excel no histograma.
 *
 * Duas formas, e a escolha é da planilha:
 *
 * — Com rótulo na primeira célula ("MOD Previsto", "MOI Real", "Replanejado"),
 *   cada linha vai para a série que o rótulo nomeia, em qualquer ordem. É o
 *   único jeito de colar MOI, porque seis séries em posição fixa ninguém
 *   memoriza.
 * — Sem rótulo nenhum, vale a ordem de sempre: previsto, real, replanejado.
 *   Mantida exatamente como era para não mudar o significado de uma colagem
 *   que já funcionava.
 *
 * Os valores caem nas colunas que já estão na tela, pela posição — as semanas
 * vêm da Curva S, então a planilha de origem só precisa estar na mesma ordem.
 */
export const lerColagemHistograma = (texto: string): SeriesColadas => {
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
      const temRotulo = numero(celulas[0]) == null;
      return {
        serie: temRotulo ? serieDoRotulo(celulas[0]) : null,
        valores: (temRotulo ? celulas.slice(1) : celulas).map((c) => numero(c) ?? 0),
      };
    });

  const saida: SeriesColadas = {};
  const comRotulo = linhas.some((l) => l.serie != null);

  linhas.forEach((l, i) => {
    // Basta UMA linha rotulada para a colagem inteira passar a ser por rótulo:
    // misturar os dois critérios na mesma colagem escreveria série errada sem
    // ninguém perceber.
    const destino = comRotulo ? l.serie : ORDEM_SEM_ROTULO[i];
    if (destino) saida[destino] = l.valores;
  });

  return saida;
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
 * Recorte de 15 ou 30 dias a partir da SEMANA DE ANÁLISE, para frente.
 *
 * Antes a janela era centrada na data de status, metade para trás. Mas o
 * histograma é o gráfico de decisão de efetivo: o que a reunião resolve é
 * quanta gente colocar nas próximas semanas — a semana que já passou está
 * apontada, e enche metade do card com número que ninguém vai mudar.
 *
 * O começo é a data da PRÓPRIA coluna de status, não a data de status: a
 * semana costuma ser rotulada pelo seu primeiro dia, e cortar pela data exata
 * jogaria a semana em análise para fora do próprio recorte.
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

  const anoRef = ref.getFullYear();
  const idx = indiceDaSemanaDeStatus(dados, atualizadoEm);
  const inicioDt = idx >= 0 ? dataDoRotulo(dados[idx].date, anoRef) : null;

  const inicio = (inicioDt ?? ref).getTime();
  const fim = somarDias(ref, periodo === '15' ? 15 : 30).getTime();

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
