import type { ActionStatus } from '@/store/projectStore';

/**
 * Situação de um prazo em relação a hoje, já considerando o status.
 *
 * Ponto concluído ou cancelado não tem urgência — cobrar prazo de algo resolvido
 * só polui o relatório.
 */
export type SituacaoPrazo = 'sem_prazo' | 'encerrado' | 'atrasado' | 'proximo' | 'no_prazo';

export interface Prazo {
  situacao: SituacaoPrazo;
  /** Dias até o prazo; negativo quando já passou. */
  dias: number;
  /** Texto curto para o indicador. */
  label: string;
}

/** Aceita ISO (yyyy-mm-dd) e o formato brasileiro (dd/mm/aaaa). */
export const parsePrazo = (valor: string | undefined | null): Date | null => {
  const s = String(valor ?? '').trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const ano = Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3]);
    return new Date(ano, Number(br[2]) - 1, Number(br[1]));
  }
  return null;
};

/** Converte o valor guardado para o que o `<input type="date">` espera. */
export const paraInputDate = (valor: string | undefined | null): string => {
  const d = parsePrazo(valor);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DIA = 86400000;

export const situacaoDoPrazo = (
  valor: string | undefined | null,
  status: ActionStatus | undefined,
  hoje = new Date(),
): Prazo => {
  if (status === 'CONCLUÍDO' || status === 'CANCELADO') {
    return { situacao: 'encerrado', dias: 0, label: status === 'CONCLUÍDO' ? 'concluído' : 'cancelado' };
  }

  const d = parsePrazo(valor);
  if (!d) return { situacao: 'sem_prazo', dias: 0, label: 'sem prazo' };

  const zero = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((zero(d) - zero(hoje)) / DIA);

  if (dias < 0) {
    const n = Math.abs(dias);
    return { situacao: 'atrasado', dias, label: `atrasado ${n} ${n === 1 ? 'dia' : 'dias'}` };
  }
  if (dias === 0) return { situacao: 'proximo', dias, label: 'vence hoje' };
  if (dias <= 3) return { situacao: 'proximo', dias, label: `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}` };
  return { situacao: 'no_prazo', dias, label: `${dias} dias` };
};

/** Classes do indicador, por situação. */
export const corDoPrazo: Record<SituacaoPrazo, string> = {
  atrasado: 'bg-destructive/15 text-destructive border-destructive/30',
  proximo: 'bg-warning/20 text-warning-foreground border-warning/40',
  no_prazo: 'bg-success/15 text-success border-success/30',
  encerrado: 'bg-muted text-muted-foreground border-border',
  sem_prazo: 'bg-muted text-muted-foreground border-border',
};
