import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { toast } from 'sonner';

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const excelSerialToDate = (serial: number): Date | null => {
  if (typeof serial !== 'number' || !isFinite(serial) || serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
};

const fmtDDMMM = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${MONTHS_PT[d.getUTCMonth()]}`;

const isLikelyDateSerial = (n: unknown) => typeof n === 'number' && n > 30000 && n < 80000;

const findRowByLabel = (rows: unknown[][], regex: RegExp): number => {
  for (let i = 0; i < rows.length; i++) {
    for (let c = 0; c < Math.min(5, rows[i]?.length || 0); c++) {
      const cell = rows[i]?.[c];
      if (typeof cell === 'string' && regex.test(cell.trim())) return i;
    }
  }
  return -1;
};

const findHeaderDateRow = (rows: unknown[][]): number => {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const dateCount = row.filter(isLikelyDateSerial).length;
    if (dateCount >= 3) return i;
  }
  return -1;
};

interface DetectedSummary {
  sheet: string;
  weeks: number;
  lastReal: string;
}

interface ParsedSCurve {
  dates: string[];
  previsto: number[];
  real: number[];
  tendencia: number[];
}

interface ParsedWeekly {
  dates: string[];
  previsto: number[];
  real: number[];
}

interface ParsedHistogram {
  dates: string[];
  previsto: number[];
  real: number[];
}

interface ParseResult {
  sCurve?: { data: ParsedSCurve; summary: DetectedSummary };
  weekly?: { data: ParsedWeekly; summary: DetectedSummary };
  histogram?: { data: ParsedHistogram; summary: DetectedSummary };
  errors: { section: string; message: string }[];
}

const parseSCurveFile = (wb: XLSX.WorkBook, errors: { section: string; message: string }[]): ParseResult => {
  const result: ParseResult = { errors };
  const sheetName = wb.SheetNames.find(n => /Dados Curva S.*Montagem/i.test(n)) || wb.SheetNames.find(n => /curva.*s/i.test(n));
  if (!sheetName) {
    errors.push({ section: 'Curva S', message: 'Aba "Dados Curva S - Montagem" não encontrada.' });
    return result;
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const headerRowIdx = findHeaderDateRow(rows);
  if (headerRowIdx < 0) {
    errors.push({ section: 'Curva S', message: 'Linha de datas não encontrada.' });
    return result;
  }
  const headerRow = rows[headerRowIdx];

  const prevRowIdx = findRowByLabel(rows, /Avan[çc]o\s*F[ií]sico\s*Prev.*Acum/i);
  const realRowIdx = findRowByLabel(rows, /Avan[çc]o\s*F[ií]sico\s*Real.*Acum/i);
  const tendRowIdx = findRowByLabel(rows, /Tend[eê]ncia.*Acum/i);

  if (prevRowIdx < 0 || realRowIdx < 0) {
    errors.push({ section: 'Curva S', message: 'Linhas Previsto/Real Acum. não encontradas.' });
    return result;
  }

  const dates: string[] = [];
  const previsto: number[] = [];
  const real: number[] = [];
  const tendencia: number[] = [];
  let lastRealDate = '';

  for (let c = 0; c < headerRow.length; c++) {
    const dv = headerRow[c];
    if (!isLikelyDateSerial(dv)) continue;
    const d = excelSerialToDate(dv as number);
    if (!d) continue;
    const dateStr = fmtDDMMM(d);
    const p = rows[prevRowIdx]?.[c];
    const r = rows[realRowIdx]?.[c];
    const t = tendRowIdx >= 0 ? rows[tendRowIdx]?.[c] : null;

    const pNum = typeof p === 'number' ? p * 100 : 0;
    const rNum = typeof r === 'number' ? r * 100 : 0;
    const tNum = typeof t === 'number' ? t * 100 : 0;

    dates.push(dateStr);
    previsto.push(+pNum.toFixed(2));
    real.push(+rNum.toFixed(2));
    tendencia.push(+tNum.toFixed(2));

    if (typeof r === 'number' && r > 0) lastRealDate = dateStr;
  }

  if (dates.length === 0) {
    errors.push({ section: 'Curva S', message: 'Nenhuma semana com dados encontrada.' });
    return result;
  }

  result.sCurve = {
    data: { dates, previsto, real, tendencia },
    summary: { sheet: sheetName, weeks: dates.length, lastReal: lastRealDate || '—' },
  };

  // Weekly from HH_Project_SEMANAL_BASE
  const weeklySheetName = wb.SheetNames.find(n => /HH_Project_SEMANAL_BASE/i.test(n)) || wb.SheetNames.find(n => /semanal/i.test(n));
  if (weeklySheetName) {
    try {
      const wws = wb.Sheets[weeklySheetName];
      const wrows = XLSX.utils.sheet_to_json<unknown[]>(wws, { header: 1, raw: true, defval: null });
      const wHeaderIdx = findHeaderDateRow(wrows);
      const wPrevIdx = findRowByLabel(wrows, /^\s*PREV\.?\s*$/i);
      const wRealIdx = findRowByLabel(wrows, /^\s*Real\s*$/i);
      if (wHeaderIdx < 0 || wPrevIdx < 0 || wRealIdx < 0) {
        errors.push({ section: 'Resultado Semanal', message: 'Linhas PREV./Real ou cabeçalho não encontradas.' });
      } else {
        const wHeader = wrows[wHeaderIdx];
        const wDates: string[] = [];
        const wPrev: number[] = [];
        const wReal: number[] = [];
        let lastWReal = '';
        for (let c = 0; c < wHeader.length; c++) {
          const dv = wHeader[c];
          if (!isLikelyDateSerial(dv)) continue;
          const d = excelSerialToDate(dv as number);
          if (!d) continue;
          const dateStr = fmtDDMMM(d);
          const p = wrows[wPrevIdx]?.[c];
          const r = wrows[wRealIdx]?.[c];
          const pNum = typeof p === 'number' ? p * 100 : 0;
          const rNum = typeof r === 'number' ? r * 100 : 0;
          wDates.push(dateStr);
          wPrev.push(+pNum.toFixed(2));
          wReal.push(+rNum.toFixed(2));
          if (typeof r === 'number' && r > 0) lastWReal = dateStr;
        }
        if (wDates.length > 0) {
          result.weekly = {
            data: { dates: wDates, previsto: wPrev, real: wReal },
            summary: { sheet: weeklySheetName, weeks: wDates.length, lastReal: lastWReal || '—' },
          };
        }
      }
    } catch (e) {
      errors.push({ section: 'Resultado Semanal', message: (e as Error).message });
    }
  } else {
    errors.push({ section: 'Resultado Semanal', message: 'Aba HH_Project_SEMANAL_BASE não encontrada.' });
  }

  return result;
};

const parseHistogramFile = (wb: XLSX.WorkBook, errors: { section: string; message: string }[]): { histogram?: { data: ParsedHistogram; summary: DetectedSummary } } => {
  const sheetName = wb.SheetNames.find(n => /Hist_MOD/i.test(n)) || wb.SheetNames.find(n => /hist/i.test(n));
  if (!sheetName) {
    errors.push({ section: 'Histograma MOD', message: 'Aba "Hist_MOD" não encontrada.' });
    return {};
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  // Header row "Dia"
  const diaRowIdx = findRowByLabel(rows, /^\s*Dia\s*$/i);
  const headerRowIdx = diaRowIdx >= 0 ? diaRowIdx : findHeaderDateRow(rows);
  if (headerRowIdx < 0) {
    errors.push({ section: 'Histograma MOD', message: 'Linha "Dia" não encontrada.' });
    return {};
  }
  const headerRow = rows[headerRowIdx];

  // Find TOTAL (MOD + MOI)
  const totalIdx = findRowByLabel(rows, /TOTAL\s*\(MOD\s*\+\s*MOI\)/i);
  if (totalIdx < 0) {
    errors.push({ section: 'Histograma MOD', message: 'Linha "TOTAL (MOD + MOI)" não encontrada.' });
    return {};
  }

  // Find P and R rows after totalIdx
  let pIdx = -1, rIdx = -1;
  for (let i = totalIdx; i < Math.min(rows.length, totalIdx + 10); i++) {
    for (let c = 0; c < Math.min(5, rows[i]?.length || 0); c++) {
      const cell = rows[i]?.[c];
      if (typeof cell === 'string') {
        const t = cell.trim();
        if (pIdx < 0 && /^P$/i.test(t)) pIdx = i;
        else if (rIdx < 0 && /^R$/i.test(t)) rIdx = i;
      }
    }
  }
  if (pIdx < 0 || rIdx < 0) {
    errors.push({ section: 'Histograma MOD', message: 'Sublinhas P/R não encontradas após TOTAL.' });
    return {};
  }

  const dates: string[] = [];
  const previsto: number[] = [];
  const real: number[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const dv = headerRow[c];
    if (!isLikelyDateSerial(dv)) continue;
    const d = excelSerialToDate(dv as number);
    if (!d) continue;
    const p = rows[pIdx]?.[c];
    const r = rows[rIdx]?.[c];
    dates.push(fmtDDMMM(d));
    previsto.push(typeof p === 'number' ? p : 0);
    real.push(typeof r === 'number' ? r : 0);
  }

  if (dates.length === 0) {
    errors.push({ section: 'Histograma MOD', message: 'Nenhuma semana de histograma encontrada.' });
    return {};
  }

  const lastReal = [...dates].reverse().find((_, i) => real[real.length - 1 - i] > 0) || '—';
  return {
    histogram: {
      data: { dates, previsto, real },
      summary: { sheet: sheetName, weeks: dates.length, lastReal },
    },
  };
};

const monthAbbrToIdx = (abbr: string) => MONTHS_PT.indexOf(abbr.toLowerCase());

const aggregateMonthly = (sCurve: ParsedSCurve): { label: string; previsto: number; real: number }[] => {
  // group by month: take last value of each month
  const byMonth: Record<string, { label: string; previsto: number; real: number; order: number }> = {};
  sCurve.dates.forEach((d, i) => {
    const [, mAbbr] = d.split('/');
    const mIdx = monthAbbrToIdx(mAbbr);
    if (mIdx < 0) return;
    const key = `${mIdx}`;
    byMonth[key] = { label: mAbbr.charAt(0).toUpperCase() + mAbbr.slice(1), previsto: sCurve.previsto[i], real: sCurve.real[i], order: i };
  });
  return Object.values(byMonth).sort((a, b) => a.order - b.order).map(({ label, previsto, real }) => ({ label, previsto, real }));
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
      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="flex flex-col items-center gap-2">
        {status === 'loaded' ? <CheckCircle2 className="h-8 w-8 text-success" /> :
          status === 'error' ? <AlertCircle className="h-8 w-8 text-destructive" /> :
          <Upload className="h-8 w-8 text-muted-foreground" />}
        <div className="font-semibold text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{expected}</div>
        <div className="text-xs mt-1">
          {status === 'loaded' && fileName ? (
            <span className="text-success font-medium">✓ {fileName}</span>
          ) : status === 'error' ? (
            <span className="text-destructive">Erro ao ler</span>
          ) : (
            <span className="text-muted-foreground">Aguardando arquivo .xlsx</span>
          )}
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
  const { setSCurveData, setWeeklyData, setMonthData, setHistogramData, setLastImport } = useProjectStore();
  const [sCurveFile, setSCurveFile] = useState<File | null>(null);
  const [histFile, setHistFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [enabled, setEnabled] = useState({ sCurve: true, weekly: true, month: true, histogram: true });

  const reset = () => {
    setSCurveFile(null); setHistFile(null); setParsed(null);
    setEnabled({ sCurve: true, weekly: true, month: true, histogram: true });
  };

  const handleParse = useCallback(async (sFile: File, hFile: File) => {
    setParsing(true);
    const errors: { section: string; message: string }[] = [];
    let combined: ParseResult = { errors };
    try {
      const sBuf = await sFile.arrayBuffer();
      const sWb = XLSX.read(sBuf, { type: 'array' });
      combined = parseSCurveFile(sWb, errors);
    } catch (e) {
      errors.push({ section: 'Curva S', message: (e as Error).message });
    }
    try {
      const hBuf = await hFile.arrayBuffer();
      const hWb = XLSX.read(hBuf, { type: 'array' });
      const histResult = parseHistogramFile(hWb, errors);
      combined.histogram = histResult.histogram;
    } catch (e) {
      errors.push({ section: 'Histograma MOD', message: (e as Error).message });
    }
    combined.errors = errors;
    setParsed(combined);
    setParsing(false);
  }, []);

  const onSCurve = (f: File) => {
    setSCurveFile(f);
    if (histFile) handleParse(f, histFile);
  };
  const onHist = (f: File) => {
    setHistFile(f);
    if (sCurveFile) handleParse(sCurveFile, f);
  };

  const confirm = () => {
    if (!parsed) return;
    const now = new Date().toISOString();
    const newErrors: { section: string; message: string }[] = [];
    let count = 0;

    try {
      if (enabled.sCurve && parsed.sCurve) {
        const { dates, previsto, real, tendencia } = parsed.sCurve.data;
        const last8 = dates.length > 8 ? dates.length - 8 : 0;
        setSCurveData(dates.slice(last8).map((d, i) => ({
          date: d,
          previsto: previsto[last8 + i],
          real: real[last8 + i],
          tendencia: tendencia[last8 + i],
        })));
        setLastImport('sCurve', now);
        count++;
      }
    } catch (e) { newErrors.push({ section: 'Curva S', message: (e as Error).message }); }

    try {
      if (enabled.weekly && parsed.weekly) {
        const { dates, previsto, real } = parsed.weekly.data;
        // Filter weeks where ambos > 0 then take last 5
        const both = dates.map((d, i) => ({ d, p: previsto[i], r: real[i] })).filter(x => x.p > 0 && x.r > 0);
        const pool = both.length >= 5 ? both : dates.map((d, i) => ({ d, p: previsto[i], r: real[i] }));
        const last5 = pool.slice(-5);
        setWeeklyData(last5.map(x => ({ date: x.d, previsto: x.p, real: x.r })));
        setLastImport('weekly', now);
        count++;
      }
    } catch (e) { newErrors.push({ section: 'Resultado Semanal', message: (e as Error).message }); }

    try {
      if (enabled.month && parsed.sCurve) {
        const monthly = aggregateMonthly(parsed.sCurve.data).slice(-4);
        setMonthData(monthly);
        setLastImport('month', now);
        count++;
      }
    } catch (e) { newErrors.push({ section: 'Prev. x Realizado Mês', message: (e as Error).message }); }

    try {
      if (enabled.histogram && parsed.histogram) {
        const { dates, previsto, real } = parsed.histogram.data;
        const last8 = dates.length > 8 ? dates.length - 8 : 0;
        setHistogramData(dates.slice(last8).map((d, i) => ({
          date: d, semana: '', previsto: previsto[last8 + i], real: real[last8 + i],
        })));
        setLastImport('histogram', now);
        count++;
      }
    } catch (e) { newErrors.push({ section: 'Histograma MOD', message: (e as Error).message }); }

    if (newErrors.length > 0) {
      setParsed({ ...parsed, errors: [...(parsed.errors || []), ...newErrors] });
      toast.error(`Importação parcial: ${newErrors.length} erro(s)`);
    } else {
      toast.success(`✓ Importação concluída — ${count} seções atualizadas`);
      onOpenChange(false);
      setTimeout(reset, 300);
    }
  };

  const canConfirm = parsed && (parsed.sCurve || parsed.weekly || parsed.histogram);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 300); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importação Semanal
          </DialogTitle>
          <DialogDescription>
            Suba os 2 arquivos Excel para atualizar todas as seções automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <UploadZone
            label="Curva S"
            expected="Curva S - Montagem.xlsx"
            status={sCurveFile ? 'loaded' : 'idle'}
            fileName={sCurveFile?.name}
            onFile={onSCurve}
          />
          <UploadZone
            label="Histograma MOD"
            expected="Hist_MOD.xlsx"
            status={histFile ? 'loaded' : 'idle'}
            fileName={histFile?.name}
            onFile={onHist}
          />
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo arquivos...
          </div>
        )}

        {parsed && !parsing && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Resumo de Detecção</h3>
              {parsed.sCurve && (
                <div className="text-xs space-y-0.5">
                  <div className="font-medium text-foreground">📊 Curva S</div>
                  <div className="text-muted-foreground pl-4">Aba detectada: <span className="font-mono text-foreground">{parsed.sCurve.summary.sheet}</span></div>
                  <div className="text-muted-foreground pl-4">Semanas com dados: <span className="font-semibold text-foreground">{parsed.sCurve.summary.weeks}</span></div>
                  <div className="text-muted-foreground pl-4">Última semana com Real: <span className="font-semibold text-foreground">{parsed.sCurve.summary.lastReal}</span></div>
                </div>
              )}
              {parsed.weekly && (
                <div className="text-xs space-y-0.5">
                  <div className="font-medium text-foreground">📅 Resultado Semanal</div>
                  <div className="text-muted-foreground pl-4">Aba detectada: <span className="font-mono text-foreground">{parsed.weekly.summary.sheet}</span></div>
                  <div className="text-muted-foreground pl-4">Semanas com dados: <span className="font-semibold text-foreground">{parsed.weekly.summary.weeks}</span></div>
                  <div className="text-muted-foreground pl-4">Última semana com Real: <span className="font-semibold text-foreground">{parsed.weekly.summary.lastReal}</span></div>
                </div>
              )}
              {parsed.histogram && (
                <div className="text-xs space-y-0.5">
                  <div className="font-medium text-foreground">👥 Histograma MOD</div>
                  <div className="text-muted-foreground pl-4">Aba detectada: <span className="font-mono text-foreground">{parsed.histogram.summary.sheet}</span></div>
                  <div className="text-muted-foreground pl-4">Semanas com dados: <span className="font-semibold text-foreground">{parsed.histogram.summary.weeks}</span></div>
                  <div className="text-muted-foreground pl-4">Última semana com Real: <span className="font-semibold text-foreground">{parsed.histogram.summary.lastReal}</span></div>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm mb-2">Seções que serão atualizadas</h3>
              {[
                { key: 'sCurve' as const, label: 'Dados da Curva S', avail: !!parsed.sCurve },
                { key: 'weekly' as const, label: 'Resultado Semanal / Visão 5 Semanas', avail: !!parsed.weekly },
                { key: 'month' as const, label: 'Prev. x Realizado Mês', avail: !!parsed.sCurve },
                { key: 'histogram' as const, label: 'Histograma (MOD)', avail: !!parsed.histogram },
              ].map(({ key, label, avail }) => (
                <label key={key} className={`flex items-center gap-2 text-sm ${!avail ? 'opacity-40' : ''}`}>
                  <Checkbox
                    checked={enabled[key] && avail}
                    disabled={!avail}
                    onCheckedChange={(c) => setEnabled(e => ({ ...e, [key]: !!c }))}
                  />
                  <span>{label}</span>
                  {!avail && <span className="text-xs text-muted-foreground">(não detectado)</span>}
                </label>
              ))}
            </div>

            {parsed.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="font-semibold text-sm text-destructive flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" /> Erros detectados
                </h3>
                <ul className="text-xs space-y-1">
                  {parsed.errors.map((e, i) => (
                    <li key={i}><span className="font-medium">{e.section}:</span> <span className="text-muted-foreground">{e.message}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirm} disabled={!canConfirm}>Confirmar Importação</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
