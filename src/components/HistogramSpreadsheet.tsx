import { useProjectStore, useCurrentProject, HistogramPoint } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ClipboardPaste, Upload } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
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

const parseNumber = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
};

const HistogramSpreadsheet = () => {
  const { histogramData } = useCurrentProject();
  const { setHistogramData, addHistogramPoint, removeHistogramPoint } = useProjectStore();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelImport = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      let sheetName = wb.SheetNames.find(n => /frigo\+spci/i.test(n));
      if (!sheetName) sheetName = wb.SheetNames.find(n => /histogr/i.test(n));
      if (!sheetName) sheetName = wb.SheetNames[0];
      if (!sheetName) { toast.error('Erro: nenhuma aba encontrada'); return; }

      const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });

      const TARGETS = { dia: 'dia', prev: 'total prevista', real: 'total real' };
      const found: Record<string, { row: number; col: number }> = {};
      rows.forEach((r, ri) => {
        r?.forEach((cell, ci) => {
          const n = norm(cell);
          if (!found.dia && n === 'dia') found.dia = { row: ri, col: ci };
          if (!found.prev && n.includes('total prevista')) found.prev = { row: ri, col: ci };
          if (!found.real && n.includes('total real')) found.real = { row: ri, col: ci };
        });
      });
      const missing = Object.keys(TARGETS).filter(k => !found[k]);
      if (missing.length) {
        const labelMap: Record<string, string> = { dia: 'Dia', prev: 'TOTAL PREVISTA', real: 'TOTAL REAL' };
        toast.error(`Erro: label não encontrado: ${missing.map(k => labelMap[k]).join(', ')}`);
        return;
      }

      const diaRow = rows[found.dia.row] || [];
      const prevRow = rows[found.prev.row] || [];
      const realRow = rows[found.real.row] || [];

      // Find first numeric date column at or to the right of the "Dia" label column
      let startCol = -1;
      for (let c = found.dia.col + 1; c < diaRow.length; c++) {
        if (parseDateCell(diaRow[c])) { startCol = c; break; }
      }
      if (startCol < 0) { toast.error('Nenhuma data encontrada na linha "Dia"'); return; }

      type Col = { date: string; dateObj: Date; previsto: number; real: number };
      const cols: Col[] = [];
      for (let c = startCol; c < diaRow.length; c++) {
        const d = parseDateCell(diaRow[c]);
        if (!d) continue;
        const num = (v: unknown) => (typeof v === 'number' ? v : 0);
        cols.push({
          date: formatDDmmm(d),
          dateObj: d,
          previsto: num(prevRow[c]),
          real: num(realRow[c]),
        });
      }

      const result = cols;
      if (result.length === 0) { toast.error('Nenhuma semana com data válida encontrada'); return; }
      const newData: HistogramPoint[] = result.map(c => ({
        date: c.date, semana: '', previsto: c.previsto, real: c.real,
      }));
      setHistogramData(newData);
      toast.success(`✓ Histograma importado — ${newData.length} semanas`);
    } catch (e) {
      toast.error(`Erro ao importar: ${e instanceof Error ? e.message : 'desconhecido'}`);
    }
  }, [setHistogramData]);
  const data = histogramData || [];

  const updateCell = (colIndex: number, field: keyof HistogramPoint, value: string) => {
    const updated = data.map((p, i) =>
      i === colIndex ? { ...p, [field]: (field === 'date' || field === 'semana') ? value : parseFloat(value) || 0 } : p
    );
    setHistogramData(updated);
  };

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const allCells = pasteText.trim().split('\n').map(l => l.split('\t'));
    let dateValues: string[] = [], semanaValues: string[] = [], prevValues: string[] = [], realValues: string[] = [];
    const lp = { dates: /^(data|date|métrica)/i, semana: /^(semana|sem)/i, prev: /prev/i, real: /real/i };
    let usedLabels = false;
    for (const cells of allCells) {
      const first = cells[0]?.trim() || '';
      if (lp.dates.test(first)) { dateValues = cells.slice(1); usedLabels = true; }
      else if (lp.semana.test(first)) { semanaValues = cells.slice(1); usedLabels = true; }
      else if (lp.prev.test(first)) { prevValues = cells.slice(1); usedLabels = true; }
      else if (lp.real.test(first)) { realValues = cells.slice(1); usedLabels = true; }
    }
    if (!usedLabels && allCells.length >= 2) {
      dateValues = allCells[0]; semanaValues = allCells.length >= 4 ? allCells[1] : [];
      prevValues = allCells.length >= 4 ? allCells[2] : allCells[1] || [];
      realValues = allCells.length >= 4 ? allCells[3] : allCells[2] || [];
    }
    if (dateValues.length === 0) return;
    const newData: HistogramPoint[] = dateValues.map((date, i) => ({
      date: date.trim(), semana: semanaValues[i]?.trim() || '', previsto: parseNumber(prevValues[i]), real: parseNumber(realValues[i]),
    })).filter(p => p.date !== '');
    if (newData.length > 0) { setHistogramData(newData); setShowPaste(false); setPasteText(''); }
  }, [pasteText, setHistogramData]);

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Histograma (MOD)</h2>
      </div>
      {showPaste && (
        <div className="mb-4 space-y-2 p-4 rounded-md bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            Cole os dados do Excel (separados por tab):<br />
            <strong>Linha 1:</strong> Datas | <strong>Linha 2:</strong> Semana (opcional) | <strong>Linha 3:</strong> Previsto | <strong>Linha 4:</strong> Real
          </p>
          <Textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole aqui os dados copiados do Excel..." className="font-mono text-xs" />
          <Button size="sm" onClick={handlePaste}>Importar Dados</Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[120px]">Métrica</th>
              {data.map((point, i) => (
                <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[70px]">
                  <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={point.date} onChange={(e) => updateCell(i, 'date', e.target.value)} placeholder="Data" />
                  <button onClick={() => removeHistogramPoint(i)} className="text-destructive/70 hover:text-destructive mt-0.5"><Trash2 className="h-3 w-3 mx-auto" /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Semana', field: 'semana' as const, type: 'text' },
              { label: 'Previsto', field: 'previsto' as const, type: 'number' },
              { label: 'Real', field: 'real' as const, type: 'number' },
            ].map(({ label, field, type }) => (
              <tr key={field}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground">{label}</td>
                {data.map((point, i) => (
                  <td key={i} className="border border-border px-1 py-1">
                    <input type={type} className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={(point as any)[field]} onChange={(e) => updateCell(i, field, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistogramSpreadsheet;
