import { describe, it, expect } from 'vitest';
import {
  ehFolha, lerEapColada, lerValor, nivelDoCodigo, totaisDaEap,
  type ItemEapFinanceira,
} from '@/lib/eapFinanceira';

const item = (p: Partial<ItemEapFinanceira>): ItemEapFinanceira => ({
  codigo: '', descricao: 'x', valorContrato: 0, previstoMes: 0, realizadoMes: 0, acumulado: 0, ...p,
});

describe('lerValor', () => {
  it('lê o formato brasileiro com e sem símbolo', () => {
    expect(lerValor('R$ 1.234.567,89')).toBeCloseTo(1234567.89, 2);
    expect(lerValor('1.234,50')).toBeCloseTo(1234.5, 2);
  });

  it('lê o formato americano', () => {
    expect(lerValor('1,234.50')).toBeCloseTo(1234.5, 2);
  });

  it('parênteses são negativo, como na planilha de medição', () => {
    expect(lerValor('(1.000,00)')).toBeCloseTo(-1000, 2);
  });

  it('vazio é zero', () => {
    expect(lerValor('')).toBe(0);
    expect(lerValor('—')).toBe(0);
  });
});

describe('nivelDoCodigo', () => {
  it('conta os pontos da EAP', () => {
    expect(nivelDoCodigo('1')).toBe(1);
    expect(nivelDoCodigo('1.2')).toBe(2);
    expect(nivelDoCodigo('1.2.3')).toBe(3);
  });

  it('código não numérico cai no nível 1', () => {
    expect(nivelDoCodigo('')).toBe(1);
    expect(nivelDoCodigo('ADM')).toBe(1);
  });
});

describe('totaisDaEap', () => {
  it('soma só as folhas, para o pai não contar duas vezes', () => {
    const itens = [
      item({ codigo: '1', descricao: 'MONTAGEM', valorContrato: 1000, acumulado: 400 }),
      item({ codigo: '1.1', descricao: 'Tubulação', valorContrato: 600, acumulado: 300 }),
      item({ codigo: '1.2', descricao: 'Estrutura', valorContrato: 400, acumulado: 100 }),
    ];
    const t = totaisDaEap(itens);
    // Sem a regra da folha isto daria 2000 — o pai somado com os filhos.
    expect(t.valorContrato).toBe(1000);
    expect(t.acumulado).toBe(400);
    expect(t.percentualAcumulado).toBe(40);
    expect(t.saldo).toBe(600);
  });

  it('lista plana soma tudo, porque toda linha é folha', () => {
    const itens = [
      item({ codigo: '1', valorContrato: 500 }),
      item({ codigo: '2', valorContrato: 300 }),
    ];
    expect(totaisDaEap(itens).valorContrato).toBe(800);
  });

  it('desvio do mês é realizado menos previsto', () => {
    const itens = [item({ codigo: '1', previstoMes: 100, realizadoMes: 80 })];
    expect(totaisDaEap(itens).desvioMes).toBe(-20);
  });

  it('sem contrato não divide por zero', () => {
    expect(totaisDaEap([item({ codigo: '1', acumulado: 50 })]).percentualAcumulado).toBe(0);
    expect(totaisDaEap([]).valorContrato).toBe(0);
  });
});

describe('ehFolha', () => {
  it('pai tem filho logo abaixo; o último item é sempre folha', () => {
    const itens = [item({ codigo: '1' }), item({ codigo: '1.1' }), item({ codigo: '2' })];
    expect(ehFolha(itens, 0)).toBe(false);
    expect(ehFolha(itens, 1)).toBe(true);
    expect(ehFolha(itens, 2)).toBe(true);
  });
});

