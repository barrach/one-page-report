import { describe, it, expect } from 'vitest';
import {
  converterParaPercentual,
  descreverPeriodicidade,
  gerarDatas,
  lerColagem,
  lerNumero,
  montarPontos,
  totalReferencia,
  type PontoAcumulado,
} from '@/lib/msProjectCurve';
import { janelaCentradaNaData, type JanelaItem } from '@/lib/dateUtils';

describe('gerarDatas', () => {
  it('avança de 7 em 7 dias no semanal', () => {
    expect(gerarDatas('2025-10-19', 'semanal', 4)).toEqual(['19/out', '26/out', '02/nov', '09/nov']);
  });

  it('avança dia a dia no diário', () => {
    expect(gerarDatas('2025-10-19', 'diaria', 4)).toEqual(['19/out', '20/out', '21/out', '22/out']);
  });

  it('devolve vazio sem data de início', () => {
    expect(gerarDatas('', 'semanal', 5)).toEqual([]);
  });
});

describe('descreverPeriodicidade', () => {
  it('explica o passo semanal com as datas reais', () => {
    const texto = descreverPeriodicidade('2025-10-19', 'semanal');
    expect(texto).toContain('19/out');
    expect(texto).toContain('26/out');
    expect(texto).toContain('7 dias');
  });

  it('explica o passo diário', () => {
    const texto = descreverPeriodicidade('2025-10-19', 'diaria');
    expect(texto).toContain('20/out');
    expect(texto).toContain('1 dia');
  });

  it('pede a data quando ela falta', () => {
    expect(descreverPeriodicidade('', 'semanal')).toContain('Informe a data de início');
  });
});

describe('totalReferencia', () => {
  it('usa o último acumulado da linha de base', () => {
    const pontos: PontoAcumulado[] = [
      { linhaBase: 100, real: 80, acumulado: 80 },
      { linhaBase: 400, real: null, acumulado: 420 },
    ];
    expect(totalReferencia(pontos)).toBe(400);
  });

  it('sem linha de base, cai no maior valor de qualquer série', () => {
    const pontos: PontoAcumulado[] = [
      { linhaBase: null, real: 80, acumulado: 90 },
      { linhaBase: null, real: 150, acumulado: 300 },
    ];
    expect(totalReferencia(pontos)).toBe(300);
  });

  it('devolve 0 quando não há nada lançado', () => {
    expect(totalReferencia([{ linhaBase: null, real: null, acumulado: null }])).toBe(0);
  });
});

describe('converterParaPercentual', () => {
  const pontos: PontoAcumulado[] = [
    { linhaBase: 100, real: 80, acumulado: 80 },
    { linhaBase: 200, real: 190, acumulado: 190 },
    { linhaBase: 300, real: 190, acumulado: 300 }, // Project repete o real no futuro
    { linhaBase: 400, real: 190, acumulado: 400 },
  ];
  const datas = ['19/out', '26/out', '02/nov', '09/nov'];

  it('divide as três séries pelo total da linha de base', () => {
    const { curva, total } = converterParaPercentual(pontos, datas);
    expect(total).toBe(400);
    expect(curva[0]).toEqual({ date: '19/out', previsto: 25, real: 20, tendencia: 20 });
    expect(curva[1]).toEqual({ date: '26/out', previsto: 50, real: 47.5, tendencia: 47.5 });
  });

  it('corta o real depois do último avanço, em vez de repetir para o futuro', () => {
    const { curva, statusIndex } = converterParaPercentual(pontos, datas);
    expect(statusIndex).toBe(1);
    expect(curva[2].real).toBe(0);
    expect(curva[3].real).toBe(0);
    // O previsto e a tendência continuam — só o real é que para na data de status.
    expect(curva[3].previsto).toBe(100);
    expect(curva[3].tendencia).toBe(100);
  });

  it('não quebra sem nenhum dado', () => {
    const { curva, total, statusIndex } = converterParaPercentual(
      [{ linhaBase: null, real: null, acumulado: null }],
      ['19/out'],
    );
    expect(total).toBe(0);
    expect(statusIndex).toBe(-1);
    expect(curva[0]).toEqual({ date: '19/out', previsto: 0, real: 0, tendencia: 0 });
  });
});

