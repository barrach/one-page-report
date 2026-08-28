import { describe, it, expect } from 'vitest';
import {
  alinharComCurva,
  dataDoRotulo,
  filtrarPeriodo,
  indiceDaSemanaDeStatus,
  lerColagemHistograma,
  ordenarPorData,
  serieDoRotulo,
  type PontoHistograma,
} from '@/lib/histograma';

describe('dataDoRotulo', () => {
  it('lê o formato da Curva S', () => {
    const d = dataDoRotulo('08/dez', 2025);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(8);
  });

  it('lê o formato "Mês/aa Sn" da planilha de histograma', () => {
    const d = dataDoRotulo('Dez/25 S2', 2025);
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(8); // (2-1)*7 + 1
  });

  it('devolve null no que não é data', () => {
    expect(dataDoRotulo('', 2025)).toBeNull();
    expect(dataDoRotulo('Total', 2025)).toBeNull();
  });
});

describe('alinharComCurva', () => {
  const curva = [
    { date: '01/dez' }, { date: '08/dez' }, { date: '15/dez' }, { date: '22/dez' },
  ];

  it('estende as colunas para todas as semanas da obra', () => {
    const hist: PontoHistograma[] = [{ date: '08/dez', semana: '', previsto: 40, real: 38 }];
    const alinhado = alinharComCurva(hist, curva, 2025);
    expect(alinhado.map((h) => h.date)).toEqual(['01/dez', '08/dez', '15/dez', '22/dez']);
    expect(alinhado[1]).toEqual({ date: '08/dez', semana: '', previsto: 40, real: 38 });
    expect(alinhado[0]).toEqual({ date: '01/dez', semana: '', previsto: 0, real: 0 });
  });

  it('reaproveita o que foi lançado mesmo com o rótulo em outro formato', () => {
    // A planilha nomeia "Dez/25 S2"; a curva, "08/dez". Casar por texto perderia
    // o lançamento — o casamento é pela data.
    const hist: PontoHistograma[] = [{ date: 'Dez/25 S2', semana: 'S2', previsto: 55, real: 51 }];
    const alinhado = alinharComCurva(hist, curva, 2025);
    expect(alinhado[1].previsto).toBe(55);
    expect(alinhado[1].real).toBe(51);
  });

  it('sem curva, devolve o histórico como está', () => {
    const hist: PontoHistograma[] = [{ date: '08/dez', semana: '', previsto: 40, real: 38 }];
    expect(alinharComCurva(hist, [], 2025)).toEqual(hist);
  });

  it('casa a semana mesmo fechada em outro dia da semana', () => {
    // A planilha do histograma fecha no sábado, a curva no domingo. Exigir o
    // mesmo dia exato fazia nenhum lançamento casar e zerava o relatório.
    const hist: PontoHistograma[] = [{ date: '07/dez', semana: '', previsto: 40, real: 38 }];
    const alinhado = alinharComCurva(hist, curva, 2025);
    expect(alinhado[1].previsto).toBe(40);
  });

  it('o rótulo é sempre o da curva', () => {
    // Devolver o rótulo do histograma misturava "06/set" com "07/set" no mesmo
    // eixo, e as datas apareciam fora de ordem.
    const hist: PontoHistograma[] = [{ date: '07/dez', semana: '', previsto: 40, real: 38 }];
    expect(alinharComCurva(hist, curva, 2025)[1].date).toBe('08/dez');
  });

  it('lançamento fora de qualquer semana da curva não é puxado', () => {
    const hist: PontoHistograma[] = [{ date: '20/jun', semana: '', previsto: 99, real: 99 }];
    expect(alinharComCurva(hist, curva, 2025).every((h) => h.previsto === 0)).toBe(true);
  });

  it('dois lançamentos na mesma semana: fica o mais próximo', () => {
    const hist: PontoHistograma[] = [
      { date: '10/dez', semana: '', previsto: 10, real: 10 },
      { date: '08/dez', semana: '', previsto: 40, real: 38 },
    ];
    expect(alinharComCurva(hist, curva, 2025)[1].previsto).toBe(40);
  });
});

describe('ordenarPorData', () => {
  it('desembaralha semanas de importações diferentes', () => {
    const dados = [{ date: '07/set' }, { date: '06/set' }, { date: '14/set' }];
    expect(ordenarPorData(dados, 2026).map((d) => d.date))
      .toEqual(['06/set', '07/set', '14/set']);
  });

  it('rótulo que não vira data vai para o fim, sem sumir', () => {
    const dados = [{ date: 'Total' }, { date: '06/set' }];
    expect(ordenarPorData(dados, 2026).map((d) => d.date)).toEqual(['06/set', 'Total']);
  });

  it('vários rótulos ilegíveis mantêm a ordem entre si', () => {
    const dados = [{ date: 'Total' }, { date: '06/set' }, { date: 'Média' }];
    expect(ordenarPorData(dados, 2026).map((d) => d.date))
      .toEqual(['06/set', 'Total', 'Média']);
  });
});

