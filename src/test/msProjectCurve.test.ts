import { describe, it, expect } from 'vitest';
import {
  converterParaPercentual,
  descreverPeriodicidade,
  gerarDatas,
  lerColagem,
  lerNumero,
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
});

describe('lerColagem', () => {
  it('lê a curva deitada, uma linha por série', () => {
    const texto = [
      'Trabalho de Linha de Base Acumulado\t100\t200\t300',
      'Trabalho Real Acumulado\t80\t190\t190',
      'Trabalho Acumulado\t80\t190\t300',
    ].join('\n');
    expect(lerColagem(texto)).toEqual([
      { linhaBase: 100, real: 80, acumulado: 80 },
      { linhaBase: 200, real: 190, acumulado: 190 },
      { linhaBase: 300, real: 190, acumulado: 300 },
    ]);
  });

  it('lê a curva em pé, três colunas', () => {
    const texto = ['100\t80\t80', '200\t190\t190'].join('\n');
    expect(lerColagem(texto)).toEqual([
      { linhaBase: 100, real: 80, acumulado: 80 },
      { linhaBase: 200, real: 190, acumulado: 190 },
    ]);
  });

  it('descarta o cabeçalho da colagem em pé em vez de tomá-lo por uma série', () => {
    const texto = ['Linha de Base\tReal\tAcumulado', '100\t80\t80', '200\t190\t190'].join('\n');
    expect(lerColagem(texto)).toEqual([
      { linhaBase: 100, real: 80, acumulado: 80 },
      { linhaBase: 200, real: 190, acumulado: 190 },
    ]);
  });

  it('devolve vazio quando não há número nenhum', () => {
    expect(lerColagem('só texto\naqui')).toEqual([]);
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
