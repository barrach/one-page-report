import { formatDDmmm, parseISOLocal, somarDias, PASSO_DIAS, type Periodicidade } from '@/lib/dateUtils';

export type { Periodicidade };

/**
 * Curva S a partir do MS Project.
 *
 * O Project não exporta percentual: o "Relatório Visual → Valor Acumulado" e a
 * visão Uso da Tarefa entregam valores ABSOLUTOS acumulados por escala de tempo,
 * em horas (Trabalho) ou em dinheiro (Custo). São três séries:
 *
 *   • Trabalho/Custo de Linha de Base Acumulado → o plano original  → Previsto
 *   • Trabalho/Custo Real Acumulado             → o que foi feito   → Real
 *   • Trabalho/Custo Acumulado                  → o plano corrente
 *     (real + restante, a estimativa no término)                    → Tendência
 *
 * Converter para percentual é dividir as três pelo MESMO denominador — o total
 * da linha de base (o BAC do valor agregado). Normalizar cada série pelo próprio
 * total seria errado: o Real terminaria sempre em 100% e o desvio sumiria do
 * gráfico, que é justamente o que a curva existe para mostrar.
 */

/** Em que unidade o MS Project exportou a curva. */
export type BaseCurva = 'trabalho' | 'custo';

export const ROTULO_BASE: Record<BaseCurva, { titulo: string; unidade: string }> = {
  trabalho: { titulo: 'Trabalho (HH)', unidade: 'h' },
  custo: { titulo: 'Custo (R$)', unidade: 'R$' },
};

/** Um período da exportação, em valor absoluto acumulado. */
export interface PontoAcumulado {
  /** Trabalho/Custo de Linha de Base Acumulado. */
  linhaBase: number | null;
  /** Trabalho/Custo Real Acumulado. */
  real: number | null;
  /** Trabalho/Custo Acumulado (plano corrente). */
  acumulado: number | null;
}

/** Um período já convertido — mesmo formato da Curva S do relatório. */
export interface PontoCurvaPct {
  date: string;
  previsto: number;
  real: number;
  tendencia: number;
}

export interface ResultadoConversao {
  curva: PontoCurvaPct[];
  /** O valor que vale 100% (total da linha de base). */
  total: number;
  /** Índice do último período com avanço real — a data de status. -1 se não houver. */
  statusIndex: number;
}

/** Rótulos "dd/mmm" a partir do início da obra, avançando pela periodicidade. */
export const gerarDatas = (
  inicioISO: string,
  periodicidade: Periodicidade,
  quantidade: number,
): string[] => {
  const inicio = parseISOLocal(inicioISO);
  if (!inicio || quantidade <= 0) return [];
  const passo = PASSO_DIAS[periodicidade];
  return Array.from({ length: quantidade }, (_, i) => formatDDmmm(somarDias(inicio, i * passo)));
};

/** Frase de conferência: mostra em palavras como a curva vai avançar. */
export const descreverPeriodicidade = (
  inicioISO: string,
  periodicidade: Periodicidade,
): string => {
  const datas = gerarDatas(inicioISO, periodicidade, 4);
  if (datas.length === 0) return 'Informe a data de início da obra para ver como a curva avança.';
  const ritmo = periodicidade === 'semanal'
    ? 'cada ponto avança 7 dias'
    : 'cada ponto avança 1 dia';
  return `Começando em ${datas[0]}, ${ritmo}: ${datas.join(' → ')} …`;
};

/**
 * O valor que representa 100%.
 *
 * É o último Acumulado da linha de base — as séries são monotônicas, então o
 * último é o total no término. Sem linha de base salva no Project, cai no maior
 * valor de qualquer série, para a curva ainda sair proporcional.
 */
export const totalReferencia = (pontos: PontoAcumulado[]): number => {
  for (let i = pontos.length - 1; i >= 0; i--) {
    const lb = pontos[i]?.linhaBase ?? 0;
    if (lb > 0) return lb;
  }
  return pontos.reduce(
    (max, p) => Math.max(max, p.linhaBase ?? 0, p.acumulado ?? 0, p.real ?? 0),
    0,
  );
};

const pct = (valor: number | null, total: number): number => {
  if (valor == null || !isFinite(valor) || total <= 0) return 0;
  return Math.round((valor / total) * 10000) / 100;
};

/**
 * Converte os acumulados absolutos em percentual da linha de base.
 *
 * O Real Acumulado do MS Project não zera nos períodos futuros: ele repete o
 * último valor até o fim do cronograma. Deixar isso passar desenharia a linha de
 * Real seguindo reta para o futuro, como se a obra continuasse avançando depois
 * da data de status. Por isso a série é cortada no último período em que ela
 * realmente cresceu.
 */
