/**
 * EAP financeira da obra.
 *
 * Cada item do contrato com o que foi previsto, o que foi medido no mês e o
 * acumulado até aqui. É o mesmo desenho da EAP do cronograma — código "1.2.3"
 * define o nível —, só que com dinheiro no lugar de datas.
 *
 * Só administrador, gestor e planejador enxergam este card no relatório: valor
 * de contrato não é informação que se mostra ao cliente da obra.
 */

export interface ItemEapFinanceira {
  /** Código da EAP: "1", "1.1", "1.1.2". É ele que dá o nível. */
  codigo: string;
  descricao: string;
  valorContrato: number;
  previstoMes: number;
  realizadoMes: number;
  /** Realizado acumulado até o mês. */
  acumulado: number;
}

/** Nível pelo código: "1.2.3" → 3. Sem código, nível 1. */
export const nivelDoCodigo = (codigo: string): number => {
  const t = String(codigo ?? '').trim();
  if (!/^\d+(\.\d+)*$/.test(t)) return 1;
  return t.split('.').length;
};

/** Um item é folha quando o próximo não é filho dele. */
export const ehFolha = (itens: ItemEapFinanceira[], i: number): boolean => {
  const proximo = itens[i + 1];
  if (!proximo) return true;
  return nivelDoCodigo(proximo.codigo) <= nivelDoCodigo(itens[i].codigo);
};

export interface TotaisEap {
  valorContrato: number;
  previstoMes: number;
  realizadoMes: number;
  acumulado: number;
  /** Quanto do contrato já foi medido. */
  percentualAcumulado: number;
  /** Contrato menos acumulado. */
  saldo: number;
  /** Realizado menos previsto no mês: negativo é medição abaixo do planejado. */
  desvioMes: number;
}

/**
 * Totais da EAP.
 *
 * Soma só as FOLHAS. Numa EAP o pai é o total dos filhos, então somar tudo
 * contaria o mesmo dinheiro duas vezes — numa estrutura de três níveis, três
 * vezes. Com a lista plana, toda linha é folha e o resultado é a soma simples.
 */
export const totaisDaEap = (itens: ItemEapFinanceira[]): TotaisEap => {
  const folhas = (itens ?? []).filter((_, i) => ehFolha(itens, i));

  const soma = (pegar: (it: ItemEapFinanceira) => number) =>
    folhas.reduce((s, it) => s + (Number(pegar(it)) || 0), 0);

  const valorContrato = soma((it) => it.valorContrato);
  const acumulado = soma((it) => it.acumulado);
  const previstoMes = soma((it) => it.previstoMes);
  const realizadoMes = soma((it) => it.realizadoMes);

  return {
    valorContrato,
    previstoMes,
    realizadoMes,
    acumulado,
    percentualAcumulado: valorContrato > 0 ? (acumulado / valorContrato) * 100 : 0,
    saldo: valorContrato - acumulado,
    desvioMes: realizadoMes - previstoMes,
  };
};

/** "R$ 1.234.567,89" */
export const fmtDinheiro = (n: number): string =>
  (Number(n) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });

/** "12,3%" */
export const fmtPercentual = (n: number): string =>
  `${(Number(n) || 0).toFixed(1).replace('.', ',')}%`;

/**
 * Lê valor em dinheiro do jeito que sai do Excel.
 *
 * Aceita "R$ 1.234,50", "1.234,50", "1,234.50" e negativo entre parênteses, que
 * é como planilha de medição costuma marcar glosa.
 */
export const lerValor = (bruto: string): number => {
  const txt = String(bruto ?? '').trim();
  if (!txt) return 0;
  const negativo = /^\(.*\)$/.test(txt);
  const limpo = txt.replace(/[^0-9,.-]/g, '');
  if (!limpo) return 0;

  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const normal = ultimaVirgula >= 0 && ultimaVirgula > ultimoPonto
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '');

  const n = parseFloat(normal);
  if (!isFinite(n)) return 0;
  return negativo ? -Math.abs(n) : n;
};

// ─── Colagem do Excel ───────────────────────────────────────────────────────

