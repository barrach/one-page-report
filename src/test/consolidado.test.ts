import { describe, it, expect } from 'vitest';
import { consolidarObras, linhaDaObra } from '@/lib/consolidado';
import type { Project } from '@/store/projectStore';

const obra = (
  nome: string,
  avancoPrev: number,
  avancoReal: number,
  valorContrato = 0,
): Project => ({
  id: nome.toLowerCase(),
  name: nome,
  info: {
    projeto: nome, cliente: 'UNIPAR', gestor: '', inicio: '2026-01-01',
    terminoLB: '2026-04-11', terminoPrev: '', avancoPrev, avancoReal,
    atualizadoEm: '2026-02-01',
  },
  statusDateIndex: 0,
  weeklyData: [], sCurveData: [], monthData: [], actions: [], observations: [],
  histogramData: [], scheduleData: [],
  eapFinanceira: valorContrato > 0
    ? [{ codigo: '1', descricao: nome, valorContrato, previstoMes: 0, realizadoMes: 0, acumulado: 0 }]
    : [],
});

describe('linhaDaObra', () => {
  it('IDP é o real sobre o previsto', () => {
    expect(linhaDaObra(obra('A', 50, 40)).idp).toBe(80);
  });

  it('classifica pelo mesmo corte do cabeçalho da obra', () => {
    expect(linhaDaObra(obra('A', 50, 50)).status).toBe('ok');
    expect(linhaDaObra(obra('B', 50, 41)).status).toBe('risco');
    expect(linhaDaObra(obra('C', 50, 20)).status).toBe('atrasada');
  });

  it('obra sem avanço previsto fica sem dado, não atrasada', () => {
    // Zero previsto é obra que ainda não começou a medir — chamar de atrasada
    // encheria o consolidado de alarme falso.
    expect(linhaDaObra(obra('D', 0, 0)).status).toBe('sem_dado');
  });

  it('projeta o término pelo ritmo', () => {
    const l = linhaDaObra(obra('E', 50, 25)); // IDP 50% → dobra a duração
    expect(l.desvioDias).toBe(100);
  });
});

describe('consolidarObras', () => {
  it('pondera pelo valor de contrato quando todas as obras têm valor', () => {
    // 5 milhões a 20% e 50 mil a 100%: a média simples daria 60%, o que seria
    // uma leitura falsa do que o cliente tem entregue.
    const c = consolidarObras([
      obra('GRANDE', 100, 20, 5_000_000),
      obra('PEQUENA', 100, 100, 50_000),
    ]);
    expect(c.ponderacao).toBe('contrato');
    expect(c.avancoReal).toBeCloseTo(20.79, 1);
  });

  it('cai na média simples quando falta valor em alguma obra', () => {
    const c = consolidarObras([
      obra('COM', 100, 20, 5_000_000),
      obra('SEM', 100, 100),
    ]);
    expect(c.ponderacao).toBe('media');
    expect(c.avancoReal).toBe(60);
  });

  it('ordena da pior para a melhor', () => {
    const c = consolidarObras([
      obra('BOA', 50, 50),
      obra('RUIM', 50, 10),
      obra('MEDIA', 50, 40),
    ]);
    expect(c.obras.map((o) => o.nome)).toEqual(['RUIM', 'MEDIA', 'BOA']);
  });

  it('conta atrasadas e em risco', () => {
    const c = consolidarObras([obra('A', 50, 50), obra('B', 50, 41), obra('C', 50, 10)]);
    expect(c.emRisco).toBe(1);
    expect(c.atrasadas).toBe(1);
  });

  it('cliente sem obra não quebra', () => {
    const c = consolidarObras([]);
    expect(c.obras).toEqual([]);
    expect(c.avancoReal).toBe(0);
    expect(c.valorContrato).toBe(0);
  });
});