export const converterParaPercentual = (
  pontos: PontoAcumulado[],
  datas: string[],
): ResultadoConversao => {
  const total = totalReferencia(pontos);

  let statusIndex = -1;
  let maiorReal = 0;
  pontos.forEach((p, i) => {
    const v = p.real ?? 0;
    if (v > maiorReal) { maiorReal = v; statusIndex = i; }
  });

  const curva = pontos.map((p, i) => ({
    date: datas[i] ?? '',
    previsto: pct(p.linhaBase, total),
    real: i <= statusIndex ? pct(p.real, total) : 0,
    tendencia: pct(p.acumulado, total),
  }));

  return { curva, total, statusIndex };
};

/**
 * Lê um número digitado ou colado do Excel.
 *
 * Aceita "1.234,50", "1,234.50", "480 h", "R$ 1.200,00" e vazio (→ null, que é
 * diferente de zero: período sem informação não pode virar 0% no gráfico).
 */
export const lerNumero = (bruto: string): number | null => {
  const txt = String(bruto ?? '').trim();
  if (!txt) return null;
  const limpo = txt.replace(/[^0-9,.-]/g, '');
  if (!limpo) return null;
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const normal = ultimaVirgula >= 0 && ultimaVirgula > ultimoPonto
    ? limpo.replace(/\./g, '').replace(',', '.') // vírgula decimal: 1.234,50
    : limpo.replace(/,/g, '');                   // ponto decimal:   1,234.50
  const n = parseFloat(normal);
  return isFinite(n) ? n : null;
};

/**
 * Lê a colagem do Excel/MS Project, em linhas ou em colunas.
 *
 * Aceita os dois sentidos porque o Project entrega a curva deitada (uma linha
 * por série, um período por coluna) e o Excel, depois de um "colar especial",
 * costuma sair em pé. A orientação é decidida pelo conteúdo: se a primeira
 * célula de alguma linha nomeia uma série, é por linha; senão, por coluna.
 */
export const lerColagem = (texto: string): PontoAcumulado[] => {
  const linhas = texto.trim().split(/\r?\n/).map((l) => l.split('\t'));
  if (linhas.length === 0) return [];

  const ehLinhaBase = (s: string) => /linha\s*de\s*base|baseline|previsto|planejado/i.test(s);
  const ehReal = (s: string) => /real|realizado|actual/i.test(s);
  const ehAcumulado = (s: string) => /acumulad|cumulative|trabalho|custo|tend/i.test(s);

  const series: Partial<Record<keyof PontoAcumulado, (number | null)[]>> = {};
  let achouRotulo = false;

  for (const celulas of linhas) {
    const primeira = (celulas[0] ?? '').trim();
    if (!primeira) continue;
    const valores = celulas.slice(1).map(lerNumero);
    // Sem número nenhum depois do rótulo não é uma série deitada — é o cabeçalho
    // de uma colagem em pé ("Linha de Base | Real | Acumulado"). Sem esta guarda,
    // o cabeçalho virava a série inteira e a curva saía toda vazia.
    if (!valores.some((v) => v != null)) continue;
    // A ordem importa: "Trabalho Real Acumulado" casa com real E com acumulado,
    // e o que vale é o rótulo mais específico.
    if (ehLinhaBase(primeira)) { series.linhaBase = valores; achouRotulo = true; }
    else if (ehReal(primeira)) { series.real = valores; achouRotulo = true; }
    else if (ehAcumulado(primeira)) { series.acumulado = valores; achouRotulo = true; }
  }

  if (achouRotulo) {
    const n = Math.max(
      series.linhaBase?.length ?? 0,
      series.real?.length ?? 0,
      series.acumulado?.length ?? 0,
    );
    return Array.from({ length: n }, (_, i) => ({
      linhaBase: series.linhaBase?.[i] ?? null,
      real: series.real?.[i] ?? null,
      acumulado: series.acumulado?.[i] ?? null,
    }));
  }

  // Sem rótulo: colunas na ordem Linha de Base | Real | Acumulado. Uma primeira
  // linha só de texto é cabeçalho e cai fora por não ter número nenhum.
  const corpo = linhas.filter((c) => c.some((v) => lerNumero(v) != null));
  return corpo.map((c) => ({
    linhaBase: lerNumero(c[0]),
    real: lerNumero(c[1]),
    acumulado: lerNumero(c[2]),
  }));
};
