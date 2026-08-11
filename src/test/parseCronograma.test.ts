import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { isCronogramaTemplate, parseCronogramaWorkbook, weekLabel } from '@/lib/parseCronograma';

/** Roda contra o template de verdade que está na raiz do repo. */
const TEMPLATE = path.resolve(__dirname, '../../Template - Cronograma.xlsx');

const workbook = () => XLSX.read(readFileSync(TEMPLATE), { type: 'buffer', cellDates: true });

describe('parseCronograma — Template - Cronograma.xlsx', () => {
  it('o template existe no repo', () => {
    expect(existsSync(TEMPLATE)).toBe(true);
  });

  it('reconhece o formato', () => {
    expect(isCronogramaTemplate(workbook())).toBe(true);
  });

  it('acha as três abas', () => {
    const { abas } = parseCronogramaWorkbook(workbook());
    expect(abas.base).toBe('TRABALHO DE LINHA DE BASE');
    expect(abas.real).toBe('TRABALHO REAL');
    expect(abas.tendencia).toBe('TRABALHO TENDÊNCIA');
  });

  it('usa o total da linha de base como 100%', () => {
    const { totalLinhaBase } = parseCronogramaWorkbook(workbook());
    expect(totalLinhaBase).toBeCloseTo(10028.87, 2);
  });

  it('começa na primeira data com valor (T3 = 181,5 na linha de base)', () => {
    const { sCurve } = parseCronogramaWorkbook(workbook());
    // 181,5 / 10.028,87 = 1,81%
    expect(sCurve[0].previsto).toBeCloseTo(1.81, 2);
    expect(sCurve[0].date).toBe(weekLabel(new Date(2026, 5, 8))); // 08/06/2026
  });

  it('corta o Real no último avanço em vez de arrastar o platô', () => {
    const { sCurve, statusDateIndex } = parseCronogramaWorkbook(workbook());
    const comReal = sCurve.filter((p) => p.real > 0);
    // O Real do template cresce até 778,31 e depois repete; o platô não entra.
    expect(comReal.length).toBeLessThan(sCurve.length);
    expect(sCurve[statusDateIndex].real).toBeCloseTo((778.31 / 10028.87) * 100, 2);
    expect(sCurve[statusDateIndex + 1]?.real ?? 0).toBe(0);
  });

  it('linha de base e tendência vão até 100%', () => {
    const { sCurve } = parseCronogramaWorkbook(workbook());
    const last = (k: 'previsto' | 'tendencia') => {
      const vals = sCurve.map((p) => p[k]).filter((v) => v > 0);
      return vals[vals.length - 1];
    };
    expect(last('previsto')).toBeCloseTo(100, 2);
    expect(last('tendencia')).toBeCloseTo(100, 2);
  });

  it('não traz replanejado — isso é preenchido à mão', () => {
    const { sCurve } = parseCronogramaWorkbook(workbook());
    expect(sCurve.every((p) => p.replanejado === undefined)).toBe(true);
    expect(sCurve.every((p) => p.realReplanejado === undefined)).toBe(true);
  });

  it('lê as tarefas com as 15 colunas do template', () => {
    const { rows } = parseCronogramaWorkbook(workbook());
    expect(rows.length).toBeGreaterThan(100);

    const primeira = rows[0];
    // linha 4 do template: nível 1, "MARCOS CONTRATUAIS", Atrasada
    expect(primeira.outlineLevel).toBe(1);
    expect(primeira.tarefa).toBe('MARCOS CONTRATUAIS');
    expect(primeira.status).toBe('Atrasada');
    expect(primeira.critica).toBe(false);
    expect(primeira.duracaoRestante).toBe('103,14 dias');
    expect(primeira.terminoBase).toContain('30/09/26');
    expect(primeira.previsaoTermino).toContain('15/10/26');
    expect(primeira.terminoReal).toBe('ND');
    expect(primeira.custo).toBe(0);
  });

  it('converte os percentuais de fração para pontos percentuais', () => {
    const { rows } = parseCronogramaWorkbook(workbook());
    const comPrev = rows.find((r) => r.previsto > 0);
    expect(comPrev).toBeDefined();
    expect(comPrev!.previsto).toBeLessThanOrEqual(100);
  });
});

describe('parseProgramacaoSemanal — Template - Programação Semanal.xlsx', () => {
  const PROG = path.resolve(__dirname, '../../Template - Programação Semanal.xlsx');

  it('o template existe no repo', () => {
    expect(existsSync(PROG)).toBe(true);
  });

  // PENDENTE: o parser atual procura uma aba com "MODELO 03"/"ENCARREGADO" e espera o
  // título em A1. Neste template a aba se chama "Programação Semanal" e o título está em
  // A2, com as colunas em outras posições — ou seja, ele foi escrito para outro layout.
  // Este teste é o alvo de quando o parser for adaptado ao template oficial.
  it.skip('é reconhecido e lido pelo parser atual', async () => {
    const { isProgramacaoSemanal, parseProgramacaoSemanal } = await import('@/lib/parseProgramacaoSemanal');
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    expect(isProgramacaoSemanal(wb)).toBe(true);
    const prog = parseProgramacaoSemanal(wb);
    expect(prog).not.toBeNull();
    expect(prog!.atividades.length).toBeGreaterThan(0);
    expect(prog!.ppc.prev.length).toBe(6);
    expect(prog!.ppc.real.length).toBe(6);
  });
});
