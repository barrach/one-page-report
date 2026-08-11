import { describe, it, expect } from 'vitest';
import { resumo6M, exigeJustificativa, CAUSAS_6M } from '@/lib/causas6m';
import type { ProgramacaoSemanal, AtividadeProgSemanal } from '@/lib/parseProgramacaoSemanal';

const atividade = (over: Partial<AtividadeProgSemanal>): AtividadeProgSemanal => ({
  id: '1',
  area: '',
  descricao: 'Atividade',
  efetivo: 0,
  quantidade: { prev: 0, real: 0 },
  unidade: '',
  dias: { prev: [1, 0, 0, 0, 0, 0], real: [0, 0, 0, 0, 0, 0] },
  executada: false,
  causas6M: [],
  planoAcao: '',
  ...over,
});

const semana = (atividades: AtividadeProgSemanal[], n = 1): ProgramacaoSemanal => ({
  semana: n,
  semanaDoMes: 'S1',
  mes: 'ago/26',
  periodo: '10/08 a 15/08',
  contrato: '',
  referencia: '',
  responsavel: '',
  equipe: '',
  engenheiro: '',
  atividades,
  ppc: {
    prev: [0, 0, 0, 0, 0, 0], real: [0, 0, 0, 0, 0, 0], aderencia: [0, 0, 0, 0, 0, 0],
    totalPrevisto: 0, totalRealizado: 0, ppcSemana: 0, totalAdherencia: 0,
  },
  importadoEm: '2026-08-11T00:00:00.000Z',
});

describe('exigeJustificativa — regra de 90% do template', () => {
  it('exige quando a aderência fica abaixo de 90%', () => {
    expect(exigeJustificativa(atividade({ aderencia: 0 }))).toBe(true);
    expect(exigeJustificativa(atividade({ aderencia: 0.5 }))).toBe(true);
    expect(exigeJustificativa(atividade({ aderencia: 0.89 }))).toBe(true);
  });

  it('não exige de quem bateu 90% ou mais', () => {
    expect(exigeJustificativa(atividade({ aderencia: 0.9 }))).toBe(false);
    expect(exigeJustificativa(atividade({ aderencia: 1 }))).toBe(false);
  });

  it('não exige de atividade que nem foi programada na semana', () => {
    const naoProgramada = atividade({ aderencia: 0, dias: { prev: [0, 0, 0, 0, 0, 0], real: [0, 0, 0, 0, 0, 0] } });
    expect(exigeJustificativa(naoProgramada)).toBe(false);
  });
});

describe('resumo6M — Pareto das causas', () => {
  it('ordena por ocorrências e acumula até 100%', () => {
    const s = semana([
      atividade({ descricao: 'A', aderencia: 0, causas6M: ['Material'] }),
      atividade({ descricao: 'B', aderencia: 0, causas6M: ['Material'] }),
      atividade({ descricao: 'C', aderencia: 0.2, causas6M: ['Material'] }),
      atividade({ descricao: 'D', aderencia: 0, causas6M: ['Mão de Obra'] }),
      atividade({ descricao: 'E', aderencia: 0, causas6M: ['Método'] }),
    ]);
    const r = resumo6M([s]);

    expect(r.pareto.map((p) => p.causa)).toEqual(['Material', 'Mão de Obra', 'Método']);
    expect(r.ocorrencias).toBe(5);
    expect(r.pareto[0].total).toBe(3);
    expect(r.pareto[0].pct).toBeCloseTo(60, 1);
    expect(r.pareto[0].acumulado).toBeCloseTo(60, 1);
    expect(r.pareto[2].acumulado).toBeCloseTo(100, 1);
  });

  it('conta uma atividade em cada causa que ela aponta', () => {
    const s = semana([
      atividade({ aderencia: 0, causas6M: ['Material', 'Mão de Obra'] }),
    ]);
    const r = resumo6M([s]);
    expect(r.ocorrencias).toBe(2);
    expect(r.aJustificar).toBe(1);
    expect(r.justificadas).toBe(1);
  });

  it('mede a cobertura: atividade sem causa apontada conta como pendente', () => {
    const s = semana([
      atividade({ descricao: 'com causa', aderencia: 0, causas6M: ['Medida'] }),
      atividade({ descricao: 'sem causa', aderencia: 0, causas6M: [] }),
      atividade({ descricao: 'ok', aderencia: 1, causas6M: [] }),
    ]);
    const r = resumo6M([s]);
    expect(r.aJustificar).toBe(2);
    expect(r.justificadas).toBe(1);
  });

  it('leva a justificativa escrita e a semana para a lista', () => {
    const s = semana([
      atividade({ descricao: 'Concretagem', local: 'Área 5', aderencia: 0, causas6M: ['Material'], planoAcao: 'Aço não chegou' }),
    ], 23);
    const r = resumo6M([s]);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({
      semana: 23,
      atividade: 'Concretagem',
      local: 'Área 5',
      justificativa: 'Aço não chegou',
    });
  });

  it('consolida várias semanas', () => {
    const s1 = semana([atividade({ aderencia: 0, causas6M: ['Clima' as never] })], 1);
    const s2 = semana([atividade({ aderencia: 0, causas6M: ['Meio Ambiente'] })], 2);
    const r = resumo6M([s1, s2]);
    expect(r.aJustificar).toBe(2);
    expect(r.ocorrencias).toBe(2);
  });

  it('sem atividades fora do programado, o Pareto fica vazio', () => {
    const r = resumo6M([semana([atividade({ aderencia: 1 })])]);
    expect(r.pareto).toEqual([]);
    expect(r.aJustificar).toBe(0);
  });

  it('as seis causas canônicas estão completas', () => {
    expect(CAUSAS_6M).toHaveLength(6);
    expect(CAUSAS_6M).toContain('Método');
    expect(CAUSAS_6M).toContain('Máquina');
    expect(CAUSAS_6M).toContain('Material');
    expect(CAUSAS_6M).toContain('Mão de Obra');
    expect(CAUSAS_6M).toContain('Medida');
    expect(CAUSAS_6M).toContain('Meio Ambiente');
  });
});
