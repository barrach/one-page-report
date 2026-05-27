import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useProjectStore, ScheduleRow, CurvaSFinanceiraPoint } from '@/store/projectStore';
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
  if (typeof v === 'string') {
    // ISO yyyy-mm-dd or yyyy-mm-dd hh:mm:ss
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isNaN(d.getTime()) ? null : d;
    }
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

// ===================== FORMAT C (Relatório Integrado: curva + hist em abas separadas + RESUMO) =====================

interface FormatCCurveBlock {
  ref: SheetRef;
  rowDates: number;
  colStart: number;
  rowPrevAcu: number; rowPrevSem: number;
  rowRealAcu: number; rowRealSem: number;
  rowTendAcu: number; rowTendSem: number;
  rowReplanjAcu: number; rowReplanjSem: number;
  rowRealReplanjAcu: number; rowRealReplanjSem: number;
  updateDate?: Date;
}

interface FormatCHistBlock {
  ref: SheetRef;
  rowPlan: number;
  rowReal: number;
  colStart: number;
  rowMeses?: number;
  rowSemanas?: number;
  colEnd?: number;
}

interface FormatCInfo {
  projeto?: string; cliente?: string; gestor?: string;
  inicio?: Date; terminoLB?: Date; terminoPrev?: Date;
}

interface FormatCBundle {
  curve: FormatCCurveBlock;
  hist: FormatCHistBlock | null;
  info: FormatCInfo;
}


// Busca dinâmica de linha por label, com trim e variações de espaço
const findRowByLabel = (labelMap: Record<string, number>, ...candidates: string[]): number => {
  for (const c of candidates) {
    if (labelMap[c] !== undefined) return labelMap[c];
    const target = c.trim();
    const found = Object.keys(labelMap).find(k => k.trim() === target);
    if (found !== undefined) return labelMap[found];
  }
  return -1;
};

const isExcelDateSerial = (v: unknown): boolean =>
  typeof v === 'number' && v > 40000 && v < 60000;

const findFormatCCurveBlock = (ref: SheetRef): FormatCCurveBlock | null => {
  const { grid } = ref;

  // 1. Mapear TODOS os labels da col 0 dinamicamente
  const labelMap: Record<string, number> = {};
  grid.forEach((row, i) => {
    const v = (row || [])[0];
    if (v == null) return;
    const label = String(v).trim();
    if (label && !(label in labelMap)) labelMap[label] = i;
  });

  // SHEET CHECK (3 labels obrigatórios): Curva S = Evento + LB Acu + Real Acu
  const hasEvento = !!Object.keys(labelMap).find(k => k.trim().startsWith('Evento'));
  const hasLbAcu  = findRowByLabel(labelMap, 'PREVISTO GERAL LB (ACUMULADO)') >= 0;
  const hasReAcu  = findRowByLabel(labelMap, 'REALIZADO GERAL (ACUMULADO)') >= 0;
  if (!(hasEvento && hasLbAcu && hasReAcu)) return null;
  console.log('[FORMATO C] ✅ Aba Curva S =', ref.sheetName);

  // 2. Buscas dinâmicas (tolerantes a espaço extra)
  let rowDates       = findRowByLabel(labelMap, 'Evento ( Cronograma)', 'Evento (Cronograma)', 'EVENTO');
  const rowPrevSem   = findRowByLabel(labelMap, 'PREVISTO GERAL LB', 'PREVISTO GERAL LB ');
  const rowPrevAcu   = findRowByLabel(labelMap, 'PREVISTO GERAL LB (ACUMULADO)');
  const rowRealSem   = findRowByLabel(labelMap, 'REALIZADO GERAL', 'REALIZADO GERAL ');
  const rowRealAcu   = findRowByLabel(labelMap, 'REALIZADO GERAL (ACUMULADO)');
  const rowReplanjSem    = findRowByLabel(labelMap, 'PREVISTO GERAL REPLANEJADO (SEMANAL)');
  const rowReplanjAcu    = findRowByLabel(labelMap, 'PREVISTO GERAL REPLANEJADO (ACUMULADO)');
  const rowRealReplanjSem = findRowByLabel(labelMap, 'REALIZADO GERAL REPLANEJADO (SEMANAL)');
  const rowRealReplanjAcu = findRowByLabel(labelMap, 'REALIZADO GERAL REPLANEJADO (ACUMULADO)');
  const rowTendSem   = findRowByLabel(labelMap, 'TENDÊNCIA GERAL', 'TENDENCIA GERAL', 'TENDÊNCIA GERAL ', 'TENDENCIA GERAL ');
  const rowTendAcu   = findRowByLabel(labelMap, 'TENDÊNCIA GERAL (ACUMULADO)', 'TENDENCIA GERAL (ACUMULADO)');

  // Fallback rowDates: qualquer linha cujo col 0 contenha "Evento" e cujas cols seguintes tenham datas
  if (rowDates < 0) {
    for (let i = 0; i < grid.length; i++) {
      const row = grid[i] || [];
      if (row[0] && String(row[0]).includes('Evento')) {
        const temDatas = row.slice(1).some(v => v instanceof Date || isExcelDateSerial(v));
        if (temDatas) { rowDates = i; break; }
      }
    }
  }

  if (rowDates < 0 || rowRealAcu < 0 || rowPrevAcu < 0) return null;

  // 3. COL_START dinâmico: primeira col > 0 com Date na linha de datas
  const dateRow = grid[rowDates] || [];
  let colStart = -1;
  for (let j = 1; j < dateRow.length; j++) {
    const v = dateRow[j];
    if (v instanceof Date || toDate(v)) { colStart = j; break; }
  }
  if (colStart < 0) return null;

  // 4. Data de atualização: buscar label dinamicamente
  let updateDate: Date | undefined;
  const rowAtu = findRowByLabel(labelMap, 'Data da atualização:', 'Data da atualização', 'Data da atualizacao:', 'Atualizado em:');
  if (rowAtu >= 0) {
    const v1 = (grid[rowAtu + 1] || [])[0];
    const v2 = (grid[rowAtu] || [])[1];
    updateDate = toDate(v1) || toDate(v2) || undefined;
  }
  if (!updateDate) {
    // Fallback: varredura nas linhas após o bloco de dados
    for (let r = rowRealAcu + 1; r < grid.length; r++) {
      const d = toDate((grid[r] || [])[0]);
      if (d) { updateDate = d; break; }
    }
  }

  console.log('[FORMATO C] labelMap encontrado:', {
    rowDates, rowPrevAcu, rowRealAcu, rowTendAcu, rowReplanjAcu, colStart, updateDate,
  });

  return {
    ref, rowDates, colStart,
    rowPrevAcu, rowPrevSem, rowRealAcu, rowRealSem,
    rowTendAcu, rowTendSem,
    rowReplanjAcu, rowReplanjSem,
    rowRealReplanjAcu, rowRealReplanjSem,
    updateDate,
  };
};

