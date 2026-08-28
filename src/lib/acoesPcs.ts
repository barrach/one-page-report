import type { ActionItem } from '@/store/projectStore';
import { parseISOLocal } from '@/lib/dateUtils';

/**
 * Plano de ação no formato PCS: problema → causa → solução.
 *
 * Reaproveita o `ActionItem` que o relatório já usa — `atividade` é a solução —
 * em vez de criar uma segunda lista de ações. Duas listas de pendências no
 * mesmo app é a forma mais rápida de as duas ficarem desatualizadas.
 */

/** O que uma pessoa escolhe no seletor. */
export type StatusEscolhido = 'NÃO INICIADO' | 'EM ANDAMENTO' | 'CONCLUÍDO' | 'CANCELADO';

/** O que a tela mostra — inclui o ATRASADO, que ninguém escolhe. */
export type StatusPcs = StatusEscolhido | 'ATRASADO';

export const STATUS_ESCOLHIVEIS: StatusEscolhido[] = [
  'NÃO INICIADO', 'EM ANDAMENTO', 'CONCLUÍDO', 'CANCELADO',
];

export const ROTULO_STATUS_PCS: Record<StatusPcs, string> = {
  'NÃO INICIADO': 'Não iniciado',
  'EM ANDAMENTO': 'Em andamento',
  ATRASADO: 'Atrasado',
  'CONCLUÍDO': 'Concluído',
  CANCELADO: 'Cancelado',
};

export const CORES_STATUS_PCS: Record<StatusPcs, string> = {
  'NÃO INICIADO': 'border-border bg-muted/50 text-muted-foreground',
  'EM ANDAMENTO': 'border-primary/40 bg-primary/10 text-primary',
  ATRASADO: 'border-destructive/40 bg-destructive/10 text-destructive',
  'CONCLUÍDO': 'border-success/40 bg-success/10 text-success',
  CANCELADO: 'border-border bg-muted/50 text-muted-foreground line-through',
};

/**
 * O status que vale de verdade.
 *
 * ATRASADO é DERIVADO, nunca digitado: prazo vencido na data de corte e ação
 * ainda aberta. Se fosse um valor guardado, ele só estaria certo no dia em que
 * alguém o marcasse — e no dia seguinte já seria mentira, porque ninguém volta
 * numa lista de ações para reclassificar o que venceu durante a noite.
 *
 * A data de corte é a data de status do relatório, e não "hoje": o relatório
 * inteiro fala de um instante, e uma coluna que anda sozinha contradiria todas
 * as outras na mesma tela.
 */
export const statusEfetivo = (acao: ActionItem, dataCorte: string): StatusPcs => {
  const escolhido = (String(acao.status ?? '').toUpperCase() || 'NÃO INICIADO') as StatusPcs;
  if (escolhido === 'CONCLUÍDO' || escolhido === 'CANCELADO') return escolhido;

  const prazo = parseISOLocal(acao.prazo ?? '');
  const corte = parseISOLocal(dataCorte);
  if (prazo && corte && prazo.getTime() < corte.getTime()) return 'ATRASADO';

  return escolhido === 'ATRASADO' ? 'EM ANDAMENTO' : escolhido;
};

/** Ações que ainda cobram alguém — as concluídas e canceladas saem. */
export const acoesEmAberto = (acoes: ActionItem[]): ActionItem[] =>
  (acoes ?? []).filter((a) => {
    const s = String(a.status ?? '').toUpperCase();
    return s !== 'CONCLUÍDO' && s !== 'CANCELADO';
  });

/** Linha nova do plano, já com o status de quem ainda não começou. */
export const acaoVazia = (id: number): ActionItem => ({
  id,
  problema: '',
  causa: '',
  impacto: '',
  atividade: '',
  responsavel: '',
  prazo: '',
  necessidade: '',
  status: 'NÃO INICIADO',
});
