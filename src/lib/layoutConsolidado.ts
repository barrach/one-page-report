import {
  linhasDoLayout, type ItemLayoutRelatorio, type LarguraCard,
} from '@/lib/layoutRelatorio';

/**
 * Arrumação dos blocos do consolidado.
 *
 * Mesma mecânica do relatório — reordenar, largura, altura, ocultar — e pelo
 * mesmo motivo: o layout é da EMPRESA, não de quem olha. O administrador
 * arruma uma vez e todo mundo passa a ler na mesma ordem, senão duas pessoas
 * na mesma reunião discutem telas diferentes.
 *
 * A diferença é que aqui o conteúdo é fixo: são sempre as sete perguntas, e
 * não uma lista de cards que cresce. Por isso o catálogo mora neste arquivo.
 */

export const BLOCOS_CONSOLIDADO: { id: string; nome: string; larguraPadrao: LarguraCard }[] = [
  { id: 'b1', nome: '1 · O que aconteceu', larguraPadrao: 'inteira' },
  { id: 'b2', nome: '2 · Por quê', larguraPadrao: 'meia' },
  { id: 'b3', nome: '3 · Onde está o problema', larguraPadrao: 'meia' },
  { id: 'b4', nome: '4 · Tendência do prazo', larguraPadrao: 'meia' },
  { id: 'b5', nome: '5 · Quanto vai sobrar', larguraPadrao: 'meia' },
  { id: 'b6', nome: '6 · Qual o risco', larguraPadrao: 'meia' },
  { id: 'b7', nome: '7 · O que devemos fazer', larguraPadrao: 'meia' },
  // Fora do roteiro das sete perguntas: elas respondem "a obra anda?", e esta
  // responde "a obra paga?". Por isso vem depois, e nao no meio delas.
  { id: 'b8', nome: '8 · Dados do contrato', larguraPadrao: 'inteira' },
];

export const layoutConsolidadoPadrao = (): ItemLayoutRelatorio[] =>
  BLOCOS_CONSOLIDADO.map((b) => ({ id: b.id, largura: b.larguraPadrao }));

export const nomeDoBloco = (id: string): string =>
  BLOCOS_CONSOLIDADO.find((b) => b.id === id)?.nome ?? id;

/**
 * Concilia o layout guardado com os blocos que existem hoje.
 *
 * Bloco novo entra no fim em vez de sumir; bloco que deixou de existir cai
 * fora em vez de virar um buraco na grade.
 */
export const normalizarLayoutConsolidado = (
  salvo: ItemLayoutRelatorio[] | undefined,
): ItemLayoutRelatorio[] => {
  const conhecidos = new Set(BLOCOS_CONSOLIDADO.map((b) => b.id));
  const validos = (salvo ?? []).filter((i) => i && conhecidos.has(i.id));

  const jaTem = new Set(validos.map((i) => i.id));
  const faltando = BLOCOS_CONSOLIDADO
    .filter((b) => !jaTem.has(b.id))
    .map((b) => ({ id: b.id, largura: b.larguraPadrao }));

  const completo = [...validos, ...faltando];
  return completo.length > 0 ? completo : layoutConsolidadoPadrao();
};

/**
 * A seção de cada bloco — os que dividem a linha da grade compartilham a mesma.
 *
 * É o que faz recolher um bloco recolher a linha inteira: fechar metade dela
 * deixaria um card sozinho ao lado de um espaço vazio.
 */
export const secaoDeCadaBloco = (layout: ItemLayoutRelatorio[]): Record<string, string[]> => {
  const mapa: Record<string, string[]> = {};
  linhasDoLayout(layout).forEach((linha) => {
    linha.forEach((id) => { mapa[id] = linha; });
  });
  layout.forEach((item) => { if (!mapa[item.id]) mapa[item.id] = [item.id]; });
  return mapa;
};

/**
 * Posição de cada bloco na grade CSS.
 *
 * `order` em vez de reordenar o JSX: os blocos são sete trechos grandes e
 * fixos, e movê-los no código a cada arrumação significaria recriar cada um
 * deles — gráficos remontam, tabelas perdem rolagem. Com `order`, mudar a
 * arrumação é só CSS.
 */
export interface PosicaoBloco {
  ordem: number;
  inteira: boolean;
  oculto: boolean;
  altura?: number;
}

export const posicoesDoLayout = (
  layout: ItemLayoutRelatorio[],
): Record<string, PosicaoBloco> => {
  const mapa: Record<string, PosicaoBloco> = {};
  layout.forEach((item, i) => {
    mapa[item.id] = {
      ordem: i + 1,
      inteira: item.largura === 'inteira',
      oculto: Boolean(item.oculto),
      altura: item.altura,
    };
  });
  return mapa;
};
