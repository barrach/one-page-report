/**
 * Arrumação dos cards do relatório.
 *
 * O layout é do PROJETO, não de quem olha: o administrador arruma e todo mundo
 * passa a ver assim — é o mesmo relatório que vai para a reunião e para o PDF.
 *
 * A escolha é reordenar + largura + altura, e não posição livre numa grade. O
 * export em PDF percorre os cards em ordem e encaixa um por folha; com posição
 * livre, a relação entre o que se vê na tela e o que sai no papel se perde, e o
 * papel é justamente o que vai para a reunião.
 */

export type LarguraCard = 'meia' | 'inteira';

export interface ItemLayoutRelatorio {
  id: string;
  largura: LarguraCard;
  /** Altura mínima em pixels. Ausente = a altura natural do card. */
  altura?: number;
  oculto?: boolean;
}

/** Os cards que o relatório sabe desenhar, na arrumação padrão. */
export const CARDS_RELATORIO: { id: string; nome: string; larguraPadrao: LarguraCard }[] = [
  { id: 'scurve', nome: 'Curva S', larguraPadrao: 'meia' },
  { id: 'fiveweek', nome: 'Visão de 5 Semanas', larguraPadrao: 'meia' },
  { id: 'month', nome: 'Prev. × Realizado Mês', larguraPadrao: 'meia' },
  { id: 'histogram', nome: 'Histograma MOD', larguraPadrao: 'meia' },
  { id: 'schedule', nome: 'Cronograma', larguraPadrao: 'inteira' },
  { id: 'clima', nome: 'Clima na Obra', larguraPadrao: 'inteira' },
  { id: 'actions', nome: 'Pontos de Atenção', larguraPadrao: 'meia' },
  { id: 'progsemanal', nome: 'Programação Semanal', larguraPadrao: 'meia' },
  { id: 'pareto', nome: 'Pareto de Causas', larguraPadrao: 'inteira' },
  { id: 'financeiro', nome: 'Financeiro', larguraPadrao: 'inteira' },
  { id: 'evidencias', nome: 'Evidências', larguraPadrao: 'inteira' },
];

export const layoutPadrao = (): ItemLayoutRelatorio[] =>
  CARDS_RELATORIO.map((c) => ({ id: c.id, largura: c.larguraPadrao }));

export const nomeDoCard = (id: string): string =>
  CARDS_RELATORIO.find((c) => c.id === id)?.nome ?? id;

/**
 * Concilia o layout guardado com os cards que existem hoje.
 *
 * Card novo entra no fim em vez de sumir do relatório; card que deixou de
 * existir cai fora em vez de virar um buraco. Sem isso, todo projeto com layout
 * salvo pararia de mostrar qualquer card criado depois.
 */
export const normalizarLayout = (
  salvo: ItemLayoutRelatorio[] | undefined,
): ItemLayoutRelatorio[] => {
  const conhecidos = new Set(CARDS_RELATORIO.map((c) => c.id));
  const validos = (salvo ?? []).filter((i) => i && conhecidos.has(i.id));

  const jaTem = new Set(validos.map((i) => i.id));
  const faltando = CARDS_RELATORIO
    .filter((c) => !jaTem.has(c.id))
    .map((c) => ({ id: c.id, largura: c.larguraPadrao }));

  const completo = [...validos, ...faltando];
  return completo.length > 0 ? completo : layoutPadrao();
};

/** Move um card uma posição para cima ou para baixo. */
export const moverCard = (
  layout: ItemLayoutRelatorio[],
  id: string,
  direcao: -1 | 1,
): ItemLayoutRelatorio[] => {
  const i = layout.findIndex((c) => c.id === id);
  const destino = i + direcao;
  if (i < 0 || destino < 0 || destino >= layout.length) return layout;
  const copia = [...layout];
  [copia[i], copia[destino]] = [copia[destino], copia[i]];
  return copia;
};

/** Reposiciona um card na posição de outro — é o que o arrastar usa. */
export const reordenarCard = (
  layout: ItemLayoutRelatorio[],
  idArrastado: string,
  idAlvo: string,
): ItemLayoutRelatorio[] => {
  if (idArrastado === idAlvo) return layout;
  const de = layout.findIndex((c) => c.id === idArrastado);
  const para = layout.findIndex((c) => c.id === idAlvo);
  if (de < 0 || para < 0) return layout;
  const copia = [...layout];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
};

const ALTURA_MIN = 200;
const ALTURA_MAX = 1200;
const PASSO_ALTURA = 80;

/**
 * Ajusta a altura mínima do card.
 *
 * Voltar ao menor valor limpa a altura em vez de fixá-la em 200px: card sem
 * altura definida acompanha o conteúdo, que é o comportamento certo na maioria
 * dos casos e o que se espera ao "desfazer" o aumento.
 */
export const ajustarAltura = (
  layout: ItemLayoutRelatorio[],
  id: string,
  passos: number,
): ItemLayoutRelatorio[] =>
  layout.map((c) => {
    if (c.id !== id) return c;
    const base = c.altura ?? 380;
    const nova = base + passos * PASSO_ALTURA;
    if (nova < ALTURA_MIN) return { ...c, altura: undefined };
    return { ...c, altura: Math.min(ALTURA_MAX, nova) };
  });

export const alternarLargura = (
  layout: ItemLayoutRelatorio[],
  id: string,
): ItemLayoutRelatorio[] =>
  layout.map((c) => (c.id === id ? { ...c, largura: c.largura === 'meia' ? 'inteira' : 'meia' } : c));

export const alternarOculto = (
  layout: ItemLayoutRelatorio[],
  id: string,
): ItemLayoutRelatorio[] =>
  layout.map((c) => (c.id === id ? { ...c, oculto: !c.oculto } : c));
