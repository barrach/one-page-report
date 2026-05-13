import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ClipboardPaste, Upload } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import SCurveSpreadsheet from '@/components/SCurveSpreadsheet';
import HistogramSpreadsheet from '@/components/HistogramSpreadsheet';
import ScheduleSpreadsheet from '@/components/ScheduleSpreadsheet';
import WeeklyImportModal from '@/components/WeeklyImportModal';

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const formatDDmmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${MONTHS_PT[d.getMonth()]}`;
const excelSerialToDate = (s: number) => new Date(Math.round((s - 25569) * 86400 * 1000));
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const parseDateCell = (dv: unknown): Date | null => {
  if (dv instanceof Date) return dv;
  if (typeof dv === 'number' && dv > 1000) return excelSerialToDate(dv);
  return null;
};

const extractCurveSheet = async (file: File, labels: Record<string, string>) => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => norm(n) === norm('Curva S - Geral Projeto'));
  if (!sheetName) {
    toast.error("Erro: aba 'Curva S - Geral Projeto' não encontrada");
    return null;
  }
  const data: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
  const allLabels: Record<string, string> = { __date: 'data de corte', ...labels };
  const found: Record<string, { row: number; col: number }> = {};
  data.forEach((r, ri) => {
    r?.forEach((cell, ci) => {
      const n = norm(cell);
      for (const [k, label] of Object.entries(allLabels)) {
        if (n === label && !found[k]) found[k] = { row: ri, col: ci };
      }
    });
  });
  const missing = Object.keys(allLabels).filter(k => !found[k]);
  if (missing.length) {
    const human: Record<string, string> = { __date: 'Data de Corte', ...labels };
    toast.error(`Erro: label não encontrado: ${missing.map(k => human[k]).join(', ')}`);
    return null;
  }
  return { data, found };
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS_PT[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mmm} ${hh}:${mm}`;
};

const ImportStamp = ({ iso }: { iso?: string }) => {
  const ts = formatTimestamp(iso);
  if (!ts) return null;
  return <p className="text-[11px] text-muted-foreground mt-2 italic">Atualizado em {ts}</p>;
};

