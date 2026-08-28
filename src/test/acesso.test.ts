import { describe, it, expect } from 'vitest';
import {
  acessoRestrito,
  clienteDaObra,
  clientesVisiveis,
  melhorPapel,
  obrasVisiveis,
} from '@/lib/acesso';

const obra = (id: string, cliente?: string) => ({ id, info: { cliente } });

describe('melhorPapel', () => {
  it('com mais de um papel, vale o de maior permissão', () => {
    expect(melhorPapel(['visualizador', 'admin'])).toBe('admin');
    expect(melhorPapel(['cliente', 'gestor'])).toBe('gestor');
  });

  it('sem papel nenhum devolve null', () => {
    expect(melhorPapel([])).toBeNull();
    expect(melhorPapel(['papel_inventado'])).toBeNull();
  });
});

describe('acessoRestrito', () => {
  it('visualizador e cliente são restritos', () => {
    expect(acessoRestrito('visualizador')).toBe(true);
    expect(acessoRestrito('cliente')).toBe(true);
  });

  it('a equipe da Megasteam vê tudo', () => {
    expect(acessoRestrito('admin')).toBe(false);
    expect(acessoRestrito('gestor')).toBe(false);
    expect(acessoRestrito('planejador')).toBe(false);
  });

  it('papel ainda não carregado não restringe', () => {
    expect(acessoRestrito(null)).toBe(false);
  });
});

describe('obrasVisiveis', () => {
  const todas = [obra('spci', 'UNIPAR'), obra('frigo', 'FRIGO'), obra('nts', 'NTS')];

  it('restrito enxerga só o que foi atribuído', () => {
    expect(obrasVisiveis(todas, 'visualizador', ['spci']).map((o) => o.id)).toEqual(['spci']);
  });

  it('restrito sem atribuição nenhuma não enxerga obra', () => {
    expect(obrasVisiveis(todas, 'cliente', [])).toEqual([]);
    expect(obrasVisiveis(todas, 'cliente', null)).toEqual([]);
  });

  it('atribuição não limita quem não é restrito', () => {
    // O gestor tem obras atribuídas na tela de Admin, mas isso não recorta o
    // que ele vê: é ele quem compara obra com obra.
    expect(obrasVisiveis(todas, 'gestor', ['spci'])).toHaveLength(3);
  });

  it('papel desconhecido não recorta', () => {
    expect(obrasVisiveis(todas, null, [])).toHaveLength(3);
  });
});

describe('clientesVisiveis', () => {
  it('sai das obras já recortadas, em ordem', () => {
    expect(clientesVisiveis([obra('b', 'UNIPAR'), obra('a', 'ArcelorMittal')]))
      .toEqual(['ArcelorMittal', 'UNIPAR']);
  });

  it('obra sem cliente cai num rótulo próprio, sem repetir', () => {
    expect(clientesVisiveis([obra('a'), obra('b', '  ')])).toEqual(['Sem cliente']);
  });

  it('o cliente de uma obra escondida não aparece', () => {
    const visiveis = obrasVisiveis(
      [obra('spci', 'UNIPAR'), obra('frigo', 'FRIGO')],
      'cliente',
      ['spci'],
    );
    expect(clientesVisiveis(visiveis)).toEqual(['UNIPAR']);
  });
});

describe('clienteDaObra', () => {
  it('espaço em branco não vira cliente', () => {
    expect(clienteDaObra(obra('a', '   '))).toBe('Sem cliente');
    expect(clienteDaObra(obra('a', ' UNIPAR '))).toBe('UNIPAR');
  });
});
