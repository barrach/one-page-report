import { useProjectStore, useCurrentProject, ScheduleRow } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ClipboardPaste, Upload, FileSpreadsheet } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const parseNumber = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
};

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const excelSerialToDate = (s: number): Date | null => {
  if (typeof s !== 'number' || !isFinite(s) || s < 1) return null;
  return new Date(Math.round((s - 25569) * 86400 * 1000));
};
const fmtDate = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = excelSerialToDate(v);
    return d ? `${String(d.getUTCDate()).padStart(2, '0')}/${MONTHS_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(-2)}` : '';
  }
  if (v instanceof Date) {
    return `${String(v.getUTCDate()).padStart(2, '0')}/${MONTHS_PT[v.getUTCMonth()]}/${String(v.getUTCFullYear()).slice(-2)}`;
  }
  return String(v).trim();
};

const COLUMN_PATTERNS: Record<keyof Omit<ScheduleRow, 'highlight' | 'bold' | 'criticalPath'>, RegExp> = {
  id: /^\s*id\s*$/i,
  tarefa: /(task\s*name|nome.*tarefa|^\s*nome\s*$)/i,
  previsto: /(%\s*conclu[ií]do|%\s*work\s*complete|^\s*prev\.?\s*%?\s*$)/i,
  trabalhoConcluido: /(%\s*trabalho|%\s*trab|%\s*work)/i,
  desvio: /(desvio|variance)/i,
  inicio: /(^\s*in[ií]cio\s*$|^\s*start\s*$)/i,
  termino: /(^\s*t[eé]rmino\s*$|^\s*finish\s*$)/i,
  inicioBase: /(in[ií]cio.*linha.*base|baseline\s*start|in[ií]cio.*base)/i,
  terminoBase: /(t[eé]rmino.*linha.*base|baseline\s*finish|t[eé]rmino.*base)/i,
};

interface DetectedMapping {
  sheetName: string;
  headerRowIdx: number;
  columnIndex: Partial<Record<keyof typeof COLUMN_PATTERNS, number>>;
  rows: ScheduleRow[];
}

const detectScheduleFromWorkbook = (wb: XLSX.WorkBook): DetectedMapping | { error: string } => {
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    // Find header row: row containing at least 3 of our patterns
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i] || [];
      const colIdx: Partial<Record<keyof typeof COLUMN_PATTERNS, number>> = {};
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell !== 'string') continue;
        const txt = cell.trim();
        for (const [key, regex] of Object.entries(COLUMN_PATTERNS)) {
          const k = key as keyof typeof COLUMN_PATTERNS;
          if (colIdx[k] == null && regex.test(txt)) colIdx[k] = c;
        }
      }
      const matches = Object.keys(colIdx).length;
      if (matches >= 3 && colIdx.tarefa != null) {
        // Build rows from i+1 onward
        const dataRows: ScheduleRow[] = [];
        for (let r = i + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const tarefa = colIdx.tarefa != null ? row[colIdx.tarefa] : '';
          if (tarefa == null || String(tarefa).trim() === '') continue;
          const get = (k: keyof typeof COLUMN_PATTERNS) => colIdx[k] != null ? row[colIdx[k]!] : null;
          const num = (v: unknown): number => {
            if (typeof v === 'number') return v <= 1 && v > 0 ? v * 100 : v;
            if (typeof v === 'string') return parseNumber(v);
            return 0;
          };
          dataRows.push({
            id: String(get('id') ?? '').trim(),
            tarefa: String(tarefa).trim(),
            previsto: num(get('previsto')),
            trabalhoConcluido: num(get('trabalhoConcluido')),
            desvio: num(get('desvio')),
            inicio: fmtDate(get('inicio')),
            termino: fmtDate(get('termino')),
            inicioBase: fmtDate(get('inicioBase')),
            terminoBase: fmtDate(get('terminoBase')),
          });
        }
        if (dataRows.length > 0) {
          return { sheetName, headerRowIdx: i, columnIndex: colIdx, rows: dataRows };
        }
      }
    }
  }
  return { error: 'Não foi possível detectar colunas de cronograma. Verifique se o arquivo possui cabeçalhos como Id, Nome da Tarefa, Início, Término...' };
};

const COL_LABELS: Record<keyof typeof COLUMN_PATTERNS, string> = {
  id: 'Id',
  tarefa: 'Nome da Tarefa',
  previsto: 'Prev. %',
  trabalhoConcluido: '% Trab.',
  desvio: 'Desvio',
  inicio: 'Início',
  termino: 'Término',
  inicioBase: 'Início Base',
  terminoBase: 'Término Base',
};