const findFormatCHistBlock = (ref: SheetRef): FormatCHistBlock | null => {
  const { grid } = ref;

  // ROW_PLAN: alguma col 0-4 contém "EQUIPE DO PROJETO - TOTAL"
  // E alguma col 0-4 == "PLAN"
  let rowPlan = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    let hasTotal = false, hasPlan = false;
    for (let c = 0; c <= 4; c++) {
      const v = row[c];
      if (v == null) continue;
      const s = String(v).trim().toUpperCase();
      if (s.includes('EQUIPE DO PROJETO - TOTAL')) hasTotal = true;
      if (s === 'PLAN') hasPlan = true;
    }
    if (hasTotal && hasPlan) { rowPlan = r; break; }
  }

  // ROW_REAL: primeira linha APÓS ROW_PLAN onde col 0-4 == "REAL"
  let rowReal = -1;
  if (rowPlan >= 0) {
    for (let r = rowPlan + 1; r < Math.min(grid.length, rowPlan + 10); r++) {
      const row = grid[r] || [];
      for (let c = 0; c <= 4; c++) {
        const v = row[c];
        if (v != null && String(v).trim().toUpperCase() === 'REAL') { rowReal = r; break; }
      }
      if (rowReal >= 0) break;
    }
  }
  if (rowPlan < 0 || rowReal < 0) return null;

  const colStart = 5; // dados começam fixo na col 5 no FORMATO C

  // TIPO 2 (FORMATO C): tem linha de MESES (col5 com "letras/2-digitos")
  // e linha de SEMANAS (col5..col8 = S1,S2,S3,S4)
  const mesPattern = /^[A-Za-zÀ-ÿ]+\/\d{2}$/;
  let rowMeses = -1, rowSemanas = -1, colEnd = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const v5 = row[5], v9 = row[9];
    if (v5 != null && mesPattern.test(String(v5).trim()) &&
        v9 != null && String(v9).trim() !== String(v5).trim()) {
      rowMeses = r; break;
    }
  }
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const c5 = String(row[5] ?? '').trim().toUpperCase();
    const c6 = String(row[6] ?? '').trim().toUpperCase();
    const c7 = String(row[7] ?? '').trim().toUpperCase();
    const c8 = String(row[8] ?? '').trim().toUpperCase();
    if (c5 === 'S1' && c6 === 'S2' && c7 === 'S3' && c8 === 'S4') {
      rowSemanas = r; break;
    }
  }

  // COL_END = última coluna ≤ 40 onde plan > 0 OU real > 0
  const planRow = grid[rowPlan] || [];
  const realRow = grid[rowReal] || [];
  for (let j = colStart; j <= 40; j++) {
    const p = parseFloat(String(planRow[j])) || 0;
    const r2 = parseFloat(String(realRow[j])) || 0;
    if (p > 0 || r2 > 0) colEnd = j;
  }

  console.log('[Hist TIPO 2] ROW_MESES:', rowMeses, 'ROW_SEMANAS:', rowSemanas,
    'ROW_PLAN:', rowPlan, 'ROW_REAL:', rowReal, 'COL_END:', colEnd);

  return { ref, rowPlan, rowReal, colStart,
    rowMeses: rowMeses >= 0 ? rowMeses : undefined,
    rowSemanas: rowSemanas >= 0 ? rowSemanas : undefined,
    colEnd: colEnd >= colStart ? colEnd : undefined };
};



const extractFormatCInfo = (refs: SheetRef[]): FormatCInfo => {
  const info: FormatCInfo = {};
  const ref = refs.find(r => norm(r.sheetName).includes('resumo'));
  if (!ref) return info;
  const { grid } = ref;
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const row = grid[r] || [];
    const cells = row.map(norm);
    // Header line: "CONTRATO" + "ESCOPO" + "CLIENTE"
    if (cells.some(c => c === 'contrato') && cells.some(c => c.includes('escopo')) && cells.some(c => c.includes('cliente'))) {
      const valRow = grid[r + 1] || [];
      if (valRow[6] != null) info.projeto = String(valRow[6]).trim();
      if (valRow[14] != null) info.cliente = String(valRow[14]).trim();
      if (valRow[19] != null) info.gestor = String(valRow[19]).trim();
    }
    // Header: "DATA LINHA DE BASE"
    if (cells.some(c => c.includes('data linha de base') || c.includes('linha de base'))) {
      const valRow = grid[r + 2] || [];
      const d1 = toDate(valRow[1]); if (d1) info.inicio = d1;
      const d2 = toDate(valRow[2]); if (d2) info.terminoLB = d2;
      const d5 = toDate(valRow[5]); if (d5) info.terminoPrev = d5;
      const d6 = toDate(valRow[6]); if (d6 && !info.inicio) info.inicio = d6;
    }
  }
  return info;
};

// Converte valor decimal/percentual em percentual com 2 casas
const toPercentC = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!isFinite(n)) return 0;
  return n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100;
};