describe('lerNumero', () => {
  it('lê o formato brasileiro', () => {
    expect(lerNumero('1.234,50')).toBe(1234.5);
  });

  it('lê o formato americano', () => {
    expect(lerNumero('1,234.50')).toBe(1234.5);
  });

  it('ignora unidade e moeda', () => {
    expect(lerNumero('480 h')).toBe(480);
    expect(lerNumero('R$ 1.200,00')).toBe(1200);
  });

  it('vazio vira null, não zero', () => {
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('   ')).toBeNull();
    expect(lerNumero('—')).toBeNull();
  });

  it('recusa data — "Seg 01/Jun/26" não pode virar o número 126', () => {
    expect(lerNumero('Seg 01/Jun/26')).toBeNull();
    expect(lerNumero('01/06/2026')).toBeNull();
  });
});

describe('lerColagem', () => {
  // Recorte fiel do que o MS Project entrega na visão Uso da Tarefa.
  const CABECALHO = 'Detalhes\tSeg 01/Jun/26\tSeg 08/Jun/26\tSeg 15/Jun/26\tSeg 22/Jun/26';
  const BASE = 'Trab. Acum. Base\t\t181,5h\t201,8h\t222,1h';
  const ACUM = 'Trab. acum.\t\t185,46h\t214,62h\t243,77h';
  const REAL = 'Trab. Real Acum.\t\t185,46h\t214,62h\t243,77h';

  it('reconhece os rótulos abreviados do MS Project', () => {
    const lida = lerColagem([BASE, ACUM, REAL].join('\n'));
    expect(lida.orientacao).toBe('linhas');
    expect(lida.series.map((s) => s.papel)).toEqual(['linhaBase', 'acumulado', 'real']);
    expect(lida.series[0].rotulo).toBe('Trab. Acum. Base');
  });

  it('lê a curva deitada mesmo sem rótulo nenhum, pela forma', () => {
    // O caso real: a pessoa seleciona só o bloco de números no Project.
    const texto = [
      '181,5h\t201,8h\t222,1h\t242,4h\t302,7h\t338,7h',
      '185,46h\t214,62h\t243,77h\t272,93h\t342,09h\t386,94h',
      '185,46h\t214,62h\t243,77h\t272,93h\t342,09h\t386,94h',
    ].join('\n');
    const lida = lerColagem(texto);
    expect(lida.orientacao).toBe('linhas');
    expect(lida.periodos).toBe(6);
    // Sem rótulo, vale a ordem em que o Project entrega: Base, plano, Real.
    expect(lida.series.map((s) => s.papel)).toEqual(['linhaBase', 'acumulado', 'real']);
    expect(lida.series[0].valores[0]).toBe(181.5);
  });

  it('lê início e periodicidade da linha de datas', () => {
    const lida = lerColagem([CABECALHO, BASE, ACUM, REAL].join('\n'));
    expect(lida.inicio).toBe('2026-06-01');
    expect(lida.periodicidade).toBe('semanal');
    // A linha de datas não pode virar mais uma série.
    expect(lida.series).toHaveLength(3);
  });

  it('detecta periodicidade diária pelo espaçamento das datas', () => {
    const texto = [
      'Detalhes\tSeg 01/Jun/26\tTer 02/Jun/26\tQua 03/Jun/26\tQui 04/Jun/26',
      'Trab. Acum. Base\t10h\t20h\t30h\t40h',
    ].join('\n');
    expect(lerColagem(texto).periodicidade).toBe('diaria');
  });

  it('preserva o período vazio da frente, para as datas não escorregarem', () => {
    const lida = lerColagem([CABECALHO, BASE].join('\n'));
    // 4 períodos: o primeiro (01/Jun) é vazio na linha de Base.
    expect(lida.periodos).toBe(4);
    expect(lida.series[0].valores).toEqual([null, 181.5, 201.8, 222.1]);
  });

  it('ignora o trabalho restante, que não entra na curva', () => {
    const texto = [BASE, ACUM, REAL, 'Trab. Acum. Restante\t\t100h\t90h\t80h'].join('\n');
    const lida = lerColagem(texto);
    expect(lida.series[3].papel).toBe('ignorar');
    const pontos = montarPontos(lida.series, lida.periodos);
    expect(pontos[1]).toEqual({ linhaBase: 181.5, real: 185.46, acumulado: 185.46 });
  });

  it('lê a curva em pé quando há mais períodos que colunas', () => {
    const texto = [
      'Linha de Base\tAcumulado\tReal',
      '100\t80\t80',
      '200\t190\t190',
      '300\t300\t190',
      '400\t400\t190',
    ].join('\n');
    const lida = lerColagem(texto);
    expect(lida.orientacao).toBe('colunas');
    expect(lida.periodos).toBe(4);
    expect(lida.series.map((s) => s.papel)).toEqual(['linhaBase', 'acumulado', 'real']);
    expect(montarPontos(lida.series, lida.periodos)[0]).toEqual({
      linhaBase: 100, real: 80, acumulado: 80,
    });
  });

  it('devolve vazio quando não há número nenhum', () => {
    expect(lerColagem('só texto\naqui').series).toEqual([]);
  });
});

