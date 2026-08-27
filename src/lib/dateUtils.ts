/**
 * Formata datas no padrão brasileiro.
 * Aceita strings ISO (yyyy-mm-dd) ou datas já formatadas.
 */

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** yyyy-mm-dd → dd/mm/aaaa */
export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr; // already formatted or invalid
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/** yyyy-mm-dd → dd/mmm (ex: 01/jan) */
export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}`;
};

/**
 * Semana ISO ("SEM 32") da data.
 *
 * ISO e não "dias desde 1º de janeiro dividido por 7": a semana ISO começa na
 * segunda e é a numeração que o planejamento usa para conversar com o cliente.
 */
export const semanaISO = (iso: string): string => {
  const d = parseISOLocal(iso);
  if (!d) return '';
  // Quinta-feira da mesma semana define o ano ISO.
  const quinta = somarDias(d, 3 - ((d.getDay() + 6) % 7));
  const primeiraQuinta = new Date(quinta.getFullYear(), 0, 4);
  const deslocamento = (primeiraQuinta.getDay() + 6) % 7;
  const semana1 = somarDias(primeiraQuinta, -deslocamento);
  const numero = Math.round((quinta.getTime() - semana1.getTime()) / (7 * 86_400_000)) + 1;
  return `SEM ${String(numero).padStart(2, '0')}`;
};

/** Calcula semana do ano */
export const getWeekOfYear = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  const oneWeek = 604800000;
  return `S${Math.ceil((diff / oneWeek) + 1)}`;
};

const monthMap: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  feb: 1, apr: 3, may: 4, aug: 7, sep: 8, oct: 9, dec: 11,
};

/** Parse week label like "12/abr", "28-Dec", "01/05", "01/05/2026" or ISO yyyy-mm-dd */
export const parseWeekLabel = (s: string, refYear: number): Date | null => {
  if (!s) return null;
  const txt = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
    const d = new Date(txt.slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = txt.toLowerCase().replace(/-/g, '/').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const mPart = parts[1];
  let month: number;
  if (/^\d+$/.test(mPart)) month = parseInt(mPart, 10) - 1;
  else month = monthMap[mPart.slice(0, 3)] ?? -1;
  if (month < 0 || isNaN(day)) return null;
  let year = parts[2] ? parseInt(parts[2], 10) : refYear;
  if (year < 100) year += 2000;
  if (!parts[2]) {
    const ref = new Date(refYear, 5, 15).getTime();
    const candidates = [year - 1, year, year + 1].map(y => new Date(y, month, day));
    candidates.sort((a, b) => Math.abs(a.getTime() - ref) - Math.abs(b.getTime() - ref));
    return candidates[0];
  }
  return new Date(year, month, day);
};

/** Returns a centered 5-week window (2 before, central, 2 after) around the update date */
export const centerWeeklyWindow = <T extends { date: string }>(
  data: T[],
  atualizadoEm: string,
  size = 5,
): T[] => {
  if (!data || data.length === 0) return data;
  if (data.length <= size) return data;
  const ref = new Date((atualizadoEm || '').slice(0, 10) + 'T00:00:00');
  if (isNaN(ref.getTime())) return data.slice(-size);
  const refYear = ref.getFullYear();
  let bestIdx = 0;
  let bestDiff = Infinity;
  data.forEach((row, i) => {
    const d = parseWeekLabel(row.date, refYear);
    if (!d) return;
    const diff = Math.abs(d.getTime() - ref.getTime());
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  });
  const half = Math.floor(size / 2);
  let start = bestIdx - half;
  let end = start + size;
  if (start < 0) { end -= start; start = 0; }
  if (end > data.length) { start -= (end - data.length); end = data.length; start = Math.max(0, start); }
  return data.slice(start, end);
};

// ─── Primitivas de data usadas pela Curva S do MS Project ────────────────────

/** ISO (yyyy-mm-dd) → Date no fuso local. `null` quando não dá para ler. */
export const parseISOLocal = (iso: string): Date | null => {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** Nova data deslocada em `dias` — não altera a original. */
export const somarDias = (d: Date, dias: number): Date => {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + dias);
  return out;
};

/** Date → "dd/mmm" (ex.: 19/out) — o rótulo usado nos eixos dos gráficos. */
export const formatDDmmm = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}`;

