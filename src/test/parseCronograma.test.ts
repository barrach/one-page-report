import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { isCronogramaTemplate, parseCronogramaWorkbook, weekLabel } from '@/lib/parseCronograma';
import { isProgramacaoSemanal, parseProgramacaoSemanal } from '@/lib/parseProgramacaoSemanal';

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

  it('é reconhecido pelo parser', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    expect(isProgramacaoSemanal(wb)).toBe(true);
  });

  it('lê as atividades em pares P/R', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    const prog = parseProgramacaoSemanal(wb)!;
    expect(prog).not.toBeNull();
    // linhas 11..53, de 2 em 2 → 22 atividades
    expect(prog.atividades.length).toBe(22);
    expect(prog.atividades[0].idCronograma).toBe('1.1');
    expect(prog.atividades[0].os).toBe('1.11');
    expect(prog.atividades[0].dias.prev).toHaveLength(6);
    expect(prog.atividades[0].dias.real).toHaveLength(6);
  });

  it('guarda a "Descrição da Causa" preenchida no template', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    const prog = parseProgramacaoSemanal(wb)!;
    expect(prog.atividades[0].descricaoCausa).toContain('Solicitação de modifica');
  });

  it('deriva o período das datas dos 6 dias', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    const prog = parseProgramacaoSemanal(wb)!;
    // Q8:V8 = 20/02/2023 a 25/02/2023
    expect(prog.periodo).toBe('20/02 a 25/02');
    expect(prog.semanaDoMes).toBe('S3'); // dia 20 → S3 pela regra de faixas (<=21)
    expect(prog.mes).toBe('fev/23');
  });

  it('pega o contrato e a obra do cabeçalho / aba Calendário', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    const prog = parseProgramacaoSemanal(wb)!;
    expect(prog.contrato).toBe('5500071140');
    expect(prog.referencia).toContain('obras civis');
  });

  it('monta o PPC somando os dias das atividades', () => {
    const wb = XLSX.read(readFileSync(PROG), { type: 'buffer', cellDates: true });
    const prog = parseProgramacaoSemanal(wb)!;
    expect(prog.ppc.prev).toHaveLength(6);
    expect(prog.ppc.real).toHaveLength(6);
    expect(prog.ppc.aderencia).toHaveLength(6);
    // O template vem em branco: sem quantidade diária, o PPC fica zerado.
    expect(prog.ppc.totalPrevisto).toBe(0);
    expect(prog.ppc.ppcSemana).toBe(0);
  });
});
