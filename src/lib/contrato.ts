import { parseISOLocal, somarDias, formatISOLocal } from '@/lib/dateUtils';

/**
 * Os dados de CONTRATO da obra — o que faltava para o app sair de
 * acompanhamento de execução e virar gestão de contrato.
 *
 * A diferença não é acadêmica: o avanço físico responde "a obra anda?", e estes
 * campos respondem "a obra paga?". Numa obra industrial as duas respostas
 * divergem com frequência, e é a segunda que decide se o contrato foi bom.
 */

// ─── Aditivos ───────────────────────────────────────────────────────────

export interface Aditivo {
  id: string;
  numero: string;
  /** ISO yyyy-mm-dd da assinatura. */
  data: string;
  objeto: string;
  /** Acréscimo (ou supressão, negativo) em R$. */
  valor: number;
  /** Prorrogação em dias corridos. */
  dias: number;
}

// ─── Pleitos ────────────────────────────────────────────────────────────

export type StatusPleito =
  | 'EM PREPARO' | 'PROTOCOLADO' | 'EM ANÁLISE'
  | 'APROVADO' | 'APROVADO PARCIAL' | 'NEGADO';

export const STATUS_PLEITO: StatusPleito[] = [
  'EM PREPARO', 'PROTOCOLADO', 'EM ANÁLISE', 'APROVADO', 'APROVADO PARCIAL', 'NEGADO',
];

/** Pleito que ainda pode virar dinheiro — nem ganho, nem perdido. */
export const PLEITO_EM_ABERTO: StatusPleito[] = ['EM PREPARO', 'PROTOCOLADO', 'EM ANÁLISE'];

export interface Pleito {
  id: string;
  descricao: string;
  /** ISO do protocolo. Pleito tem prazo contratual: sem data não há como cobrar. */
  dataProtocolo: string;
  /** Valor reivindicado. */
  valor: number;
  status: StatusPleito;
  /** Quanto o cliente reconheceu — pode ser menor que o pleiteado. */
  valorAprovado: number;
  dataResposta: string;
}

// ─── Ciclo da medição ───────────────────────────────────────────────────

/**
 * Uma competência do ciclo de medição.
 *
 * Medido não é recebido, e é entre um e outro que o dinheiro da empresa fica
 * parado. Cada estágio é um valor separado de propósito: sem eles não há como
 * dizer quanto está travado na aprovação do cliente.
 */
export interface CompetenciaMedicao {
  id: string;
  /** "2026-08" — a competência, não a data de envio. */
  mes: string;
  medido: number;
  enviado: number;
  aprovado: number;
  faturado: number;
  recebido: number;
}

// ─── Custo incorrido ────────────────────────────────────────────────────

export interface CustoMes {
  id: string;
  mes: string;
  previsto: number;
  incorrido: number;
}

export interface DadosContrato {
  /** Data contratual de término — pode diferir da linha de base do cronograma. */
  terminoContratual?: string;
  /** Multa por dia de atraso, em R$. */
  multaDiaria?: number;
  /** Teto de multa em % do contrato — quase todo contrato tem um. */
  tetoMultaPercentual?: number;
  /**
   * A cadência do contrato: dia em que a janela de medição abre, dia em que
   * ela fecha e dia do faturamento.
   *
   * Parecem detalhe de rotina e não são: é o corte da medição que define o que
   * entra no mês, e é a distância entre o corte e o faturamento que explica
   * por que uma obra adiantada ainda não gerou caixa.
   */
  medicaoDiaInicio?: number;
  medicaoDiaFim?: number;
  diaFaturamento?: number;
  aditivos: Aditivo[];
  pleitos: Pleito[];
  medicoes: CompetenciaMedicao[];
  custos: CustoMes[];
}

export const CONTRATO_VAZIO: DadosContrato = {
  aditivos: [], pleitos: [], medicoes: [], custos: [],
};

const soma = <T>(lista: T[], pegar: (x: T) => number) =>
  (lista ?? []).reduce((s, x) => s + (Number(pegar(x)) || 0), 0);

