import { useProjectStore, useCurrentProject, ScheduleRow } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';

const parseNumber = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.trim().replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
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
        <div className="flex gap-2 flex-wrap justify-end">
          <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)} className="gap-1">
            <ClipboardPaste className="h-4 w-4" /> Colar do Excel
          </Button>
          <Button size="sm" variant="outline" onClick={addScheduleRow} className="gap-1">
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

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setTimeout(() => { setImportFile(null); setDetected(null); setImportError(null); }, 300); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Cronograma
            </DialogTitle>
            <DialogDescription>
              Exporte do MS Project: <strong>Arquivo → Salvar Como → Excel</strong>
            </DialogDescription>
          </DialogHeader>

          <label
            className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors block ${
              detected ? 'border-success bg-success/5' :
              importError ? 'border-destructive bg-destructive/5' :
              'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProjectFile(f); }}
            />
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="font-semibold text-sm">Arquivo .xlsx do MS Project</div>
              <div className="text-xs text-muted-foreground">
                {importFile ? importFile.name : 'Clique para selecionar o arquivo'}
              </div>
            </div>
          </label>

          {importError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {importError}
            </div>
          )}

          {detected && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <div><span className="font-semibold">Aba detectada:</span> <span className="font-mono">{detected.sheetName}</span></div>
                <div><span className="font-semibold">Tarefas encontradas:</span> {detected.rows.length}</div>
                <div><span className="font-semibold">Colunas mapeadas:</span> {Object.keys(detected.columnIndex).map(k => COL_LABELS[k as keyof typeof COL_LABELS]).join(', ')}</div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Preview (primeiras 5 linhas)</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="text-xs w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        {(Object.keys(COL_LABELS) as (keyof typeof COL_LABELS)[]).filter(k => detected.columnIndex[k] != null).map(k => (
                          <th key={k} className="px-2 py-1.5 text-left border-b border-border whitespace-nowrap">{COL_LABELS[k]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detected.rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-border">
                          {(Object.keys(COL_LABELS) as (keyof typeof COL_LABELS)[]).filter(k => detected.columnIndex[k] != null).map(k => {
                            const v = r[k as keyof ScheduleRow];
                            return <td key={k} className="px-2 py-1 whitespace-nowrap">{typeof v === 'number' ? v.toFixed(1) : String(v ?? '')}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                <Button onClick={confirmProjectImport}>Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleSpreadsheet;
