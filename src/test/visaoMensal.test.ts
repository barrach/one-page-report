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
});
