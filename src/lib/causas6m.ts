import type { Causa6M } from '@/lib/parseProgramacaoSemanal';
import type { ProgramacaoSemanal } from '@/lib/parseProgramacaoSemanal';

/** As seis causas do diagrama de Ishikawa, na ordem canônica. */
export const CAUSAS_6M: Causa6M[] = [
  'Método',
  'Máquina',
  'Material',
  'Mão de Obra',
  'Medida',
  'Meio Ambiente',
];

/** Uma cor por M, usada no gráfico e nas pílulas — sempre a mesma. */
export const COR_CAUSA: Record<Causa6M, string> = {
  'Método': '#3b82f6',        // azul
  'Máquina': '#f97316',       // laranja
  'Material': '#8b5cf6',      // violeta
  'Mão de Obra': '#ef4444',   // vermelho
  'Medida': '#eab308',        // amarelo
  'Meio Ambiente': '#22c55e', // verde
};

/**
 * Limite de aderência do template: abaixo dele a atividade precisa de
 * justificativa ("Orientação: preencher a coluna 'Descrição da Causa' em cada
 * atividade, sempre que a aderência da mesma for menor que 90%").
 */
export const CORTE_ADERENCIA = 0.9;

/** A atividade não entregou o programado e portanto exige justificativa 6M. */
export const exigeJustificativa = (a: {
  aderencia?: number;
  executada: boolean;
  dias: { prev: number[] };
}): boolean => {
  const programada = a.dias.prev.some((v) => v > 0);
  if (!programada) return false;
  if (a.aderencia == null) return !a.executada;
  return a.aderencia < CORTE_ADERENCIA;
};

export interface JustificativaItem {
  semana: number;
  periodo: string;
  atividade: string;
  local?: string;
  causas: Causa6M[];
  justificativa: string;
  /** 0–1 */
  aderencia?: number;
}

export interface ParetoCausa {
  causa: Causa6M;
  /** Ocorrências da causa. */
  total: number;
  /** Participação da causa no total (0–100). */
  pct: number;
  /** Percentual acumulado no ranking (0–100) — a linha de Pareto. */
  acumulado: number;
  cor: string;
}

export interface Resumo6M {
  pareto: ParetoCausa[];
  /** Total de ocorrências apontadas (uma atividade pode ter mais de uma causa). */
  ocorrencias: number;
  /** Atividades que exigem justificativa. */
  aJustificar: number;
  /** Dessas, quantas já têm ao menos uma causa apontada. */
  justificadas: number;
  itens: JustificativaItem[];
}

/**
 * Consolida as justificativas 6M de todas as semanas importadas e monta o Pareto.
 *
 * O ranking é por número de ocorrências, com o acumulado clássico de Pareto — é
 * ele que mostra as poucas causas que respondem pela maior parte das falhas.
 */
export const resumo6M = (semanas: ProgramacaoSemanal[] | null | undefined): Resumo6M => {
  const contagem = new Map<Causa6M, number>();
  const itens: JustificativaItem[] = [];
  let aJustificar = 0;
  let justificadas = 0;

  for (const semana of semanas ?? []) {
    for (const a of semana.atividades) {
      if (!exigeJustificativa(a)) continue;
      aJustificar++;
      if (a.causas6M.length > 0) justificadas++;

      for (const c of a.causas6M) contagem.set(c, (contagem.get(c) ?? 0) + 1);

      itens.push({
        semana: semana.semana,
        periodo: semana.periodo,
        atividade: a.descricao || a.idCronograma || 'Atividade sem descrição',
        local: a.local,
        causas: a.causas6M,
        justificativa: a.planoAcao || '',
        aderencia: a.aderencia,
      });
    }
  }

  const ocorrencias = [...contagem.values()].reduce((s, v) => s + v, 0);
  const ordenadas = [...contagem.entries()].sort((a, b) => b[1] - a[1]);

  let acum = 0;
  const pareto: ParetoCausa[] = ordenadas.map(([causa, total]) => {
    acum += total;
    return {
      causa,
      total,
      pct: ocorrencias > 0 ? Math.round((total / ocorrencias) * 1000) / 10 : 0,
      acumulado: ocorrencias > 0 ? Math.round((acum / ocorrencias) * 1000) / 10 : 0,
      cor: COR_CAUSA[causa],
    };
  });

  return { pareto, ocorrencias, aJustificar, justificadas, itens };
};
