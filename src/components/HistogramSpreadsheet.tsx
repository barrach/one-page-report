import { useProjectStore, useCurrentProject, HistogramPoint } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';

const parseNumber = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
};

const HistogramSpreadsheet = () => {
  const { histogramData } = useCurrentProject();
  const { setHistogramData, addHistogramPoint, removeHistogramPoint } = useProjectStore();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)} className="gap-1">
            <ClipboardPaste className="h-4 w-4" /> Colar do Excel
          </Button>
          <Button size="sm" onClick={addHistogramPoint} className="gap-1">
            <Plus className="h-4 w-4" /> Coluna
          </Button>
        </div>
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
