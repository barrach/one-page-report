/**
 * Previsão do tempo para a obra.
 *
 * Usa a Open-Meteo: gratuita, sem cadastro nem chave, e — o que importa aqui —
 * ela responde com CORS liberado, então o navegador consegue chamar direto. Um
 * campo de "cole a URL do site de clima" não funcionaria: o navegador bloqueia
 * a leitura de qualquer site que não autorize a origem, e a maioria não
 * autoriza. Aqui a pessoa informa a CIDADE, não um endereço.
 *
 * O que interessa numa obra não é a temperatura, é a chuva: por isso cada dia
 * traz probabilidade e milímetros, e um risco derivado deles. E, dentro do dia,
 * a HORA — 8 mm de madrugada não param nada; os mesmos 8 mm às 10h param
 * concretagem, içamento e trabalho em altura.
 */

const URL_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const URL_PREVISAO = 'https://api.open-meteo.com/v1/forecast';

export interface LocalClima {
  nome: string;
  latitude: number;
  longitude: number;
  /** "Betim, Minas Gerais" — para diferenciar homônimos na hora de escolher. */
  detalhe: string;
}

export interface DiaPrevisao {
  /** ISO yyyy-mm-dd */
  data: string;
  /** Código WMO devolvido pela Open-Meteo. */
  codigo: number;
  tempMin: number;
  tempMax: number;
  chuvaMm: number;
  chuvaProb: number;
}

export interface HoraPrevisao {
  /** Carimbo local da obra, no formato yyyy-mm-ddTHH:mm. */
  hora: string;
  codigo: number;
  temp: number;
  chuvaMm: number;
  chuvaProb: number;
}

export interface Previsao {
  dias: DiaPrevisao[];
  horas: HoraPrevisao[];
}

/** Quanto o dia atrapalha a produção a céu aberto. */
export type RiscoChuva = 'baixo' | 'medio' | 'alto';

/**
 * Códigos WMO agrupados no que muda a decisão em obra. O texto é curto de
 * propósito: o card é lido de longe, numa reunião.
 */
const TEMPO_POR_CODIGO: Array<{ codigos: number[]; texto: string; icone: string }> = [
  { codigos: [0], texto: 'Céu limpo', icone: 'sol' },
  { codigos: [1], texto: 'Poucas nuvens', icone: 'sol-nuvem' },
  { codigos: [2], texto: 'Parcialmente nublado', icone: 'sol-nuvem' },
  { codigos: [3], texto: 'Nublado', icone: 'nuvem' },
  { codigos: [45, 48], texto: 'Nevoeiro', icone: 'nevoeiro' },
  { codigos: [51, 53, 55, 56, 57], texto: 'Garoa', icone: 'garoa' },
  { codigos: [61, 63, 65, 66, 67], texto: 'Chuva', icone: 'chuva' },
  { codigos: [71, 73, 75, 77, 85, 86], texto: 'Neve', icone: 'neve' },
  { codigos: [80, 81, 82], texto: 'Pancadas de chuva', icone: 'chuva' },
  { codigos: [95], texto: 'Trovoada', icone: 'tempestade' },
  { codigos: [96, 99], texto: 'Trovoada com granizo', icone: 'tempestade' },
];

export const descreverTempo = (codigo: number): { texto: string; icone: string } => {
  const achado = TEMPO_POR_CODIGO.find((t) => t.codigos.includes(codigo));
  return achado ? { texto: achado.texto, icone: achado.icone } : { texto: '—', icone: 'nuvem' };
};

/**
 * Risco de a chuva parar o serviço.
 *
 * Milímetros e probabilidade contam juntos: 80% de chance de 0,2 mm é uma
 * garoa que não para nada, e 5 mm certos param concretagem e içamento.
 */
export const riscoDeChuva = (dia: DiaPrevisao): RiscoChuva => {
  if (dia.chuvaMm >= 10 || (dia.chuvaProb >= 70 && dia.chuvaMm >= 3)) return 'alto';
  if (dia.chuvaMm >= 2 || dia.chuvaProb >= 50) return 'medio';
  return 'baixo';
};

