import { describe, it, expect } from 'vitest';
import {
  alinharComCurva,
  dataDoRotulo,
  filtrarPeriodo,
  indiceDaSemanaDeStatus,
  lerColagemHistograma,
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
});

describe('filtrarPeriodo', () => {
  const dados = [
    { date: '01/dez' }, { date: '08/dez' }, { date: '15/dez' },
    { date: '22/dez' }, { date: '29/dez' },
  ];

  it('"tudo" não recorta', () => {
    expect(filtrarPeriodo(dados, '2025-12-15', 'tudo')).toHaveLength(5);
  });

  it('15 dias pega uma semana para cada lado do status', () => {
    expect(filtrarPeriodo(dados, '2025-12-15', '15').map((d) => d.date))
      .toEqual(['08/dez', '15/dez', '22/dez']);
  });

  it('30 dias abre a janela', () => {
    expect(filtrarPeriodo(dados, '2025-12-15', '30').map((d) => d.date))
      .toEqual(['01/dez', '08/dez', '15/dez', '22/dez', '29/dez']);
  });

  it('recorte que não sobra nada devolve tudo, em vez de card vazio', () => {
    expect(filtrarPeriodo(dados, '2026-06-01', '15')).toHaveLength(5);
  });
});

describe('lerColagemHistograma', () => {
  it('primeira linha é previsto, segunda é real', () => {
    const { previsto, real, replanejado } = lerColagemHistograma('10\t20\t30\n8\t18\t25');
    expect(previsto).toEqual([10, 20, 30]);
    expect(real).toEqual([8, 18, 25]);
    expect(replanejado).toEqual([]);
  });

  it('terceira linha é o replanejado', () => {
    const { replanejado } = lerColagemHistograma('10\t20\n8\t18\n12\t22');
    expect(replanejado).toEqual([12, 22]);
  });

  it('rótulo na primeira célula é ignorado', () => {
    const { previsto, real } = lerColagemHistograma('Previsto\t10\t20\nReal\t8\t18');
    expect(previsto).toEqual([10, 20]);
    expect(real).toEqual([8, 18]);
  });

  it('lê número no formato brasileiro', () => {
    expect(lerColagemHistograma('1.250,5\t2.000').previsto).toEqual([1250.5, 2000]);
  });

  it('colagem sem número nenhum devolve séries vazias', () => {
    expect(lerColagemHistograma('só texto')).toEqual({ previsto: [], real: [], replanejado: [] });
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
