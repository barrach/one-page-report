import { describe, it, expect } from 'vitest';
import { avancoDaCurva, indiceDoStatus, limitarAoTermino } from '@/lib/avancoCurva';

const CURVA = [
  { date: '01/jun', previsto: 10, real: 9 },
  { date: '08/jun', previsto: 20, real: 18 },
  { date: '15/jun', previsto: 30, real: 26 },
  { date: '22/jun', previsto: 40, real: 0 },
  { date: '29/jun', previsto: 50, real: 0 },
];

describe('limitarAoTermino', () => {
  it('corta a curva no término previsto', () => {
    expect(limitarAoTermino(CURVA, '2026-06-15').map((p) => p.date))
      .toEqual(['01/jun', '08/jun', '15/jun']);
  });

  it('inclui o próprio dia do término', () => {
    expect(limitarAoTermino(CURVA, '2026-06-08')).toHaveLength(2);
  });

  it('sem término previsto, não corta nada', () => {
    expect(limitarAoTermino(CURVA, '')).toHaveLength(5);
  });

  it('término antes de tudo devolve a curva inteira, em vez de gráfico vazio', () => {
    expect(limitarAoTermino(CURVA, '2020-01-01')).toHaveLength(5);
  });
});

describe('avancoDaCurva', () => {
  it('lê previsto e real do ponto de status', () => {
    expect(avancoDaCurva(CURVA, 2)).toEqual({ previsto: 30, real: 26 });
  });

  it('havendo replanejamento, o previsto vem do replanejado', () => {
    const comRepl = [{ date: '15/jun', previsto: 30, real: 26, replanejado: 27 }];
    expect(avancoDaCurva(comRepl, 0)).toEqual({ previsto: 27, real: 26 });
  });

  it('ponto zerado não apaga o que está no cabeçalho', () => {
    expect(avancoDaCurva([{ date: '15/jun', previsto: 0, real: 0 }], 0)).toBeNull();
    expect(avancoDaCurva(CURVA, 99)).toBeNull();
  });
});

describe('indiceDoStatus', () => {
  it('casa pela data exata', () => {
    expect(indiceDoStatus(CURVA, '2026-06-15')).toBe(2);
  });

  it('sem data exata, fica na última semana que já passou', () => {
    expect(indiceDoStatus(CURVA, '2026-06-11')).toBe(1);
  });

  it('sem "Atualizado em", devolve o padrão recebido', () => {
    expect(indiceDoStatus(CURVA, '', 3)).toBe(3);
  });
});
