import type { ProgramacaoSemanal } from '@/lib/parseProgramacaoSemanal';

/**
 * PPC — Percentual de Programação Concluída.
 *
 * A conta é a do próprio template de Programação Semanal, que é a fonte da
 * verdade (nada é marcado à mão no app):
 *
 *   - por dia, cada atividade recebe 1 (programado / realizado) ou 0
 *   - aderência da atividade = soma dos "realizado" ÷ soma dos "previsto"   (coluna X)
 *   - PPC da semana = MÉDIA das aderências das atividades                   (célula X7:X8)
 *   - a atividade conta como concluída a partir de 90% de aderência         (coluna "OK? (S/N)")
 *
 * Média, e não razão dos totais: cada atividade pesa igual, independente de
 * quantos dias foi programada.
 */
export interface PpcResumo {
  /** Atividades que bateram o corte de 90% de aderência. */
  concluidas: number;
  /** Atividades programadas na semana. */
  programadas: number;
  /** 0–100. */
  pct: number;
}

const CORTE_ADERENCIA = 0.9;

export const ppcDaSemana = (semana: ProgramacaoSemanal | null | undefined): PpcResumo => {
  const atividades = semana?.atividades ?? [];
  const programadas = atividades.length;
  const concluidas = atividades.filter(
    (a) => a.executada || (a.aderencia ?? 0) >= CORTE_ADERENCIA,
  ).length;

  // Prefere o PPC que veio do arquivo; só recalcula se ele não vier.
  const doArquivo = semana?.ppc?.ppcSemana;
  if (doArquivo != null && doArquivo > 0) {
    return { concluidas, programadas, pct: doArquivo };
  }

  const aderencias = atividades
    .map((a) => a.aderencia)
    .filter((v): v is number => v != null);
  const pct = aderencias.length
    ? Math.round((aderencias.reduce((s, v) => s + v, 0) / aderencias.length) * 1000) / 10
    : 0;

  return { concluidas, programadas, pct };
};

/** A última semana importada — a que alimenta o indicador do relatório. */
export const ultimaSemana = (
  semanas: ProgramacaoSemanal[] | null | undefined,
): ProgramacaoSemanal | null => {
  const lista = semanas ?? [];
  if (lista.length === 0) return null;
  return [...lista].sort((a, b) => a.semana - b.semana)[lista.length - 1];
};