const parseNumber = (val: string): number => {
  if (!val) return 0;
  const cleaned = val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const DataInputPage = () => {
  const { info, weeklyData, monthData, lastImports } = useCurrentProject();
  const { setInfo, setWeeklyData, addWeek, removeWeek, setMonthData } = useProjectStore();
  const [showWeeklyPaste, setShowWeeklyPaste] = useState(false);
  const [weeklyPasteText, setWeeklyPasteText] = useState('');
  const [showMonthPaste, setShowMonthPaste] = useState(false);
  const [monthPasteText, setMonthPasteText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const weeklyFileRef = useRef<HTMLInputElement>(null);
  const monthFileRef = useRef<HTMLInputElement>(null);

  const handleWeeklyExcelImport = useCallback(async (file: File) => {
    const ex = await extractCurveSheet(file, { prev: 'prev. %', real: 'real. %' });
    if (!ex) return;
    const dateRow = ex.data[ex.found.__date.row] || [];
    const prevRow = ex.data[ex.found.prev.row] || [];
    const realRow = ex.data[ex.found.real.row] || [];
    const startCol = ex.found.__date.col + 1;
    const cols: { date: string; previsto: number; real: number }[] = [];
    for (let c = startCol; c < dateRow.length; c++) {
      const d = parseDateCell(dateRow[c]);
      if (!d) continue;
      const num = (v: unknown) => (typeof v === 'number' ? v * 100 : 0);
      cols.push({ date: formatDDmmm(d), previsto: num(prevRow[c]), real: num(realRow[c]) });
    }
    const last5 = cols.filter(c => c.previsto > 0).slice(-5);
    if (last5.length === 0) { toast.error('Nenhuma semana com Prev. % > 0'); return; }
    setWeeklyData(last5);
    toast.success(`✓ Resultado Semanal importado — ${last5.length} semanas`);
  }, [setWeeklyData]);

  const handleMonthExcelImport = useCallback(async (file: File) => {
    const ex = await extractCurveSheet(file, { prev: 'prev. acum. %', real: 'real. acum. %' });
    if (!ex) return;
    const dateRow = ex.data[ex.found.__date.row] || [];
    const prevRow = ex.data[ex.found.prev.row] || [];
    const realRow = ex.data[ex.found.real.row] || [];
    const startCol = ex.found.__date.col + 1;
    // Group by year-month, keep last value per month
    const byMonth = new Map<string, { date: Date; previsto: number; real: number }>();
    for (let c = startCol; c < dateRow.length; c++) {
      const d = parseDateCell(dateRow[c]);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const num = (v: unknown) => (typeof v === 'number' ? v * 100 : 0);
      const previsto = num(prevRow[c]);
      const real = num(realRow[c]);
      if (previsto > 0) byMonth.set(key, { date: d, previsto, real });
    }
    const ordered = [...byMonth.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    const last4 = ordered.slice(-4);
    if (last4.length === 0) { toast.error('Nenhum mês com Prev. Acum. % > 0'); return; }
    const newData = last4.map(m => ({
      label: `${MONTHS_PT[m.date.getMonth()]}/${String(m.date.getFullYear()).slice(-2)}`,
      previsto: m.previsto,
      real: m.real,
    }));
    setMonthData(newData);
    toast.success(`✓ Prev. x Realizado Mês importado — ${newData.length} meses`);
  }, [setMonthData]);

  const updateWeekly = (index: number, field: string, value: string) => {
    const updated = weeklyData.map((w, i) =>
      i === index ? { ...w, [field]: field === 'date' ? value : parseFloat(value) || 0 } : w
    );
    setWeeklyData(updated);
  };

  const updateMonth = (index: number, field: string, value: string) => {
    const updated = monthData.map((m, i) =>
      i === index ? { ...m, [field]: field === 'label' ? value : parseFloat(value) || 0 } : m
    );
    setMonthData(updated);
  };

  const handleWeeklyPaste = useCallback(() => {
    if (!weeklyPasteText.trim()) return;
    const lines = weeklyPasteText.trim().split('\n').map(l => l.split('\t'));
    let dates: string[] = [], prevValues: string[] = [], realValues: string[] = [];
    const dp = /^(data|métrica|date|semana)/i, pp = /prev/i, rp = /real/i;
    let usedLabels = false;
    for (const cells of lines) {
      const first = cells[0]?.trim() || '';
      if (dp.test(first)) { dates = cells.slice(1); usedLabels = true; }
      else if (pp.test(first)) { prevValues = cells.slice(1); usedLabels = true; }
      else if (rp.test(first)) { realValues = cells.slice(1); usedLabels = true; }
    }
    if (!usedLabels && lines.length >= 2) { dates = lines[0]; prevValues = lines[1] || []; realValues = lines[2] || []; }
    if (dates.length === 0) return;
    const newData = dates.map((d, i) => ({ date: d.trim(), previsto: parseNumber(prevValues[i]), real: parseNumber(realValues[i]) })).filter(p => p.date !== '');
    if (newData.length > 0) { setWeeklyData(newData); setShowWeeklyPaste(false); setWeeklyPasteText(''); }
  }, [weeklyPasteText, setWeeklyData]);

  const handleMonthPaste = useCallback(() => {
    if (!monthPasteText.trim()) return;
    const lines = monthPasteText.trim().split('\n').map(l => l.split('\t'));
    let labels: string[] = [], prevValues: string[] = [], realValues: string[] = [];
    const lp = /^(semana|métrica|sem|label)/i, pp = /prev/i, rp = /real/i;
    let usedLabels = false;
    for (const cells of lines) {
      const first = cells[0]?.trim() || '';
      if (lp.test(first)) { labels = cells.slice(1); usedLabels = true; }
      else if (pp.test(first)) { prevValues = cells.slice(1); usedLabels = true; }
      else if (rp.test(first)) { realValues = cells.slice(1); usedLabels = true; }
    }
    if (!usedLabels && lines.length >= 2) { labels = lines[0]; prevValues = lines[1] || []; realValues = lines[2] || []; }
    if (labels.length === 0) return;
    const newData = labels.map((l, i) => ({ label: l.trim(), previsto: parseNumber(prevValues[i]), real: parseNumber(realValues[i]) })).filter(p => p.label !== '');
    if (newData.length > 0) { setMonthData(newData); setShowMonthPaste(false); setMonthPasteText(''); }
  }, [monthPasteText, setMonthData]);

  const PasteSection = ({ show, text, setText, onImport, label }: { show: boolean; text: string; setText: (v: string) => void; onImport: () => void; label: string }) => {
    if (!show) return null;
    return (
      <div className="mb-4 space-y-2 p-4 rounded-md bg-muted/50 border">
        <p className="text-sm text-muted-foreground">
          Cole os dados do Excel (separados por tab):<br />
          <strong>Linha 1:</strong> {label} | <strong>Linha 2:</strong> Previsto % | <strong>Linha 3:</strong> Real %
        </p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui os dados copiados do Excel..." className="font-mono text-xs" />
        <Button size="sm" onClick={onImport}>Importar Dados</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Import button - top of page */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => setImportOpen(true)}
          className="gap-2 gradient-primary text-primary-foreground shadow-lg hover:opacity-90 font-semibold"
        >
          <Upload className="h-5 w-5" />
          Importar Semana
        </Button>
      </div>

      <WeeklyImportModal open={importOpen} onOpenChange={setImportOpen} />

      {/* Project Info */}
      <div className="bg-card rounded-lg p-6 shadow-sm border">
        <h2 className="text-xl font-bold text-foreground mb-4">Informações do Projeto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Projeto', key: 'projeto', type: 'text' },
            { label: 'Cliente', key: 'cliente', type: 'text' },
            { label: 'Gestor', key: 'gestor', type: 'text' },
            { label: 'Início', key: 'inicio', type: 'date' },
            { label: 'Término LB', key: 'terminoLB', type: 'date' },
            { label: 'Término Prev.', key: 'terminoPrev', type: 'date' },
            { label: 'Avanço Prev. (%)', key: 'avancoPrev', type: 'number' },
            { label: 'Avanço Real (%)', key: 'avancoReal', type: 'number' },
            { label: 'Atualizado em', key: 'atualizadoEm', type: 'date' },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">{field.label}</label>
              <Input
                type={field.type}
                value={(info as any)[field.key]}
                onChange={(e) => setInfo({ [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SCurveSpreadsheet />
        <ImportStamp iso={lastImports?.sCurve} />
      </div>

      {/* Weekly Data */}
      <div className="bg-card rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Resultado Semanal / Visão 5 Semanas</h2>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowWeeklyPaste(!showWeeklyPaste)} className="gap-1">
              <ClipboardPaste className="h-4 w-4" /> Colar do Excel
            </Button>
            <Button size="sm" variant="outline" onClick={addWeek} className="gap-1">
              <Plus className="h-4 w-4" /> Coluna
            </Button>
          </div>
        </div>
        <PasteSection show={showWeeklyPaste} text={weeklyPasteText} setText={setWeeklyPasteText} onImport={handleWeeklyPaste} label="Datas" />
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[120px]">Métrica</th>
                {weeklyData.map((w, i) => (
                  <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[90px]">
                    <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={w.date} onChange={(e) => updateWeekly(i, 'date', e.target.value)} placeholder="Data" />
                    <button onClick={() => removeWeek(i)} className="text-destructive/70 hover:text-destructive mt-0.5"><Trash2 className="h-3 w-3 mx-auto" /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Previsto %', field: 'previsto' },
                { label: 'Real %', field: 'real' },
              ].map(({ label, field }) => (
                <tr key={field}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground">{label}</td>
                  {weeklyData.map((w, i) => (
                    <td key={i} className="border border-border px-1 py-1">
                      <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={(w as any)[field]} onChange={(e) => updateWeekly(i, field, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ImportStamp iso={lastImports?.weekly} />
      </div>

      {/* Month Data */}
      <div className="bg-card rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Prev. x Realizado Mês</h2>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowMonthPaste(!showMonthPaste)} className="gap-1">
              <ClipboardPaste className="h-4 w-4" /> Colar do Excel
            </Button>
          </div>
        </div>
        <PasteSection show={showMonthPaste} text={monthPasteText} setText={setMonthPasteText} onImport={handleMonthPaste} label="Semanas" />
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[120px]">Métrica</th>
                {monthData.map((m, i) => (
                  <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[90px]">
                    <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={m.label} onChange={(e) => updateMonth(i, 'label', e.target.value)} placeholder="Semana" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Previsto %', field: 'previsto' },
                { label: 'Real %', field: 'real' },
              ].map(({ label, field }) => (
                <tr key={field}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground">{label}</td>
                  {monthData.map((m, i) => (
                    <td key={i} className="border border-border px-1 py-1">
                      <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={(m as any)[field]} onChange={(e) => updateMonth(i, field, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ImportStamp iso={lastImports?.month} />
      </div>

      <div>
        <HistogramSpreadsheet />
        <ImportStamp iso={lastImports?.histogram} />
      </div>
      <ScheduleSpreadsheet />
    </div>
  );
};

export default DataInputPage;
