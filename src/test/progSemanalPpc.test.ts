import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { isProgramacaoSemanal, parseProgramacaoSemanal } from '@/lib/parseProgramacaoSemanal';
import { ppcDaSemana } from '@/lib/ppc';

/**
 * O template do repo vem em branco, então a matemática do PPC não é exercitada
 * por ele. Aqui montamos uma planilha no MESMO layout, com dias 1/0 preenchidos,
 * para provar a regra do template:
 *
 *   aderência da atividade = realizado ÷ previsto        (coluna X)
 *   PPC da semana          = média das aderências        (célula X7:X8)
 *   concluída              = aderência ≥ 90%             (coluna "OK? (S/N)")
 */
const COL = { D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, W: 22, X: 23 };

const linha = (pares: Record<number, unknown>): unknown[] => {
  const max = Math.max(...Object.keys(pares).map(Number));
  const out: unknown[] = new Array(max + 1).fill(null);
  for (const [i, v] of Object.entries(pares)) out[Number(i)] = v;
  return out;
};

const dias = (base: number, valores: number[]) =>
  Object.fromEntries(valores.map((v, i) => [base + i, v]));

const planilha = () => {
  const aoa: unknown[][] = [];
  aoa[1] = linha({ 0: 'PROGRAMAÇÃO SEMANAL DE SERVIÇOS' });                       // linha 2
  aoa[3] = linha({ 0: 'Obra', 4: 'Obra de teste', 11: 'Período', 14: 12 });        // linha 4
  aoa[5] = linha({                                                                 // linha 6 — cabeçalho
    [COL.D]: 'Item', [COL.E]: 'ID Cronograma', [COL.F]: 'OS atividade', [COL.G]: 'Semana',
    [COL.H]: 'Atividade Detalhada', [COL.I]: 'Local', [COL.J]: 'Empresa',
    [COL.K]: 'Responsável', [COL.L]: 'Encarregado', [COL.M]: 'Quantidade Prevista',
    [COL.N]: 'Und.', [COL.O]: '(P)rev.\n(R)eal', [COL.X]: 'Aderência',
  });
  aoa[7] = linha({                                                                 // linha 8 — datas
    [COL.Q]: new Date(2026, 7, 10), [COL.Q + 1]: new Date(2026, 7, 11),
    [COL.Q + 2]: new Date(2026, 7, 12), [COL.Q + 3]: new Date(2026, 7, 13),
    [COL.Q + 4]: new Date(2026, 7, 14), [COL.Q + 5]: new Date(2026, 7, 15),
  });
  aoa[8] = linha({                                                                 // linha 9 — dias da semana
    [COL.Q]: '2ª', [COL.Q + 1]: '3ª', [COL.Q + 2]: '4ª', [COL.Q + 3]: '5ª',
    [COL.Q + 4]: '6ª', [COL.Q + 5]: 'Sab', [COL.W]: 'Total Sem.',
  });

  // Atividade 1 — 2 dias programados, 1 realizado → aderência 50%
  aoa[10] = linha({ [COL.D]: 1, [COL.E]: '1.1', [COL.H]: 'Concretagem laje', [COL.I]: 'Área 5', [COL.N]: 'm³', [COL.O]: 'P', ...dias(COL.Q, [1, 1, 0, 0, 0, 0]) });
  aoa[11] = linha({ [COL.O]: 'R', ...dias(COL.Q, [1, 0, 0, 0, 0, 0]) });
  // Atividade 2 — 1 dia programado, 1 realizado → aderência 100%
  aoa[12] = linha({ [COL.D]: 2, [COL.E]: '1.2', [COL.H]: 'Montagem forma', [COL.I]: 'Área 6', [COL.N]: 'm²', [COL.O]: 'P', ...dias(COL.Q, [0, 0, 1, 0, 0, 0]) });
  aoa[13] = linha({ [COL.O]: 'R', ...dias(COL.Q, [0, 0, 1, 0, 0, 0]) });

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r ?? []), { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Programação Semanal');
  return wb;
};

describe('Programação Semanal — PPC a partir dos dias 1/0', () => {
  it('reconhece a planilha pelos pares P/R', () => {
    expect(isProgramacaoSemanal(planilha())).toBe(true);
  });

  it('mapeia atividade (H), local (I) e os dias das colunas Q..V', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    expect(prog.atividades).toHaveLength(2);
    expect(prog.atividades[0].descricao).toBe('Concretagem laje');
    expect(prog.atividades[0].local).toBe('Área 5');
    expect(prog.atividades[0].dias.prev).toEqual([1, 1, 0, 0, 0, 0]);
    expect(prog.atividades[0].dias.real).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it('calcula a aderência de cada atividade (realizado ÷ previsto)', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    expect(prog.atividades[0].aderencia).toBeCloseTo(0.5, 3);
    expect(prog.atividades[1].aderencia).toBeCloseTo(1, 3);
  });

  it('conclui a atividade só a partir de 90% de aderência', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    expect(prog.atividades[0].executada).toBe(false); // 50%
    expect(prog.atividades[1].executada).toBe(true);  // 100%
  });

  it('PPC da semana é a MÉDIA das aderências, não a razão dos totais', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    // média(50%, 100%) = 75% — a razão dos totais daria 2/3 = 66,7%
    expect(prog.ppc.ppcSemana).toBeCloseTo(75, 1);
    expect(ppcDaSemana(prog).pct).toBeCloseTo(75, 1);
    expect(ppcDaSemana(prog).concluidas).toBe(1);
    expect(ppcDaSemana(prog).programadas).toBe(2);
  });

  it('soma os dias no grid diário do PPC', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    expect(prog.ppc.prev).toEqual([1, 1, 1, 0, 0, 0]);
    expect(prog.ppc.real).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it('deriva o período das datas da linha 8', () => {
    const prog = parseProgramacaoSemanal(planilha())!;
    expect(prog.periodo).toBe('10/08 a 15/08');
    expect(prog.dias).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15',
    ]);
  });
});
