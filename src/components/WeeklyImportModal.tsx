import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { toast } from 'sonner';

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const formatDDmmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${MONTHS_PT[d.getMonth()]}`;
const excelSerialToDate = (s: number) => new Date(Math.round((s - 25569) * 86400 * 1000));
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const parseDateCell = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v > 1000) return excelSerialToDate(v);
  return null;
};

interface CurveDetect {
  sheet: string;
  labelsFound: Record<string, boolean>;
  missing: string[];
  weeks: number;
  currentWeek: string;
  lastReal: string;
  sCurve: { date: string; previsto: number; real: number; tendencia: number }[];
  weekly: { date: string; previsto: number; real: number }[];
  monthly: { label: string; previsto: number; real: number }[];
}

interface HistDetect {
  sheet: string;
  labelsFound: Record<string, boolean>;
  missing: string[];
  weeks: number;
  lastReal: string;
  histogram: { date: string; semana: string; previsto: number; real: number }[];
}

const CURVE_LABELS: Record<string, string> = {
  data: 'data de corte',
  prevAcum: 'prev. acum. %',
  realAcum: 'real. acum. %',
  tendAcum: 'tend. acum. %',
  prev: 'prev. %',
  real: 'real. %',
};
const CURVE_LABEL_HUMAN: Record<string, string> = {
  data: 'Data de Corte',
  prevAcum: 'Prev. Acum. %',
  realAcum: 'Real. Acum. %',
  tendAcum: 'Tend. Acum. %',
  prev: 'Prev. %',
  real: 'Real. %',
};

const HIST_LABEL_HUMAN: Record<string, string> = {
  dia: 'Dia',
  prev: 'TOTAL PREVISTA',
  real: 'TOTAL REAL',
};

const parseCurveFile = async (file: File): Promise<CurveDetect | { error: string }> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => norm(n) === norm('Curva S - Geral Projeto'));
  if (!sheetName) return { error: "Aba 'Curva S - Geral Projeto' não encontrada" };
  const data: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });

  const found: Record<string, { row: number; col: number }> = {};
  data.forEach((r, ri) => {
    r?.forEach((cell, ci) => {
      const n = norm(cell);
      for (const [k, label] of Object.entries(CURVE_LABELS)) {
        if (n === label && !found[k]) found[k] = { row: ri, col: ci };
      }
    });
  });

  const labelsFound: Record<string, boolean> = {};
  Object.keys(CURVE_LABELS).forEach(k => { labelsFound[k] = !!found[k]; });
  const missing = Object.keys(CURVE_LABELS).filter(k => !found[k]).map(k => CURVE_LABEL_HUMAN[k]);

  if (!found.data) {
    return { error: `Labels não encontrados: ${missing.join(', ')}` };
  }

  const dateRow = data[found.data.row] || [];
  const startCol = found.data.col + 1;
  const num = (v: unknown) => (typeof v === 'number' ? v * 100 : 0);

  const cols: { date: string; dateObj: Date; previsto: number; real: number; tendencia: number; prev: number; realW: number }[] = [];
  for (let c = startCol; c < dateRow.length; c++) {
    const d = parseDateCell(dateRow[c]);
    if (!d) continue;
    cols.push({
      date: formatDDmmm(d),
      dateObj: d,
      previsto: found.prevAcum ? num((data[found.prevAcum.row] || [])[c]) : 0,
      real: found.realAcum ? num((data[found.realAcum.row] || [])[c]) : 0,
      tendencia: found.tendAcum ? num((data[found.tendAcum.row] || [])[c]) : 0,
      prev: found.prev ? num((data[found.prev.row] || [])[c]) : 0,
      realW: found.real ? num((data[found.real.row] || [])[c]) : 0,
    });
  }

  // S-Curve: last 8 with previsto (acum) > 0
  const sCurveCols = cols.filter(c => c.previsto > 0).slice(-8);
  const sCurve = sCurveCols.map(c => ({ date: c.date, previsto: c.previsto, real: c.real, tendencia: c.tendencia }));

  // Weekly: last 5 with prev (semanal) > 0
  const weeklyCols = cols.filter(c => c.prev > 0).slice(-5);
  const weekly = weeklyCols.map(c => ({ date: c.date, previsto: c.prev, real: c.realW }));

  // Monthly: group by year-month, last per month, last 4
  const byMonth = new Map<string, { date: Date; previsto: number; real: number }>();
  for (const c of cols) {
    if (c.previsto <= 0) continue;
    const key = `${c.dateObj.getFullYear()}-${String(c.dateObj.getMonth()).padStart(2, '0')}`;
    byMonth.set(key, { date: c.dateObj, previsto: c.previsto, real: c.real });
  }
  const monthly = [...byMonth.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-4)
    .map(m => ({
      label: `${MONTHS_PT[m.date.getMonth()]}/${String(m.date.getFullYear()).slice(-2)}`,
      previsto: m.previsto,
      real: m.real,
    }));

  // Current week & last real
  let lastRealCol = cols.filter(c => c.real > 0).slice(-1)[0];
  const currentWeek = cols.length ? cols[cols.length - 1].date : '—';
  const lastReal = lastRealCol ? lastRealCol.date : '—';

  return {
    sheet: sheetName,
    labelsFound,
    missing,
    weeks: cols.length,
    currentWeek,
    lastReal,
    sCurve,
    weekly,
    monthly,
  };
};

const parseHistFile = async (file: File): Promise<HistDetect | { error: string }> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  let sheetName = wb.SheetNames.find(n => /frigo\+spci/i.test(n));
  if (!sheetName) sheetName = wb.SheetNames.find(n => /histogr/i.test(n));
  if (!sheetName) sheetName = wb.SheetNames[0];
  if (!sheetName) return { error: 'Nenhuma aba encontrada' };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });

  const found: { dia?: { row: number; col: number }; prev?: { row: number; col: number }; real?: { row: number; col: number } } = {};
  rows.forEach((r, ri) => {
    r?.forEach((cell, ci) => {
      const n = norm(cell);
      if (!found.dia && n === 'dia') found.dia = { row: ri, col: ci };
      if (!found.prev && n.includes('total prevista')) found.prev = { row: ri, col: ci };
      if (!found.real && n.includes('total real')) found.real = { row: ri, col: ci };
    });
  });
  const labelsFound = { dia: !!found.dia, prev: !!found.prev, real: !!found.real };
  const missing = (Object.keys(HIST_LABEL_HUMAN) as (keyof typeof HIST_LABEL_HUMAN)[])
    .filter(k => !labelsFound[k]).map(k => HIST_LABEL_HUMAN[k]);

  if (!found.dia || !found.prev || !found.real) {
    return { error: `Labels não encontrados: ${missing.join(', ')}` };
  }

  const diaRow = rows[found.dia.row] || [];
  const prevRow = rows[found.prev.row] || [];
  const realRow = rows[found.real.row] || [];

  let startCol = -1;
  for (let c = found.dia.col + 1; c < diaRow.length; c++) {
    if (parseDateCell(diaRow[c])) { startCol = c; break; }
  }
  if (startCol < 0) return { error: 'Nenhuma data encontrada na linha "Dia"' };

  type Col = { date: string; dateObj: Date; previsto: number; real: number };
  const cols: Col[] = [];
  for (let c = startCol; c < diaRow.length; c++) {
    const d = parseDateCell(diaRow[c]);
    if (!d) continue;
    const num = (v: unknown) => (typeof v === 'number' ? v : 0);
    cols.push({ date: formatDDmmm(d), dateObj: d, previsto: num(prevRow[c]), real: num(realRow[c]) });
  }

  const today = new Date();
  const filtered = cols.filter(c => !(c.dateObj.getTime() > today.getTime() && c.real === 0 && c.previsto === 0));

  let lastRealIdx = -1;
  filtered.forEach((c, i) => { if (c.real > 0) lastRealIdx = i; });

  let result: Col[];
  if (lastRealIdx >= 0) {
    const past = filtered.slice(Math.max(0, lastRealIdx - 5), lastRealIdx + 1);
    const futureCandidates = filtered.slice(lastRealIdx + 1).filter(c => c.previsto > 0).slice(0, 4);
    result = [...past, ...futureCandidates];
  } else {
    result = filtered.filter(c => c.previsto > 0).slice(0, 10);
  }

  const histogram = result.map(c => ({ date: c.date, semana: '', previsto: c.previsto, real: c.real }));
  const lastReal = lastRealIdx >= 0 ? filtered[lastRealIdx].date : '—';
  return { sheet: sheetName, labelsFound, missing, weeks: histogram.length, lastReal, histogram };
};

interface UploadZoneProps {
  label: string;
  expected: string;
  status: 'idle' | 'loaded' | 'error';
  fileName?: string;
  onFile: (f: File) => void;
}

const UploadZone = ({ label, expected, status, fileName, onFile }: UploadZoneProps) => {
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
      className={`flex-1 cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        dragOver ? 'border-primary bg-primary/5' :
        status === 'loaded' ? 'border-success bg-success/5' :
        status === 'error' ? 'border-destructive bg-destructive/5' :
        'border-border hover:border-primary/50'
      }`}
    >
      <input type="file" accept=".xlsx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="flex flex-col items-center gap-2">
        {status === 'loaded' ? <CheckCircle2 className="h-8 w-8 text-success" /> :
          status === 'error' ? <AlertCircle className="h-8 w-8 text-destructive" /> :
          <Upload className="h-8 w-8 text-muted-foreground" />}
        <div className="font-semibold text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{expected}</div>
        <div className="text-xs mt-1">
          {status === 'loaded' && fileName ? <span className="text-success font-medium">✓ {fileName}</span> :
            status === 'error' ? <span className="text-destructive">Erro ao ler</span> :
            <span className="text-muted-foreground">Aguardando arquivo .xlsx</span>}
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
  const { setSCurveData, setWeeklyData, setMonthData, setHistogramData, setLastImport, setStatusDateIndex } = useProjectStore();
  const [curveFile, setCurveFile] = useState<File | null>(null);
  const [histFile, setHistFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [curveResult, setCurveResult] = useState<CurveDetect | { error: string } | null>(null);
  const [histResult, setHistResult] = useState<HistDetect | { error: string } | null>(null);

  const reset = () => {
    setCurveFile(null); setHistFile(null); setCurveResult(null); setHistResult(null);
  };

  const onCurve = useCallback(async (f: File) => {
    setCurveFile(f); setParsing(true);
    try { setCurveResult(await parseCurveFile(f)); } catch (e) { setCurveResult({ error: (e as Error).message }); }
    setParsing(false);
  }, []);

  const onHist = useCallback(async (f: File) => {
    setHistFile(f); setParsing(true);
    try { setHistResult(await parseHistFile(f)); } catch (e) { setHistResult({ error: (e as Error).message }); }
    setParsing(false);
  }, []);

  const curveOk = curveResult && !('error' in curveResult);
  const histOk = histResult && !('error' in histResult);

  const confirm = () => {
    const now = new Date().toISOString();
    let count = 0;
    if (curveOk) {
      const c = curveResult as CurveDetect;
      if (c.sCurve.length) {
        setSCurveData(c.sCurve);
        let statusIdx = -1;
        c.sCurve.forEach((p, i) => { if (p.real > 0) statusIdx = i; });
        if (statusIdx >= 0) setStatusDateIndex(statusIdx);
        setLastImport('sCurve', now); count++;
      }
      if (c.weekly.length) { setWeeklyData(c.weekly); setLastImport('weekly', now); count++; }
      if (c.monthly.length) { setMonthData(c.monthly); setLastImport('month', now); count++; }
    }
    if (histOk) {
      const h = histResult as HistDetect;
      if (h.histogram.length) { setHistogramData(h.histogram); setLastImport('histogram', now); count++; }
    }
    toast.success(`✓ Importação concluída — ${count} seções atualizadas`);
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const canConfirm = curveOk || histOk;

  const renderLabelChip = (label: string, ok: boolean) => (
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
            Suba os 2 arquivos Excel para atualizar todas as seções automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <UploadZone
            label="Arquivo Curva S (.xlsx)"
            expected="Aba: Curva S - Geral Projeto"
            status={curveResult ? (('error' in curveResult) ? 'error' : 'loaded') : (curveFile ? 'loaded' : 'idle')}
            fileName={curveFile?.name}
            onFile={onCurve}
          />
          <UploadZone
            label="Arquivo Histograma MOD (.xlsx)"
            expected="Aba: FRIGO+SPCI"
            status={histResult ? (('error' in histResult) ? 'error' : 'loaded') : (histFile ? 'loaded' : 'idle')}
            fileName={histFile?.name}
            onFile={onHist}
          />
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo arquivo...
          </div>
        )}

        {(curveResult || histResult) && !parsing && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <h3 className="font-semibold text-sm">Resumo de Detecção</h3>

              {curveResult && (
                <div className="text-xs space-y-2">
                  <div className="font-medium text-foreground">📊 Curva S</div>
                  {'error' in curveResult ? (
                    <div className="pl-4 text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {curveResult.error}
                    </div>
                  ) : (
                    <div className="pl-4 space-y-1">
                      <div className="text-muted-foreground">Aba: <span className="font-mono text-foreground">{curveResult.sheet}</span></div>
                      <div>{Object.entries(CURVE_LABEL_HUMAN).map(([k, v]) => renderLabelChip(v, curveResult.labelsFound[k]))}</div>
                      {curveResult.missing.length > 0 && (
                        <div className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />Faltando: {curveResult.missing.join(', ')}</div>
                      )}
                      <div className="text-muted-foreground">Semana atual: <span className="font-semibold text-foreground">{curveResult.currentWeek}</span> · Última semana com Real: <span className="font-semibold text-foreground">{curveResult.lastReal}</span></div>
                      <div className="text-muted-foreground">Curva S: {curveResult.sCurve.length} sem · Semanal: {curveResult.weekly.length} sem · Mensal: {curveResult.monthly.length} meses</div>
                    </div>
                  )}
                </div>
              )}

              {histResult && (
                <div className="text-xs space-y-2">
                  <div className="font-medium text-foreground">👥 Histograma MOD</div>
                  {'error' in histResult ? (
                    <div className="pl-4 text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {histResult.error}
                    </div>
                  ) : (
                    <div className="pl-4 space-y-1">
                      <div className="text-muted-foreground">Aba: <span className="font-mono text-foreground">{histResult.sheet}</span></div>
                      <div>{Object.entries(HIST_LABEL_HUMAN).map(([k, v]) => renderLabelChip(v, histResult.labelsFound[k as keyof typeof HIST_LABEL_HUMAN]))}</div>
                      {histResult.missing.length > 0 && (
                        <div className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />Faltando: {histResult.missing.join(', ')}</div>
                      )}
                      <div className="text-muted-foreground">Semanas detectadas: <span className="font-semibold text-foreground">{histResult.weeks}</span> · Última com Real: <span className="font-semibold text-foreground">{histResult.lastReal}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirm} disabled={!canConfirm} className="gradient-primary text-primary-foreground">Confirmar Importação</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