const extractFormatCCurve = (b: FormatCCurveBlock): CurveExtract | { error: string } => {
  const { grid } = b.ref;
  const dateRow = grid[b.rowDates] || [];
  const rd = (r: number) => r >= 0 ? (grid[r] || []) : null;
  const rPa = rd(b.rowPrevAcu)!, rPs = rd(b.rowPrevSem);
  const rRa = rd(b.rowRealAcu)!, rRs = rd(b.rowRealSem);
  const rTa = rd(b.rowTendAcu), rTs = rd(b.rowTendSem);
  const rRpa = rd(b.rowReplanjAcu), rRps = rd(b.rowReplanjSem);
  const rRra = rd(b.rowRealReplanjAcu), rRrs = rd(b.rowRealReplanjSem);

  // 1. ULTIMA_REAL = última coluna com realAcu > 0
  let ultimaRealCol = -1;
  for (let j = b.colStart; j < rRa.length; j++) {
    const v = parseFloat(String(rRa[j]));
    if (!isNaN(v) && v > 0) ultimaRealCol = j;
  }
  if (ultimaRealCol < 0) return { error: 'Nenhuma coluna com Real Acumulado > 0 (FORMATO C)' };

  // 1b. LAST_COL = última coluna com QUALQUER série acumulada > 0 (LB/Real/Replanj/Tend)
  // garante que Replanejado/Tendência futuros (até 26/jun) sejam plotados
  let lastCol = ultimaRealCol;
  const accRows = [rPa, rRa, rRpa, rTa].filter(Boolean) as unknown[][];
  for (const r of accRows) {
    for (let j = b.colStart; j < r.length; j++) {
      const v = parseFloat(String(r[j]));
      if (!isNaN(v) && v > 0 && j > lastCol) lastCol = j;
    }
  }
  // truncar para colunas que ainda têm Date na linha de datas
  while (lastCol > ultimaRealCol && !toDate(dateRow[lastCol])) lastCol--;

  // 2. Construir array de semanas COL_START até LAST_COL (valores em %)
  type Semana = {
    j: number; date: Date; label: string;
    lb: number; ra: number; rpa: number; ta: number;
    ps: number; rs: number; rps: number; rrps: number; rra: number;
  };
  const semanas: Semana[] = [];
  for (let j = b.colStart; j <= lastCol; j++) {
    const d = toDate(dateRow[j]);
    if (!d) continue;
    semanas.push({
      j, date: d, label: fmtDDmmm(d),
      lb:   toPercentC(rPa[j]),
      ra:   toPercentC(rRa[j]),
      rpa:  rRpa ? toPercentC(rRpa[j]) : 0,
      ta:   rTa ? toPercentC(rTa[j]) : 0,
      ps:   rPs ? toPercentC(rPs[j]) : 0,
      rs:   rRs ? toPercentC(rRs[j]) : 0,
      rps:  rRps ? toPercentC(rRps[j]) : 0,
      rrps: rRrs ? toPercentC(rRrs[j]) : 0,
      rra:  rRra ? toPercentC(rRra[j]) : 0,
    });
  }
  const ultimaRealIdx = semanas.findIndex(s => s.j === ultimaRealCol);
  console.log('=== FORMATO C DEBUG ===');
  console.log('Aba Curva S:', b.ref.sheetName);
  console.log('idxMap R.DATES:', b.rowDates, 'R.RE_ACU:', b.rowRealAcu);
  console.log('COL_START:', b.colStart);
  console.log('ULTIMA_REAL:', ultimaRealCol,
    'val:', toPercentC(rRa[ultimaRealCol]) + '%',
    'data:', fmtDDmmm(toDate(dateRow[ultimaRealCol]) as Date));
  console.log('Total semanas:', semanas.length);
  console.log('semanas[0]:', semanas[0]);
  console.log('semanas última:', semanas[semanas.length - 1]);

  const hasReplanejado = semanas.some(s => s.rpa > 0);

  // Tendência: se TODOS os valores > 0 forem < 10%, são deltas semanais (não acumulado).
  // Nesse caso, ocultar a linha de tendência no gráfico.
  const tendVals = semanas.map(s => s.ta).filter(v => v > 0);
  const tendIsDeltas = tendVals.length > 0 && tendVals.every(v => v < 10);
  if (tendIsDeltas) console.log('[FORMATO C] Tendência ocultada (valores são deltas semanais < 10%)');

  // 3. sCurve: null onde série = 0 para criar lacunas no gráfico
  const sCurve = semanas.map(s => ({
    date: s.label,
    previsto: s.lb > 0 ? s.lb : null as unknown as number,
    real: s.ra > 0 ? s.ra : null as unknown as number,
    tendencia: !tendIsDeltas && s.ta > 0 ? s.ta : null as unknown as number,
    ...(hasReplanejado ? { replanejado: s.rpa > 0 ? s.rpa : null as unknown as number } : {}),
  }));

  // 4. Resultado Semanal (FORMATO C): últimas 5 semanas ATÉ ULTIMA_REAL.
  // Usar SOMENTE PREVISTO GERAL LB (ps) e REALIZADO GERAL (rs) — NUNCA os
  // semanais de Replanejado (rps/rrps), que contêm deltas e não avanços.
  const upToReal = ultimaRealIdx >= 0 ? semanas.slice(0, ultimaRealIdx + 1) : semanas;
  const weekly = upToReal.slice(-5).map(s => ({
    date: s.label,
    previsto: s.ps,
    real: s.rs,
  }));



  // 5. Prev x Mês: agrupar por mês usando APENAS colunas até ULTIMA_REAL
  // (meses futuros têm Replanejado>0 e Real=0 — não comparáveis)
  // Para cada mês, agregar MAX de cada série, então aplicar prioridade:
  //   previsto = max(rpa) > 0 ? max(rpa) : max(lb)
  //   real     = max(rra) > 0 ? max(rra) : max(ra)
  // (evita pegar 0 da última semana quando LB acabou antes do fim do mês)
  type MesAgg = { date: Date; lb: number; rpa: number; ra: number; rra: number };
  const mesesAgg = new Map<string, MesAgg>();
  upToReal.forEach(s => {
    const key = `${s.date.getFullYear()}-${String(s.date.getMonth()).padStart(2, '0')}`;
    const cur = mesesAgg.get(key) || { date: s.date, lb: 0, rpa: 0, ra: 0, rra: 0 };
    if (s.date.getTime() >= cur.date.getTime()) cur.date = s.date;
    cur.lb  = Math.max(cur.lb,  s.lb);
    cur.rpa = Math.max(cur.rpa, s.rpa);
    cur.ra  = Math.max(cur.ra,  s.ra);
    cur.rra = Math.max(cur.rra, s.rra);
    mesesAgg.set(key, cur);
  });
  const monthly = [...mesesAgg.values()]
    .map(m => ({ date: m.date, previsto: m.rpa > 0 ? m.rpa : m.lb, real: m.rra > 0 ? m.rra : m.ra }))
    .filter(m => m.previsto > 0 || m.real > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-4)
    .map(m => ({ label: fmtMmmAaaa(m.date), previsto: m.previsto, real: m.real }));

  // 6. KPIs — usar dados da ULTIMA_REAL (não da última projeção)
  const last = (ultimaRealIdx >= 0 ? semanas[ultimaRealIdx] : semanas[semanas.length - 1]);
  const prevLast = last.rpa > 0 ? last.rpa : last.lb;

  // 7. cols compatível com CurveExtract (valores decimais para back-compat)
  const cols: CurveExtract['cols'] = semanas.map(s => ({
    date: s.date,
    prevSem: s.ps / 100, prevAcu: s.lb / 100,
    realSem: s.rs / 100, realAcu: s.ra / 100,
    tendSem: 0, tendAcu: s.ta / 100,
    replanjSem: s.rps / 100, replanjAcu: s.rpa / 100,
  }));

  return {
    block: null as never,
    cols, ultimaReal: ultimaRealIdx >= 0 ? ultimaRealIdx : semanas.length - 1,
    statusDate: last.date,
    realAcuLast: last.ra,
    prevAcuLast: prevLast,
    hasReplanejado, sCurve, weekly, monthly,
  };
};

