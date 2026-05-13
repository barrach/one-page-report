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
interface ScheduleExtract { rows: ScheduleRow[]; format: ScheduleFormat; }

const parseScheduleXML = (text: string): ScheduleRow[] => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
  const tasks = Array.from(doc.getElementsByTagName('Task'));
  const rows: ScheduleRow[] = [];
  for (const t of tasks) {
    const get = (tag: string) => {
      const el = Array.from(t.children).find(c => c.tagName === tag);
      return el?.textContent ?? '';
    };
    if (get('UID') === '0') continue;
    const name = get('Name');
    if (!name) continue;
    const pc = parseFloat(get('PercentComplete')) || 0;
    const pwc = parseFloat(get('PercentWorkComplete')) || 0;
    const fd = (s: string) => {
      if (!s || s === 'NA') return '';
      const d = parseAnyDate(s);
      return d ? fmtScheduleDate(d) : '';
    };
    const fdBaseline = (s: string) => {
      if (!s || s === 'NA') return 'ND';
      const d = parseAnyDate(s);
      if (!d) return 'ND';
      // MS Project uses year 1984 for "NA" baseline
      if (d.getFullYear() < 1990) return 'ND';
      return fmtScheduleDate(d);
    };
    const outlineLevel = parseInt(get('OutlineLevel')) || 1;
    const summary = get('Summary') === '1';
    const milestone = get('Milestone') === '1';
    const outlineNumber = get('OutlineNumber') || '';
    rows.push({
      id: get('ID'),
      tarefa: name,
      previsto: pc,
      trabalhoConcluido: pwc,
      desvio: Math.round((pc - pwc) * 100) / 100,
      inicio: fd(get('Start')),
      termino: fd(get('Finish')),
      inicioBase: fdBaseline(get('BaselineStart')),
      terminoBase: fdBaseline(get('BaselineFinish')),
      outlineLevel,
      outlineNumber,
      summary,
      milestone,
      bold: summary || outlineLevel <= 2,
    });
  }
  return rows;
};