export const ROTULO_RISCO: Record<RiscoChuva, string> = {
  baixo: 'Sem impacto previsto',
  medio: 'Atenção',
  alto: 'Risco de parada',
};

/**
 * Risco de uma hora isolada.
 *
 * Os cortes são menores que os do dia porque aqui o volume é de UMA hora:
 * 4 mm em sessenta minutos é chuva que manda todo mundo descer do andaime,
 * ainda que o dia inteiro não passe de 6 mm.
 */
export const riscoDaHora = (h: HoraPrevisao): RiscoChuva => {
  if (h.chuvaMm >= 4 || (h.chuvaProb >= 70 && h.chuvaMm >= 1)) return 'alto';
  if (h.chuvaMm >= 0.5 || h.chuvaProb >= 50) return 'medio';
  return 'baixo';
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isFinite(n) ? n : 0;
};

const uma = (n: number) => Math.round(n * 10) / 10;

/** Traduz a parte diária da resposta. Fora da chamada de rede, para poder testar. */
export const interpretarPrevisao = (json: unknown): DiaPrevisao[] => {
  const diario = (json as { daily?: Record<string, unknown[]> })?.daily;
  const datas = diario?.time;
  if (!Array.isArray(datas)) return [];

  return datas.map((data, i) => ({
    data: String(data),
    codigo: num(diario?.weather_code?.[i]),
    tempMin: Math.round(num(diario?.temperature_2m_min?.[i])),
    tempMax: Math.round(num(diario?.temperature_2m_max?.[i])),
    chuvaMm: uma(num(diario?.precipitation_sum?.[i])),
    chuvaProb: Math.round(num(diario?.precipitation_probability_max?.[i])),
  }));
};

/** Traduz a parte horária da resposta. */
export const interpretarHoras = (json: unknown): HoraPrevisao[] => {
  const porHora = (json as { hourly?: Record<string, unknown[]> })?.hourly;
  const carimbos = porHora?.time;
  if (!Array.isArray(carimbos)) return [];

  return carimbos.map((hora, i) => ({
    hora: String(hora),
    codigo: num(porHora?.weather_code?.[i]),
    temp: Math.round(num(porHora?.temperature_2m?.[i])),
    chuvaMm: uma(num(porHora?.precipitation?.[i])),
    chuvaProb: Math.round(num(porHora?.precipitation_probability?.[i])),
  }));
};

/** Recorta as 24 horas de um dia. A data sai do próprio carimbo, sem fuso. */
export const horasDoDia = (horas: HoraPrevisao[], dataISO: string): HoraPrevisao[] =>
  horas.filter((h) => h.hora.slice(0, 10) === dataISO);

/** Faixa de trabalho padrão em obra: das 7h às 17h. */
export const TURNO_PADRAO = { inicio: 7, fim: 17 };

export const horaDoCarimbo = (hora: string): number => num(hora.slice(11, 13));

export const dentroDoTurno = (h: HoraPrevisao, turno = TURNO_PADRAO): boolean => {
  const hh = horaDoCarimbo(h.hora);
  return hh >= turno.inicio && hh < turno.fim;
};

export interface ResumoTurno {
  chuvaMm: number;
  maiorProb: number;
  /** Horas do turno com chuva que atrapalha (risco médio ou alto). */
  horasComChuva: number;
  /** Primeira hora crítica do turno, no formato HH:mm — ou null. */
  primeiraCritica: string | null;
}

/**
 * O que a chuva faz com o dia de TRABALHO.
 *
 * É o número que decide a programação: chuva fora do turno não muda nada, e o
 * total do dia sozinho não distingue os dois casos — 12 mm entre 2h e 5h e
 * 12 mm entre 9h e meio-dia aparecem iguais no card diário.
 */