const ScheduleSpreadsheet = () => {
  const { scheduleData } = useCurrentProject();
  const { setScheduleData, addScheduleRow, removeScheduleRow } = useProjectStore();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const data = scheduleData || [];

  const updateRow = (index: number, field: keyof ScheduleRow, value: string) => {
    const updated = data.map((r, i) => {
      if (i !== index) return r;
      if (field === 'previsto' || field === 'trabalhoConcluido' || field === 'desvio') {
        return { ...r, [field]: parseFloat(value) || 0 };
      }
      return { ...r, [field]: value };
    });
    setScheduleData(updated);
  };

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split('\n');
    const newData: ScheduleRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split('\t');
      if (i === 0 && /^(id|Id|ID)$/i.test(cells[0]?.trim())) continue;
      if (cells.length >= 2) {
        newData.push({
          id: cells[0]?.trim() || '',
          tarefa: cells[1]?.trim() || '',
          previsto: parseNumber(cells[2]),
          trabalhoConcluido: parseNumber(cells[3]),
          desvio: parseNumber(cells[4]),
          inicio: cells[5]?.trim() || '',
          termino: cells[6]?.trim() || '',
          inicioBase: cells[7]?.trim() || '',
          terminoBase: cells[8]?.trim() || '',
        });
      }
    }
    if (newData.length > 0) { setScheduleData(newData); setShowPaste(false); setPasteText(''); }
  }, [pasteText, setScheduleData]);

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Cronograma</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)} className="gap-1">
            <ClipboardPaste className="h-4 w-4" /> Colar do Excel
          </Button>
          <Button size="sm" onClick={addScheduleRow} className="gap-1">
            <Plus className="h-4 w-4" /> Linha
          </Button>
        </div>
      </div>

      {showPaste && (
        <div className="mb-4 space-y-2 p-4 rounded-md bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            Cole os dados do Excel (separados por tab). Formato esperado por linha:<br />
            <strong>Id</strong> | <strong>Nome da Tarefa</strong> | <strong>Previsto %</strong> | <strong>% Trabalho</strong> | <strong>Desvio %</strong> | <strong>Início</strong> | <strong>Término</strong> | <strong>Início Base</strong> | <strong>Término Base</strong>
          </p>
          <Textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole aqui os dados copiados do Excel..." className="font-mono text-xs" />
          <Button size="sm" onClick={handlePaste}>Importar Dados</Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              <th className="px-1 py-1.5 text-center border border-border w-10" title="Destaque">✦</th>
              <th className="px-1 py-1.5 text-center border border-border w-8" title="Negrito">N</th>
              <th className="px-1 py-1.5 text-center border border-border w-8" title="Caminho Crítico">CC</th>
              <th className="px-2 py-1.5 text-center border border-border w-12">Id</th>
              <th className="px-2 py-1.5 text-left border border-border min-w-[200px]">Nome da Tarefa</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">Prev. %</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">% Trab.</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">Desvio</th>
              <th className="px-2 py-1.5 text-center border border-border w-24">Início</th>
              <th className="px-2 py-1.5 text-center border border-border w-24">Término</th>
              <th className="px-2 py-1.5 text-center border border-border w-24">Início Base</th>
              <th className="px-2 py-1.5 text-center border border-border w-24">Término Base</th>
              <th className="px-1 py-1.5 w-8 border border-border"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={`border-b border-border ${row.highlight ? 'bg-warning/10' : ''}`}>
                <td className="border border-border px-1 py-0.5 text-center">
                  <Checkbox checked={!!row.highlight} onCheckedChange={(checked) => {
                    setScheduleData(data.map((r, j) => j === i ? { ...r, highlight: !!checked } : r));
                  }} />
                </td>
                <td className="border border-border px-1 py-0.5 text-center">
                  <Checkbox checked={!!row.bold} onCheckedChange={(checked) => {
                    setScheduleData(data.map((r, j) => j === i ? { ...r, bold: !!checked } : r));
                  }} />
                </td>
                <td className="border border-border px-1 py-0.5 text-center">
                  <Checkbox checked={!!row.criticalPath} onCheckedChange={(checked) => {
                    setScheduleData(data.map((r, j) => j === i ? { ...r, criticalPath: !!checked } : r));
                  }} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input className="w-full text-center bg-transparent outline-none text-xs" value={row.id} onChange={(e) => updateRow(i, 'id', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input className="w-full bg-transparent outline-none text-xs px-1" value={row.tarefa} onChange={(e) => updateRow(i, 'tarefa', e.target.value)} placeholder="Nome da tarefa..." />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs" value={row.previsto} onChange={(e) => updateRow(i, 'previsto', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="1" className="w-full text-center bg-transparent outline-none text-xs" value={row.trabalhoConcluido} onChange={(e) => updateRow(i, 'trabalhoConcluido', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs" value={row.desvio} onChange={(e) => updateRow(i, 'desvio', e.target.value)} />
                </td>
                {['inicio', 'termino', 'inicioBase', 'terminoBase'].map((field) => (
                  <td key={field} className="border border-border px-1 py-0.5">
                    <input className="w-full text-center bg-transparent outline-none text-xs" value={(row as any)[field]} onChange={(e) => updateRow(i, field as keyof ScheduleRow, e.target.value)} />
                  </td>
                ))}
                <td className="px-1 py-0.5 text-center">
                  <button onClick={() => removeScheduleRow(i)} className="text-destructive/50 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleSpreadsheet;