const parseScheduleXLSX = (buf: ArrayBuffer): ScheduleRow[] => {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });
    for (let i = 0; i < Math.min(grid.length, 5); i++) {
      const row = grid[i] || [];
      const idx: Record<string, number> = {};
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell !== 'string') continue;
        const n = cell.trim().toLowerCase();
        if (idx.id == null && /^\s*id\s*$/.test(n)) idx.id = c;
        if (idx.tarefa == null && /(nome|tarefa|task)/.test(n)) idx.tarefa = c;
        if (idx.previsto == null && /(%\s*conc|prev|f[ií]sico)/.test(n)) idx.previsto = c;
        if (idx.trabalhoConcluido == null && /(%\s*trab|work)/.test(n)) idx.trabalhoConcluido = c;
        if (idx.desvio == null && /(desvio|variance)/.test(n)) idx.desvio = c;
        if (idx.inicioBase == null && /base/.test(n) && /(in[ií]cio|start)/.test(n)) idx.inicioBase = c;
        else if (idx.inicio == null && /(in[ií]cio|start)/.test(n)) idx.inicio = c;
        if (idx.terminoBase == null && /base/.test(n) && /(t[eé]rmino|finish)/.test(n)) idx.terminoBase = c;
        else if (idx.termino == null && /(t[eé]rmino|finish)/.test(n)) idx.termino = c;
      }
      if (idx.tarefa == null || Object.keys(idx).length < 3) continue;
      const out: ScheduleRow[] = [];
      for (let r = i + 1; r < grid.length; r++) {
        const rr = grid[r] || [];
        const tarefa = rr[idx.tarefa];
        if (tarefa == null || String(tarefa).trim() === '') continue;
        const cell = (k: string) => idx[k] != null ? rr[idx[k]] : null;
        const num = (v: unknown) => {
          if (typeof v === 'number') return v <= 1 && v > 0 ? v * 100 : v;
          if (typeof v === 'string') { const n = parseFloat(v.replace(',', '.')); return isFinite(n) ? n : 0; }
          return 0;
        };
        const fd = (v: unknown) => { const d = parseAnyDate(v); return d ? fmtScheduleDate(d) : ''; };
        out.push({
          id: String(cell('id') ?? '').trim(),
          tarefa: String(tarefa).trim(),
          previsto: num(cell('previsto')),
          trabalhoConcluido: num(cell('trabalhoConcluido')),
          desvio: num(cell('desvio')),
          inicio: fd(cell('inicio')),
          termino: fd(cell('termino')),
          inicioBase: fd(cell('inicioBase')),
          terminoBase: fd(cell('terminoBase')),
        });
      }
      if (out.length) return out;
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
  return { rows: parseScheduleXLSX(buf), format: 'xlsx' };
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

  const wStart = Math.max(0, ultimaReal - 4);
  const weekly = cols.slice(wStart, ultimaReal + 1).map(c => ({
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

  return { block, cols, ultimaReal, statusDate: cols[ultimaReal].date, realAcuLast: round2(cols[ultimaReal].realAcu * 100), hasReplanejado, sCurve, weekly, monthly };
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
  errors: string[];
}

const runImport = async (files: File[]): Promise<ImportResult> => {
  const scans = await Promise.all(files.map(scanFile));
  const allSheets = scans.flatMap(s => s.sheets);

  // Identify CURVA_GERAL — best block across all sheets (most realAcu>0 cols)
  const curveBlock: CurveBlock | null = findBestCurveBlock(allSheets);

  // Identify HISTOGRAMA — pick max realCount
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

  return { curveBlock, curve, histBlock, hist, projectDates, errors };
};

interface UploadZoneProps {
  label: string;
  subtitle?: string;
  badge?: { text: string; variant: 'required' | 'optional' };
  accept?: string;
  status: 'idle' | 'loaded';
  fileName?: string;
  onFile: (f: File) => void;
}

const UploadZone = ({ label, subtitle, badge, accept = '.xlsx', status, fileName, onFile }: UploadZoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex-1 cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-colors relative ${
        dragOver ? 'border-primary bg-primary/5' :
        status === 'loaded' ? 'border-success bg-success/5' :
        'border-border hover:border-primary/50'
      }`}
    >
      {badge && (
        <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          badge.variant === 'optional'
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary/10 text-primary'
        }`}>{badge.text}</span>
      )}
      <input type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="flex flex-col items-center gap-2">
        {status === 'loaded'
          ? <CheckCircle2 className="h-8 w-8 text-success" />
          : <Upload className="h-8 w-8 text-muted-foreground" />}
        <div className="font-semibold text-sm text-foreground">{label}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        <div className="text-xs">
          {status === 'loaded' && fileName
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
    const infoPatch: Record<string, string> = {};
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
      // Status date is the source of truth for "atualizadoEm" — always update
      infoPatch.atualizadoEm = toIsoDate(c.statusDate);
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
          <UploadZone label="Arquivo 1 — Curva S (.xlsx)" badge={{ text: 'Obrigatório', variant: 'required' }} status={file1 ? 'loaded' : 'idle'} fileName={file1?.name} onFile={onFile1} />
          <UploadZone label="Arquivo 2 — Histograma MOD (.xlsx)" badge={{ text: 'Obrigatório', variant: 'required' }} status={file2 ? 'loaded' : 'idle'} fileName={file2?.name} onFile={onFile2} />
          <UploadZone
            label="Arquivo 3 — Cronograma (.xml ou .xlsx)"
            subtitle="Opcional — MS Project: Arquivo → Salvar Como → XML"
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
                    <div className="font-medium text-foreground">📊 Curva S / Semanal / Prev x Mês (CURVA_GERAL)</div>
                    {!result.curveBlock ? (
                      <div className="pl-4 text-destructive">Aba não identificada</div>
                    ) : (
                      <div className="pl-4 space-y-1">
                        <div className="text-muted-foreground">
                          Arquivo: <span className="font-mono text-foreground">{result.curveBlock.ref.fileName}</span> ·
                          Aba: <span className="font-mono text-foreground">{result.curveBlock.ref.sheetName}</span>
                        </div>
                        <div>{(Object.keys(CURVE_HUMAN) as CurveKey[]).map(k => chip(CURVE_HUMAN[k], !!result.curveBlock!.pos[k]))}</div>
                        {result.curve && ('error' in result.curve ? (
                          <div className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{result.curve.error}</div>
                        ) : (() => {
                          const c = result.curve as CurveExtract;
                          const sd = c.statusDate;
                          const sdFull = `${String(sd.getDate()).padStart(2, '0')}/${MONTHS_PT[sd.getMonth()]}/${sd.getFullYear()}`;
                          const realStr = c.realAcuLast.toFixed(2).replace('.', ',');
                          return (
                            <>
                              <div className="rounded bg-success/10 border border-success/30 px-2 py-1 text-foreground">
                                <div>📅 <strong>Data de Status detectada:</strong> {sdFull}</div>
                                <div>Última semana com Real: <strong>{fmtDDmmm(sd)}</strong> ({realStr}%)</div>
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
                        {result.curve && !('error' in result.curve) === false && (
                          <div className="rounded bg-warning/10 border border-warning/30 px-2 py-1 text-warning-foreground text-xs">
                            ⚠ Data de status não encontrada — verifique se o arquivo contém dados reais.
                          </div>
                        )}
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
                    <div className="pl-4 text-muted-foreground">
                      Cronograma: <span className="font-semibold text-foreground">{schedule.rows.length}</span> tarefas encontradas
                      {' · '}formato: <span className="font-mono text-foreground">{schedule.format === 'xml' ? 'XML do Project' : 'Excel'}</span>
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