export type Periodicidade = 'semanal' | 'diaria';

/** Quantos dias cada ponto da curva avança. */
export const PASSO_DIAS: Record<Periodicidade, number> = { semanal: 7, diaria: 1 };

/**
 * A data real de cada ponto da curva, pela POSIÇÃO.
 *
 * Os rótulos da curva são "03/ago", sem ano. Numa obra que atravessa o
 * ano-novo, "03/ago" de 2026 e de 2027 são o mesmo texto, e qualquer conversão
 * a partir do rótulo tem de adivinhar — foi o que fez o card do mês mostrar dez
 * colunas em vez de quatro. Contando do início da obra não há o que adivinhar.
 */
export const datasDaCurva = (
  quantidade: number,
  inicioISO: string,
  periodicidade: Periodicidade = 'semanal',
): (Date | null)[] => {
  const inicio = parseISOLocal(inicioISO);
  if (!inicio) return Array.from({ length: quantidade }, () => null);
  const passo = PASSO_DIAS[periodicidade];
  return Array.from({ length: quantidade }, (_, i) => somarDias(inicio, i * passo));
};

export interface JanelaItem {
  date: string;
  previsto: number;
  real: number;
  tendencia?: number;
  isStatus?: boolean;
}

/**
 * Janela de N períodos com a data de status SEMPRE no centro.
 *
 * Diferente de `centerWeeklyWindow`, que desliza a janela para dentro dos dados
 * quando o status está perto da borda: aqui o centro é inegociável — quando a
 * série não alcança, o período que falta entra vazio, com o rótulo calculado a
 * partir da periodicidade. É o que a Visão de 5 Semanas precisa: duas semanas
 * atrás, a semana de status e duas semanas à frente (o que está previsto).
 */
export const janelaCentradaNaData = (
  data: JanelaItem[],
  atualizadoEm: string,
  opts: { size?: number; periodicidade?: Periodicidade } = {},
): JanelaItem[] => {
  const size = opts.size ?? 5;
  const passo = PASSO_DIAS[opts.periodicidade ?? 'semanal'];
  if (!data || data.length === 0) return data;

  const ref = parseISOLocal(atualizadoEm);

  // A semana já marcada pela importação manda: rótulos como "26-SEM29" não são
  // datas parseáveis, então procurar pela mais próxima de `atualizadoEm` cairia
  // sempre na primeira da série.
  let centro = data.findIndex((w) => w.isStatus);
  if (centro < 0) {
    if (!ref) return data.slice(-size);
    const anoRef = ref.getFullYear();
    let menor = Infinity;
    centro = 0;
    data.forEach((row, i) => {
      const d = parseWeekLabel(row.date, anoRef);
      if (!d) return;
      const diff = Math.abs(d.getTime() - ref.getTime());
      if (diff < menor) { menor = diff; centro = i; }
    });
  }

  const meio = Math.floor(size / 2);
  const anoRef = (ref ?? new Date()).getFullYear();
  const dataCentro = parseWeekLabel(data[centro]?.date ?? '', anoRef) ?? ref;

  const out: JanelaItem[] = [];
  for (let k = -meio; k <= size - meio - 1; k++) {
    const existente = data[centro + k];
    if (existente) {
      out.push({ ...existente, isStatus: k === 0 });
      continue;
    }
    // Fora da série: período vazio, só para manter o status no centro.
    out.push({
      date: dataCentro ? formatDDmmm(somarDias(dataCentro, k * passo)) : '',
      previsto: 0,
      real: 0,
      isStatus: k === 0,
    });
  }
  return out;
};

/** Date → yyyy-mm-dd pelos getters locais; `toISOString` jogaria o dia para trás. */
export const formatISOLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Ano que serve de referência para ler rótulos sem ano ("08/dez").
 *
 * A data de status manda, e não o relógio de quem abre: uma obra de 2025
 * revisada em 2026 tem que continuar casando as mesmas semanas.
 */
export const anoDeReferencia = (atualizadoEm?: string): number =>
  parseISOLocal(atualizadoEm ?? '')?.getFullYear() ?? new Date().getFullYear();
