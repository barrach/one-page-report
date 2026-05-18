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