describe('lerEapColada', () => {
  const COLAGEM = [
    'EAP\tDescrição\tValor do contrato\tPrevisto\tRealizado\tRealizado acumulado',
    '1\tMONTAGEM ELETROMECÂNICA\tR$ 1.000.000,00\tR$ 50.000,00\tR$ 42.000,00\tR$ 400.000,00',
    '1.1\tTubulação\tR$ 600.000,00\tR$ 30.000,00\tR$ 25.000,00\tR$ 300.000,00',
    '1.2\tEstrutura\tR$ 400.000,00\tR$ 20.000,00\tR$ 17.000,00\tR$ 100.000,00',
  ].join('\n');

  it('reconhece as colunas pelo cabeçalho', () => {
    const { itens, faltando } = lerEapColada(COLAGEM);
    expect(itens).toHaveLength(3);
    expect(faltando).toEqual([]);
    expect(itens[0].descricao).toBe('MONTAGEM ELETROMECÂNICA');
    expect(itens[0].valorContrato).toBeCloseTo(1000000, 2);
  });

  it('"Realizado acumulado" vira acumulado, e não o realizado do mês', () => {
    const { itens } = lerEapColada(COLAGEM);
    expect(itens[0].realizadoMes).toBeCloseTo(42000, 2);
    expect(itens[0].acumulado).toBeCloseTo(400000, 2);
  });

  it('linha sem descrição não vira item', () => {
    const comTotal = [COLAGEM, '\t\tR$ 1.000.000,00\t\t\t'].join('\n');
    expect(lerEapColada(comTotal).itens).toHaveLength(3);
  });

  it('colagem sem cabeçalho reconhecível não vira EAP', () => {
    expect(lerEapColada('a\tb\nc\td').itens).toEqual([]);
  });
});

describe('colunas da EAP colada', () => {
  const COLAGEM = [
    'Item\tDiscriminação dos serviços\tValor do contrato\tPrevisto\tRealizado\tUnidade',
    '1\tSPCI\tR$ 150.000,00\tR$ 10.000,00\tR$ 5.000,00\tvb',
  ].join('\n');

  it('traz as colunas da planilha com os títulos dela', () => {
    const { colunas } = lerEapColada(COLAGEM);
    expect(colunas.map((c) => c.titulo)).toEqual([
      'Item', 'Discriminação dos serviços', 'Valor do contrato', 'Previsto', 'Realizado', 'Unidade',
    ]);
  });

  it('guarda o texto cru, inclusive de coluna que não é campo conhecido', () => {
    const { itens, colunas } = lerEapColada(COLAGEM);
    const unidade = colunas.find((c) => c.titulo === 'Unidade')!;
    expect(itens[0].celulas?.[unidade.chave]).toBe('vb');
    expect(unidade.campo).toBeUndefined();
  });

  it('marca qual coluna é a descrição, para o relatório indentar por nível', () => {
    const { colunas } = lerEapColada(COLAGEM);
    expect(colunas.find((c) => c.campo === 'descricao')?.titulo).toBe('Discriminação dos serviços');
  });
});

describe('reconhecimento da coluna de valor', () => {
  const colar = (cabecalho: string) => lerEapColada(
    `Item\tDescricao\t${cabecalho}\tRealizado no mes\n1\tMontagem\t1.000.000,00\t50.000,00`,
  );

  it('aceita a coluna nomeada so como "Valor"', () => {
    // Metade das planilhas de medicao chama assim, e antes o valor ficava zero
    // - o que derrubava o consolidado inteiro para media simples.
    expect(colar('Valor').itens[0].valorContrato).toBe(1_000_000);
  });

  it('aceita "Total" e "Preco"', () => {
    expect(colar('Total').itens[0].valorContrato).toBe(1_000_000);
    expect(colar('Preco Unitario').itens[0].valorContrato).toBe(1_000_000);
  });

  it('nao rouba a coluna do realizado', () => {
    // "Valor realizado no mes" comeca com "valor" mas nao e o contrato.
    const r = lerEapColada(
      'Item\tDescricao\tValor do contrato\tValor realizado no mes\n1\tMontagem\t1.000.000,00\t50.000,00',
    );
    expect(r.itens[0].valorContrato).toBe(1_000_000);
    expect(r.itens[0].realizadoMes).toBe(50_000);
  });

  it('nao rouba a coluna do acumulado', () => {
    const r = lerEapColada(
      'Item\tDescricao\tValor\tTotal acumulado\n1\tMontagem\t1.000.000,00\t300.000,00',
    );
    expect(r.itens[0].valorContrato).toBe(1_000_000);
    expect(r.itens[0].acumulado).toBe(300_000);
  });
});
