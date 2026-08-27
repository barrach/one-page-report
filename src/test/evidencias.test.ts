import { describe, it, expect } from 'vitest';
import { caminhoDaEvidencia, formatarTamanho, nomeSeguro } from '@/lib/evidencias';

describe('nomeSeguro', () => {
  it('tira acento, espaço e caractere que quebraria o caminho', () => {
    expect(nomeSeguro('Montagem Tubulação #3.jpg')).toBe('montagem-tubulacao-3.jpg');
  });

  it('não deixa barra virar pasta nova no bucket', () => {
    expect(nomeSeguro('../../etc/senha.jpg')).not.toContain('/');
    expect(nomeSeguro('../../etc/senha.jpg')).not.toContain('..');
  });

  it('nome vazio ainda vira um nome', () => {
    expect(nomeSeguro('')).toBe('foto.jpg');
    expect(nomeSeguro('###')).toBe('foto.jpg');
  });

  it('corta nome quilométrico', () => {
    expect(nomeSeguro('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('caminhoDaEvidencia', () => {
  it('separa por projeto e carimba para não colidir', () => {
    expect(caminhoDaEvidencia('frigo', 'Foto Obra.JPG', 1756300000000))
      .toBe('frigo/1756300000000-foto-obra.jpg');
  });

  it('duas fotos de mesmo nome não se sobrescrevem', () => {
    const a = caminhoDaEvidencia('frigo', 'foto.jpg', 1);
    const b = caminhoDaEvidencia('frigo', 'foto.jpg', 2);
    expect(a).not.toBe(b);
  });
});

describe('formatarTamanho', () => {
  it('usa a unidade que cabe', () => {
    expect(formatarTamanho(800)).toBe('800 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(4_000_000)).toBe('3,8 MB');
  });

  it('tamanho inválido não vira "NaN"', () => {
    expect(formatarTamanho(0)).toBe('—');
    expect(formatarTamanho(Number.NaN)).toBe('—');
  });
});
