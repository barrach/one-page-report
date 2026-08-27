import { useProjectStore, useCurrentProject, ScheduleRow } from '@/store/projectStore';
import { Button } from '@/components/ui/button';

import { Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { computeVisibleIndices, rowHasChildren, computeOutlineNumbers } from '@/lib/scheduleHierarchy';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import ClearDataButton from '@/components/ClearDataButton';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import { lerCronogramaColado, type LeituraCronograma } from '@/lib/parseCronogramaColado';

const ScheduleSpreadsheet = () => {
  const { scheduleData } = useCurrentProject();
  const { setScheduleData, setCronograma, removeScheduleRow } = useProjectStore();
  const data = scheduleData || [];

  const [maxLevel, setMaxLevel] = useState<number>(4);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [mostrarColagem, setMostrarColagem] = useState(false);
  const [colagem, setColagem] = useState('');
  const [leitura, setLeitura] = useState<LeituraCronograma | null>(null);

  const visible = useMemo(
    () => computeVisibleIndices(data, maxLevel, collapsed),
    [data, maxLevel, collapsed],
  );

  const toggleCollapse = (i: number) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

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

  const levelButtons: Array<{ label: string; value: number }> = [
    { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
    { label: '4', value: 4 }, { label: '5', value: 5 }, { label: 'Todos', value: 99 },
  ];

  // ── Colagem direta do MS Project ──
  // Ler não aplica de imediato: o mapeamento das colunas é adivinhado pelo
  // cabeçalho, e trocar o cronograma inteiro por um palpite errado custa caro.
  const lerColagem = () => {
    const lida = lerCronogramaColado(colagem);
    if (lida.linhas.length === 0) {
      toast.error('Não achei o cabeçalho do cronograma na colagem. Copie do Project incluindo a linha de títulos das colunas.');
      return;
    }
    setLeitura(lida);
  };

  const aplicarColagem = () => {
    if (!leitura) return;
    // Linhas e colunas vão juntas: é o par que faz o relatório mostrar
    // exatamente as colunas que foram importadas, com os títulos do arquivo.
    setCronograma(computeOutlineNumbers(leitura.linhas), leitura.colunas);
    toast.success(`✓ Cronograma aplicado — ${leitura.linhas.length} tarefas, ${leitura.colunas.length} colunas`);
    setLeitura(null);
    setColagem('');
    setMostrarColagem(false);
  };

  return (
    <SecaoRecolhivel
      id="cronograma"
      titulo="Cronograma"
      acoes={
        <>
          <button
            onClick={() => setMostrarColagem((v) => !v)}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              mostrarColagem
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:text-foreground',
            )}
            title="Copiar as colunas no MS Project e colar aqui"
          >
            {mostrarColagem ? '▾ Fechar colagem' : '▸ Colar do MS Project'}
          </button>
          {data.length > 0 && (
            <ClearDataButton sectionName="Cronograma" onConfirm={() => setScheduleData([])} />
          )}
        </>
      }
    >
      {mostrarColagem && (
        <div className="mb-4 space-y-2 p-3 rounded-md bg-card border">
          <p className="text-xs text-muted-foreground">
            No MS Project, selecione as colunas <strong>com a linha de títulos</strong> e cole aqui.
            A ordem não importa — as colunas são reconhecidas pelo nome. Inclua a coluna de
            <strong> Nível</strong> (ou a EDT) para o relatório poder filtrar por nível.
          </p>
          <Textarea
            rows={5}
            value={colagem}
            onChange={(e) => setColagem(e.target.value)}
            placeholder="Cole aqui as linhas copiadas do MS Project..."
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={lerColagem}>Ler colagem</Button>
        </div>
      )}

      {leitura && (
        <div className="mb-4 space-y-3 p-3 rounded-md bg-card border border-primary/40">
          <p className="text-xs text-foreground/80">
            Reconheci <strong>{leitura.linhas.length} tarefas</strong> e estas colunas:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leitura.mapeamento.map((m) => (
              <span key={m.campo} className="text-[11px] rounded border border-border bg-muted/40 px-1.5 py-0.5">
                <strong>{m.campo}</strong> ← {m.cabecalho}
              </span>
            ))}
          </div>
          {leitura.faltando.length > 0 && (
            <p className="text-[11px] text-destructive">
              Sem coluna para: {leitura.faltando.join(', ')}. Esses campos entram vazios.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={aplicarColagem}>Aplicar cronograma</Button>
            <Button size="sm" variant="outline" onClick={() => setLeitura(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Exibir até nível:</span>
          {levelButtons.map((b) => (
            <button
              key={b.value}
              onClick={() => setMaxLevel(b.value)}
              className={cn(
                'px-2 py-1 rounded border text-xs font-medium transition-colors',
                maxLevel === b.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              <th className="px-1 py-1.5 text-center border border-border w-14" title="Nível hierárquico (OutlineNumber)">+</th>
              <th className="px-2 py-1.5 text-center border border-border w-12">Id</th>
              <th className="px-2 py-1.5 text-left border border-border min-w-[200px]">Nome da Tarefa</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">Prev. %</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">% Trab.</th>
              <th className="px-2 py-1.5 text-center border border-border w-16">Desvio</th>
              <th className="px-2 py-1.5 text-center border border-border w-28">Início</th>
              <th className="px-2 py-1.5 text-center border border-border w-28">Término</th>
              <th className="px-2 py-1.5 text-center border border-border w-28">Início Base</th>
              <th className="px-2 py-1.5 text-center border border-border w-28">Término Base</th>
              <th className="px-1 py-1.5 w-8 border border-border"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => {
              const row = data[i];
              const level = row.outlineLevel ?? 1;
              const indentPx = Math.min(Math.max(level - 1, 0), 5) * 16;
              const hasKids = rowHasChildren(data, i);
              const isCollapsed = collapsed.has(i);
              const rowStyle: React.CSSProperties =
                level === 1 ? { backgroundColor: '#1a3158', color: '#ffffff', fontWeight: 700, fontSize: '13px' } :
                level === 2 ? { backgroundColor: '#2e5fa3', color: '#ffffff', fontWeight: 700, fontSize: '13px' } :
                level === 3 ? { backgroundColor: '#d6e4f0', color: '#1a3158', fontWeight: 700, fontSize: '12px' } :
                level === 4 ? { backgroundColor: '#ffffff', color: '#333333', fontWeight: 400, fontSize: '12px' } :
                              { backgroundColor: '#ffffff', color: '#555555', fontWeight: 400, fontSize: '11px' };
              const desvioStyle: React.CSSProperties =
                row.desvio < 0 ? { color: '#dc2626', fontWeight: 600 } :
                row.desvio > 0 ? { color: '#16a34a', fontWeight: 600 } :
                                 { color: '#999999' };
              const baselineStyle = (v: string): React.CSSProperties =>
                v === 'ND' ? { fontStyle: 'italic', color: '#aaaaaa' } : {};
              const inheritStyle: React.CSSProperties = { color: 'inherit' };
              return (
              <tr key={i} style={rowStyle} className={`border-b border-border ${row.highlight ? 'ring-1 ring-warning/40 ring-inset' : ''}`}>
                <td className="border border-border px-1 py-0.5 text-center" style={{ fontFamily: 'monospace', fontSize: '11px', color: level <= 2 ? '#ffffff' : '#444444' }}>{row.outlineNumber || ''}</td>
                <td className="border border-border px-1 py-0.5">
                  <input className="w-full text-center bg-transparent outline-none text-xs" style={inheritStyle} value={row.id} onChange={(e) => updateRow(i, 'id', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5" style={{ paddingLeft: `${indentPx + 4}px` }}>
                  <div className="flex items-center gap-1">
                    {hasKids ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(i)}
                        className="shrink-0 hover:opacity-70"
                        style={{ color: 'inherit' }}
                        title={isCollapsed ? 'Expandir' : 'Colapsar'}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    ) : (
                      <span className="inline-block w-3" />
                    )}
                    <input className="w-full bg-transparent outline-none text-xs px-1" style={inheritStyle} value={row.tarefa} onChange={(e) => updateRow(i, 'tarefa', e.target.value)} placeholder="Nome da tarefa..." />
                  </div>
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs" style={inheritStyle} value={row.previsto} onChange={(e) => updateRow(i, 'previsto', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="1" className="w-full text-center bg-transparent outline-none text-xs" style={inheritStyle} value={row.trabalhoConcluido} onChange={(e) => updateRow(i, 'trabalhoConcluido', e.target.value)} />
                </td>
                <td className="border border-border px-1 py-0.5">
                  <input type="number" step="0.01" className="w-full text-center bg-transparent outline-none text-xs" style={desvioStyle} value={row.desvio} onChange={(e) => updateRow(i, 'desvio', e.target.value)} />
                </td>
                {(['inicio', 'termino', 'inicioBase', 'terminoBase'] as const).map((field) => {
                  const v = (row as unknown as Record<string, string>)[field];
                  const isBaseline = field === 'inicioBase' || field === 'terminoBase';
                  return (
                    <td key={field} className="border border-border px-1 py-0.5">
                      <input className="w-full text-center bg-transparent outline-none text-xs" style={isBaseline ? baselineStyle(v) : inheritStyle} value={v} onChange={(e) => updateRow(i, field, e.target.value)} />
                    </td>
                  );
                })}
                <td className="px-1 py-0.5 text-center">
                  <button onClick={() => removeScheduleRow(i)} className="text-destructive/50 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Exibindo {visible.length} de {data.length} linhas.
      </p>
    </SecaoRecolhivel>
  );
};

export default ScheduleSpreadsheet;
