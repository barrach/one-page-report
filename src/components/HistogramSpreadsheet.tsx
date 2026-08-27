import { useProjectStore, useCurrentProject, HistogramPoint } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ClipboardPaste, Upload } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import ClearDataButton from '@/components/ClearDataButton';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import { alinharComCurva, indiceDaSemanaDeStatus, lerColagemHistograma } from '@/lib/histograma';
import { cn } from '@/lib/utils';

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
  const { histogramData, sCurveData, info } = useCurrentProject();
  const { setHistogramData, addHistogramPoint, removeHistogramPoint } = useProjectStore();
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [abriuReplanejado, setAbriuReplanejado] = useState(false);
  const [abriuMoi, setAbriuMoi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const algum = (campo: keyof HistogramPoint) =>
    (histogramData ?? []).some((h) => Number(h[campo] ?? 0) > 0);

  // Linha com dado aparece sempre: esconder número já lançado atrás de um botão
  // é a forma mais fácil de alguém achar que a MOI se perdeu. O botão só existe
  // enquanto a série está vazia, para abrir espaço de digitação.
  const temReplanejado = algum('replanejado') || algum('moiReplanejado');
  const temMoi = algum('moiPrevisto') || algum('moiReal');
  const mostrarReplanejado = abriuReplanejado || temReplanejado;
  const mostrarMoi = abriuMoi || temMoi;

  const botaoCabecalho = (ativo: boolean) =>
    cn(
      'text-xs px-2 py-1 rounded border transition-colors',
      ativo
        ? 'bg-primary text-primary-foreground border-primary'
        : 'text-muted-foreground border-border hover:text-foreground',
    );

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
  // As colunas são as semanas da obra inteira, vindas da Curva S; o que já foi
  // lançado é reaproveitado casando pela data. Editar grava a série alinhada,
  // então a planilha passa a cobrir do início ao fim do projeto.
  const data = useMemo(
    () => alinharComCurva(histogramData || [], sCurveData, new Date().getFullYear()),
    [histogramData, sCurveData],
  );

  // Rola até a semana de status: numa obra longa a coluna a preencher fica
  // muito à direita, e abrir a planilha no começo obrigava a arrastar até lá.
  const rolagemRef = useRef<HTMLDivElement>(null);
  const colunaStatusRef = useRef<HTMLTableCellElement>(null);
  const statusIdx = indiceDaSemanaDeStatus(data, info?.atualizadoEm || '');

  useEffect(() => {
    const caixa = rolagemRef.current;
    const coluna = colunaStatusRef.current;
    if (!caixa || !coluna) return;
    // Uma folga de 120px deixa a semana anterior visível como referência.
    caixa.scrollLeft = Math.max(0, coluna.offsetLeft - 120);
  }, [statusIdx, data.length]);

  /**
   * Aplica a colagem sobre as colunas já existentes, pela ordem.
   *
   * Diferente do importador antigo, que trocava as colunas pelas da colagem:
   * aqui as semanas são as da obra (vindas da Curva S) e o que se cola são só
   * os valores, como se estivesse digitando mais rápido.
   */
  const aplicarColagemSeries = () => {
    const series = lerColagemHistograma(pasteText);
    const nomes = Object.keys(series) as (keyof typeof series)[];
    if (nomes.length === 0) {
      toast.error('Não consegui ler nenhuma linha de números na colagem.');
      return;
    }

    // Só as séries que vieram na colagem são tocadas: colar a MOI não pode
    // zerar a MOD que já estava lançada.
    const atualizado = data.map((p, i) => {
      const novo = { ...p } as HistogramPoint;
      nomes.forEach((s) => {
        const valor = series[s]?.[i];
        if (valor != null) (novo as Record<string, unknown>)[s] = valor;
      });
      return novo;
    });

    setHistogramData(atualizado);
    if (series.replanejado || series.moiReplanejado) setAbriuReplanejado(true);
    if (series.moiPrevisto || series.moiReal || series.moiReplanejado) setAbriuMoi(true);
    setShowPaste(false);
    setPasteText('');

    const colunas = Math.max(...nomes.map((s) => series[s]?.length ?? 0));
    toast.success(`✓ ${nomes.length} série(s) · ${colunas} colunas preenchidas`);
  };

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
    <SecaoRecolhivel
      id="histograma"
      titulo="Histograma (MOD e MOI)"
      acoes={
        <>
          <button
            onClick={() => setShowPaste((v) => !v)}
            className={botaoCabecalho(showPaste)}
            title="Colar do Excel: rotule as linhas para trazer MOD e MOI"
          >
            {showPaste ? '▾ Fechar colagem' : '▸ Colar do Excel'}
          </button>
          {/* Os botões somem quando a série já tem número: aí a linha aparece
              sozinha e não há o que abrir. */}
          {!temMoi && (
            <button
              onClick={() => setAbriuMoi((v) => !v)}
              className={botaoCabecalho(abriuMoi)}
              title="Mostrar as linhas de mão de obra indireta"
            >
              {abriuMoi ? '▾ Ocultar MOI' : '▸ Mostrar MOI'}
            </button>
          )}
          {!temReplanejado && (
            <button
              onClick={() => setAbriuReplanejado((v) => !v)}
              className={botaoCabecalho(abriuReplanejado)}
              title="Mostrar as linhas de mão de obra replanejada"
            >
              {abriuReplanejado ? '▾ Ocultar Replanj.' : '▸ Mostrar Replanj.'}
            </button>
          )}
          {histogramData.length > 0 && (
            <ClearDataButton sectionName="Histograma" onConfirm={() => setHistogramData([])} />
          )}
        </>
      }
    >
      {showPaste && (
        <div className="mb-4 space-y-2 p-4 rounded-md bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            <strong>Com MOI:</strong> ponha um rótulo na primeira célula de cada linha —{' '}
            <code className="text-xs">MOD Previsto</code>, <code className="text-xs">MOD Real</code>,{' '}
            <code className="text-xs">MOI Previsto</code>, <code className="text-xs">MOI Real</code>,{' '}
            <code className="text-xs">MOD Replanejado</code>, <code className="text-xs">MOI Replanejado</code>.
            A ordem das linhas não importa e só as séries que você colar são alteradas.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Só MOD, sem rótulo:</strong> continua valendo a ordem de sempre —
            1ª linha Previsto, 2ª Real, 3ª Replanejado. Em qualquer um dos casos os valores
            caem nas colunas que já estão na tela, pela ordem.
          </p>
          <Textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole aqui os dados copiados do Excel..." className="font-mono text-xs" />
          <Button size="sm" onClick={aplicarColagemSeries}>Aplicar nas colunas</Button>
        </div>
      )}
      <div ref={rolagemRef} className="overflow-x-auto">
        <table className="border-collapse text-xs min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[120px]">Métrica</th>
              {data.map((point, i) => (
                <th
                  key={i}
                  ref={i === statusIdx ? colunaStatusRef : undefined}
                  className={`bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[70px] ${
                    i === statusIdx ? 'ring-2 ring-inset ring-[hsl(var(--chart-cutline))]' : ''
                  }`}
                >
                  <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={point.date} onChange={(e) => updateCell(i, 'date', e.target.value)} placeholder="Data" />
                  {i === statusIdx && <span className="block text-[10px] font-normal opacity-80">status</span>}
                  <button onClick={() => removeHistogramPoint(i)} className="text-destructive/70 hover:text-destructive mt-0.5"><Trash2 className="h-3 w-3 mx-auto" /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Agrupadas como o gráfico empilha: primeiro a coluna do previsto
                (MOD + MOI), depois a do real. */}
            {[
              { label: 'Semana', field: 'semana' as const, type: 'text', sempre: true, recuo: false },
              { label: 'MOD Previsto', field: 'previsto' as const, type: 'number', sempre: true, recuo: false },
              { label: 'MOI Previsto', field: 'moiPrevisto' as const, type: 'number', sempre: mostrarMoi, recuo: true },
              { label: 'MOD Real', field: 'real' as const, type: 'number', sempre: true, recuo: false },
              { label: 'MOI Real', field: 'moiReal' as const, type: 'number', sempre: mostrarMoi, recuo: true },
              { label: 'MOD Replanejado', field: 'replanejado' as const, type: 'number', sempre: mostrarReplanejado, recuo: false },
              { label: 'MOI Replanejado', field: 'moiReplanejado' as const, type: 'number', sempre: mostrarReplanejado && mostrarMoi, recuo: true },
            ].filter((r) => r.sempre).map(({ label, field, type, recuo }) => (
              <tr key={field}>
                <td className={cn(
                  'sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground',
                  recuo && 'pl-6 font-normal text-muted-foreground',
                )}>{label}</td>
                {data.map((point, i) => (
                  <td key={i} className="border border-border px-1 py-1">
                    {/* ?? '' porque MOI e replanejado só existem depois de
                        preenchidos — sem isso o input nasce descontrolado. */}
                    <input type={type} className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={(point as any)[field] ?? ''} onChange={(e) => updateCell(i, field, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SecaoRecolhivel>
  );
};

export default HistogramSpreadsheet;
