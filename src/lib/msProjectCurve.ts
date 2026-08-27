import {
  formatDDmmm,
  formatISOLocal,
  parseISOLocal,
  parseWeekLabel,
  somarDias,
  PASSO_DIAS,
  type Periodicidade,
} from '@/lib/dateUtils';

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
  // Barra nunca aparece num valor, mas aparece em toda data ("Seg 01/Jun/26").
  // Sem esta guarda, a limpeza abaixo transformava aquele cabeçalho no número
  // 126 e a linha de datas entrava na curva como se fosse uma série.
  if (txt.includes('/')) return null;
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

// ─── Leitura da colagem vinda do MS Project ─────────────────────────────────

/** Que série da curva cada linha/coluna colada representa. */
export type PapelSerie = 'linhaBase' | 'real' | 'acumulado' | 'ignorar';

export const ROTULO_PAPEL: Record<PapelSerie, string> = {
  linhaBase: 'Linha de Base Acum.',
  real: 'Real Acum.',
  acumulado: 'Acum. (plano)',
  ignorar: 'Ignorar',
};

export interface SerieLida {
  /** Rótulo que veio junto, quando a seleção incluiu a coluna de nomes. */
  rotulo: string | null;
  valores: (number | null)[];
  /** Papel sugerido pela leitura — a tela deixa corrigir. */
  papel: PapelSerie;
}

export interface LeituraColagem {
  orientacao: 'linhas' | 'colunas';
  series: SerieLida[];
  /** Início lido do cabeçalho de datas, quando a colagem trouxe essa linha. */
  inicio: string | null;
  periodicidade: Periodicidade | null;
  periodos: number;
}

/**
 * "Seg 01/Jun/26" → Date.
 *
 * O cabeçalho da escala de tempo do Project vem com o dia da semana na frente,
 * que precisa sair antes de tentar ler a data.
 */
export const lerDataCabecalho = (bruto: string, anoRef: number): Date | null => {
  const txt = String(bruto ?? '')
    .trim()
    .replace(/^(seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç]*\.?\s+/i, '');
  if (!txt || !/\d/.test(txt)) return null;
  return parseWeekLabel(txt, anoRef);
};

/** Um valor de verdade — `lerNumero` já recusa datas, então basta perguntar. */
const ehValor = (c: string): boolean => lerNumero(c) != null;

/**
 * Papel sugerido pelo rótulo, incluindo as abreviações que o Project usa de
 * fato: "Trab. Acum. Base", "Trab. acum.", "Trab. Real Acum." (e os
 * equivalentes de Custo). Procurar pelos nomes por extenso não pegava nenhum.
 *
 * A ordem dos testes importa: "Trab. Acum. Base" casa com base E com acumulado,
 * e o que vale é o mais específico.
 */
export const papelDoRotulo = (rotulo: string): PapelSerie => {
  const n = rotulo.toLowerCase();
  // "Trab. Acum. Restante" é o que falta, não o que foi feito — somá-lo à curva
  // contaria o mesmo trabalho duas vezes.
  if (/restante|remaining/.test(n)) return 'ignorar';
  if (/base|baseline|planejad/.test(n)) return 'linhaBase';
  if (/real|actual|realizad/.test(n)) return 'real';
  if (/acum|cumulative|trabalho|trab|custo|tend|plano|previsto/.test(n)) return 'acumulado';
  return 'ignorar';
};

/**
 * Ordem em que as linhas saem do Project quando a colagem vem sem rótulo — é a
 * ordem da visão Uso da Tarefa: Base, plano corrente, real.
 */
const ORDEM_PADRAO: PapelSerie[] = ['linhaBase', 'acumulado', 'real'];

/** Tabulação é o normal; espaço é o plano B de quem copiou de outro lugar. */
const dividirCelulas = (linha: string): string[] => {
  if (linha.includes('\t')) return linha.split('\t');
  const porEspacoDuplo = linha.trim().split(/\s{2,}/);
  if (porEspacoDuplo.length > 1) return porEspacoDuplo;
  return linha.trim().split(/\s+/);
};

/**
 * Separa o rótulo dos valores.
 *
 * As células de texto do começo viram o rótulo (juntas, para "Trab. Acum. Base"
 * sobreviver a uma colagem separada por espaço). Uma primeira célula VAZIA não é
 * rótulo: é um período sem valor, e precisa continuar na série — descartá-la
 * empurraria todas as datas uma semana para frente.
 */