const id = (prefixo: string) =>
  `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const aditivoVazio = (): Aditivo =>
  ({ id: id('ad'), numero: '', data: '', objeto: '', valor: 0, dias: 0 });

export const pleitoVazio = (): Pleito => ({
  id: id('pl'), descricao: '', dataProtocolo: '', valor: 0,
  status: 'EM PREPARO', valorAprovado: 0, dataResposta: '',
});

export const medicaoVazia = (): CompetenciaMedicao =>
  ({ id: id('md'), mes: '', medido: 0, enviado: 0, aprovado: 0, faturado: 0, recebido: 0 });

export const custoVazio = (): CustoMes =>
  ({ id: id('ct'), mes: '', previsto: 0, incorrido: 0 });

// ─── O que os lançamentos produzem ──────────────────────────────────────

export interface ResumoContrato {
  valorOriginal: number;
  /** Soma dos aditivos de valor — negativa quando há supressão. */
  valorAditivos: number;
  /** Original + aditivos. É contra ELE que o avanço deve ser medido. */
  valorVigente: number;

  diasAditados: number;
  terminoContratual: string;
  /** Contratual + prorrogações. É a data que vale, não a original. */
  terminoVigente: string;

  pleitosAbertos: { quantidade: number; valor: number };
  pleitosGanhos: { quantidade: number; valor: number };
  pleitosNegados: { quantidade: number; valor: number };

  medicao: {
    medido: number;
    enviado: number;
    aprovado: number;
    faturado: number;
    recebido: number;
    /** Enviado ao cliente e ainda sem aprovação. */
    travadoNaAprovacao: number;
    /** Aprovado e ainda não faturado. */
    aFaturar: number;
    /** Faturado e ainda não recebido. */
    aReceber: number;
  };

  custo: {
    previsto: number;
    incorrido: number;
    /** Incorrido menos previsto: positivo é estouro. */
    desvio: number;
  };
}

/**
 * Consolida os lançamentos do contrato.
 *
 * O valor VIGENTE é o número que importa: um contrato com aditivo tem duas
 * bases, e medir avanço contra a original faz a obra parecer mais adiantada do
 * que está — o escopo cresceu e o denominador não.
 */
export const resumoDoContrato = (
  valorOriginal: number,
  dados: DadosContrato | undefined,
): ResumoContrato => {
  const d = dados ?? CONTRATO_VAZIO;

  const valorAditivos = soma(d.aditivos, (a) => a.valor);
  const diasAditados = soma(d.aditivos, (a) => a.dias);

  const contratual = d.terminoContratual ?? '';
  const base = parseISOLocal(contratual);
  const vigente = base && diasAditados !== 0
    ? formatISOLocal(somarDias(base, diasAditados))
    : contratual;

  const porStatus = (status: StatusPleito[]) => {
    const lista = (d.pleitos ?? []).filter((p) => status.includes(p.status));
    return { quantidade: lista.length, valor: soma(lista, (p) => p.valor) };
  };

  const ganhos = (d.pleitos ?? []).filter(
    (p) => p.status === 'APROVADO' || p.status === 'APROVADO PARCIAL',
  );

  const medido = soma(d.medicoes, (m) => m.medido);
  const enviado = soma(d.medicoes, (m) => m.enviado);
  const aprovado = soma(d.medicoes, (m) => m.aprovado);
  const faturado = soma(d.medicoes, (m) => m.faturado);
  const recebido = soma(d.medicoes, (m) => m.recebido);

  const previsto = soma(d.custos, (c) => c.previsto);
  const incorrido = soma(d.custos, (c) => c.incorrido);

  return {
    valorOriginal,
    valorAditivos,
    valorVigente: valorOriginal + valorAditivos,
    diasAditados,
    terminoContratual: contratual,
    terminoVigente: vigente,
    pleitosAbertos: porStatus(PLEITO_EM_ABERTO),
    // Nos ganhos vale o RECONHECIDO, não o pleiteado: aprovado parcial é
    // exatamente o caso em que os dois números diferem.
    pleitosGanhos: { quantidade: ganhos.length, valor: soma(ganhos, (p) => p.valorAprovado || p.valor) },
    pleitosNegados: porStatus(['NEGADO']),
    medicao: {
      medido, enviado, aprovado, faturado, recebido,
      travadoNaAprovacao: Math.max(0, enviado - aprovado),
      aFaturar: Math.max(0, aprovado - faturado),
      aReceber: Math.max(0, faturado - recebido),
    },
    custo: { previsto, incorrido, desvio: incorrido - previsto },
  };
};

export interface ExposicaoMulta {
  dias: number;
  /** Multa bruta: dias × valor diário. */
  bruta: number;
  /** O teto contratual em R$, quando há percentual lançado. */
  teto: number | null;
  /** O que realmente se paga: a bruta limitada pelo teto. */
  exposicao: number;
  /** A bruta já passou do teto. */
  noTeto: boolean;
}

/**
 * Quanto o atraso custa em multa.
 *
 * Com teto lançado, a exposição para de crescer — e saber que ela travou muda
 * a decisão: a partir do teto, atrasar mais um mês não custa mais multa, e o
 * dinheiro que se gastaria acelerando pode valer mais em outra frente.
 */
export const exposicaoDeMulta = (
  diasAtraso: number,
  multaDiaria: number | undefined,
  valorVigente: number,
  tetoPercentual: number | undefined,
): ExposicaoMulta | null => {
  const diaria = Number(multaDiaria) || 0;
  const dias = Math.max(0, Math.round(diasAtraso || 0));
  if (diaria <= 0 || dias <= 0) return null;

  const bruta = dias * diaria;
  const pct = Number(tetoPercentual) || 0;
  const teto = pct > 0 && valorVigente > 0 ? (valorVigente * pct) / 100 : null;

  return {
    dias,
    bruta,
    teto,
    exposicao: teto != null ? Math.min(bruta, teto) : bruta,
    noTeto: teto != null && bruta >= teto,
  };
};

// ─── A cadência do contrato ─────────────────────────────────────────────

const diaDoMes = (n: number) =>
  String(Math.min(31, Math.max(1, Math.round(n)))).padStart(2, '0');

/**
 * A janela de medição, escrita como se lê no contrato: "21 a 20".
 *
 * Com só um dos dois lançado, o que sobra é o corte — que é o dado que
 * realmente decide o que entra na competência.
 */
export const janelaDeMedicao = (d: DadosContrato | undefined): string => {
  const i = Number(d?.medicaoDiaInicio) || 0;
  const f = Number(d?.medicaoDiaFim) || 0;
  if (i && f) return `${diaDoMes(i)} a ${diaDoMes(f)}`;
  if (f || i) return `corte dia ${diaDoMes(f || i)}`;
  return '—';
};

export const diaDoFaturamento = (d: DadosContrato | undefined): string => {
  const n = Number(d?.diaFaturamento) || 0;
  return n ? `dia ${diaDoMes(n)}` : '—';
};

export interface Vigencia {
  /** Dias entre hoje e o término vigente. Negativo quando já venceu. */
  restantes: number;
  vencida: boolean;
  /** Duração total contratada, em dias. */
  total: number;
  /** Quanto da vigência já correu, de 0 a 100. */
  percorrido: number;
}

/**
 * Quanto ainda resta do contrato.
 *
 * Vigência é calendário, não cadência de relatório: ela corre nos fins de
 * semana e na parada de fim de ano igual. Por isso conta contra HOJE, e não
 * contra a data de corte da semana.
 */
export const vigenciaDoContrato = (
  inicioISO: string,
  terminoVigenteISO: string,
  hoje: Date = new Date(),
): Vigencia | null => {
  const inicio = parseISOLocal(inicioISO);
  const fim = parseISOLocal(terminoVigenteISO);
  if (!fim) return null;

  const dia = 86_400_000;
  const restantes = Math.round((fim.getTime() - hoje.getTime()) / dia);
  const total = inicio ? Math.round((fim.getTime() - inicio.getTime()) / dia) : 0;
  const corrido = inicio ? Math.round((hoje.getTime() - inicio.getTime()) / dia) : 0;

  return {
    restantes,
    vencida: restantes < 0,
    total,
    percorrido: total > 0 ? Math.max(0, Math.min(100, (corrido / total) * 100)) : 0,
  };
};

/** "2026-08" → "ago/26". Mês de competência é sempre lido assim em medição. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const rotuloDaCompetencia = (mes: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes ?? '').trim());
  if (!m) return mes || '—';
  return `${MESES[Number(m[2]) - 1] ?? m[2]}/${m[1].slice(2)}`;
};
