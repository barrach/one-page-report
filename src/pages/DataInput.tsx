import { useProjectStore, useCurrentProject, type ProjectInfo } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Save } from 'lucide-react';
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
import TemplatesDownload from '@/components/TemplatesDownload';
import ScheduleSpreadsheet from '@/components/ScheduleSpreadsheet';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import ClimaConfig from '@/components/ClimaConfig';
import EapFinanceiraInput from '@/components/EapFinanceiraInput';
import { avancoDaCurva, indiceDoStatus } from '@/lib/avancoCurva';
import { useAuth, type AppRole } from '@/context/AuthContext';
import { visaoMensal } from '@/lib/visaoMensal';
import { formatISOLocal, parseWeekLabel } from '@/lib/dateUtils';

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

/**
 * Campos das Informações do Projeto.
 *
 * `papeis` restringe quem vê o campo. Sem `papeis`, todo mundo vê.
 *
 * ATENÇÃO: isto esconde o campo da TELA, não protege o dado. O projeto inteiro
 * viaja num único JSON para o navegador, então quem souber abrir o DevTools
 * ainda enxerga o custo. Proteger de verdade exige separar o campo em outra
 * tabela com RLS — hoje o RLS está desligado no banco.
 */
const INFO_FIELDS: {
  label: string;
  key: keyof ProjectInfo;
  type: 'text' | 'date' | 'number';
  papeis?: AppRole[];
}[] = [
  { label: 'Projeto', key: 'projeto', type: 'text' },
  { label: 'Cliente', key: 'cliente', type: 'text' },
  { label: 'Gestor', key: 'gestor', type: 'text' },
  { label: 'Planejador', key: 'planejador', type: 'text' },
  { label: 'Tipo de obra', key: 'tipoObra', type: 'text' },
  { label: 'Custo da obra (R$)', key: 'custoObra', type: 'number', papeis: ['admin', 'gestor', 'planejador'] },
  { label: 'Início', key: 'inicio', type: 'date' },
  { label: 'Término LB', key: 'terminoLB', type: 'date' },
  { label: 'Término Prev.', key: 'terminoPrev', type: 'date' },
  { label: 'Avanço Prev. (%)', key: 'avancoPrev', type: 'number' },
  { label: 'Avanço Real (%)', key: 'avancoReal', type: 'number' },
  { label: 'Atualizado em', key: 'atualizadoEm', type: 'date' },
  { label: 'Semana de análise', key: 'semanaAnalise', type: 'text' },
];

const camposVisiveis = (papel: AppRole | null) =>
  INFO_FIELDS.filter((f) => !f.papeis || (papel != null && f.papeis.includes(papel)));

const ProjectInfoEditor = ({ info, setInfo }: { info: ProjectInfo; setInfo: (patch: Partial<ProjectInfo>) => void }) => {
  const [draft, setDraft] = useState<ProjectInfo>(info);
  const { role } = useAuth();
  const campos = useMemo(() => camposVisiveis(role), [role]);

  // Ressincroniza quando o projeto muda (ex.: troca de projeto ou import)
  useEffect(() => { setDraft(info); }, [info]);

  const dirty = useMemo(
    () => campos.some(f => String(draft[f.key] ?? '') !== String(info[f.key] ?? '')),
    [campos, draft, info]
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
    // Só os campos que a pessoa enxerga entram no patch: incluir os escondidos
    // faria quem não vê o custo gravá-lo de volta com o valor do próprio draft.
    campos.forEach(f => { (patch as Record<string, unknown>)[f.key] = draft[f.key]; });
    patch.infoSavedAt = new Date().toISOString();
    setInfo(patch);
  };

  return (
    <SecaoRecolhivel id="info-projeto" titulo="Informações do Projeto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campos.map((field) => (
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
    </SecaoRecolhivel>
  );
};

