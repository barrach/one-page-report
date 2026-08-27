import { describe, it, expect } from 'vitest';
import { projetarTermino } from '@/lib/previsaoTermino';

describe('projetarTermino', () => {
  // Obra de 100 dias: 01/01 a 11/04 de 2026.
  const INICIO = '2026-01-01';
  const BASE = '2026-04-11';

  it('IDP de 100% termina na data da linha de base', () => {
    const p = projetarTermino(INICIO, BASE, 100)!;
    expect(p.data).toBe(BASE);
    expect(p.desvioDias).toBe(0);
  });

  it('IDP de 50% dobra a duração', () => {
    const p = projetarTermino(INICIO, BASE, 50)!;
    expect(p.duracaoBase).toBe(100);
    expect(p.desvioDias).toBe(100);
    expect(p.data).toBe('2026-07-20');
  });

  it('IDP acima de 100% antecipa o término', () => {
    const p = projetarTermino(INICIO, BASE, 125)!;
    expect(p.desvioDias).toBe(-20);
  });

  it('IDP muito baixo não vira data absurda', () => {
    // 5% de desempenho projetaria 20x a duração — extrapolação sem sentido.
    expect(projetarTermino(INICIO, BASE, 5)).toBeNull();
    expect(projetarTermino(INICIO, BASE, 0)).toBeNull();
  });

  it('sem datas não inventa projeção', () => {
    expect(projetarTermino('', BASE, 90)).toBeNull();
    expect(projetarTermino(INICIO, '', 90)).toBeNull();
    // Término antes do início é dado errado, não obra de duração negativa.
    expect(projetarTermino(BASE, INICIO, 90)).toBeNull();
  });
});
