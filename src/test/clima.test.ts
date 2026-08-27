import { describe, it, expect } from 'vitest';
import {
  descreverTempo,
  interpretarLocais,
  interpretarPrevisao,
  riscoDeChuva,
  type DiaPrevisao,
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
