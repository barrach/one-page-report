/**
 * Quem enxerga qual obra.
 *
 * Até aqui todo usuário logado carregava TODAS as obras: as atribuições que o
 * administrador marcava na tela de Admin eram gravadas e nunca lidas. Um
 * visualizador da SPCI via GUAXE, FRIGO, NTS, OXICORTE e ArcelorMittal — com
 * valor de contrato, fotos da planta e cronograma.
 *
 * Restrição vale para `visualizador` e `cliente`. Quem lança dado (admin,
 * gestor, planejador) continua vendo tudo: é a equipe da Megasteam, e é ela
 * que precisa comparar obra com obra.
 *
 * ATENÇÃO — isto é filtro de TELA. Enquanto o RLS não estiver ligado no
 * Supabase (migration 20260828... deste repositório), a chave anônima que vai
 * no bundle continua conseguindo ler qualquer projeto pela API. O filtro daqui
 * tira a obra da vista; só o RLS tira do alcance.
 */

export type AppRole = 'admin' | 'planejador' | 'gestor' | 'visualizador' | 'cliente';

/**
 * Da maior para a menor permissão: com mais de um papel, vale o primeiro.
 *
 * Mora aqui, e não no AuthContext, porque o carregamento das obras também
 * precisa saber o papel — e o store não deve depender de um módulo React.
 */
export const ORDEM_PAPEIS: AppRole[] = ['admin', 'planejador', 'gestor', 'visualizador', 'cliente'];

export const melhorPapel = (papeis: string[]): AppRole | null =>
  ORDEM_PAPEIS.find((p) => papeis.includes(p)) ?? null;

/** Papéis que só enxergam o que foi liberado para eles. */
export const PAPEIS_RESTRITOS: AppRole[] = ['visualizador', 'cliente'];

export const acessoRestrito = (role: AppRole | null | undefined): boolean =>
  role != null && PAPEIS_RESTRITOS.includes(role);

export interface ObraComCliente {
  id: string;
  info?: { cliente?: string } | null;
}

/**
 * Recorta a lista de obras para o que o usuário pode ver.
 *
 * Papel desconhecido não restringe: enquanto o papel não chegou do banco, não
 * dá para afirmar que a pessoa é restrita, e cortar por suposição esconderia
 * obra de quem tem direito a ela. Papel restrito SEM atribuição nenhuma
 * devolve lista vazia — e a tela diz isso, em vez de cair num projeto
 * qualquer.
 */
export const obrasVisiveis = <T extends { id: string }>(
  obras: T[],
  role: AppRole | null | undefined,
  atribuidas: string[] | null | undefined,
): T[] => {
  if (!acessoRestrito(role)) return obras;
  const liberadas = new Set(atribuidas ?? []);
  return obras.filter((o) => liberadas.has(o.id));
};

const SEM_CLIENTE = 'Sem cliente';

export const clienteDaObra = (obra: ObraComCliente): string =>
  obra.info?.cliente?.trim() || SEM_CLIENTE;

/**
 * Clientes que aparecem no seletor do consolidado.
 *
 * Sai das obras já recortadas, e não da lista completa: um cliente cujo nome
 * aparece num seletor já entrega que ele existe e que a Megasteam trabalha
 * para ele — mesmo que a obra em si esteja escondida.
 */
export const clientesVisiveis = (obras: ObraComCliente[]): string[] => {
  const nomes = new Set(obras.map(clienteDaObra));
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
