import { useProjectStore, useCurrentProject, type ProjectInfo } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ClipboardPaste, Upload, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import SCurveSpreadsheet from '@/components/SCurveSpreadsheet';
import HistogramSpreadsheet from '@/components/HistogramSpreadsheet';
import WeeklyImportModal from '@/components/WeeklyImportModal';
import ClearDataButton from '@/components/ClearDataButton';
import { cn } from '@/lib/utils';
import PpcSemanalTable from '@/components/PpcSemanalTable';
import ProjectSelector from '@/components/ProjectSelector';

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

const fmtSavedAt = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const INFO_FIELDS: { label: string; key: keyof ProjectInfo; type: 'text' | 'date' | 'number' }[] = [
  { label: 'Projeto', key: 'projeto', type: 'text' },
  { label: 'Cliente', key: 'cliente', type: 'text' },
  { label: 'Gestor', key: 'gestor', type: 'text' },
  { label: 'Início', key: 'inicio', type: 'date' },
  { label: 'Término LB', key: 'terminoLB', type: 'date' },
  { label: 'Término Prev.', key: 'terminoPrev', type: 'date' },
  { label: 'Avanço Prev. (%)', key: 'avancoPrev', type: 'number' },
  { label: 'Avanço Real (%)', key: 'avancoReal', type: 'number' },
  { label: 'Atualizado em', key: 'atualizadoEm', type: 'date' },
];

const ProjectInfoEditor = ({ info, setInfo }: { info: ProjectInfo; setInfo: (patch: Partial<ProjectInfo>) => void }) => {
  const [draft, setDraft] = useState<ProjectInfo>(info);

  // Ressincroniza quando o projeto muda (ex.: troca de projeto ou import)
  useEffect(() => { setDraft(info); }, [info]);

  const dirty = useMemo(
    () => INFO_FIELDS.some(f => String(draft[f.key] ?? '') !== String(info[f.key] ?? '')),
    [draft, info]
  );

  // Aviso de alterações não salvas (fechar/recarregar a aba)
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const onField = (key: keyof ProjectInfo, type: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: type === 'number' ? (parseFloat(value) || 0) : value }));
  };

  const handleSave = () => {
    const patch: Partial<ProjectInfo> = {};
    INFO_FIELDS.forEach(f => { (patch as Record<string, unknown>)[f.key] = draft[f.key]; });
    patch.infoSavedAt = new Date().toISOString();
    setInfo(patch);
  };

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <h2 className="text-xl font-bold text-foreground mb-4">Informações do Projeto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INFO_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">{field.label}</label>
            <Input
              type={field.type}
              value={(draft as Record<string, unknown>)[field.key] as string | number}
              onChange={(e) => onField(field.key, field.type, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-4 min-h-[36px]">
        {!dirty && info.infoSavedAt && (
          <span className="text-[11px] text-muted-foreground">Atualizado em {fmtSavedAt(info.infoSavedAt)}</span>
        )}
        {dirty && (
          <Button onClick={handleSave} size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        )}
      </div>
    </div>
  );
};

const DataInputPage = () => {
  const { info, weeklyData, monthData, lastImports } = useCurrentProject();
  const { setInfo, setWeeklyData, addWeek, removeWeek, setMonthData, setHistogramData, setScheduleData } = useProjectStore();
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
    <div className="min-h-screen bg-background p-3 sm:p-4 space-y-6">
      {/* Primeira linha: seletor de projeto à esquerda, Importar Semana à direita */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ProjectSelector showDelete />
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
      <ProjectInfoEditor info={info} setInfo={setInfo} />

      <div>
        <SCurveSpreadsheet />
        <ImportStamp iso={lastImports?.sCurve} />
      </div>

      {/* Weekly Data */}
      <div className="bg-card rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Resultado Semanal / Visão 5 Semanas</h2>
            {weeklyData.length > 0 && (
              <ClearDataButton sectionName="Resultado Semanal" onConfirm={() => setWeeklyData([])} />
            )}
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Prev. x Realizado Mês</h2>
            {monthData.length > 0 && (
              <ClearDataButton sectionName="Prev. x Realizado Mês" onConfirm={() => setMonthData([])} />
            )}
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
      <ProgSemanalSection />
    </div>
  );
};

// ─── Programação Semanal Section ─────────────────────────────────────────────

const ProgSemanalSection = () => {
  const { programacaoSemanal, lastImports, id: projectId } = useCurrentProject() as ReturnType<typeof useCurrentProject> & {
    lastImports?: Record<string, string>;
  };
  const clearProgramacaoSemanal = useProjectStore(s => s.clearProgramacaoSemanal);

  const weeks = programacaoSemanal ?? [];
  if (weeks.length === 0) return null;

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Programação Semanal — PPC</h2>
          <ClearDataButton
            sectionName="Programação Semanal"
            onConfirm={() => clearProgramacaoSemanal(projectId!)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {weeks.length} semana{weeks.length !== 1 ? 's' : ''} importada{weeks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <PpcSemanalTable data={weeks} showPeriodo={false} />

      {lastImports?.progSemanal && (
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          Atualizado em {formatTimestamp(lastImports.progSemanal)}
        </p>
      )}
    </div>
  );
};

export default DataInputPage;