describe('montarPontos', () => {
  it('respeita o papel escolhido, mesmo trocado à mão', () => {
    const series = [
      { rotulo: null, valores: [1, 2, 3], papel: 'real' as const },
      { rotulo: null, valores: [10, 20, 30], papel: 'linhaBase' as const },
      { rotulo: null, valores: [5, 6, 7], papel: 'ignorar' as const },
    ];
    expect(montarPontos(series, 3)).toEqual([
      { linhaBase: 10, real: 1, acumulado: null },
      { linhaBase: 20, real: 2, acumulado: null },
      { linhaBase: 30, real: 3, acumulado: null },
    ]);
  });
});

describe('janelaCentradaNaData', () => {
  const semana = (date: string, previsto = 1, real = 1): JanelaItem => ({ date, previsto, real });

  it('mantém a semana de status no centro', () => {
    const dados = [
      semana('05/out'), semana('12/out'), semana('19/out'),
      semana('26/out'), semana('02/nov'), semana('09/nov'),
    ];
    const janela = janelaCentradaNaData(dados, '2025-10-19');
    expect(janela).toHaveLength(5);
    expect(janela[2].date).toBe('19/out');
    expect(janela[2].isStatus).toBe(true);
    expect(janela.map((j) => j.date)).toEqual(['05/out', '12/out', '19/out', '26/out', '02/nov']);
  });

  it('completa com períodos vazios em vez de deslizar quando o status é a última semana', () => {
    const dados = [semana('05/out'), semana('12/out'), semana('19/out')];
    const janela = janelaCentradaNaData(dados, '2025-10-19');
    expect(janela.map((j) => j.date)).toEqual(['05/out', '12/out', '19/out', '26/out', '02/nov']);
    expect(janela[2].isStatus).toBe(true);
    expect(janela[3]).toMatchObject({ previsto: 0, real: 0 });
  });

  it('completa para trás quando o status é a primeira semana', () => {
    const dados = [semana('19/out'), semana('26/out')];
    const janela = janelaCentradaNaData(dados, '2025-10-19');
    expect(janela.map((j) => j.date)).toEqual(['05/out', '12/out', '19/out', '26/out', '02/nov']);
    expect(janela[2].isStatus).toBe(true);
  });

  it('respeita o passo diário', () => {
    const dados = [semana('19/out')];
    const janela = janelaCentradaNaData(dados, '2025-10-19', { periodicidade: 'diaria' });
    expect(janela.map((j) => j.date)).toEqual(['17/out', '18/out', '19/out', '20/out', '21/out']);
  });

  it('usa a semana já marcada como status quando os rótulos não são datas', () => {
    const dados: JanelaItem[] = [
      { date: '26-SEM27', previsto: 1, real: 1 },
      { date: '26-SEM28', previsto: 1, real: 1, isStatus: true },
      { date: '26-SEM29', previsto: 1, real: 0 },
    ];
    const janela = janelaCentradaNaData(dados, '2026-07-13');
    expect(janela).toHaveLength(5);
    expect(janela[2].date).toBe('26-SEM28');
    expect(janela[2].isStatus).toBe(true);
  });
});
