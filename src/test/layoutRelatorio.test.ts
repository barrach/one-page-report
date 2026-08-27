import { describe, it, expect } from 'vitest';
import {
  ajustarAltura,
  alternarLargura,
  alternarOculto,
  CARDS_RELATORIO,
  layoutPadrao,
  moverCard,
  normalizarLayout,
  reordenarCard,
  linhasDoLayout,
  grupoDeCadaCard,
} from '@/lib/layoutRelatorio';

describe('normalizarLayout', () => {
  it('sem nada salvo, devolve o padrão', () => {
    expect(normalizarLayout(undefined)).toEqual(layoutPadrao());
    expect(normalizarLayout([])).toEqual(layoutPadrao());
  });

  it('card novo entra no fim em vez de sumir do relatório', () => {
    // Layout antigo, salvo antes de o Clima existir.
    const antigo = [{ id: 'scurve', largura: 'meia' as const }];
    const normalizado = normalizarLayout(antigo);
    expect(normalizado[0].id).toBe('scurve');
    expect(normalizado.map((i) => i.id)).toEqual(
      expect.arrayContaining(CARDS_RELATORIO.map((c) => c.id)),
    );
    expect(normalizado).toHaveLength(CARDS_RELATORIO.length);
  });

  it('card que não existe mais cai fora, em vez de virar buraco', () => {
    const comLixo = [
      { id: 'card-que-foi-removido', largura: 'meia' as const },
      { id: 'scurve', largura: 'inteira' as const },
    ];
    const normalizado = normalizarLayout(comLixo);
    expect(normalizado.find((i) => i.id === 'card-que-foi-removido')).toBeUndefined();
    // A escolha de largura de quem sobrou é preservada.
    expect(normalizado[0]).toEqual({ id: 'scurve', largura: 'inteira' });
  });
});

describe('moverCard', () => {
  const base = [
    { id: 'a', largura: 'meia' as const },
    { id: 'b', largura: 'meia' as const },
    { id: 'c', largura: 'meia' as const },
  ];

  it('sobe e desce uma posição', () => {
    expect(moverCard(base, 'b', -1).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(moverCard(base, 'b', 1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('nas bordas não faz nada', () => {
    expect(moverCard(base, 'a', -1)).toBe(base);
    expect(moverCard(base, 'c', 1)).toBe(base);
  });
});

describe('reordenarCard', () => {
  const base = [
    { id: 'a', largura: 'meia' as const },
    { id: 'b', largura: 'meia' as const },
    { id: 'c', largura: 'meia' as const },
  ];

  it('leva o card arrastado para a posição do alvo', () => {
    expect(reordenarCard(base, 'c', 'a').map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(reordenarCard(base, 'a', 'c').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('soltar sobre si mesmo não muda nada', () => {
    expect(reordenarCard(base, 'b', 'b')).toBe(base);
  });
});

describe('alternarLargura e alternarOculto', () => {
  const base = [{ id: 'a', largura: 'meia' as const }];

  it('vai e volta entre meia e inteira', () => {
    const inteira = alternarLargura(base, 'a');
    expect(inteira[0].largura).toBe('inteira');
    expect(alternarLargura(inteira, 'a')[0].largura).toBe('meia');
  });

  it('esconde e mostra', () => {
    const oculto = alternarOculto(base, 'a');
    expect(oculto[0].oculto).toBe(true);
    expect(alternarOculto(oculto, 'a')[0].oculto).toBe(false);
  });
});

describe('ajustarAltura', () => {
  const base = [{ id: 'a', largura: 'meia' as const }];

  it('aumenta a partir da altura natural', () => {
    expect(ajustarAltura(base, 'a', 1)[0].altura).toBe(460);
  });

  it('diminuir até o mínimo devolve a altura natural, e não um valor fixo', () => {
    const baixo = [{ id: 'a', largura: 'meia' as const, altura: 240 }];
    expect(ajustarAltura(baixo, 'a', -1)[0].altura).toBeUndefined();
  });

  it('não passa do teto', () => {
    const alto = [{ id: 'a', largura: 'meia' as const, altura: 1180 }];
    expect(ajustarAltura(alto, 'a', 1)[0].altura).toBe(1200);
  });
});

describe('linhasDoLayout e grupoDeCadaCard', () => {
  it('dois cards de meia largura dividem a linha; um inteiro fica sozinho', () => {
    const layout = [
      { id: 'a', largura: 'meia' as const },
      { id: 'b', largura: 'meia' as const },
      { id: 'c', largura: 'inteira' as const },
      { id: 'd', largura: 'meia' as const },
    ];
    expect(linhasDoLayout(layout)).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('quem divide a linha compartilha a mesma seção', () => {
    const layout = [
      { id: 'a', largura: 'meia' as const },
      { id: 'b', largura: 'meia' as const },
      { id: 'c', largura: 'inteira' as const },
    ];
    const grupos = grupoDeCadaCard(layout);
    expect(grupos.a).toBe(grupos.b);
    expect(grupos.c).not.toBe(grupos.a);
  });

  it('card oculto não entra na linha e responde por si', () => {
    const layout = [
      { id: 'a', largura: 'meia' as const, oculto: true },
      { id: 'b', largura: 'meia' as const },
      { id: 'c', largura: 'meia' as const },
    ];
    // Sem o oculto, b e c e que passam a dividir a linha.
    expect(linhasDoLayout(layout)).toEqual([['b', 'c']]);
    const grupos = grupoDeCadaCard(layout);
    expect(grupos.b).toBe(grupos.c);
    expect(grupos.a).toBe('a');
  });
});
