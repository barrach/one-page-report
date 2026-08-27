import { describe, it, expect } from 'vitest';
import { visaoMensal, type PontoMensal } from '@/lib/visaoMensal';

const CURVA: PontoMensal[] = [
  { date: '27/abr', previsto: 40, real: 38, tendencia: 39 },
  { date: '04/mai', previsto: 45, real: 42, tendencia: 44 },
  { date: '11/mai', previsto: 50, real: 46, tendencia: 49 },
  { date: '18/mai', previsto: 55, real: 49, tendencia: 53 },
  { date: '25/mai', previsto: 60, real: 0, tendencia: 57 },
  { date: '01/jun', previsto: 65, real: 0, tendencia: 61 },
];

describe('visaoMensal', () => {
  it('traz só as semanas do mês do "Atualizado em"', () => {
    const mes = visaoMensal(CURVA, '2026-05-20');
    expect(mes.map((s) => s.label)).toEqual(['04/mai', '11/mai', '18/mai', '25/mai']);
  });

  it('usa a linha de base por padrão', () => {
    const mes = visaoMensal(CURVA, '2026-05-20');
    expect(mes[0]).toEqual({ label: '04/mai', previsto: 45, real: 42 });
    expect(mes[3]).toEqual({ label: '25/mai', previsto: 60, real: 0 });
  });

  it('troca o previsto para a tendência quando pedido', () => {
    const mes = visaoMensal(CURVA, '2026-05-20', 'tendencia');
    expect(mes.map((s) => s.previsto)).toEqual([44, 49, 53, 57]);
    // O real não muda de série — só o previsto é que troca de referência.
    expect(mes.map((s) => s.real)).toEqual([42, 46, 49, 0]);
  });

  it('o mês acompanha o "Atualizado em"', () => {
    expect(visaoMensal(CURVA, '2026-04-30').map((s) => s.label)).toEqual(['27/abr']);
    expect(visaoMensal(CURVA, '2026-06-03').map((s) => s.label)).toEqual(['01/jun']);
  });

  it('devolve vazio sem curva ou sem data de status', () => {
    expect(visaoMensal([], '2026-05-20')).toEqual([]);
    expect(visaoMensal(CURVA, '')).toEqual([]);
  });

  it('numa obra de mais de um ano, não mistura o mesmo mês de anos diferentes', () => {
    // O bug: os rótulos não têm ano, então "03/ago" de 2026 e de 2027 viravam a
    // mesma coisa e o card mostrava dez colunas. Com o início da obra, a data de
    // cada ponto vem da posição na curva e a ambiguidade some.
    const doisAnos = Array.from({ length: 105 }, (_, i) => ({
      date: `sem${i}`,
      previsto: i,
      real: 0,
      tendencia: i,
    }));
    // Início numa segunda: 03/08/2026 é a primeira segunda de agosto/2026.
    const mes = visaoMensal(doisAnos, '2026-08-20', 'linhaBase', {
      inicio: '2026-08-03',
      periodicidade: 'semanal',
    });
    // Agosto/2026 tem 5 segundas a partir do dia 3: 3, 10, 17, 24 e 31.
    expect(mes).toHaveLength(5);
    expect(mes[0].label).toBe('sem0');
    expect(mes[4].label).toBe('sem4');
  });

  it('a primeira semana do mês é a primeira segunda-feira dele', () => {
    const semanal = Array.from({ length: 60 }, (_, i) => ({
      date: `s${i}`, previsto: i, real: 0, tendencia: i,
    }));
    // Obra começa em 05/01/2026 (segunda). Em maio/2026 as segundas são
    // 4, 11, 18 e 25 — quatro semanas.
    const mes = visaoMensal(semanal, '2026-05-20', 'linhaBase', {
      inicio: '2026-01-05',
      periodicidade: 'semanal',
    });
    expect(mes).toHaveLength(4);
  });
});
