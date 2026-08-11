import { describe, it, expect } from 'vitest';
import { situacaoDoPrazo, parsePrazo, paraInputDate } from '@/lib/prazoUtils';

const HOJE = new Date(2026, 7, 11); // 11/08/2026

describe('prazoUtils', () => {
  it('lê data ISO e data brasileira', () => {
    expect(parsePrazo('2026-08-20')?.getDate()).toBe(20);
    expect(parsePrazo('20/08/2026')?.getMonth()).toBe(7);
    expect(parsePrazo('20/08/26')?.getFullYear()).toBe(2026);
    expect(parsePrazo('')).toBeNull();
    expect(parsePrazo('semana que vem')).toBeNull();
  });

  it('normaliza para o formato do input de data', () => {
    // o valor antigo em dd/mm/aaaa continua abrindo no seletor de data
    expect(paraInputDate('20/08/2026')).toBe('2026-08-20');
    expect(paraInputDate('2026-08-20')).toBe('2026-08-20');
    expect(paraInputDate('qualquer coisa')).toBe('');
  });

  it('marca atraso quando o prazo já passou', () => {
    const p = situacaoDoPrazo('2026-08-06', 'EM ANDAMENTO', HOJE);
    expect(p.situacao).toBe('atrasado');
    expect(p.dias).toBe(-5);
    expect(p.label).toBe('atrasado 5 dias');
  });

  it('avisa quando está próximo (até 3 dias) e quando vence hoje', () => {
    expect(situacaoDoPrazo('2026-08-11', 'EM ANDAMENTO', HOJE).label).toBe('vence hoje');
    expect(situacaoDoPrazo('2026-08-12', 'EM ANDAMENTO', HOJE).label).toBe('vence em 1 dia');
    expect(situacaoDoPrazo('2026-08-14', 'EM ANDAMENTO', HOJE).situacao).toBe('proximo');
    expect(situacaoDoPrazo('2026-08-15', 'EM ANDAMENTO', HOJE).situacao).toBe('no_prazo');
  });

  it('não cobra prazo de ponto concluído ou cancelado', () => {
    // já resolvido: cobrar prazo só poluiria o relatório
    expect(situacaoDoPrazo('2026-01-01', 'CONCLUÍDO', HOJE).situacao).toBe('encerrado');
    expect(situacaoDoPrazo('2026-01-01', 'CANCELADO', HOJE).situacao).toBe('encerrado');
  });

  it('sem prazo preenchido, não inventa urgência', () => {
    expect(situacaoDoPrazo('', 'EM ANDAMENTO', HOJE).situacao).toBe('sem_prazo');
    expect(situacaoDoPrazo(undefined, '', HOJE).situacao).toBe('sem_prazo');
  });
});
