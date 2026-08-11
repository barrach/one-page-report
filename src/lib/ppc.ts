import type { ProgramacaoSemanal } from '@/lib/parseProgramacaoSemanal';

/**
 * PPC — Percentual de Programação Concluída (Last Planner).
 *
 * É binário por atividade: fez o que estava programado → 1; não fez → 0.
 * Atividade parcial conta como NÃO concluída, de propósito: é isso que dá ao
 * indicador o poder de expor programação irreal.
 *
 *   PPC = atividades concluídas ÷ atividades programadas
 */
export interface PpcResumo {
  /** Atividades com baixa dada. */
  concluidas: number;
  /** Total de atividades programadas na semana. */
  programadas: number;
  /** 0–100. Zero quando não há atividades programadas. */
  pct: number;
}

export const ppcDaSemana = (semana: ProgramacaoSemanal | null | undefined): PpcResumo => {
  const atividades = semana?.atividades ?? [];
  const programadas = atividades.length;
  const concluidas = atividades.filter((a) => a.executada).length;
  return {
    concluidas,
    programadas,
    pct: programadas > 0 ? Math.round((concluidas / programadas) * 1000) / 10 : 0,
  };
};

/** A última semana importada — a que alimenta o indicador do relatório. */
export const ultimaSemana = (
  semanas: ProgramacaoSemanal[] | null | undefined,
): ProgramacaoSemanal | null => {
  const lista = semanas ?? [];
  if (lista.length === 0) return null;
  return [...lista].sort((a, b) => a.semana - b.semana)[lista.length - 1];
};
