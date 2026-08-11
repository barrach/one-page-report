import { describe, it, expect } from 'vitest';
import { paginar } from '@/lib/pdfPaginacao';

describe('paginar — quebra de páginas do PDF', () => {
  it('corta no último ponto de quebra que cabe na página', () => {
    // blocos terminando em 300, 700, 1100, 1500; página de 1000
    const paginas = paginar(1500, 1000, [300, 700, 1100, 1500]);
    expect(paginas).toEqual([
      { inicio: 0, fim: 700 },   // 1100 não cabe, então fecha em 700
      { inicio: 700, fim: 1500 },
    ]);
  });

  it('nunca deixa buraco nem sobreposição entre páginas', () => {
    const paginas = paginar(5000, 900, [200, 480, 900, 1300, 1800, 2400, 3100, 3900, 4500, 5000]);
    expect(paginas[0].inicio).toBe(0);
    expect(paginas[paginas.length - 1].fim).toBe(5000);
    for (let i = 1; i < paginas.length; i++) {
      expect(paginas[i].inicio).toBe(paginas[i - 1].fim);
    }
  });

  it('nenhuma página passa da altura permitida', () => {
    const paginas = paginar(5000, 900, [200, 480, 900, 1300, 1800, 2400, 3100, 3900, 4500, 5000]);
    for (const p of paginas) {
      expect(p.fim - p.inicio).toBeLessThanOrEqual(900);
    }
  });

  it('bloco mais alto que a página é cortado no limite, sem travar', () => {
    // um único bloco de 2500 com página de 1000: não há como não cortar
    const paginas = paginar(2500, 1000, [2500]);
    expect(paginas).toEqual([
      { inicio: 0, fim: 1000 },
      { inicio: 1000, fim: 2000 },
      { inicio: 2000, fim: 2500 },
    ]);
  });

  it('conteúdo que cabe numa página gera uma página só', () => {
    expect(paginar(800, 1000, [300, 800])).toEqual([{ inicio: 0, fim: 800 }]);
  });

  it('ignora quebras fora do conteúdo e duplicadas', () => {
    const paginas = paginar(1000, 600, [-50, 0, 400, 400, 1000, 3000]);
    expect(paginas).toEqual([
      { inicio: 0, fim: 400 },
      { inicio: 400, fim: 1000 },
    ]);
  });

  it('quebra colada no início da página é ignorada, para não gerar página quase vazia', () => {
    // quebra em 20 está dentro da folga mínima (40) e não deve ser usada
    const paginas = paginar(2000, 1000, [20, 900, 2000]);
    expect(paginas[0]).toEqual({ inicio: 0, fim: 900 });
  });

  it('sem pontos de quebra, pagina em altura fixa', () => {
    expect(paginar(2500, 1000, [])).toEqual([
      { inicio: 0, fim: 1000 },
      { inicio: 1000, fim: 2000 },
      { inicio: 2000, fim: 2500 },
    ]);
  });

  it('entradas degeneradas não geram páginas', () => {
    expect(paginar(0, 1000, [])).toEqual([]);
    expect(paginar(1000, 0, [])).toEqual([]);
  });
});