type CampoEap = 'codigo' | 'descricao' | 'valorContrato' | 'previstoMes' | 'realizadoMes' | 'acumulado';

const normalizar = (v: string): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Reconhecimento pelo CABEÇALHO, como no cronograma: cada obra monta a planilha
 * de medição do seu jeito, e exigir ordem fixa quebraria a cada contrato novo.
 *
 * A ordem importa: "realizado acumulado" tem de virar acumulado antes de casar
 * com o realizado do mês.
 */
const RECONHECEDORES: Array<{ campo: CampoEap; casa: (h: string) => boolean }> = [
  { campo: 'acumulado', casa: (h) => /acumulad/.test(h) },
  { campo: 'valorContrato', casa: (h) => /contrato|valor total|preco total|orcado|or[cç]amento/.test(h) },
  { campo: 'previstoMes', casa: (h) => /previsto|planejad/.test(h) },
  { campo: 'realizadoMes', casa: (h) => /realizad|medi(do|cao)|executad/.test(h) },
  { campo: 'codigo', casa: (h) => /^(eap|edt|wbs|item|codigo|cod|n|no)$/.test(h) },
  { campo: 'descricao', casa: (h) => /descricao|servico|atividade|nome|discriminacao/.test(h) },
];

export interface LeituraEap {
  itens: ItemEapFinanceira[];
  /** Campos que nenhuma coluna preencheu — a tela avisa antes de aplicar. */
  faltando: CampoEap[];
  reconhecidas: { campo: CampoEap; cabecalho: string }[];
}

const VAZIO: LeituraEap = { itens: [], faltando: [], reconhecidas: [] };

export const lerEapColada = (texto: string): LeituraEap => {
  const linhas = String(texto ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((c) => c.some((v) => v.trim() !== ''));
  if (linhas.length < 2) return VAZIO;

  // Cabeçalho é a primeira linha que reconhece ao menos dois campos: antes dela
  // costuma vir o nome do contrato ou uma linha em branco arrastada junto.
  let idxCabecalho = -1;
  const mapa: Partial<Record<CampoEap, number>> = {};
  const reconhecidas: { campo: CampoEap; cabecalho: string }[] = [];

  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    const cabecalhos = linhas[i].map(normalizar);
    const tentativa: Partial<Record<CampoEap, number>> = {};
    const usadas = new Set<number>();
    for (const { campo, casa } of RECONHECEDORES) {
      if (tentativa[campo] != null) continue;
      for (let c = 0; c < cabecalhos.length; c++) {
        if (usadas.has(c) || !cabecalhos[c]) continue;
        if (casa(cabecalhos[c])) { tentativa[campo] = c; usadas.add(c); break; }
      }
    }
    if (Object.keys(tentativa).length >= 2) {
      idxCabecalho = i;
      Object.assign(mapa, tentativa);
      (Object.entries(tentativa) as [CampoEap, number][]).forEach(([campo, col]) =>
        reconhecidas.push({ campo, cabecalho: String(linhas[i][col] ?? '').trim() }),
      );
      break;
    }
  }
  if (idxCabecalho < 0) return VAZIO;

  const texto_ = (celulas: string[], campo: CampoEap): string => {
    const col = mapa[campo];
    return col == null ? '' : (celulas[col] ?? '').trim();
  };

  const itens = linhas.slice(idxCabecalho + 1)
    .map((celulas) => ({
      codigo: texto_(celulas, 'codigo'),
      descricao: texto_(celulas, 'descricao'),
      valorContrato: lerValor(texto_(celulas, 'valorContrato')),
      previstoMes: lerValor(texto_(celulas, 'previstoMes')),
      realizadoMes: lerValor(texto_(celulas, 'realizadoMes')),
      acumulado: lerValor(texto_(celulas, 'acumulado')),
    }))
    // Linha sem descrição é total, separador ou sobra da seleção.
    .filter((it) => it.descricao !== '');

  const faltando = (['descricao', 'valorContrato'] as CampoEap[]).filter((c) => mapa[c] == null);
  return { itens, faltando, reconhecidas };
};
