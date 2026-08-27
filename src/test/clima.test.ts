import { describe, it, expect } from 'vitest';
import {
  descreverTempo,
  interpretarLocais,
  interpretarPrevisao,
  interpretarHoras,
  riscoDeChuva,
  riscoDaHora,
  horasDoDia,
  resumoDoTurno,
  type DiaPrevisao,
  type HoraPrevisao,
} from '@/lib/clima';

const dia = (p: Partial<DiaPrevisao>): DiaPrevisao => ({
  data: '2026-08-03', codigo: 0, tempMin: 18, tempMax: 30, chuvaMm: 0, chuvaProb: 0, ...p,
});

describe('interpretarPrevisao', () => {
  it('lê a resposta da Open-Meteo', () => {
    const json = {
      daily: {
        time: ['2026-08-03', '2026-08-04'],
        weather_code: [3, 61],
        temperature_2m_max: [28.4, 24.1],
        temperature_2m_min: [17.6, 16.2],
        precipitation_sum: [0, 12.34],
        precipitation_probability_max: [10, 90],
      },
    };
    expect(interpretarPrevisao(json)).toEqual([
      { data: '2026-08-03', codigo: 3, tempMin: 18, tempMax: 28, chuvaMm: 0, chuvaProb: 10 },
      { data: '2026-08-04', codigo: 61, tempMin: 16, tempMax: 24, chuvaMm: 12.3, chuvaProb: 90 },
    ]);
  });

  it('resposta sem "daily" não quebra o card', () => {
    expect(interpretarPrevisao({})).toEqual([]);
    expect(interpretarPrevisao(null)).toEqual([]);
  });
});

describe('interpretarLocais', () => {
  it('monta nome e detalhe para diferenciar homônimos', () => {
    const json = {
      results: [
        { name: 'Betim', latitude: -19.96, longitude: -44.2, admin1: 'Minas Gerais', country: 'Brasil' },
      ],
    };
    expect(interpretarLocais(json)).toEqual([
      { nome: 'Betim', latitude: -19.96, longitude: -44.2, detalhe: 'Minas Gerais, Brasil' },
    ]);
  });

  it('sem resultados devolve lista vazia', () => {
    expect(interpretarLocais({})).toEqual([]);
  });
});

describe('riscoDeChuva', () => {
  it('chuva forte é risco de parada', () => {
    expect(riscoDeChuva(dia({ chuvaMm: 12, chuvaProb: 60 }))).toBe('alto');
  });

  it('chance alta com volume relevante também', () => {
    expect(riscoDeChuva(dia({ chuvaMm: 4, chuvaProb: 80 }))).toBe('alto');
  });

  it('chance alta de garoa não para serviço', () => {
    // 80% de 0,2 mm é garoa: probabilidade sozinha não decide.
    expect(riscoDeChuva(dia({ chuvaMm: 0.2, chuvaProb: 80 }))).toBe('medio');
  });

  it('tempo firme é risco baixo', () => {
    expect(riscoDeChuva(dia({ chuvaMm: 0, chuvaProb: 10 }))).toBe('baixo');
  });
});

describe('descreverTempo', () => {
  it('traduz os códigos WMO usados na obra', () => {
    expect(descreverTempo(0).texto).toBe('Céu limpo');
    expect(descreverTempo(61).texto).toBe('Chuva');
    expect(descreverTempo(95).texto).toBe('Trovoada');
  });

  it('código desconhecido não quebra', () => {
    expect(descreverTempo(999)).toEqual({ texto: '—', icone: 'nuvem' });
  });
});

describe('interpretarHoras', () => {
  it('le a serie horaria da Open-Meteo', () => {
    const json = {
      hourly: {
        time: ['2026-09-01T00:00', '2026-09-01T01:00'],
        weather_code: [3, 61],
        temperature_2m: [17.4, 16.8],
        precipitation: [0, 2.46],
        precipitation_probability: [10, 88],
      },
    };
    expect(interpretarHoras(json)).toEqual([
      { hora: '2026-09-01T00:00', codigo: 3, temp: 17, chuvaMm: 0, chuvaProb: 10 },
      { hora: '2026-09-01T01:00', codigo: 61, temp: 17, chuvaMm: 2.5, chuvaProb: 88 },
    ]);
  });

  it('resposta sem "hourly" nao quebra o detalhe', () => {
    expect(interpretarHoras({})).toEqual([]);
    expect(interpretarHoras(null)).toEqual([]);
  });
});

const hora = (h: string, p: Partial<HoraPrevisao> = {}): HoraPrevisao => ({
  hora: `2026-09-01T${h}`, codigo: 0, temp: 20, chuvaMm: 0, chuvaProb: 0, ...p,
});

describe('horasDoDia', () => {
  it('recorta pelo carimbo, sem depender de fuso', () => {
    const horas = [hora('23:00'), { ...hora('00:00'), hora: '2026-09-02T00:00' }];
    expect(horasDoDia(horas, '2026-09-01')).toHaveLength(1);
    expect(horasDoDia(horas, '2026-09-02')).toHaveLength(1);
  });
});

describe('riscoDaHora', () => {
  it('4 mm numa hora so ja e parada, mesmo com o dia inteiro seco', () => {
    expect(riscoDaHora(hora('10:00', { chuvaMm: 4, chuvaProb: 60 }))).toBe('alto');
  });

  it('chance alta com volume relevante tambem', () => {
    expect(riscoDaHora(hora('10:00', { chuvaMm: 1.2, chuvaProb: 75 }))).toBe('alto');
  });

  it('garoa de meio milimetro e atencao, nao parada', () => {
    expect(riscoDaHora(hora('10:00', { chuvaMm: 0.6, chuvaProb: 40 }))).toBe('medio');
  });

  it('hora firme e risco baixo', () => {
    expect(riscoDaHora(hora('10:00'))).toBe('baixo');
  });
});

describe('resumoDoTurno', () => {
  it('ignora a chuva fora do horario de trabalho', () => {
    // O dia tem 12 mm, mas todos de madrugada: nao custa hora-homem nenhuma.
    const horas = [
      hora('02:00', { chuvaMm: 6, chuvaProb: 95 }),
      hora('04:00', { chuvaMm: 6, chuvaProb: 95 }),
      hora('09:00'),
      hora('14:00'),
    ];
    const r = resumoDoTurno(horas);
    expect(r.chuvaMm).toBe(0);
    expect(r.horasComChuva).toBe(0);
    expect(r.primeiraCritica).toBeNull();
  });

  it('aponta a primeira hora critica do turno', () => {
    const horas = [
      hora('08:00', { chuvaMm: 0.8, chuvaProb: 40 }),
      hora('10:00', { chuvaMm: 5, chuvaProb: 90 }),
      hora('11:00', { chuvaMm: 5, chuvaProb: 90 }),
    ];
    const r = resumoDoTurno(horas);
    expect(r.chuvaMm).toBe(10.8);
    expect(r.maiorProb).toBe(90);
    expect(r.horasComChuva).toBe(3);
    expect(r.primeiraCritica).toBe('10:00');
  });

  it('a hora do fim do turno ja esta fora dele', () => {
    // 17h e a hora de encerrar: a chuva dessa hora nao entra na conta.
    expect(resumoDoTurno([hora('17:00', { chuvaMm: 9, chuvaProb: 99 })]).chuvaMm).toBe(0);
  });
});
