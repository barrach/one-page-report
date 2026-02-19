import { useProjectStore, useCurrentProject, SCurvePoint } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';

const SCurveSpreadsheet = () => {
  const { sCurveData, statusDateIndex } = useCurrentProject();
  const { setSCurveData, addSCurvePoint, removeSCurvePoint, setStatusDateIndex } = useProjectStore();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showReplanejado, setShowReplanejado] = useState(false);

  const updateCell = (colIndex: number, field: keyof SCurvePoint, value: string) => {
    const updated = sCurveData.map((p, i) =>
      i === colIndex ? { ...p, [field]: field === 'date' ? value : parseFloat(value) || 0 } : p
    );
    setSCurveData(updated);
  };

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    return parseFloat(val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
  };

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const allCells = pasteText.trim().split('\n').map(l => l.split('\t'));
    let dateValues: string[] = [], prevValues: string[] = [], realValues: string[] = [], tendValues: string[] = [];
    let replValues: string[] = [];
    const lp = { dates: /^(métrica|data|nome|lb|date)/i, prev: /prev.*acum|linha.*base|prev\./i, real: /real.*acum|real\./i, tend: /tend[eê]ncia/i, repl: /replanejado/i };
    let usedLabels = false;
    for (const cells of allCells) {
      const first = cells[0]?.trim() || '';
      if (lp.dates.test(first)) { dateValues = cells.slice(1); usedLabels = true; }
      else if (lp.repl.test(first)) { replValues = cells.slice(1); usedLabels = true; }
      else if (lp.prev.test(first)) { prevValues = cells.slice(1); usedLabels = true; }
      else if (lp.real.test(first)) { realValues = cells.slice(1); usedLabels = true; }
      else if (lp.tend.test(first)) { tendValues = cells.slice(1); usedLabels = true; }
    }
    if (!usedLabels && allCells.length >= 2) {
      dateValues = allCells[0]; prevValues = allCells[1] || []; realValues = allCells[2] || []; tendValues = allCells[3] || []; replValues = allCells[4] || [];
    }
    if (dateValues.length === 0) return;
    const newData: SCurvePoint[] = dateValues.map((date, i) => ({
      date: date.trim(),
      previsto: parseNumber(prevValues[i]),
      real: parseNumber(realValues[i]),
      tendencia: parseNumber(tendValues[i]),
      ...(replValues[i] !== undefined && replValues[i] !== '' ? { replanejado: parseNumber(replValues[i]) } : {}),
    })).filter(p => p.date !== '');
    if (replValues.some(v => v !== undefined && v !== '')) setShowReplanejado(true);
    if (newData.length > 0) { setSCurveData(newData); setShowPaste(false); setPasteText(''); }
  }, [pasteText, setSCurveData]);

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Dados da Curva S</h2>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            size="sm"
            variant={showReplanejado ? 'default' : 'outline'}
            onClick={() => setShowReplanejado(!showReplanejado)}
            className="gap-1"
          >
            {showReplanejado ? '✓' : '+'} Replanejado
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)} className="gap-1">
            <ClipboardPaste className="h-4 w-4" /> Colar do Excel
          </Button>
          <Button size="sm" onClick={addSCurvePoint} className="gap-1">
            <Plus className="h-4 w-4" /> Coluna
          </Button>
        </div>
      </div>

      {showPaste && (
        <div className="mb-4 space-y-2 p-4 rounded-md bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            Cole os dados do Excel (separados por tab):<br />
            <strong>Linha 1:</strong> Datas | <strong>Linha 2:</strong> Prev. Acum. % | <strong>Linha 3:</strong> Real Acum. % | <strong>Linha 4:</strong> Tendência %
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
              {sCurveData.map((point, i) => (
                <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[90px]">
                  <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={point.date} onChange={(e) => updateCell(i, 'date', e.target.value)} placeholder="Data" />
                  <button onClick={() => removeSCurvePoint(i)} className="text-destructive/70 hover:text-destructive mt-0.5"><Trash2 className="h-3 w-3 mx-auto" /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 bg-[hsl(var(--chart-cutline)/0.1)] px-3 py-2 font-semibold border border-border text-[hsl(var(--chart-cutline))] text-xs">📍 Data de Status</td>
              {sCurveData.map((_, i) => (
                <td key={i} className={`border border-border px-1 py-1 text-center ${i === statusDateIndex ? 'bg-[hsl(var(--chart-cutline)/0.15)]' : ''}`}>
                  <input type="radio" name="statusDate" checked={i === statusDateIndex} onChange={() => setStatusDateIndex(i)} className="accent-[hsl(var(--chart-cutline))]" />
                </td>
              ))}
            </tr>
            {[
              { label: 'Linha base %', field: 'previsto' as const },
              { label: 'Real Acum. %', field: 'real' as const },
              { label: 'Tendência %', field: 'tendencia' as const },
              ...(showReplanejado ? [{ label: 'Replanejado %', field: 'replanejado' as const }] : []),
            ].map(({ label, field }) => (
              <tr key={field}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground">{label}</td>
                {sCurveData.map((point, i) => (
                  <td key={i} className="border border-border px-1 py-1">
                    <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={point[field] ?? ''} onChange={(e) => updateCell(i, field, e.target.value)} />
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

export default SCurveSpreadsheet;