const extractFormatCHist = (h: FormatCHistBlock, curveBlock: FormatCCurveBlock | null): HistExtract => {
  const { grid } = h.ref;
  const planRow = grid[h.rowPlan] || [];
  const realRow = grid[h.rowReal] || [];

  type Item = { j: number; label: string; prev: number; real: number };
  const items: Item[] = [];

  // ===== NOVO: leitura por linha de MESES + linha S1/S2/S3/S4 =====
  if (h.rowMeses != null && h.rowSemanas != null && h.colEnd != null) {
    const mesesRow = grid[h.rowMeses] || [];
    const semRow = grid[h.rowSemanas] || [];
    let mesAtual = '';
    for (let j = h.colStart; j <= h.colEnd; j++) {
      const mv = mesesRow[j];
      if (mv != null && String(mv).trim() !== '') mesAtual = String(mv).trim();
      const sv = String(semRow[j] ?? '').trim().toUpperCase();
      if (!/^S[1-4]$/.test(sv)) continue;
      const p = parseFloat(String(planRow[j])) || 0;
      const r = parseFloat(String(realRow[j])) || 0;
      const label = `${mesAtual} ${sv}`;
      if (p > 0 || r > 0) items.push({ j, label, prev: p, real: r });
    }
    console.log('[Hist TIPO 2] total semanas:', items.length);
    console.log('[Hist TIPO 2] primeira:', items[0]);
    console.log('[Hist TIPO 2] última:', items[items.length - 1]);
  } else {
    // ===== Fallback: lógica antiga baseada em datas da curva =====
    const curveDateRow = curveBlock ? (curveBlock.ref.grid[curveBlock.rowDates] || []) : null;
    const offset = curveBlock ? (curveBlock.colStart - h.colStart) : 0;
    let colEnd = planRow.length - 1;
    for (let j = h.colStart; j < planRow.length; j++) {
      const pv = planRow[j], rv = realRow[j];
      if ((typeof pv === 'number' && pv > 1000) || (typeof rv === 'number' && rv > 1000)) {
        colEnd = j - 1; break;
      }
    }
    for (let j = h.colStart; j <= colEnd; j++) {
      const p = parseFloat(String(planRow[j])) || 0;
      const r = parseFloat(String(realRow[j])) || 0;
      let label = `S${j - h.colStart + 1}`;
      if (curveDateRow) {
        const d = toDate(curveDateRow[j + offset]);
        if (d) label = fmtDDmmm(d);
      }
      if (p > 0 || r > 0) items.push({ j, label, prev: p, real: r });
    }
    console.log('[FORMATO C HIST] (fallback) items:', items.length, items);
  }

  // ULTIMA_REAL = última posição com real > 0
  let ultimaReal = -1;
  items.forEach((it, i) => { if (it.real > 0) ultimaReal = i; });

  // Incluir TODAS as semanas (não limitar a janela)
  const histogram = items.map(x => ({
    date: x.label,
    semana: '',
    previsto: Math.round(x.prev),
    real: Math.round(x.real),
  }));

  return {
    block: { ref: h.ref, rowDia: h.rowPlan, colDia: h.colStart - 1, rowPrev: h.rowPlan, rowReal: h.rowReal, realCount: items.reduce((s, x) => s + (x.real > 0 ? x.real : 0), 0) },
    total: items.length,
    ultimaReal,
    histogram,
  };
};


