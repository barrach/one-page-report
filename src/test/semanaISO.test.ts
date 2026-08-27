import { describe, it, expect } from 'vitest';
import { semanaISO } from '@/lib/dateUtils';

describe('semanaISO', () => {
  it('numera pela semana ISO, que comeca na segunda', () => {
    // 2026-08-20 e uma quinta; a semana ISO dela e a 34.
    expect(semanaISO('2026-08-20')).toBe('SEM 34');
  });

  it('domingo pertence a semana que comecou na segunda anterior', () => {
    expect(semanaISO('2026-08-23')).toBe(semanaISO('2026-08-17'));
    expect(semanaISO('2026-08-24')).not.toBe(semanaISO('2026-08-23'));
  });

  it('a virada do ano segue a regra da quinta-feira', () => {
    // 01/01/2027 e sexta: pertence a semana 53 de 2026.
    expect(semanaISO('2027-01-01')).toBe('SEM 53');
    expect(semanaISO('2027-01-04')).toBe('SEM 01');
  });

  it('data invalida nao quebra o cabecalho', () => {
    expect(semanaISO('')).toBe('');
    expect(semanaISO('nao e data')).toBe('');
  });
});
