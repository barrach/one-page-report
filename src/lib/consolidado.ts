import type { Project } from '@/store/projectStore';
import { totaisDaEap } from '@/lib/eapFinanceira';
import { projetarTermino } from '@/lib/previsaoTermino';

/**
 * One Page Report consolidado de um cliente.
 *
 * A pergunta que ele responde é diferente da do relatório de obra: não é "como
 * está o FRIGO", é "como está a UNIPAR" — quantas obras, quanto contratado,
 * quais estão em risco e onde a equipe precisa ir primeiro.
 *
 * A decisão difícil aqui é o AVANÇO CONSOLIDADO. Média simples de percentuais
 * mente: uma obra de R$ 5 milhões a 20% e uma de R$ 50 mil a 100% não dão 60%
 * de avanço para o cliente. Por isso a consolidação é ponderada pelo valor do
 * contrato sempre que ele existir — e, quando não existir, o relatório DIZ que
 * caiu na média simples, em vez de apresentar os dois números como se fossem a
 * mesma coisa.
 */

export type StatusObra = 'ok' | 'risco' | 'atrasada' | 'sem_dado';

export interface LinhaObra {
  id: string;
  nome: string;
  avancoPrev: number;
  avancoReal: number;
  /** Real menos previsto: negativo é atraso. */
  desvio: number;
  /** Real ÷ previsto, em percentual. */
  idp: number;
  status: StatusObra;
  terminoBase: string;
  /** ISO da data que o ritmo aponta, quando dá para projetar. */
  terminoProjetado: string | null;
  /** Dias além (ou aquém) da linha de base. */
  desvioDias: number | null;
  valorContrato: number;
  /** Previsto de medição para o mês, da EAP financeira. */
  previstoMes: number;
  realizadoMes: number;
  acumulado: number;
  /** Última importação de qualquer seção — o dado mais fresco da obra. */
  atualizadoEm: string;
}

export interface Consolidado {
  obras: LinhaObra[];
  avancoPrev: number;
  avancoReal: number;
  desvio: number;
  valorContrato: number;
  /** Soma do previsto de medição do mês nas obras do cliente. */
  previstoMes: number;
  realizadoMes: number;
  acumulado: number;
  /** Como o avanço foi consolidado — a tela precisa dizer isto. */
  ponderacao: 'contrato' | 'media';
  emRisco: number;
  atrasadas: number;
}

/** Mesmos cortes do cabeçalho do relatório de obra, para não haver dois critérios. */
const statusPorIdp = (idp: number, temDado: boolean): StatusObra => {
  if (!temDado) return 'sem_dado';
  if (idp >= 95) return 'ok';
  if (idp >= 80) return 'risco';
  return 'atrasada';
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export const linhaDaObra = (p: Project): LinhaObra => {
  const info = p.info ?? ({} as Project['info']);
  const avancoPrev = Number(info.avancoPrev) || 0;
  const avancoReal = Number(info.avancoReal) || 0;
  const idp = avancoPrev > 0 ? (avancoReal / avancoPrev) * 100 : 0;
  const previsao = projetarTermino(info.inicio ?? '', info.terminoLB ?? '', idp);
  const totais = totaisDaEap(p.eapFinanceira ?? []);

  return {
    id: p.id,
    nome: p.name,
    avancoPrev: r2(avancoPrev),
    avancoReal: r2(avancoReal),
    desvio: r2(avancoReal - avancoPrev),
    idp: r2(idp),
    status: statusPorIdp(idp, avancoPrev > 0),
    terminoBase: info.terminoLB ?? '',
    terminoProjetado: previsao?.data ?? null,
    desvioDias: previsao?.desvioDias ?? null,
    // Sem valor na EAP, vale o "Custo da obra" das Informações do Projeto: é o
    // mesmo número, digitado em outro lugar, e sem esta queda o consolidado
    // caía em média simples mesmo com a obra valorizada na aba Dados.
    valorContrato: totais.valorContrato || Number(info.custoObra) || 0,
    previstoMes: totais.previstoMes,
    realizadoMes: totais.realizadoMes,
    acumulado: totais.acumulado,
    atualizadoEm: info.atualizadoEm ?? '',
  };
};

/**
 * Consolida as obras de um cliente.
 *
 * A ordem é por desvio: a obra mais atrasada aparece primeiro, porque é ela que
 * decide para onde a equipe vai na semana. Ordenar por nome deixaria a pior obra
 * escondida no meio da lista.
 */
export const consolidarObras = (projetos: Project[]): Consolidado => {
  const obras = projetos.map(linhaDaObra).sort((a, b) => a.desvio - b.desvio);

  const comContrato = obras.filter((o) => o.valorContrato > 0);
  // Só pondera por contrato se TODAS as obras tiverem valor. Com metade
  // valorizada e metade zerada, a ponderação daria peso zero às zeradas e o
  // consolidado esconderia obra inteira.
  const ponderacao: Consolidado['ponderacao'] =
    obras.length > 0 && comContrato.length === obras.length ? 'contrato' : 'media';

  const pesoDe = (o: LinhaObra) => (ponderacao === 'contrato' ? o.valorContrato : 1);
  const pesoTotal = obras.reduce((s, o) => s + pesoDe(o), 0);

  const media = (pegar: (o: LinhaObra) => number) =>
    pesoTotal > 0 ? r2(obras.reduce((s, o) => s + pegar(o) * pesoDe(o), 0) / pesoTotal) : 0;

  const avancoPrev = media((o) => o.avancoPrev);
  const avancoReal = media((o) => o.avancoReal);

  return {
    obras,
    avancoPrev,
    avancoReal,
    desvio: r2(avancoReal - avancoPrev),
    valorContrato: obras.reduce((s, o) => s + o.valorContrato, 0),
    previstoMes: obras.reduce((s, o) => s + o.previstoMes, 0),
    realizadoMes: obras.reduce((s, o) => s + o.realizadoMes, 0),
    acumulado: obras.reduce((s, o) => s + o.acumulado, 0),
    ponderacao,
    emRisco: obras.filter((o) => o.status === 'risco').length,
    atrasadas: obras.filter((o) => o.status === 'atrasada').length,
  };
};

export const ROTULO_STATUS: Record<StatusObra, string> = {
  ok: 'No prazo',
  risco: 'Em risco',
  atrasada: 'Atrasada',
  sem_dado: 'Sem dado',
};