const detectFormatC = (allSheets: SheetRef[]): FormatCBundle | null => {
  // Sinais de Formato C: aba RESUMO ou aba EQUIPE DO PROJETO - TOTAL/PLAN
  const hasResumo = allSheets.some(s => norm(s.sheetName).includes('resumo'));
  const hasHistSig = allSheets.some(s =>
    (s.grid || []).some(r => (r as unknown[])?.some(v => v != null && String(v).includes('EQUIPE DO PROJETO - TOTAL')))
  );
  const isFormatC = hasResumo || hasHistSig;

  // Varre TODAS as abas em busca de candidatas à Curva S
  const candidatas: { ref: SheetRef; curve: FormatCCurveBlock; semanasComReal: number }[] = [];
  for (const ref of allSheets) {
    const c = findFormatCCurveBlock(ref);
    if (!c) continue;
    const rowReal = (ref.grid[c.rowRealAcu] || []) as unknown[];
    const semanasComReal = rowReal.filter(v => typeof v === 'number' && v > 0).length;
    candidatas.push({ ref, curve: c, semanasComReal });
    console.log('[FORMATO C] Candidata:', ref.sheetName, '| semanas com real:', semanasComReal);
  }
  candidatas.sort((a, b) => b.semanasComReal - a.semanasComReal);
  const melhor = candidatas[0];
  console.log('[FORMATO C] Aba selecionada:', melhor?.ref.sheetName, '| semanas:', melhor?.semanasComReal);
  if (!melhor || melhor.semanasComReal === 0) {
    if (isFormatC) {
      console.error('[FORMATO C] ❌ Aba da Curva S não encontrada ou sem dados. Abas:', allSheets.map(s => s.sheetName));
      toast.error('FORMATO C: aba da Curva S não encontrada ou sem dados.');
    }
    return null;
  }
  const curve = melhor.curve;
  // Format C signature: has RESUMO sheet OR an EQUIPE DO PROJETO hist sheet
  let hist: FormatCHistBlock | null = null;
  for (const ref of allSheets) {
    if (ref === curve.ref) continue;
    const h = findFormatCHistBlock(ref);
    if (h) { hist = h; break; }
  }
  if (!hasResumo && !hist) return null;
  const info = extractFormatCInfo(allSheets);
  return { curve, hist, info };
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

  // ===== DEBUG: varre TODAS as abas em busca dos blocos do Formato C =====
  console.log('[FormatoC] arquivo:', file.name, 'abas:', wb.SheetNames);

  let curvaSheetName: string | null = null;
  let histSheetName: string | null = null;
  let resumoSheetName: string | null = null;

  for (const s of sheets) {
    const rows = s.grid;
    const hasRealAcu = rows.some(r => r && String((r as unknown[])[0] ?? '').trim() === 'REALIZADO GERAL (ACUMULADO)');
    const hasEvento  = rows.some(r => r && String((r as unknown[])[0] ?? '').trim().startsWith('Evento'));
    if (!curvaSheetName && hasRealAcu && hasEvento) {
      curvaSheetName = s.sheetName;
      console.log('[FormatoC] aba Curva S encontrada =', s.sheetName);
    }
    const hasTotal = rows.some(r => (r as unknown[])?.some(v => v != null && String(v).includes('EQUIPE DO PROJETO - TOTAL')));
    if (!histSheetName && hasTotal) {
      histSheetName = s.sheetName;
      console.log('[FormatoC] aba Histograma encontrada =', s.sheetName);
    }
    if (!resumoSheetName && s.sheetName.toUpperCase().includes('RESUMO')) {
      resumoSheetName = s.sheetName;
      console.log('[FormatoC] aba Resumo encontrada =', s.sheetName);
    }
  }

  if (curvaSheetName) {
    const curvaRows = sheets.find(s => s.sheetName === curvaSheetName)!.grid as unknown[][];
    const labelMap: Record<string, number> = {};
    curvaRows.forEach((row, i) => {
      const v = row?.[0];
      if (v != null) {
        const k = String(v).trim();
        if (k && !(k in labelMap)) labelMap[k] = i;
      }
    });
    const ROW_DATES    = labelMap['Evento ( Cronograma)'] ?? labelMap['Evento (Cronograma)'] ?? -1;
    const ROW_PREV_ACU = labelMap['PREVISTO GERAL LB (ACUMULADO)'] ?? -1;
    const ROW_REAL_ACU = labelMap['REALIZADO GERAL (ACUMULADO)'] ?? -1;
    const ROW_REPL_ACU = labelMap['PREVISTO GERAL REPLANEJADO (ACUMULADO)'] ?? -1;
    const ROW_TEND_ACU = labelMap['TENDÊNCIA GERAL (ACUMULADO)'] ?? labelMap['TENDENCIA GERAL (ACUMULADO)'] ?? -1;
    console.log('[FormatoC] labelMap:', { ROW_DATES, ROW_PREV_ACU, ROW_REAL_ACU, ROW_REPL_ACU, ROW_TEND_ACU });

    let COL_START = -1;
    if (ROW_DATES >= 0) {
      (curvaRows[ROW_DATES] || []).forEach((v, j) => {
        if (j > 0 && COL_START < 0 && v instanceof Date) COL_START = j;
      });
    }
    console.log('[FormatoC] COL_START:', COL_START, 'data:', curvaRows[ROW_DATES]?.[COL_START]);

    let ULTIMA_REAL = -1;
    if (ROW_REAL_ACU >= 0) {
      (curvaRows[ROW_REAL_ACU] || []).forEach((v, j) => {
        if (j >= COL_START && typeof v === 'number' && v > 0) ULTIMA_REAL = j;
      });
    }
    console.log('[FormatoC] ULTIMA_REAL:', ULTIMA_REAL,
      'valor:', curvaRows[ROW_REAL_ACU]?.[ULTIMA_REAL],
      'data:', curvaRows[ROW_DATES]?.[ULTIMA_REAL]);
  } else {
    console.log('[FormatoC] aba Curva S NÃO encontrada. Abas:', wb.SheetNames);
  }
  // ===== fim debug =====


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
  formatC?: FormatCBundle | null;
  errors: string[];
}

const runImport = async (files: File[]): Promise<ImportResult> => {
  const scans = await Promise.all(files.map(scanFile));
  const allSheets = scans.flatMap(s => s.sheets);

  // Try FORMAT C first (Relatório Integrado: curve + hist em abas separadas + RESUMO)
  const formatC = detectFormatC(allSheets);
  if (formatC) {
    const curve = extractFormatCCurve(formatC.curve);
    const hist = formatC.hist ? extractFormatCHist(formatC.hist, formatC.curve) : null;
    const projectDates: ProjectDates = {
      inicio: formatC.info.inicio,
      terminoLB: formatC.info.terminoLB,
      terminoPrev: formatC.info.terminoPrev,
    };
    const errors: string[] = [];
    if ('error' in curve) errors.push(curve.error);
    return {
      curveBlock: null,
      curve,
      histBlock: hist?.block ?? null,
      hist,
      projectDates,
      formatB: null,
      formatC,
      errors,
    };
  }

  // Try FORMAT B (integrated curve + histogram in same sheet)
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
      formatC: null,
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

  return { curveBlock, curve, histBlock, hist, projectDates, formatB: null, formatC: null, errors };
};