const DataInputPage = () => {
  const { info, monthData, lastImports, sCurveData, statusDateIndex } = useCurrentProject();
  const { setInfo, setMonthData } = useProjectStore();

  // ── Avanço Prev./Real seguem a Curva S ──
  // O efeito dispara quando o PONTO da curva muda, não a cada render: assim o
  // cabeçalho acompanha a curva sozinho e, ao mesmo tempo, uma correção feita à
  // mão sobrevive até a curva mudar de novo.
  const avanco = useMemo(
    () => avancoDaCurva(
      sCurveData,
      indiceDoStatus(sCurveData, info?.atualizadoEm || '', statusDateIndex, { inicio: info?.inicio, periodicidade: info?.curvaPeriodicidade }),
    ),
    [sCurveData, info?.atualizadoEm, statusDateIndex],
  );
  const ultimoAvanco = useRef<string>('');
  useEffect(() => {
    if (!avanco) return;
    const assinatura = `${avanco.previsto}|${avanco.real}`;
    if (ultimoAvanco.current === assinatura) return;
    ultimoAvanco.current = assinatura;
    if (info.avancoPrev === avanco.previsto && info.avancoReal === avanco.real) return;
    setInfo({ avancoPrev: avanco.previsto, avancoReal: avanco.real });
    // `info` fora das dependências de propósito: reagir a ele reescreveria o
    // valor logo depois de alguém corrigi-lo na mão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avanco, setInfo]);
  // ── Início do projeto = primeira data da Curva S ──
  // A curva é quem define quando a obra começa; deixar o campo solto fazia o
  // cabeçalho dizer 18/dez enquanto a curva partia de 09/dez. Não há risco de
  // laço: o painel de HH/Custo gera as datas A PARTIR do início, então os dois
  // convergem para o mesmo valor e o efeito para de disparar.
  const inicioDaCurva = useMemo(() => {
    const primeira = (sCurveData ?? []).find((p) => p.date);
    if (!primeira) return null;
    const d = parseWeekLabel(primeira.date, new Date().getFullYear());
    return d ? formatISOLocal(d) : null;
  }, [sCurveData]);

  useEffect(() => {
    if (inicioDaCurva && inicioDaCurva !== info.inicio) setInfo({ inicio: inicioDaCurva });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioDaCurva]);

  // O mês vem das semanas da Curva S que caem no mês do "Atualizado em". O
  // `monthData` guardado só aparece em projeto antigo, que ainda tem o mês
  // digitado à mão e nenhuma curva cobrindo aquele período.
  const janelaMensal = useMemo(
    () => visaoMensal(sCurveData, info?.atualizadoEm || '', info?.mesBase ?? 'linhaBase', { inicio: info?.inicio, periodicidade: info?.curvaPeriodicidade }),
    [sCurveData, info?.atualizadoEm, info?.mesBase],
  );
  const mesDerivado = janelaMensal.length > 0;
  const mesData = mesDerivado ? janelaMensal : monthData;

  const [showMonthPaste, setShowMonthPaste] = useState(false);
  const [monthPasteText, setMonthPasteText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const monthFileRef = useRef<HTMLInputElement>(null);


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


  const updateMonth = (index: number, field: string, value: string) => {
    const updated = monthData.map((m, i) =>
      i === index ? { ...m, [field]: field === 'label' ? value : parseFloat(value) || 0 } : m
    );
    setMonthData(updated);
  };


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

      <TemplatesDownload />

      {/* Project Info */}
      <ProjectInfoEditor info={info} setInfo={setInfo} />

      <ClimaConfig />

      <EapFinanceiraInput />

      <div>
        <SCurveSpreadsheet />
        <ImportStamp iso={lastImports?.sCurve} />
      </div>

      {/* Month Data */}
      <SecaoRecolhivel
        id="prev-real-mes"
        titulo="Prev. x Realizado Mês"
        acoes={monthData.length > 0 ? (
          <ClearDataButton sectionName="Prev. x Realizado Mês" onConfirm={() => setMonthData([])} />
        ) : undefined}
      >
        <PasteSection show={showMonthPaste} text={monthPasteText} setText={setMonthPasteText} onImport={handleMonthPaste} label="Semanas" />
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[120px]">Métrica</th>
                {mesData.map((m, i) => (
                  <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[90px]">
                    {mesDerivado ? (
                      m.label
                    ) : (
                      <input className="bg-transparent text-center text-[hsl(var(--table-header-foreground))] w-full outline-none text-xs font-semibold" value={m.label} onChange={(e) => updateMonth(i, 'label', e.target.value)} placeholder="Semana" />
                    )}
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
                  {mesData.map((m, i) => (
                    <td key={i} className={cn('border border-border px-1 py-1', mesDerivado && 'text-center bg-muted/30 tabular-nums')}>
                      {mesDerivado ? (
                        ((m as any)[field] || 0) > 0 ? (m as any)[field] : '—'
                      ) : (
                        <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5" value={(m as any)[field]} onChange={(e) => updateMonth(i, field, e.target.value)} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ImportStamp iso={lastImports?.month} />
      </SecaoRecolhivel>

      <div>
        <HistogramSpreadsheet />
        <ImportStamp iso={lastImports?.histogram} />
      </div>

      {/* Cronograma — as tarefas trazidas pelo "Importar Semana" */}
      <div>
        <ScheduleSpreadsheet />
        <ImportStamp iso={lastImports?.schedule} />
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
    <SecaoRecolhivel
      id="prog-semanal"
      titulo="Programação Semanal — PPC"
      resumo={
        <span className="text-xs text-muted-foreground">
          {weeks.length} semana{weeks.length !== 1 ? 's' : ''} importada{weeks.length !== 1 ? 's' : ''}
        </span>
      }
      acoes={
        <ClearDataButton
          sectionName="Programação Semanal"
          onConfirm={() => clearProgramacaoSemanal(projectId!)}
        />
      }
    >
      <PpcSemanalTable data={weeks} showPeriodo={false} />

      {lastImports?.progSemanal && (
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          Atualizado em {formatTimestamp(lastImports.progSemanal)}
        </p>
      )}
    </SecaoRecolhivel>
  );
};

export default DataInputPage;
