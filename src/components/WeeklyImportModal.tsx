import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, CalendarDays } from 'lucide-react';
import { useProjectStore, ScheduleRow } from '@/store/projectStore';
import { toast } from 'sonner';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtScheduleDate = (d: Date): string => {
  if (!d || isNaN(d.getTime())) return '';
  const dia = DAYS_PT[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dia} ${dd}/${mm}/${yy}`;
};
const parseAnyDate = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && v > 1000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

type ScheduleFormat = 'xml' | 'xlsx';
type ScheduleField = 'id' | 'tarefa' | 'previsto' | 'trabalhoConcluido' | 'desvio' | 'inicio' | 'termino' | 'inicioBase' | 'terminoBase' | 'nivel';
interface ScheduleMapEntry { field: ScheduleField; col: number; header: string; }
interface ScheduleExtract { rows: ScheduleRow[]; format: ScheduleFormat; mapping?: ScheduleMapEntry[]; missing?: ScheduleField[]; }


const parseScheduleXML = (xmlString: string): ScheduleRow[] => {
  // 1. Parsear o XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length) throw new Error('XML inválido');

  // 2. O namespace pode variar — buscar Tasks de duas formas
  let tasks: HTMLCollectionOf<Element> | Element[] = xmlDoc.getElementsByTagName('Task');
  if (!tasks || tasks.length === 0) {
    tasks = xmlDoc.getElementsByTagNameNS('*', 'Task');
  }

  // 3. Helper para ler tag com e sem namespace
  function getTag(task: Element, tagName: string): string | null {
    const el = task.getElementsByTagName(tagName)[0]
             || task.getElementsByTagNameNS('*', tagName)[0];
    return el ? (el.textContent ?? '').trim() : null;
  }

  // 4. Formatar data — "Dia DD/mmm/aa"
  function formatDate(dateStr: string | null): string {
    if (!dateStr || dateStr === 'NA' || dateStr === '') return 'ND';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'ND';
    if (d.getFullYear() < 1990) return 'ND';
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = meses[d.getMonth()];
    const ano = String(d.getFullYear()).slice(2);
    return `${dias[d.getDay()]} ${dia}/${mes}/${ano}`;
  }

  // 5. Processar cada Task
  const result: ScheduleRow[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    const uid = getTag(task, 'UID');
    if (uid === '0') continue; // ignorar tarefa raiz

    const rawId = getTag(task, 'ID');
    const name = getTag(task, 'Name');
    if (!name) continue;
    const outlineLevel = parseInt(getTag(task, 'OutlineLevel') || '1') || 1;
    const outlineNumber = getTag(task, 'OutlineNumber') || (rawId ?? '');
    const prevPct = parseFloat(getTag(task, 'PercentComplete') || '0') || 0;
    const trabPct = parseFloat(getTag(task, 'PercentWorkComplete') || '0') || 0;
    const isSummary = getTag(task, 'Summary') === '1';
    const isMilestone = getTag(task, 'Milestone') === '1';

    const inicio = formatDate(getTag(task, 'Start'));
    const termino = formatDate(getTag(task, 'Finish'));

    const rawBaseStart  = getTag(task, 'BaselineStart');
    const rawBaseFinish = getTag(task, 'BaselineFinish');

    const inicioBase = (
      !rawBaseStart ||
      rawBaseStart === 'NA' ||
      rawBaseStart === '' ||
      rawBaseStart.startsWith('NA')
    ) ? 'ND' : formatDate(rawBaseStart);

    const terminoBase = (
      !rawBaseFinish ||
      rawBaseFinish === 'NA' ||
      rawBaseFinish === '' ||
      rawBaseFinish.startsWith('NA')
    ) ? 'ND' : formatDate(rawBaseFinish);

    const desvio = Math.round((prevPct - trabPct) * 100) / 100;

    result.push({
      id: rawId ?? String(i + 1),
      tarefa: name,
      previsto: prevPct,
      trabalhoConcluido: trabPct,
      desvio,
      inicio: inicio === 'ND' ? '' : inicio,
      termino: termino === 'ND' ? '' : termino,
      inicioBase,
      terminoBase,
      outlineLevel,
      outlineNumber,
      summary: isSummary,
      milestone: isMilestone,
      bold: isSummary || outlineLevel <= 2,
    });
  }

  console.log('XML tasks encontradas:', tasks.length);
  console.log('Primeira task:', result[0]);
  console.log('Total importado:', result.length);
  console.log('=== DEBUG CRONOGRAMA ===');
  console.log('Total tasks:', result.length);
  console.log('Task ID=1:', JSON.stringify(result.find(t => Number(t.id) === 1)));
  console.log('Task ID=21:', JSON.stringify(result.find(t => Number(t.id) === 21)));
  console.log('OutlineLevels encontrados:', [...new Set(result.map(t => t.outlineLevel))].sort());

  return result;
};

// ─── Schedule (XLSX) — fully dynamic, header-driven column mapping ───
const normHeader = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Field matchers — each returns true when the (normalised) header is a candidate
// for that field. Order matters: more specific fields run first so they can
// claim columns before generic ones (e.g. baseline before plain start/finish).
const FIELD_MATCHERS: Array<{ field: ScheduleField; match: (h: string) => boolean }> = [
  { field: 'tarefa', match: (h) => /nome.*tarefa|task\s*name|^tarefa$|^atividade$|^descricao$|^name$/.test(h) },
  { field: 'nivel', match: (h) => /^(nivel|level|outline\s*level)$/.test(h) },
  { field: 'inicioBase', match: (h) => (h.includes('base') || h.includes('linha')) && (h.includes('inicio') || h.includes('start')) },
  { field: 'terminoBase', match: (h) => (h.includes('base') || h.includes('linha')) && (h.includes('termino') || h.includes('fim') || h.includes('finish')) },
  { field: 'trabalhoConcluido', match: (h) => (h.includes('trabalho') || h.includes('work')) && (h.includes('%') || h.includes('conclu')) },
  { field: 'previsto', match: (h) => !h.includes('trabalho') && !h.includes('work') && (
      /%\s*previsto|%\s*prev\b|^previsto$|%\s*conclu|percent\s*complete|fisico\s*prev|avanco\s*prev/.test(h)
    ) },
  { field: 'desvio', match: (h) => /\b(desvio|variance|spi|diferenca)\b/.test(h) },
  { field: 'inicio', match: (h) => !h.includes('base') && !h.includes('linha') && /\b(inicio|start)\b/.test(h) },
  { field: 'termino', match: (h) => !h.includes('base') && !h.includes('linha') && /\b(termino|finish|conclusao)\b/.test(h) },
  { field: 'id', match: (h) => /^(id|wbs|codigo|cod|numero|n)$/.test(h) },
];

const buildScheduleMapping = (headers: string[]): { map: Partial<Record<ScheduleField, ScheduleMapEntry>>; missing: ScheduleField[] } => {
  const map: Partial<Record<ScheduleField, ScheduleMapEntry>> = {};
  const used = new Set<number>();
  for (const { field, match } of FIELD_MATCHERS) {
    if (map[field]) continue;
    for (let c = 0; c < headers.length; c++) {
      if (used.has(c)) continue;
      if (!headers[c]) continue;
      if (match(headers[c])) {
        map[field] = { field, col: c, header: headers[c] };
        used.add(c);
        break;
      }
    }
  }
  const missing = (['id', 'tarefa', 'previsto', 'trabalhoConcluido', 'desvio', 'inicio', 'termino', 'inicioBase', 'terminoBase'] as ScheduleField[])
    .filter((f) => !map[f]);
  return { map, missing };
};

const fdSchedule = (v: unknown): string => {
  const d = parseAnyDate(v);
  return d ? fmtScheduleDate(d) : '';
};
const fdScheduleBase = (v: unknown): string => {
  if (v == null) return 'ND';
  const s = String(v).trim();
  if (!s || /^(na|nd|n\/?d)$/i.test(s)) return 'ND';
  const d = parseAnyDate(v);
  if (!d || d.getFullYear() < 1990) return 'ND';
  return fmtScheduleDate(d);
};
const numSchedule = (v: unknown): number => {
  if (typeof v === 'number') return v <= 1 && v > 0 ? v * 100 : v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace('%', '').replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  return 0;
};

interface XlsxParseResult { rows: ScheduleRow[]; mapping: ScheduleMapEntry[]; missing: ScheduleField[]; }

const parseScheduleXLSX = (buf: ArrayBuffer): XlsxParseResult => {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });

    // PASSO 1 — find header row: first row whose cells contain "nome", "task" or "tarefa"
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(grid.length, 15); i++) {
      const cells = (grid[i] || []) as unknown[];
      const normed = cells.map(normHeader);
      if (normed.some((h) => /nome|tarefa|task/.test(h))) { headerRowIdx = i; break; }
    }
    if (headerRowIdx < 0) continue;

    const headers = ((grid[headerRowIdx] || []) as unknown[]).map(normHeader);

    // PASSO 2/3 — dynamic field → column mapping with conflict resolution
    const { map, missing } = buildScheduleMapping(headers);
    if (!map.tarefa) continue;

    const get = (row: unknown[], f: ScheduleField) => {
      const e = map[f]; return e ? row[e.col] : null;
    };

    const out: ScheduleRow[] = [];
    const counters: number[] = [];
    const hasDesvio = !!map.desvio;
    const hasNivelCol = !!map.nivel;

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const rr = (grid[r] || []) as unknown[];
      const rawTar = get(rr, 'tarefa');
      if (rawTar == null || String(rawTar).trim() === '') continue;
      const rawName = String(rawTar);

      // PASSO 4 — outline level
      let outlineLevel: number;
      if (hasNivelCol) {
        const v = get(rr, 'nivel');
        const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
        outlineLevel = Number.isFinite(n) && n > 0 ? n : 1;
      } else {
        const leading = rawName.length - rawName.trimStart().length;
        outlineLevel = Math.max(1, Math.floor(leading / 3) + 1);
      }

      if (counters.length < outlineLevel) {
        while (counters.length < outlineLevel) counters.push(0);
      } else {
        counters.length = outlineLevel;
      }
      counters[outlineLevel - 1] = (counters[outlineLevel - 1] || 0) + 1;
      const outlineNumber = counters.slice(0, outlineLevel).join('.');

      const previsto = numSchedule(get(rr, 'previsto'));
      const trab = numSchedule(get(rr, 'trabalhoConcluido'));
      // PASSO 5 — desvio: usar do arquivo se existir, senão Prev - %Trab
      const desvio = hasDesvio
        ? numSchedule(get(rr, 'desvio'))
        : Math.round((previsto - trab) * 100) / 100;

      const idVal = map.id ? String(get(rr, 'id') ?? '').trim() : '';
      out.push({
        id: idVal || String(r - headerRowIdx),
        tarefa: rawName.trim(),
        previsto,
        trabalhoConcluido: trab,
        desvio,
        inicio: map.inicio ? fdSchedule(get(rr, 'inicio')) : '',
        termino: map.termino ? fdSchedule(get(rr, 'termino')) : '',
        inicioBase: map.inicioBase ? fdScheduleBase(get(rr, 'inicioBase')) : 'ND',
        terminoBase: map.terminoBase ? fdScheduleBase(get(rr, 'terminoBase')) : 'ND',
        outlineLevel,
        outlineNumber,
        summary: false,
        milestone: false,
        bold: outlineLevel <= 2,
      });
    }

    if (out.length) {
      const mapping: ScheduleMapEntry[] = Object.values(map).filter((m): m is ScheduleMapEntry => !!m);
      return { rows: out, mapping, missing };
    }
  }
  throw new Error('Não foi possível detectar colunas do cronograma');
};

const parseScheduleFile = async (file: File): Promise<ScheduleExtract> => {
  const isXml = /\.xml$/i.test(file.name);
  if (isXml) {
    const text = await file.text();
    return { rows: parseScheduleXML(text), format: 'xml' };
  }
  const buf = await file.arrayBuffer();
  const { rows, mapping, missing } = parseScheduleXLSX(buf);
  return { rows, format: 'xlsx', mapping, missing };
};


const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDDmmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${MONTHS_PT[d.getMonth()]}`;
const fmtMmmAaaa = (d: Date) => `${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const round2 = (n: number) => Math.round(n * 100) / 100;

const toDate = (v: unknown): Date | null => {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number' && v > 1000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};
const toNum = (v: unknown): number => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.replace(/%/g, '').replace(/\./g, '').replace(',', '.').trim();
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  return 0;
};

type Grid = unknown[][];
interface SheetRef { fileName: string; sheetName: string; grid: Grid; }

// Required labels (fingerprint of curve block)
const REQUIRED_LABELS = {
  dates: ['data de corte'],
  prevAcu: ['prev. acum. %'],
  realAcu: ['real. acum. %'],
} as const;
// Optional labels
const OPTIONAL_LABELS = {
  prevSem: ['prev. %'],
  realSem: ['real. %'],
  tendAcu: ['tend. acum. %', 'tendência acum. %', 'tendencia acum. %'],
  tendSem: ['tendência %', 'tendencia %'],
  replanjSem: ['prev. replanejado %'],
  replanjAcu: ['prev. acum. replanejado %'],
} as const;
type RequiredKey = keyof typeof REQUIRED_LABELS;
type OptionalKey = keyof typeof OPTIONAL_LABELS;
type CurveKey = RequiredKey | OptionalKey;
const CURVE_HUMAN: Record<CurveKey, string> = {
  dates: 'Data de Corte',
  prevAcu: 'Prev. Acum. %',
  realAcu: 'Real. Acum. %',
  prevSem: 'Prev. %',
  realSem: 'Real. %',
  tendAcu: 'Tend. Acum. %',
  tendSem: 'Tendência %',
  replanjSem: 'Prev. Replanejado %',
  replanjAcu: 'Prev. Acum. Replanejado %',
};

interface CurvePos { row: number; col: number; }
interface CurveBlock {
  ref: SheetRef;
  pos: Partial<Record<CurveKey, CurvePos>> & Record<RequiredKey, CurvePos>;
}

const findLabelInColumn = (grid: Grid, anchorRow: number, col: number, targets: readonly string[], range = 15): CurvePos | null => {
  for (let dr = -range; dr <= range; dr++) {
    const ri = anchorRow + dr;
    if (ri < 0) continue;
    const cell = (grid[ri] || [])[col];
    if (cell == null) continue;
    const n = norm(cell);
    if (targets.some(t => n === t)) return { row: ri, col };
  }
  return null;
};

// Anchor on "Data de Corte". Required fingerprint must match in same col within 15 rows.
// Pick block with most realAcu > 0 columns.
const findBestCurveBlock = (refs: SheetRef[]): CurveBlock | null => {
  let best: { block: CurveBlock; score: number } | null = null;
  for (const ref of refs) {
    const dateOcc: CurvePos[] = [];
    ref.grid.forEach((row, ri) => {
      row?.forEach((cell, ci) => {
        if (norm(cell) === REQUIRED_LABELS.dates[0]) dateOcc.push({ row: ri, col: ci });
      });
    });
    for (const dp of dateOcc) {
      const pos: Partial<Record<CurveKey, CurvePos>> = { dates: dp };
      let ok = true;
      (['prevAcu', 'realAcu'] as RequiredKey[]).forEach(k => {
        const f = findLabelInColumn(ref.grid, dp.row, dp.col, REQUIRED_LABELS[k]);
        if (!f) ok = false; else pos[k] = f;
      });
      if (!ok) continue;
      (Object.keys(OPTIONAL_LABELS) as OptionalKey[]).forEach(k => {
        const f = findLabelInColumn(ref.grid, dp.row, dp.col, OPTIONAL_LABELS[k]);
        if (f) pos[k] = f;
      });
      // Score = number of cols with realAcu > 0
      const realRow = ref.grid[pos.realAcu!.row] || [];
      let score = 0;
      for (let j = pos.dates!.col + 1; j < realRow.length; j++) {
        const v = realRow[j];
        if (typeof v === 'number' && v > 0) score++;
        else if (typeof v === 'string') {
          const n = parseFloat(v.replace(',', '.'));
          if (isFinite(n) && n > 0) score++;
        }
      }
      const block: CurveBlock = { ref, pos: pos as CurveBlock['pos'] };
      if (!best || score > best.score) best = { block, score };
    }
  }
  return best?.block ?? null;
};

interface HistBlock {
  ref: SheetRef;
  rowDia: number;
  colDia: number;
  rowPrev: number;
  rowReal: number;
  realCount: number;
}

const findHistBlock = (ref: SheetRef): HistBlock | null => {
  let rowDia = -1, colDia = -1;
  let rowPrev = -1, rowReal = -1;
  let hasMODD = false, hasMODI = false;

  ref.grid.forEach((row, ri) => {
    row?.forEach((cell, ci) => {
      const n = norm(cell);
      if (!n) return;
      if (rowDia < 0 && n === 'dia') { rowDia = ri; colDia = ci; }
      if (ci === 0) {
        if (rowPrev < 0 && n.includes('total prevista')) rowPrev = ri;
        if (rowReal < 0 && n.includes('total real')) rowReal = ri;
      }
      if (n.includes('mao de obra direta') || n.includes('mão de obra direta')) hasMODD = true;
      if (n.includes('mao de obra indireta') || n.includes('mão de obra indireta')) hasMODI = true;
    });
  });

  if (rowDia < 0 || rowPrev < 0 || rowReal < 0 || !hasMODD || !hasMODI) return null;

  const realRow = ref.grid[rowReal] || [];
  let realSum = 0;
  for (let j = colDia + 1; j < realRow.length; j++) {
    const v = realRow[j];
    if (typeof v === 'number' && isFinite(v) && v > 0) realSum += v;
  }
  return { ref, rowDia, colDia, rowPrev, rowReal, realCount: realSum };
};

interface CurveExtract {
  block: CurveBlock;
  cols: { date: Date; prevSem: number; prevAcu: number; realSem: number; realAcu: number; tendSem: number; tendAcu: number; replanjSem: number; replanjAcu: number; }[];
  ultimaReal: number;
  statusDate: Date;
  realAcuLast: number;
  prevAcuLast: number;
  hasReplanejado: boolean;
  sCurve: { date: string; previsto: number; real: number; tendencia: number; replanejado?: number }[];
  weekly: { date: string; previsto: number; real: number }[];
  monthly: { label: string; previsto: number; real: number }[];
}

const extractCurve = (block: CurveBlock): CurveExtract | { error: string } => {
  const { grid } = block.ref;
  const { dates } = block.pos;
  const dateRow = grid[dates.row] || [];

  let colStart = -1;
  for (let j = dates.col + 1; j < dateRow.length; j++) {
    if (toDate(dateRow[j])) { colStart = j; break; }
  }
  if (colStart < 0) return { error: 'Nenhuma data encontrada após "Data de Corte"' };

  const readRow = (key: CurveKey) => {
    const p = block.pos[key];
    return p ? (grid[p.row] || []) : null;
  };
  const r = {
    prevSem: readRow('prevSem'),
    prevAcu: readRow('prevAcu')!,
    realSem: readRow('realSem'),
    realAcu: readRow('realAcu')!,
    tendSem: readRow('tendSem'),
    tendAcu: readRow('tendAcu'),
    replanjSem: readRow('replanjSem'),
    replanjAcu: readRow('replanjAcu'),
  };

  const cols: CurveExtract['cols'] = [];
  for (let j = colStart; j < dateRow.length; j++) {
    const d = toDate(dateRow[j]);
    if (!d) continue;
    const get = (row: unknown[] | null) => row ? toNum(row[j]) : 0;
    cols.push({
      date: d,
      prevSem: get(r.prevSem),
      prevAcu: get(r.prevAcu),
      realSem: get(r.realSem),
      realAcu: get(r.realAcu),
      tendSem: get(r.tendSem),
      tendAcu: get(r.tendAcu),
      replanjSem: get(r.replanjSem),
      replanjAcu: get(r.replanjAcu),
    });
  }

  let ultimaReal = -1;
  cols.forEach((c, i) => { if (c.realAcu > 0) ultimaReal = i; });
  if (ultimaReal < 0) return { error: 'Nenhuma coluna com Real Acumulado > 0' };

  const hasReplanejado = cols.some(c => c.replanjAcu > 0);

  const sCurve = cols
    .filter(c => c.prevAcu > 0 || c.realAcu > 0 || c.tendAcu > 0 || c.replanjAcu > 0)
    .map(c => ({
      date: fmtDDmmm(c.date),
      previsto: round2(c.prevAcu * 100),
      real: round2(c.realAcu * 100),
      tendencia: round2(c.tendAcu * 100),
      ...(hasReplanejado ? { replanejado: round2(c.replanjAcu * 100) } : {}),
    }));

  // Janela de 5 semanas centrada na data de atualização (2 antes + central + 2 depois)
  let wStart = ultimaReal - 2;
  let wEnd = ultimaReal + 3; // exclusivo
  if (wStart < 0) { wEnd -= wStart; wStart = 0; }
  if (wEnd > cols.length) { wStart -= (wEnd - cols.length); wEnd = cols.length; wStart = Math.max(0, wStart); }
  const weekly = cols.slice(wStart, wEnd).map(c => ({
    date: fmtDDmmm(c.date),
    previsto: round2(c.prevSem * 100),
    real: round2(c.realSem * 100),
  }));

  const monthMap = new Map<string, { date: Date; prevAcu: number; realAcu: number }>();
  cols.slice(0, ultimaReal + 1).forEach(c => {
    const key = `${c.date.getFullYear()}-${String(c.date.getMonth()).padStart(2, '0')}`;
    monthMap.set(key, { date: c.date, prevAcu: c.prevAcu, realAcu: c.realAcu });
  });
  const monthly = [...monthMap.values()]
    .filter(m => m.prevAcu > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-4)
    .map(m => ({
      label: fmtMmmAaaa(m.date),
      previsto: round2(m.prevAcu * 100),
      real: round2(m.realAcu * 100),
    }));

  return { block, cols, ultimaReal, statusDate: cols[ultimaReal].date, realAcuLast: round2(cols[ultimaReal].realAcu * 100), prevAcuLast: round2(cols[ultimaReal].prevAcu * 100), hasReplanejado, sCurve, weekly, monthly };
};

interface HistExtract {
  block: HistBlock;
  total: number;
  ultimaReal: number;
  histogram: { date: string; semana: string; previsto: number; real: number }[];
}

const extractHist = (block: HistBlock): HistExtract | { error: string } => {
  const { grid } = block.ref;
  const diaRow = grid[block.rowDia] || [];
  const prevRow = grid[block.rowPrev] || [];
  const realRow = grid[block.rowReal] || [];

  let colStart = -1;
  for (let j = block.colDia + 1; j < diaRow.length; j++) {
    if (toDate(diaRow[j])) { colStart = j; break; }
  }
  if (colStart < 0) return { error: 'Nenhuma data encontrada na linha "Dia"' };

  // Only columns where "Dia" is a real Date — skip totals/summary columns
  const items: { date: Date; prev: number; real: number }[] = [];
  for (let j = colStart; j < diaRow.length; j++) {
    const d = toDate(diaRow[j]);
    if (!d) continue;
    items.push({
      date: d,
      prev: toNum(prevRow[j]),
      real: toNum(realRow[j]),
    });
  }

  let ultimaReal = -1;
  items.forEach((c, i) => { if (c.real > 0) ultimaReal = i; });

  // Keep ALL weeks with valid date. Past weeks: prev=0, real=real. Future weeks: prev=prev, real=0.
  const result = items.map((x, i) => {
    const isFuture = ultimaReal >= 0 ? i > ultimaReal : x.real === 0;
    return isFuture
      ? { date: x.date, prev: x.prev, real: 0 }
      : { date: x.date, prev: 0, real: x.real };
  });

  const histogram = result.map(c => ({
    date: fmtDDmmm(c.date),
    semana: '',
    previsto: Math.round(c.prev),
    real: Math.round(c.real),
  }));

  return { block, total: items.length, ultimaReal, histogram };
};

// ===================== FORMAT B (integrated curve + histogram in same sheet) =====================

interface FormatBBlock {
  ref: SheetRef;
  rowDates: number;
  colStart: number;
  rowPrevAcu: number;
  rowPrevSem: number;
  rowRealAcu: number;
  rowRealSem: number;
  rowTendAcu: number;
  rowTendSem: number;
  rowReplanjAcu: number;
  rowReplanjSem: number;
  rowModPrev: number;
  rowModReal: number;
  updateDate?: Date;
}

const findFormatBBlock = (ref: SheetRef): FormatBBlock | null => {
  const { grid } = ref;

  // 1. ROW_DATES: in first 12 rows, col 0 contains "evento" or "cronograma", subsequent cols are Dates
  let rowDates = -1, colStart = -1;
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    const row = grid[r] || [];
    const n = norm(row[0]);
    if (!(n.includes('evento') || n.includes('cronograma'))) continue;
    for (let c = 1; c < row.length; c++) {
      if (toDate(row[c])) { rowDates = r; colStart = c; break; }
    }
    if (rowDates >= 0) break;
  }
  if (rowDates < 0) return null;

  // 2. Search col 0 for labels
  let rowPrevAcu = -1, rowPrevSem = -1;
  let rowRealAcu = -1, rowRealSem = -1;
  let rowTendAcu = -1, rowTendSem = -1;
  let rowReplanjAcu = -1, rowReplanjSem = -1;
  let rowModPrev = -1, rowModReal = -1;
  let updateDate: Date | undefined;

  for (let r = 0; r < grid.length; r++) {
    const n = norm((grid[r] || [])[0]);
    if (!n) continue;
    // Acumulados (contain "(acumulado)")
    if (n.includes('(acumulado)')) {
      if (rowPrevAcu < 0 && n.includes('previsto geral lb')) rowPrevAcu = r;
      else if (rowRealAcu < 0 && n.includes('realizado geral')) rowRealAcu = r;
      else if (rowTendAcu < 0 && (n.includes('tendência geral') || n.includes('tendencia geral'))) rowTendAcu = r;
      else if (rowReplanjAcu < 0 && n.includes('replanejado')) rowReplanjAcu = r;
    } else if (n.includes('(semanal)')) {
      if (rowReplanjSem < 0 && n.includes('replanejado')) rowReplanjSem = r;
    } else {
      // Semanais (exact-ish, no parens)
      if (rowPrevSem < 0 && n === 'previsto geral lb') rowPrevSem = r;
      else if (rowRealSem < 0 && n === 'realizado geral') rowRealSem = r;
      else if (rowTendSem < 0 && (n === 'tendência geral' || n === 'tendencia geral')) rowTendSem = r;
    }
    if (rowModPrev < 0 && n === 'mod - prev') rowModPrev = r;
    if (rowModReal < 0 && n === 'mod - real') rowModReal = r;
    if (n.includes('data da atualização') || n.includes('data da atualizacao')) {
      const next = (grid[r + 1] || [])[0];
      const d = toDate(next);
      if (d) updateDate = d;
    }
  }

  // Required: prevAcu + realAcu + (modPrev OR modReal)
  if (rowPrevAcu < 0 || rowRealAcu < 0) return null;
  if (rowModPrev < 0 && rowModReal < 0) return null;

  return {
    ref, rowDates, colStart,
    rowPrevAcu, rowPrevSem, rowRealAcu, rowRealSem,
    rowTendAcu, rowTendSem, rowReplanjAcu, rowReplanjSem,
    rowModPrev, rowModReal, updateDate,
  };
};

const extractFormatBCurve = (b: FormatBBlock): CurveExtract | { error: string } => {
  const { grid } = b.ref;
  const dateRow = grid[b.rowDates] || [];
  const rd = (r: number) => r >= 0 ? (grid[r] || []) : null;
  const rPa = rd(b.rowPrevAcu)!, rPs = rd(b.rowPrevSem);
  const rRa = rd(b.rowRealAcu)!, rRs = rd(b.rowRealSem);
  const rTa = rd(b.rowTendAcu), rTs = rd(b.rowTendSem);
  const rRpa = rd(b.rowReplanjAcu), rRps = rd(b.rowReplanjSem);

  const cols: CurveExtract['cols'] = [];
  for (let j = b.colStart; j < dateRow.length; j++) {
    const d = toDate(dateRow[j]);
    if (!d) continue;
    const get = (row: unknown[] | null) => row ? toNum(row[j]) : 0;
    cols.push({
      date: d,
      prevSem: get(rPs), prevAcu: get(rPa),
      realSem: get(rRs), realAcu: get(rRa),
      tendSem: get(rTs), tendAcu: get(rTa),
      replanjSem: get(rRps), replanjAcu: get(rRpa),
    });
  }

  let ultimaReal = -1;
  cols.forEach((c, i) => { if (c.realAcu > 0) ultimaReal = i; });
  if (ultimaReal < 0) return { error: 'Nenhuma coluna com Real Acumulado > 0 (FORMATO B)' };

  const hasReplanejado = cols.some(c => c.replanjAcu > 0);

  const sCurve = cols
    .filter(c => c.prevAcu > 0 || c.realAcu > 0 || c.tendAcu > 0 || c.replanjAcu > 0)
    .map(c => ({
      date: fmtDDmmm(c.date),
      previsto: round2(c.prevAcu * 100),
      real: round2(c.realAcu * 100),
      tendencia: round2(c.tendAcu * 100),
      ...(hasReplanejado ? { replanejado: round2(c.replanjAcu * 100) } : {}),
    }));

  // Janela de 5 semanas centrada na data de atualização (2 antes + central + 2 depois)
  let wStart = ultimaReal - 2;
  let wEnd = ultimaReal + 3;
  if (wStart < 0) { wEnd -= wStart; wStart = 0; }
  if (wEnd > cols.length) { wStart -= (wEnd - cols.length); wEnd = cols.length; wStart = Math.max(0, wStart); }
  const weekly = cols.slice(wStart, wEnd).map(c => ({
    date: fmtDDmmm(c.date),
    previsto: round2(c.prevSem * 100),
    real: round2(c.realSem * 100),
  }));

  const monthMap = new Map<string, { date: Date; prevAcu: number; realAcu: number }>();
  cols.slice(0, ultimaReal + 1).forEach(c => {
    const key = `${c.date.getFullYear()}-${String(c.date.getMonth()).padStart(2, '0')}`;
    monthMap.set(key, { date: c.date, prevAcu: c.prevAcu, realAcu: c.realAcu });
  });
  const monthly = [...monthMap.values()]
    .filter(m => m.prevAcu > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-4)
    .map(m => ({
      label: fmtMmmAaaa(m.date),
      previsto: round2(m.prevAcu * 100),
      real: round2(m.realAcu * 100),
    }));

  return {
    block: null as never,
    cols, ultimaReal,
    statusDate: cols[ultimaReal].date,
    realAcuLast: round2(cols[ultimaReal].realAcu * 100),
    prevAcuLast: round2(cols[ultimaReal].prevAcu * 100),
    hasReplanejado, sCurve, weekly, monthly,
  };
};

const extractFormatBHist = (b: FormatBBlock): HistExtract => {
  const { grid } = b.ref;
  const dateRow = grid[b.rowDates] || [];
  const rPrev = b.rowModPrev >= 0 ? (grid[b.rowModPrev] || []) : [];
  const rReal = b.rowModReal >= 0 ? (grid[b.rowModReal] || []) : [];

  const items: { date: Date; prev: number; real: number }[] = [];
  for (let j = b.colStart; j < dateRow.length; j++) {
    const d = toDate(dateRow[j]);
    if (!d) continue;
    items.push({ date: d, prev: toNum(rPrev[j]), real: toNum(rReal[j]) });
  }

  let ultimaReal = -1;
  items.forEach((c, i) => { if (c.real > 0) ultimaReal = i; });

  // Window: past 5 + future 4
  let windowItems = items;
  if (ultimaReal >= 0) {
    const start = Math.max(0, ultimaReal - 4);
    const futureEnd = Math.min(items.length, ultimaReal + 1 + 4);
    windowItems = items.slice(start, futureEnd);
  }

  const localUltimaReal = ultimaReal >= 0
    ? Math.max(0, Math.min(ultimaReal, ultimaReal) - Math.max(0, ultimaReal - 4))
    : -1;

  const result = windowItems.map((x, i) => {
    const isFuture = localUltimaReal >= 0 ? i > localUltimaReal : x.real === 0;
    return isFuture
      ? { date: x.date, prev: x.prev, real: 0 }
      : { date: x.date, prev: 0, real: x.real };
  });

  const histogram = result.map(c => ({
    date: fmtDDmmm(c.date),
    semana: '',
    previsto: Math.round(c.prev),
    real: Math.round(c.real),
  }));

  return {
    block: { ref: b.ref, rowDia: b.rowDates, colDia: b.colStart - 1, rowPrev: b.rowModPrev, rowReal: b.rowModReal, realCount: items.reduce((s, x) => s + (x.real > 0 ? x.real : 0), 0) },
    total: windowItems.length,
    ultimaReal: localUltimaReal,
    histogram,
  };
};



interface FileScan {
  fileName: string;
  sheets: SheetRef[];
}

const scanFile = async (file: File): Promise<FileScan> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true });
  const sheets: SheetRef[] = wb.SheetNames.map(name => ({
    fileName: file.name,
    sheetName: name,
    grid: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true }),
  }));
  return { fileName: file.name, sheets };
};

interface ProjectDates {
  inicio?: Date;
  terminoLB?: Date;
  terminoPrev?: Date;
}

const PROJECT_DATE_LABELS: { key: keyof ProjectDates; patterns: string[] }[] = [
  { key: 'terminoPrev', patterns: ['término prev', 'termino prev'] },
  { key: 'terminoLB', patterns: ['término lb', 'termino lb', 'término linha base', 'termino linha base'] },
  { key: 'inicio', patterns: ['início', 'inicio'] },
];

const extractProjectDates = (refs: SheetRef[]): ProjectDates => {
  const out: ProjectDates = {};
  for (const ref of refs) {
    const rows = ref.grid.slice(0, 15);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const n = norm(row[c]);
        if (!n) continue;
        for (const { key, patterns } of PROJECT_DATE_LABELS) {
          if (out[key]) continue;
          if (!patterns.some(p => n.includes(p))) continue;
          // Try cell to the right, then 2 rows below same column
          const candidates: unknown[] = [
            row[c + 1],
            (ref.grid[r + 2] || [])[c],
            (ref.grid[r + 1] || [])[c],
            row[c + 2],
          ];
          for (const cand of candidates) {
            const d = toDate(cand);
            if (d) { out[key] = d; break; }
          }
        }
      }
    }
  }
  return out;
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface ImportResult {
  curveBlock: CurveBlock | null;
  curve: CurveExtract | { error: string } | null;
  histBlock: HistBlock | null;
  hist: HistExtract | { error: string } | null;
  projectDates: ProjectDates;
  formatB?: FormatBBlock | null;
  errors: string[];
}

const runImport = async (files: File[]): Promise<ImportResult> => {
  const scans = await Promise.all(files.map(scanFile));
  const allSheets = scans.flatMap(s => s.sheets);

  // Try FORMAT B first (integrated curve + histogram in same sheet)
  let formatB: FormatBBlock | null = null;
  for (const ref of allSheets) {
    const fb = findFormatBBlock(ref);
    if (fb) { formatB = fb; break; }
  }

  if (formatB) {
    const curve = extractFormatBCurve(formatB);
    const hist = extractFormatBHist(formatB);
    const projectDates = extractProjectDates(allSheets);
    const errors: string[] = [];
    if ('error' in curve) errors.push(curve.error);
    return {
      curveBlock: null,
      curve,
      histBlock: hist.block,
      hist,
      projectDates,
      formatB,
      errors,
    };
  }

  // FORMAT A — fallback
  const curveBlock: CurveBlock | null = findBestCurveBlock(allSheets);
  const histCandidates = allSheets
    .map(findHistBlock)
    .filter((b): b is HistBlock => !!b)
    .sort((a, b) => b.realCount - a.realCount);
  const histBlock = histCandidates[0] || null;

  const errors: string[] = [];
  if (!curveBlock) errors.push('Aba tipo CURVA_GERAL não encontrada (faltam labels da Curva S agrupados)');
  if (!histBlock) errors.push('Aba tipo HISTOGRAMA não encontrada (faltam TOTAL PREVISTA/REAL/MÃO DE OBRA)');

  const curve = curveBlock ? extractCurve(curveBlock) : null;
  const hist = histBlock ? extractHist(histBlock) : null;
  const projectDates = extractProjectDates(allSheets);

  return { curveBlock, curve, histBlock, hist, projectDates, formatB: null, errors };
};

interface UploadZoneProps {
  label: string;
  subtitle?: string;
  badge?: { text: string; variant: 'required' | 'optional' };
  accept?: string;
  status: 'idle' | 'loaded' | 'disabled';
  fileName?: string;
  disabledMessage?: string;
  onFile: (f: File) => void;
}

const UploadZone = ({ label, subtitle, badge, accept = '.xlsx', status, fileName, disabledMessage, onFile }: UploadZoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  const isDisabled = status === 'disabled';
  return (
    <label
      onDragOver={(e) => { if (isDisabled) return; e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (isDisabled) return;
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center transition-colors relative ${
        isDisabled ? 'border-muted bg-muted/30 opacity-60 cursor-not-allowed' :
        dragOver ? 'border-primary bg-primary/5 cursor-pointer' :
        status === 'loaded' ? 'border-success bg-success/5 cursor-pointer' :
        'border-border hover:border-primary/50 cursor-pointer'
      }`}
    >
      {badge && (
        <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          badge.variant === 'optional'
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary/10 text-primary'
        }`}>{badge.text}</span>
      )}
      <input type="file" accept={accept} className="hidden" disabled={isDisabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="flex flex-col items-center gap-2">
        {isDisabled
          ? <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          : status === 'loaded'
          ? <CheckCircle2 className="h-8 w-8 text-success" />
          : <Upload className="h-8 w-8 text-muted-foreground" />}
        <div className="font-semibold text-sm text-foreground">{label}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        <div className="text-xs">
          {isDisabled
            ? <span className="text-muted-foreground font-medium italic">{disabledMessage || 'Desabilitado'}</span>
            : status === 'loaded' && fileName
            ? <span className="text-success font-medium">✓ {fileName}</span>
            : <span className="text-muted-foreground">Arraste ou clique para selecionar</span>}
        </div>
      </div>
    </label>
  );
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WeeklyImportModal({ open, onOpenChange }: Props) {
  const { setSCurveData, setWeeklyData, setMonthData, setHistogramData, setScheduleData, setLastImport, setStatusDateIndex, setInfo, projects, selectedProjectId } = useProjectStore();
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [file3, setFile3] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [schedule, setSchedule] = useState<ScheduleExtract | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const reset = () => {
    setFile1(null); setFile2(null); setFile3(null);
    setResult(null); setSchedule(null); setScheduleError(null);
  };

  const runWith = useCallback(async (a: File | null, b: File | null) => {
    const files = [a, b].filter((f): f is File => !!f);
    if (!files.length) return;
    setParsing(true);
    try {
      setResult(await runImport(files));
    } catch (e) {
      setResult({ curveBlock: null, curve: null, histBlock: null, hist: null, projectDates: {}, errors: [(e as Error).message] });
    }
    setParsing(false);
  }, []);

  const onFile1 = useCallback((f: File) => { setFile1(f); runWith(f, file2); }, [file2, runWith]);
  const onFile2 = useCallback((f: File) => { setFile2(f); runWith(file1, f); }, [file1, runWith]);
  const onFile3 = useCallback(async (f: File) => {
    setFile3(f); setSchedule(null); setScheduleError(null);
    try {
      const ex = await parseScheduleFile(f);
      if (!ex.rows.length) setScheduleError('Nenhuma tarefa encontrada no arquivo');
      else setSchedule(ex);
    } catch (e) {
      setScheduleError((e as Error).message);
    }
  }, []);

  const curveOk = result?.curve && !('error' in result.curve);
  const histOk = result?.hist && !('error' in result.hist);
  const canConfirm = !!(curveOk || histOk || schedule);

  const confirm = () => {
    const now = new Date().toISOString();
    let count = 0;
    const currentInfo = projects.find(p => p.id === selectedProjectId)?.info;
    const infoPatch: Record<string, string | number> = {};
    if (curveOk) {
      const c = result!.curve as CurveExtract;
      if (c.sCurve.length) {
        setSCurveData(c.sCurve);
        let idx = -1;
        c.sCurve.forEach((p, i) => { if (p.real > 0) idx = i; });
        if (idx >= 0) setStatusDateIndex(idx);
        setLastImport('sCurve', now); count++;
      }
      if (c.weekly.length) { setWeeklyData(c.weekly); setLastImport('weekly', now); count++; }
      if (c.monthly.length) { setMonthData(c.monthly); setLastImport('month', now); count++; }
      // Always overwrite: status date + avanço prev/real come from the file
      // FORMAT B may override "Atualizado em" with explicit "Data da atualização:" label
      const updateDate = result?.formatB?.updateDate ?? c.statusDate;
      infoPatch.atualizadoEm = toIsoDate(updateDate);
      infoPatch.avancoPrev = c.prevAcuLast;
      infoPatch.avancoReal = c.realAcuLast;
    }
    if (histOk) {
      const h = result!.hist as HistExtract;
      if (h.histogram.length) { setHistogramData(h.histogram); setLastImport('histogram', now); count++; }
    }
    // Project dates: only fill if user hasn't set manually
    const pd = result?.projectDates;
    if (pd && currentInfo) {
      if (pd.inicio && !currentInfo.inicio) infoPatch.inicio = toIsoDate(pd.inicio);
      if (pd.terminoLB && !currentInfo.terminoLB) infoPatch.terminoLB = toIsoDate(pd.terminoLB);
      if (pd.terminoPrev && !currentInfo.terminoPrev) infoPatch.terminoPrev = toIsoDate(pd.terminoPrev);
    }
    if (Object.keys(infoPatch).length) setInfo(infoPatch);
    if (schedule && schedule.rows.length) {
      setScheduleData(schedule.rows.map(r => ({ ...r, bold: r.bold ?? false, criticalPath: false })));
      count++;
    }
    toast.success(`✓ Importação concluída — ${count} seções atualizadas`);
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const chip = (label: string, ok: boolean) => (
    <span key={label} className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono mr-1 mb-1 ${ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 300); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Importação Semanal
          </DialogTitle>
          <DialogDescription>
            Suba os arquivos — o sistema identifica as abas pelo conteúdo, não pelo nome
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <UploadZone label="Arquivo 1 — Curva S (.xlsx)" subtitle="Aceita FORMATO A (separado) ou FORMATO B (integrado)" badge={{ text: 'Obrigatório', variant: 'required' }} status={file1 ? 'loaded' : 'idle'} fileName={file1?.name} onFile={onFile1} />
          <UploadZone
            label="Arquivo 2 — Histograma MOD (.xlsx)"
            badge={{ text: result?.formatB ? 'Não necessário' : 'Obrigatório', variant: result?.formatB ? 'optional' : 'required' }}
            status={result?.formatB ? 'disabled' : (file2 ? 'loaded' : 'idle')}
            fileName={file2?.name}
            disabledMessage="Incluído no Arquivo 1 (FORMATO B)"
            onFile={onFile2}
          />
          <UploadZone
            label="Arquivo 3 — Cronograma (.xml ou .xlsx)"
            subtitle="Opcional — MS Project: XML ou Excel exportado"
            badge={{ text: 'Opcional', variant: 'optional' }}
            accept=".xml,.xlsx,.xls"
            status={file3 ? 'loaded' : 'idle'}
            fileName={file3?.name}
            onFile={onFile3}
          />
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando arquivos...
          </div>
        )}

        {(result || schedule || scheduleError) && !parsing && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <h3 className="font-semibold text-sm">Resumo de Detecção</h3>

              {result?.errors.map((e, i) => (
                <div key={i} className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {e}
                </div>
              ))}

              {result && (
                <>
                  {/* CURVA_GERAL */}
                  <div className="text-xs space-y-2">
                    <div className="font-medium text-foreground">
                      📊 Curva S / Semanal / Prev x Mês
                      {result.formatB && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">FORMATO B (integrado)</span>}
                    </div>
                    {!result.curveBlock && !result.formatB ? (
                      <div className="pl-4 text-destructive">Aba não identificada</div>
                    ) : (
                      <div className="pl-4 space-y-1">
                        <div className="text-muted-foreground">
                          Arquivo: <span className="font-mono text-foreground">{(result.curveBlock?.ref || result.formatB!.ref).fileName}</span> ·
                          Aba: <span className="font-mono text-foreground">{(result.curveBlock?.ref || result.formatB!.ref).sheetName}</span>
                        </div>
                        {result.curveBlock && (
                          <div>{(Object.keys(CURVE_HUMAN) as CurveKey[]).map(k => chip(CURVE_HUMAN[k], !!result.curveBlock!.pos[k]))}</div>
                        )}
                        {result.formatB && (
                          <div>
                            {chip('Prev. LB Acu.', result.formatB.rowPrevAcu >= 0)}
                            {chip('Real Acu.', result.formatB.rowRealAcu >= 0)}
                            {chip('Tend. Acu.', result.formatB.rowTendAcu >= 0)}
                            {chip('Prev. Sem.', result.formatB.rowPrevSem >= 0)}
                            {chip('Real Sem.', result.formatB.rowRealSem >= 0)}
                            {chip('Replanej.', result.formatB.rowReplanjAcu >= 0)}
                            {chip('MOD Prev', result.formatB.rowModPrev >= 0)}
                            {chip('MOD Real', result.formatB.rowModReal >= 0)}
                          </div>
                        )}
                        {result.curve && ('error' in result.curve ? (
                          <div className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{result.curve.error}</div>
                        ) : (() => {
                          const c = result.curve as CurveExtract;
                          const sd = c.statusDate;
                          const sdFull = `${String(sd.getDate()).padStart(2, '0')}/${MONTHS_PT[sd.getMonth()]}/${sd.getFullYear()}`;
                          const realStr = c.realAcuLast.toFixed(2).replace('.', ',');
                          const updateDate = result.formatB?.updateDate ?? sd;
                          const udFull = `${String(updateDate.getDate()).padStart(2, '0')}/${MONTHS_PT[updateDate.getMonth()]}/${updateDate.getFullYear()}`;
                          return (
                            <>
                              <div className="rounded bg-success/10 border border-success/30 px-2 py-1 text-foreground space-y-0.5">
                                <div>📅 <strong>Data de Status detectada:</strong> {sdFull}</div>
                                <div>Última semana com Real: <strong>{fmtDDmmm(sd)}</strong> ({realStr}%)</div>
                                <div className="pt-1 border-t border-success/30 mt-1">
                                  <div className="font-semibold">Informações do Projeto:</div>
                                  <div>· Avanço Prev.: <strong>{c.prevAcuLast.toFixed(2).replace('.', ',')}%</strong></div>
                                  <div>· Avanço Real: <strong>{realStr}%</strong></div>
                                  <div>· Atualizado em: <strong>{udFull}</strong></div>
                                </div>
                              </div>
                              <div className="text-muted-foreground">
                                Curva S: {c.sCurve.length} sem · Semanal: {c.weekly.length} sem · Mensal: {c.monthly.length} meses
                              </div>
                              {result.projectDates && (result.projectDates.inicio || result.projectDates.terminoLB || result.projectDates.terminoPrev) && (
                                <div className="text-muted-foreground">
                                  Datas do projeto detectadas:
                                  {result.projectDates.inicio && <> Início <strong className="text-foreground">{fmtDDmmm(result.projectDates.inicio)}/{result.projectDates.inicio.getFullYear()}</strong></>}
                                  {result.projectDates.terminoLB && <> · Término LB <strong className="text-foreground">{fmtDDmmm(result.projectDates.terminoLB)}/{result.projectDates.terminoLB.getFullYear()}</strong></>}
                                  {result.projectDates.terminoPrev && <> · Término Prev <strong className="text-foreground">{fmtDDmmm(result.projectDates.terminoPrev)}/{result.projectDates.terminoPrev.getFullYear()}</strong></>}
                                </div>
                              )}
                            </>
                          );
                        })())}
                      </div>
                    )}
                  </div>

                  {/* HISTOGRAMA */}
                  <div className="text-xs space-y-2">
                    <div className="font-medium text-foreground">👥 Histograma MOD</div>
                    {!result.histBlock ? (
                      <div className="pl-4 text-destructive">Aba não identificada</div>
                    ) : (
                      <div className="pl-4 space-y-1">
                        <div className="text-muted-foreground">
                          Arquivo: <span className="font-mono text-foreground">{result.histBlock.ref.fileName}</span> ·
                          Aba: <span className="font-mono text-foreground">{result.histBlock.ref.sheetName}</span>
                        </div>
                        <div>
                          {chip('Dia', true)}{chip('TOTAL PREVISTA', true)}{chip('TOTAL REAL', true)}
                          {chip('MÃO DE OBRA DIRETA', true)}{chip('MÃO DE OBRA INDIRETA', true)}
                        </div>
                        {result.hist && ('error' in result.hist ? (
                          <div className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{result.hist.error}</div>
                        ) : (() => {
                          const h = result.hist as HistExtract;
                          return (
                            <div className="text-muted-foreground">
                              Semanas exibidas: <span className="font-semibold text-foreground">{h.histogram.length}</span> ·
                              Última com Real: <span className="font-semibold text-foreground">
                                {h.ultimaReal >= 0 && h.histogram.length
                                  ? h.histogram.find(x => x.real > 0)?.date || '—'
                                  : '—'}
                              </span>
                            </div>
                          );
                        })())}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CRONOGRAMA (opcional) */}
              {(schedule || scheduleError) && (
                <div className="text-xs space-y-2">
                  <div className="font-medium text-foreground flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Cronograma <span className="text-muted-foreground font-normal">(opcional)</span>
                  </div>
                  {scheduleError ? (
                    <div className="pl-4 text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{scheduleError}</div>
                  ) : schedule && (
                    <div className="pl-4 space-y-1">
                      <div className="text-muted-foreground">
                        Cronograma: <span className="font-semibold text-foreground">{schedule.rows.length}</span> tarefas encontradas
                        {' · '}formato: <span className="font-mono text-foreground">{schedule.format === 'xml' ? 'XML do Project' : 'Excel'}</span>
                      </div>
                      {schedule.mapping && schedule.mapping.length > 0 && (() => {
                        const labels: Record<ScheduleField, string> = {
                          tarefa: 'Nome da Tarefa', id: 'Id', previsto: 'Prev. %',
                          trabalhoConcluido: '% Trab.', desvio: 'Desvio',
                          inicio: 'Início', termino: 'Término',
                          inicioBase: 'Início Base', terminoBase: 'Término Base',
                          nivel: 'Nível',
                        };
                        const order: ScheduleField[] = ['tarefa', 'id', 'previsto', 'trabalhoConcluido', 'desvio', 'inicio', 'termino', 'inicioBase', 'terminoBase'];
                        const found = new Map(schedule.mapping.map((m) => [m.field, m]));
                        return (
                          <div className="rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
                            <div className="text-muted-foreground mb-1">Mapeamento detectado:</div>
                            {order.map((f) => {
                              const e = found.get(f);
                              const label = labels[f].padEnd(14, ' ');
                              if (e) {
                                return (
                                  <div key={f} className="text-foreground">
                                    <span className="text-green-600">✓</span> {label} ← col {e.col} <span className="text-muted-foreground">'{e.header}'</span>
                                  </div>
                                );
                              }
                              const fallback = f === 'id' ? 'usando sequencial'
                                : f === 'desvio' ? 'calculado (Prev − %Trab)'
                                : f === 'inicioBase' || f === 'terminoBase' ? 'exibido como ND'
                                : 'vazio';
                              return (
                                <div key={f} className="text-amber-600">
                                  ⚠ {label} ← não encontrado ({fallback})
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirm} disabled={!canConfirm} className="gradient-primary text-primary-foreground">
                Confirmar Importação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