// ─── Curva S Financeira (aba "02-CURVA S- FINANCEIRA") ───
const parseFinancialCurve = async (file: File): Promise<CurvaSFinanceiraPoint[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  // STEP 1 — find sheet
  const normSheet = (s: string) => s.trim().replace(/\.$/, '').toUpperCase();
  const candidates = wb.SheetNames.filter(n => {
    const nn = normSheet(n);
    return nn.includes('CURVA') && nn.includes('FINANC') && !nn.includes('BI') && !nn.includes('REPLAN');
  });
  const sheetName = candidates.find(n => normSheet(n).includes('02')) || candidates[0];
  if (!sheetName) throw new Error('Aba "CURVA S FINANCEIRA" não encontrada');

  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });

  // STEP 2 — find rows by column A content (case-insensitive substring)
  let rDates = -1, rPrev = -1, rReal = -1, rPrevAcum = -1, rRealAcum = -1;
  grid.forEach((row, i) => {
    const a = row?.[0];
    if (a == null) return;
    const t = String(a);
    const has = (s: string) => t.toLowerCase().includes(s.toLowerCase());
    if (rDates === -1 && has('Evento de Pagamento')) rDates = i;
    if (rPrevAcum === -1 && has('Prevista Acumulada')) rPrevAcum = i;
    if (rRealAcum === -1 && has('Real Acumulada')) rRealAcum = i;
    if (rPrev === -1 && has('Medição Prevista') && !has('Acumulada') && !has('Replanej')) rPrev = i;
    if (rReal === -1 && has('Medição Real') && !has('Acumulada')) rReal = i;
  });

  if (rDates === -1) throw new Error('Linha "Evento de Pagamento" não encontrada');

  const dateRow = (grid[rDates] || []) as unknown[];
  const getRow = (r: number) => (r >= 0 ? (grid[r] || []) : []) as unknown[];
  const prevRow = getRow(rPrev);
  const realRow = getRow(rReal);
  const prevAcumRow = getRow(rPrevAcum);
  const realAcumRow = getRow(rRealAcum);

  // STEP 3 — extract values
  const num = (v: unknown): number => {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
      return isFinite(n) ? n : 0;
    }
    return 0;
  };
  const isValidDateCell = (v: unknown) =>
    v instanceof Date || (typeof v === 'string' && v.trim() !== '') || typeof v === 'number';

  const out: CurvaSFinanceiraPoint[] = [];
  for (let c = 1; c < dateRow.length; c++) {
    const raw = dateRow[c];
    if (!isValidDateCell(raw)) break;
    const d = toDate(raw);
    if (!d) continue;
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      previsto: num(prevRow[c]),
      real: num(realRow[c]),
      prevAcum: num(prevAcumRow[c]),
      realAcum: num(realAcumRow[c]),
    });
  }

  // STEP 4 — debug
  console.log('[CurvaSFinanceira]', {
    sheet: sheetName,
    rows: { rDates, rPrev, rReal, rPrevAcum, rRealAcum },
    count: out.length,
    firstThreePrevAcum: out.slice(0, 3).map(o => o.prevAcum),
  });
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WeeklyImportModal({ open, onOpenChange }: Props) {
  const { setSCurveData, setWeeklyData, setMonthData, setHistogramData, setScheduleData, setCurvaSFinanceira, setLastImport, setStatusDateIndex, setInfo, projects, selectedProjectId } = useProjectStore();
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [step, setStep] = useState<'upload' | 'fields'>('upload');

  const [result, setResult] = useState<ImportResult | null>(null);
  const [schedule, setSchedule] = useState<ScheduleExtract | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [finCurve, setFinCurve] = useState<CurvaSFinanceiraPoint[] | null>(null);
  const [finCurveError, setFinCurveError] = useState<string | null>(null);
  const [sourceNames, setSourceNames] = useState<{ curve?: string; hist?: string; schedule?: string; finCurve?: string }>({});

  const reset = () => {
    setFiles([]);
    setResult(null); setSchedule(null); setScheduleError(null);
    setFinCurve(null); setFinCurveError(null);
    setSourceNames({});
  };

  const closeAll = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(() => { reset(); setStep('upload'); }, 300);
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name + ':' + f.size));
      const merged = [...prev];
      for (const f of arr) {
        const key = f.name + ':' + f.size;
        if (!seen.has(key)) { merged.push(f); seen.add(key); }
      }
      return merged;
    });
  };

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  const analyze = useCallback(async () => {
    if (!files.length) return;
    setParsing(true);
    setResult(null); setSchedule(null); setScheduleError(null);
    setFinCurve(null); setFinCurveError(null);
    setSourceNames({});

    const xmls = files.filter(f => /\.xml$/i.test(f.name));
    const xlsxs = files.filter(f => /\.xlsx?$/i.test(f.name));
    const used = new Set<string>();
    const srcs: { curve?: string; hist?: string; schedule?: string; finCurve?: string } = {};

    // 1) Curva S / Histograma (formatos A/B/C) — em todos os xlsx
    let res: ImportResult | null = null;
    if (xlsxs.length) {
      try { res = await runImport(xlsxs); }
      catch (e) { res = { curveBlock: null, curve: null, histBlock: null, hist: null, projectDates: {}, formatC: null, errors: [(e as Error).message] }; }
    }
    if (res) {
      const cb = res.curveBlock || res.formatB || res.formatC?.curve;
      if (cb) { used.add(cb.ref.fileName); srcs.curve = cb.ref.fileName; }
      if (res.histBlock) { used.add(res.histBlock.ref.fileName); srcs.hist = res.histBlock.ref.fileName; }
    }

    // 2) Curva S Financeira — xlsx restantes
    let fin: CurvaSFinanceiraPoint[] | null = null;
    for (const f of xlsxs) {
      if (used.has(f.name)) continue;
      try {
        const rows = await parseFinancialCurve(f);
        if (rows.length) { fin = rows; used.add(f.name); srcs.finCurve = f.name; break; }
      } catch { /* not a financial sheet */ }
    }

    // 3) Cronograma — todos xml + xlsx restantes
    const schedCandidates = [...xmls, ...xlsxs.filter(f => !used.has(f.name))];
    let sched: ScheduleExtract | null = null;
    let lastErr: string | null = null;
    for (const f of schedCandidates) {
      try {
        const ex = await parseScheduleFile(f);
        if (ex.rows.length) { sched = ex; srcs.schedule = f.name; break; }
      } catch (e) { lastErr = (e as Error).message; }
    }
    if (!sched && lastErr && schedCandidates.length) setScheduleError(lastErr);

    setResult(res);
    setFinCurve(fin);
    setSchedule(sched);
    setSourceNames(srcs);

    // Pré-marcar campos disponíveis
    const localC = res?.curve && !('error' in res.curve) ? (res.curve as CurveExtract) : null;
    const localH = res?.hist && !('error' in res.hist) ? (res.hist as HistExtract) : null;
    const weeklyOk = !!localC && localC.weekly.length > 0 && (() => {
      const upTo = localC.cols.slice(0, localC.ultimaReal + 1).slice(-8);
      return upTo.filter(col => col.prevSem > 0.005 || col.realSem > 0.005).length >= 3;
    })();
    setSelectedFields({
      sCurve: !!(localC && localC.sCurve.length),
      weekly: weeklyOk,
      monthly: !!(localC && localC.monthly.length),
      projectInfo: !!localC,
      histogram: !!(localH && localH.histogram.length),
      schedule: !!(sched && sched.rows.length),
      finCurve: !!(fin && fin.length),
    });

    setParsing(false);
  }, [files]);

  const curveOk = result?.curve && !('error' in result.curve);
  const histOk = result?.hist && !('error' in result.hist);

  // ─── Field selection (segunda etapa) ───
  type FieldKey = 'sCurve' | 'weekly' | 'monthly' | 'histogram' | 'schedule' | 'finCurve' | 'projectInfo';
  const FIELD_LABELS: Record<FieldKey, string> = {
    sCurve: 'Curva S — Previsto / Real / Tendência',
    weekly: 'Resultado Semanal (evolução semanal %)',
    monthly: 'Prev × Mês (velocímetro mensal)',
    histogram: 'Histograma (barras de avanço por semana)',
    schedule: 'Cronograma (Gantt)',
    finCurve: 'Curva S Financeira — Previsto / Real Acumulado',
    projectInfo: 'Informações do Projeto (avanços, datas, cliente)',
  };
  const FIELD_SOURCE: Record<FieldKey, string | undefined> = {
    sCurve: sourceNames.curve,
    weekly: sourceNames.curve,
    monthly: sourceNames.curve,
    projectInfo: sourceNames.curve,
    histogram: sourceNames.hist || sourceNames.curve,
    schedule: sourceNames.schedule,
    finCurve: sourceNames.finCurve,
  };

  const c = curveOk ? (result!.curve as CurveExtract) : null;
  const weeklyValido = (() => {
    if (!c || !c.weekly.length) return false;
    const upTo = c.cols.slice(0, c.ultimaReal + 1).slice(-8);
    return upTo.filter(col => col.prevSem > 0.005 || col.realSem > 0.005).length >= 3;
  })();

  const available: Record<FieldKey, boolean> = {
    sCurve: !!(c && c.sCurve.length),
    weekly: !!(c && c.weekly.length && weeklyValido),
    monthly: !!(c && c.monthly.length),
    projectInfo: !!c,
    histogram: !!(histOk && (result!.hist as HistExtract).histogram.length),
    schedule: !!(schedule && schedule.rows.length),
    finCurve: !!(finCurve && finCurve.length),
  };

  const [selectedFields, setSelectedFields] = useState<Record<FieldKey, boolean>>({
    sCurve: false, weekly: false, monthly: false, histogram: false,
    schedule: false, finCurve: false, projectInfo: false,
  });

  const advance = async () => {
    await analyze();
    setStep('fields');
  };

  const goBack = () => setStep('upload');

  const toggleField = (k: FieldKey) => {
    if (!available[k]) return;
    setSelectedFields(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const anyFieldChecked = (Object.keys(available) as FieldKey[])
    .some(k => available[k] && selectedFields[k]);


  const confirm = () => {
    const now = new Date().toISOString();
    let count = 0;
    const currentInfo = projects.find(p => p.id === selectedProjectId)?.info;
    const infoPatch: Record<string, string | number> = {};
    if (curveOk) {
      const c = result!.curve as CurveExtract;
      if (c.sCurve.length && selectedFields.sCurve) {
        setSCurveData(c.sCurve);
        let idx = -1;
        c.sCurve.forEach((p, i) => { if (p.real > 0) idx = i; });
        if (idx >= 0) setStatusDateIndex(idx);
        setLastImport('sCurve', now); count++;
      }
      if (c.weekly.length && weeklyValido && selectedFields.weekly) {
        setWeeklyData(c.weekly); setLastImport('weekly', now); count++;
      }
      if (c.monthly.length && selectedFields.monthly) {
        setMonthData(c.monthly); setLastImport('month', now); count++;
      }
      if (selectedFields.projectInfo) {
        const updateDate = result?.formatC?.curve.updateDate ?? result?.formatB?.updateDate ?? c.statusDate;
        infoPatch.atualizadoEm = toIsoDate(updateDate);
        infoPatch.avancoPrev = c.prevAcuLast;
        infoPatch.avancoReal = c.realAcuLast;
      }
    }
    if (histOk && selectedFields.histogram) {
      const h = result!.hist as HistExtract;
      if (h.histogram.length) { setHistogramData(h.histogram); setLastImport('histogram', now); count++; }
    }
    if (selectedFields.projectInfo) {
      const pd = result?.projectDates;
      if (pd && currentInfo) {
        if (pd.inicio && !currentInfo.inicio) infoPatch.inicio = toIsoDate(pd.inicio);
        if (pd.terminoLB && !currentInfo.terminoLB) infoPatch.terminoLB = toIsoDate(pd.terminoLB);
        if (pd.terminoPrev && !currentInfo.terminoPrev) infoPatch.terminoPrev = toIsoDate(pd.terminoPrev);
      }
      const fcInfo = result?.formatC?.info;
      if (fcInfo && currentInfo) {
        if (fcInfo.projeto && !currentInfo.projeto) infoPatch.projeto = fcInfo.projeto;
        if (fcInfo.cliente && !currentInfo.cliente) infoPatch.cliente = fcInfo.cliente;
        if (fcInfo.gestor && !currentInfo.gestor) infoPatch.gestor = fcInfo.gestor;
      }
    }

    if (Object.keys(infoPatch).length) { setInfo(infoPatch); if (!count) count++; }
    if (schedule && schedule.rows.length && selectedFields.schedule) {
      setScheduleData(schedule.rows.map(r => ({ ...r, bold: r.bold ?? false, criticalPath: false })));
      count++;
    }
    if (finCurve && finCurve.length && selectedFields.finCurve) {
      setCurvaSFinanceira(finCurve);
      setLastImport('curvaSFinanceira', now);
      count++;
    }
    toast.success(`✓ Importação concluída — ${count} seções atualizadas`);
    closeAll(false);
  };

  return (
    <Dialog open={open} onOpenChange={closeAll}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Importação Semanal
          </DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Suba seus arquivos — o sistema identifica o conteúdo de cada um automaticamente'
              : 'Marque os campos que deseja sobrescrever. Campos desmarcados manterão os dados atuais.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <MultiUploadZone files={files} onAdd={addFiles} onRemove={removeFile} />

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando arquivos...
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => closeAll(false)}>Cancelar</Button>
              <Button
                onClick={advance}
                disabled={!files.length || parsing}
                className="gradient-primary text-primary-foreground"
              >
                Avançar — Analisar Arquivos
              </Button>
            </div>
          </div>
        )}

        {step === 'fields' && (
          <FieldsStep
            files={files}
            available={available}
            selectedFields={selectedFields}
            toggleField={toggleField}
            FIELD_LABELS={FIELD_LABELS}
            FIELD_SOURCE={FIELD_SOURCE}
            anyFieldChecked={anyFieldChecked}
            onBack={goBack}
            onCancel={() => closeAll(false)}
            onConfirm={confirm}
            result={result}
            scheduleError={scheduleError}
            finCurveError={finCurveError}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Multi-file Upload Zone ───
function MultiUploadZone({
  files, onAdd, onRemove,
}: { files: File[]; onAdd: (f: FileList | File[]) => void; onRemove: (i: number) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
        }}
        className={`block border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.xml"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) onAdd(e.target.files); e.currentTarget.value = ''; }}
        />
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="font-semibold text-sm text-foreground">
            Arraste os arquivos ou clique para selecionar
          </div>
          <div className="text-xs text-muted-foreground">
            O sistema identifica automaticamente o conteúdo de cada arquivo
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Aceita .xlsx e .xml — múltiplos arquivos
          </div>
        </div>
      </label>

      {files.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            {files.length} arquivo{files.length > 1 ? 's' : ''} selecionado{files.length > 1 ? 's' : ''}
          </div>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-card border rounded px-2.5 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="flex-1 truncate font-medium text-foreground">{f.name}</span>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fields Step ───
type FieldKeyT = 'sCurve' | 'weekly' | 'monthly' | 'histogram' | 'schedule' | 'finCurve' | 'projectInfo';
function FieldsStep({
  files, available, selectedFields, toggleField, FIELD_LABELS, FIELD_SOURCE,
  anyFieldChecked, onBack, onCancel, onConfirm,
  result, scheduleError, finCurveError,
}: {
  files: File[];
  available: Record<FieldKeyT, boolean>;
  selectedFields: Record<FieldKeyT, boolean>;
  toggleField: (k: FieldKeyT) => void;
  FIELD_LABELS: Record<FieldKeyT, string>;
  FIELD_SOURCE: Record<FieldKeyT, string | undefined>;
  anyFieldChecked: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  result: ImportResult | null;
  scheduleError: string | null;
  finCurveError: string | null;
}) {

  const allMissing = !(Object.keys(available) as FieldKeyT[]).some(k => available[k]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Selecionar campos a importar</h3>
          <span className="text-[11px] text-muted-foreground">
            {files.length} arquivo{files.length > 1 ? 's' : ''} analisado{files.length > 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Campos detectados vêm marcados. Desmarque os que não deseja sobrescrever — eles manterão os dados atuais.
          Campos não detectados aparecem desabilitados.
        </p>

        {allMissing && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Nenhum conteúdo reconhecido nos arquivos enviados.
          </div>
        )}

        {result?.errors?.map((e, i) => (
          <div key={i} className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {e}
          </div>
        ))}
        {scheduleError && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Cronograma: {scheduleError}
          </div>
        )}
        {finCurveError && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Curva S Financeira: {finCurveError}
          </div>
        )}

        <div className="space-y-2 pt-1">
          {(Object.keys(FIELD_LABELS) as FieldKeyT[]).map((k) => {
            const isAvailable = available[k];
            const checked = !!selectedFields[k] && isAvailable;
            const src = FIELD_SOURCE[k];
            return (
              <label
                key={k}
                className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
                  isAvailable
                    ? 'border-border bg-card hover:bg-muted/50 cursor-pointer'
                    : 'border-border/50 bg-muted/20 opacity-50 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={!isAvailable}
                  onChange={() => toggleField(k)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{FIELD_LABELS[k]}</span>
                    {isAvailable && src && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-primary/10 text-primary truncate max-w-[260px]">
                        {src}
                      </span>
                    )}
                    {!isAvailable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-muted text-muted-foreground">
                        não detectado
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!anyFieldChecked} className="gradient-primary text-primary-foreground">
            Confirmar Importação
          </Button>
        </div>
      </div>
    </div>
  );
}