describe('filtrarPeriodo', () => {
  const dados = [
    { date: '01/dez' }, { date: '08/dez' }, { date: '15/dez' },
    { date: '22/dez' }, { date: '29/dez' },
  ];

  it('"tudo" não recorta', () => {
    expect(filtrarPeriodo(dados, '2025-12-15', 'tudo')).toHaveLength(5);
  });

  it('15 dias começa na semana de análise e vai para frente', () => {
    // O que a reunião decide é o efetivo das próximas semanas; a semana que já
    // passou está apontada e só ocuparia metade do card.
    expect(filtrarPeriodo(dados, '2025-12-15', '15').map((d) => d.date))
      .toEqual(['15/dez', '22/dez', '29/dez']);
  });

  it('30 dias abre a janela, sempre para frente', () => {
    expect(filtrarPeriodo(dados, '2025-12-15', '30').map((d) => d.date))
      .toEqual(['15/dez', '22/dez', '29/dez']);
  });

  it('a semana de análise entra mesmo com a data de status no meio dela', () => {
    // A coluna é rotulada pelo primeiro dia da semana; cortar pela data exata
    // do status jogaria a própria semana em análise para fora do recorte.
    expect(filtrarPeriodo(dados, '2025-12-17', '15').map((d) => d.date))
      .toContain('15/dez');
  });

  it('recorte que não sobra nada devolve tudo, em vez de card vazio', () => {
    expect(filtrarPeriodo(dados, '2026-06-01', '15')).toHaveLength(5);
  });
});

describe('serieDoRotulo', () => {
  it('separa direta de indireta', () => {
    expect(serieDoRotulo('MOD Previsto')).toBe('previsto');
    expect(serieDoRotulo('MOI Previsto')).toBe('moiPrevisto');
    expect(serieDoRotulo('MOI Real')).toBe('moiReal');
  });

  it('aceita a palavra por extenso e sem acento', () => {
    expect(serieDoRotulo('Mão de obra indireta - real')).toBe('moiReal');
    expect(serieDoRotulo('MAO DE OBRA DIRETA PREVISTA')).toBe('previsto');
  });

  it('sem MOD nem MOI escrito, a linha é da direta', () => {
    // Era o único conteúdo do histograma antes de a MOI existir.
    expect(serieDoRotulo('Previsto')).toBe('previsto');
    expect(serieDoRotulo('Real')).toBe('real');
  });

  it('replanejado ganha de previsto no mesmo rótulo', () => {
    expect(serieDoRotulo('MOD Previsto Replanejado')).toBe('replanejado');
    expect(serieDoRotulo('MOI replanejada')).toBe('moiReplanejado');
  });

  it('rótulo que não nomeia série nenhuma devolve null', () => {
    expect(serieDoRotulo('Semana')).toBeNull();
    expect(serieDoRotulo('')).toBeNull();
  });
});

describe('lerColagemHistograma', () => {
  it('sem rótulo, vale a ordem de sempre', () => {
    const s = lerColagemHistograma('10\t20\t30\n8\t18\t25');
    expect(s.previsto).toEqual([10, 20, 30]);
    expect(s.real).toEqual([8, 18, 25]);
    expect(s.replanejado).toBeUndefined();
  });

  it('sem rótulo, a terceira linha é o replanejado', () => {
    expect(lerColagemHistograma('10\t20\n8\t18\n12\t22').replanejado).toEqual([12, 22]);
  });

  it('com rótulo, a ordem das linhas não importa', () => {
    const s = lerColagemHistograma(
      'MOI Real\t3\t4\nMOD Previsto\t10\t20\nMOI Previsto\t2\t2\nMOD Real\t8\t18',
    );
    expect(s.previsto).toEqual([10, 20]);
    expect(s.real).toEqual([8, 18]);
    expect(s.moiPrevisto).toEqual([2, 2]);
    expect(s.moiReal).toEqual([3, 4]);
  });

  it('só as séries coladas voltam — colar MOI não zera a MOD', () => {
    const s = lerColagemHistograma('MOI Previsto\t2\t2\nMOI Real\t3\t4');
    expect(Object.keys(s).sort()).toEqual(['moiPrevisto', 'moiReal']);
  });

  it('uma linha rotulada faz a colagem inteira ser por rótulo', () => {
    // Misturar posição e rótulo na mesma colagem escreveria série errada.
    const s = lerColagemHistograma('10\t20\nMOI Real\t3\t4');
    expect(s.previsto).toBeUndefined();
    expect(s.moiReal).toEqual([3, 4]);
  });

  it('lê número no formato brasileiro', () => {
    expect(lerColagemHistograma('1.250,5\t2.000').previsto).toEqual([1250.5, 2000]);
  });

  it('colagem sem número nenhum devolve nada', () => {
    expect(lerColagemHistograma('só texto')).toEqual({});
  });
});

describe('indiceDaSemanaDeStatus', () => {
  const dados = [{ date: '01/dez' }, { date: '08/dez' }, { date: '15/dez' }];

  it('acha a coluna da data de status', () => {
    expect(indiceDaSemanaDeStatus(dados, '2025-12-15')).toBe(2);
  });

  it('cai na mais próxima quando não há data exata', () => {
    expect(indiceDaSemanaDeStatus(dados, '2025-12-10')).toBe(1);
  });

  it('devolve -1 sem data de status', () => {
    expect(indiceDaSemanaDeStatus(dados, '')).toBe(-1);
  });
});