const separarRotulo = (celulas: string[]): { rotulo: string | null; valores: (number | null)[] } => {
  let i = 0;
  while (i < celulas.length && celulas[i].trim() !== '' && !ehValor(celulas[i])) i++;
  if (i === 0) return { rotulo: null, valores: celulas.map(lerNumero) };
  return {
    rotulo: celulas.slice(0, i).join(' ').replace(/\s+/g, ' ').trim() || null,
    valores: celulas.slice(i).map(lerNumero),
  };
};

/**
 * Lê a colagem do MS Project ou do Excel.
 *
 * A orientação é decidida pela FORMA, não pelo rótulo: o Project entrega a curva
 * deitada — uma linha por série, uma coluna por período — e quase sempre sem a
 * coluna de nomes, porque a pessoa seleciona só o bloco de números. Decidir pelo
 * rótulo fazia essa colagem cair no modo "em pé", onde cada série virava um
 * período e a curva saía sem sentido.
 *
 * Quando a linha de datas vem junto, dela saem também o início da obra e a
 * periodicidade, que deixam de precisar ser digitados.
 */
export const lerColagem = (texto: string): LeituraColagem => {
  const vazio: LeituraColagem = {
    orientacao: 'linhas', series: [], inicio: null, periodicidade: null, periodos: 0,
  };

  const linhas = String(texto ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map(dividirCelulas)
    .filter((c) => c.some((v) => v.trim() !== ''));
  if (linhas.length === 0) return vazio;

  const anoRef = new Date().getFullYear();
  const maxCelulas = Math.max(...linhas.map((c) => c.length));
  // Mais colunas que linhas → séries deitadas. É o caso do Project.
  const orientacao: 'linhas' | 'colunas' = maxCelulas > linhas.length ? 'linhas' : 'colunas';

  if (orientacao === 'colunas') {
    const temCabecalho = linhas[0].every((c) => !ehValor(c));
    const rotulos = temCabecalho ? linhas[0] : [];
    const corpo = linhas.slice(temCabecalho ? 1 : 0).filter((c) => c.some(ehValor));
    if (corpo.length === 0) return vazio;

    const nCols = Math.max(...corpo.map((c) => c.length));
    const series: SerieLida[] = Array.from({ length: nCols }, (_, j) => {
      const rotulo = (rotulos[j] ?? '').trim() || null;
      return {
        rotulo,
        valores: corpo.map((c) => lerNumero(c[j] ?? '')),
        papel: rotulo ? papelDoRotulo(rotulo) : (ORDEM_PADRAO[j] ?? 'ignorar'),
      };
    });
    return { orientacao, series, inicio: null, periodicidade: null, periodos: corpo.length };
  }

  // ── Séries deitadas ──
  // A linha de datas é a que tem datas e nenhum valor.
  let inicio: string | null = null;
  let periodicidade: Periodicidade | null = null;
  const linhasSerie: string[][] = [];

  for (const celulas of linhas) {
    const datas = celulas
      .map((c) => lerDataCabecalho(c, anoRef))
      .filter((d): d is Date => d != null);
    const ehLinhaDeDatas = datas.length >= 2 && celulas.every((c) => !ehValor(c));
    if (ehLinhaDeDatas && inicio == null) {
      inicio = formatISOLocal(datas[0]);
      const dif = Math.round((datas[1].getTime() - datas[0].getTime()) / 86_400_000);
      periodicidade = dif >= 5 ? 'semanal' : 'diaria';
      continue;
    }
    if (!ehLinhaDeDatas) linhasSerie.push(celulas);
  }

  let semRotulo = 0;
  const series: SerieLida[] = linhasSerie
    .map(separarRotulo)
    .filter((s) => s.valores.some((v) => v != null))
    .map((s) => ({
      ...s,
      papel: s.rotulo ? papelDoRotulo(s.rotulo) : (ORDEM_PADRAO[semRotulo++] ?? 'ignorar'),
    }));

  const periodos = series.reduce((max, s) => Math.max(max, s.valores.length), 0);
  return { orientacao, series, inicio, periodicidade, periodos };
};

/** Junta as séries já mapeadas nos períodos que a conversão consome. */
export const montarPontos = (series: SerieLida[], periodos: number): PontoAcumulado[] => {
  const valoresDe = (papel: PapelSerie) =>
    series.find((s) => s.papel === papel)?.valores ?? [];
  const lb = valoresDe('linhaBase');
  const real = valoresDe('real');
  const acum = valoresDe('acumulado');
  return Array.from({ length: periodos }, (_, i) => ({
    linhaBase: lb[i] ?? null,
    real: real[i] ?? null,
    acumulado: acum[i] ?? null,
  }));
};