export const resumoDoTurno = (horas: HoraPrevisao[], turno = TURNO_PADRAO): ResumoTurno => {
  const noTurno = horas.filter((h) => dentroDoTurno(h, turno));
  const atrapalham = noTurno.filter((h) => riscoDaHora(h) !== 'baixo');
  const critica = noTurno.find((h) => riscoDaHora(h) === 'alto');

  return {
    chuvaMm: uma(noTurno.reduce((s, h) => s + h.chuvaMm, 0)),
    maiorProb: noTurno.reduce((m, h) => Math.max(m, h.chuvaProb), 0),
    horasComChuva: atrapalham.length,
    primeiraCritica: critica ? critica.hora.slice(11, 16) : null,
  };
};

/** Traduz a resposta do geocoder. */
export const interpretarLocais = (json: unknown): LocalClima[] => {
  const lista = (json as { results?: unknown[] })?.results;
  if (!Array.isArray(lista)) return [];
  return lista.map((r) => {
    const item = r as Record<string, unknown>;
    const partes = [item.admin1, item.country].filter(Boolean).map(String);
    return {
      nome: String(item.name ?? ''),
      latitude: num(item.latitude),
      longitude: num(item.longitude),
      detalhe: partes.join(', '),
    };
  }).filter((l) => l.nome && (l.latitude !== 0 || l.longitude !== 0));
};

export const buscarLocais = async (nome: string): Promise<LocalClima[]> => {
  const termo = nome.trim();
  if (termo.length < 2) return [];
  const url = `${URL_GEO}?name=${encodeURIComponent(termo)}&count=8&language=pt&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Busca de cidade respondeu ${r.status}`);
  return interpretarLocais(await r.json());
};

const CAMPOS_DIARIOS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
].join(',');

// O horário vem na MESMA chamada que o diário: são poucos kilobytes e evita
// uma segunda ida à rede — que, numa obra com sinal ruim, é justamente a que
// falha. Abrir o detalhe de um dia não depende de conexão.
const CAMPOS_HORARIOS = [
  'weather_code',
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
].join(',');

export const buscarPrevisao = async (
  latitude: number,
  longitude: number,
  dias = 7,
): Promise<Previsao> => {
  const url = `${URL_PREVISAO}?latitude=${latitude}&longitude=${longitude}`
    + `&daily=${CAMPOS_DIARIOS}&hourly=${CAMPOS_HORARIOS}`
    + `&timezone=auto&forecast_days=${dias}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Previsão respondeu ${r.status}`);
  const json = await r.json();
  return { dias: interpretarPrevisao(json), horas: interpretarHoras(json) };
};

// ─── Cache local ────────────────────────────────────────────────────────────
// A obra abre o relatório várias vezes por dia e às vezes com sinal ruim. Uma
// previsão de algumas horas atrás vale muito mais que um card vazio.
//
// A validade é de uma hora porque é esse o passo da previsão: buscar antes
// disso devolveria os mesmos números.

export const VALIDADE_MS = 60 * 60 * 1000;

interface CacheClima {
  gravadoEm: number;
  dias: DiaPrevisao[];
  horas?: HoraPrevisao[];
}

export interface CacheLido {
  previsao: Previsao;
  velho: boolean;
  gravadoEm: number;
}

const chaveCache = (lat: number, lon: number) =>
  `opr_clima_${lat.toFixed(2)}_${lon.toFixed(2)}`;

export const lerCache = (lat: number, lon: number): CacheLido | null => {
  try {
    const bruto = localStorage.getItem(chaveCache(lat, lon));
    if (!bruto) return null;
    const c = JSON.parse(bruto) as CacheClima;
    if (!Array.isArray(c?.dias) || c.dias.length === 0) return null;
    // Cache gravado antes de o detalhe horário existir: os dias ainda servem,
    // e o horário chega na primeira resposta nova.
    return {
      previsao: { dias: c.dias, horas: Array.isArray(c.horas) ? c.horas : [] },
      velho: Date.now() - c.gravadoEm > VALIDADE_MS,
      gravadoEm: c.gravadoEm,
    };
  } catch {
    return null;
  }
};

export const gravarCache = (lat: number, lon: number, previsao: Previsao): void => {
  try {
    localStorage.setItem(chaveCache(lat, lon), JSON.stringify({
      gravadoEm: Date.now(), dias: previsao.dias, horas: previsao.horas,
    }));
  } catch { /* quota — seguir sem cache é aceitável */ }
};
