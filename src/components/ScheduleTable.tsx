import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useCurrentProject } from '@/store/projectStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { computeVisibleIndices, rowHasChildren } from '@/lib/scheduleHierarchy';
import { cn } from '@/lib/utils';
import { useExportMode } from '@/hooks/use-export-mode';
import type { ScheduleRow } from '@/store/projectStore';
import type { ColunaCronograma } from '@/lib/parseCronogramaColado';

const fmtPct = (n: number) => Math.round(n).toString();

const fmtDesvio = (n: number) => {
  if (!n) return '0';
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2).replace('.', ',');
  return n < 0 ? `-${str}` : str;
};

const fmtCusto = (v: number | undefined) =>
  v == null || v === 0 ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Cores do Status vindo do MS Project (No Prazo / Atrasada / Concluída / Futura). */
const statusStyle = (status: string | undefined): React.CSSProperties => {
  const st = (status || '').toLowerCase();
  if (st.includes('atras')) return { color: '#dc2626', fontWeight: 600 };
  if (st.includes('prazo')) return { color: '#16a34a', fontWeight: 600 };
  if (st.includes('conclu')) return { color: '#2563eb', fontWeight: 600 };
  return {};
};

const levelStyle = (level: number): React.CSSProperties =>
  level === 1 ? { backgroundColor: '#1a3158', color: '#ffffff', fontWeight: 700 } :
  level === 2 ? { backgroundColor: '#2e5fa3', color: '#ffffff', fontWeight: 700 } :
  level === 3 ? { backgroundColor: '#d6e4f0', color: '#1a3158', fontWeight: 700 } :
  level === 4 ? { backgroundColor: '#ffffff', color: '#333333' } :
                { backgroundColor: '#ffffff', color: '#555555' };

const LEVEL_BUTTONS = [
  { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
  { label: '4', value: 4 }, { label: '5', value: 5 }, { label: 'Todos', value: 99 },
];

/**
 * Versão de impressão do cronograma.
 *
 * A tabela da tela usa estilo inline por linha, botão de colapsar e ícone de
 * marco — coisas que o html2canvas renderiza de forma inconsistente (no PDF
 * anterior as linhas de resumo saíram completamente vazias, sem nem os
 * travessões). Aqui é uma tabela simples: cor por classe, nível como texto,
 * nome indentado, nada de botão. Mostra exatamente as linhas visíveis do nível
 * escolhido na tela.
 */
const CronogramaParaImpressao = ({
  rows,
  indices,
  total,
  nivel,
}: {
  rows: ScheduleRow[];
  indices: number[];
  total: number;
  nivel: number;
}) => {
  const corDoNivel = (n: number) =>
    n === 1 ? 'bg-[#1a3158] text-white font-bold'
    : n === 2 ? 'bg-[#2e5fa3] text-white font-bold'
    : n === 3 ? 'bg-[#d6e4f0] text-[#1a3158] font-semibold'
    : 'bg-white text-[#333333]';

  const th = 'px-1.5 py-1 border border-[#c9d4e4] text-center font-bold';
  const td = 'px-1.5 py-1 border border-[#c9d4e4] text-center align-middle';

  return (
    <div className="bg-card rounded-xl p-4 card-shadow border">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Cronograma</h3>
      <p className="text-xs text-muted-foreground mb-2">
        Status das atividades planejadas · até nível {nivel === 99 ? 'todos' : nivel}
      </p>

      <table className="w-full border-collapse" style={{ fontSize: '8px' }}>
        <thead>
          <tr className="bg-[#0d2340] text-white">
            <th className={th}>Nível</th>
            <th className={th}>Status</th>
            <th className={th}>Crít.</th>
            <th className={cn(th, 'text-left')}>Nome da Tarefa</th>
            <th className={th}>% LB</th>
            <th className={th}>% Real</th>
            <th className={th}>Desvio</th>
            <th className={th}>Dur. real</th>
            <th className={th}>Dur. rest.</th>
            <th className={th}>Início LB</th>
            <th className={th}>Início Real</th>
            <th className={th}>Prev. Início</th>
            <th className={th}>Término LB</th>
            <th className={th}>Término Real</th>
            <th className={th}>Prev. Término</th>
            <th className={th}>Custo</th>
          </tr>
        </thead>
        <tbody>
          {indices.map((i) => {
            const r = rows[i];
            const nivelLinha = r.outlineLevel ?? 1;
            const desvioCor = r.desvio < 0 ? 'text-[#dc2626] font-semibold'
              : r.desvio > 0 ? 'text-[#16a34a] font-semibold' : '';
            return (
              <tr key={i} className={corDoNivel(nivelLinha)}>
                <td className={td} style={{ fontFamily: 'monospace' }}>{r.outlineNumber || ''}</td>
                <td className={td}>{r.status || '—'}</td>
                <td className={td}>{r.critica === undefined ? '—' : r.critica ? 'Sim' : 'Não'}</td>
                <td className={cn(td, 'text-left')}>
                  <span style={{ paddingLeft: `${Math.min(Math.max(nivelLinha - 1, 0), 5) * 8}px` }}>
                    {r.tarefa}
                  </span>
                </td>
                <td className={td}>{Math.round(r.previsto)}</td>
                <td className={td}>{Math.round(r.trabalhoConcluido)}</td>
                <td className={cn(td, desvioCor)}>{fmtDesvio(r.desvio)}</td>
                <td className={td}>{r.duracaoReal || '—'}</td>
                <td className={td}>{r.duracaoRestante || '—'}</td>
                <td className={td}>{r.inicioBase || '—'}</td>
                <td className={td}>{r.inicioReal || '—'}</td>
                <td className={td}>{r.previsaoInicio || r.inicio || '—'}</td>
                <td className={td}>{r.terminoBase || '—'}</td>
                <td className={td}>{r.terminoReal || '—'}</td>
                <td className={td}>{r.previsaoTermino || r.termino || '—'}</td>
                <td className={td}>{r.custo ? Math.round(r.custo).toLocaleString('pt-BR') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-1 text-[9px] text-muted-foreground">
        Exibindo {indices.length} de {total} linhas.
      </p>
    </div>
  );
};


/**
 * Cronograma com as colunas que vieram da importação.
 *
 * Quando o cronograma é colado do MS Project, o relatório mostra exatamente as
 * colunas do arquivo, com os títulos originais: cada obra traz as colunas que
 * interessam a ela, e a tabela fixa jogava fora justamente as que o planejador
 * escolheu trazer.
 *
 * O Nível continua vindo da estrutura de tópicos do Project (`outlineLevel`) —
 * é ele que o filtro "Exibir até nível" usa, independente de quais colunas
 * vieram.
 */
const TabelaImportada = ({
  rows, indices, colunas, collapsed, onToggle, semBusca,
}: {
  rows: ScheduleRow[];
  indices: number[];
  colunas: ColunaCronograma[];
  collapsed: Set<number>;
  onToggle: (i: number) => void;
  semBusca: boolean;
}) => (
  <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
    <table className="w-full text-[10px] sm:text-xs border-collapse">
      <thead>
        <tr className="bg-table-header text-table-header-foreground">
          <th className="px-2 py-2 text-center w-16 rounded-tl-lg border border-border/30">Nível</th>
          {colunas.map((c, k) => (
            <th
              key={c.chave}
              className={cn(
                'px-2 py-2 border border-border/30',
                c.campo === 'tarefa' ? 'text-left min-w-[220px]' : 'text-center whitespace-nowrap',
                k === colunas.length - 1 && 'rounded-tr-lg',
              )}
            >
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {indices.map((i) => {
          const row = rows[i];
          const level = row.outlineLevel ?? 1;
          const temFilhos = semBusca && rowHasChildren(rows, i);
          const recolhido = collapsed.has(i);
          return (
            <tr key={i} style={{ ...levelStyle(level), fontSize: level <= 2 ? '13px' : '12px' }}>
              <td className="px-2 py-1 text-center border border-border/30 tabular-nums">
                {row.outlineNumber || level}
              </td>
              {colunas.map((c) => {
                const valor = row.celulas?.[c.chave] ?? '';
                if (c.campo === 'tarefa') {
                  return (
                    <td key={c.chave} className="px-2 py-1 border border-border/30">
                      <span
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${Math.min(Math.max(level - 1, 0), 5) * 16}px` }}
                      >
                        {temFilhos ? (
                          <button
                            onClick={() => onToggle(i)}
                            data-pdf-hide
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            {recolhido ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                        <span className="min-w-0">{valor || row.tarefa}</span>
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={c.chave} className="px-2 py-1 text-center border border-border/30 whitespace-nowrap">
                    {valor || '—'}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
const ScheduleTable = () => {
  const { scheduleData, scheduleColunas } = useCurrentProject();
  const { exportando } = useExportMode();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [expandedMobile, setExpandedMobile] = useState<Record<number, boolean>>({});
  const [maxLevel, setMaxLevel] = useState<number>(4);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const all = (scheduleData || []).filter(r => r.tarefa);
  // Só valem as colunas que as linhas realmente trazem: cronograma antigo, sem
  // `celulas`, continua na tabela fixa em vez de virar uma grade de traços.
  const colunasImportadas = (scheduleColunas ?? []).length > 0 && all.some((r) => r.celulas)
    ? (scheduleColunas ?? [])
    : [];

  const toggleCollapse = (idx: number) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });

  // Visibility: when searching, ignore the hierarchical filter (show every match).
  const visibleIdx = useMemo(() => {
    if (search) {
      const q = search.toLowerCase();
      return all
        .map((r, i) => ({ r, i }))
        .filter(({ r }) =>
          r.tarefa.toLowerCase().includes(q) ||
          String(r.id ?? '').includes(search) ||
          (r.outlineNumber || '').includes(search),
        )
        .map(({ i }) => i);
    }
    return computeVisibleIndices(all, maxLevel, collapsed);
  }, [all, maxLevel, collapsed, search]);

  if (exportando) {
    return (
      <CronogramaParaImpressao rows={all} indices={visibleIdx} total={all.length} nivel={maxLevel} />
    );
  }

  if (all.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
        <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Cronograma</h3>
        <p className="text-xs text-muted-foreground text-center py-8">
          Nenhum dado de cronograma. Adicione dados na aba Dados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-3 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between mb-1 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Cronograma</h3>
          <p className="text-xs text-muted-foreground">Status das atividades planejadas</p>
        </div>
        <div data-pdf-hide className="flex items-center gap-1.5 text-[11px] flex-wrap">
          <span className="text-muted-foreground">Exibir até nível:</span>
          {LEVEL_BUTTONS.map((b) => (
            <button
              key={b.value}
              onClick={() => setMaxLevel(b.value)}
              className={cn(
                'px-2 py-0.5 rounded border font-medium transition-colors',
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

      {/* Search */}
      <div data-pdf-hide className="relative mb-3 mt-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar tarefa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 sm:h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {isMobile ? (
        /* Mobile: card per task */
        <div className="space-y-2">
          {visibleIdx.map((i) => {
            const row = all[i];
            const level = row.outlineLevel ?? 1;
            const isOpen = !!expandedMobile[i];
            const isMilestone = !!row.milestone && !row.summary;
            const borderColor = row.desvio < 0 ? '#dc2626' : '#16a34a';
            const desvioColor = row.desvio < 0 ? '#dc2626' : row.desvio > 0 ? '#16a34a' : '#999';
            const baselineStyle = (v: string): React.CSSProperties =>
              v === 'ND' ? { fontStyle: 'italic', color: '#aaa' } : {};

            return (
              <div
                key={i}
                onClick={() => setExpandedMobile((s) => ({ ...s, [i]: !s[i] }))}
                className="rounded-lg p-3 cursor-pointer transition-shadow active:shadow-inner"
                style={{
                  ...levelStyle(level),
                  borderLeft: `3px solid ${borderColor}`,
                  fontSize: '13px',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.85 }}>
                      {row.outlineNumber || '—'}
                    </span>
                    <span className="text-[11px] opacity-70">ID: {row.id}</span>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </div>
                <div className="mt-1 font-semibold leading-snug" style={{ wordBreak: 'break-word' }}>
                  {isMilestone && <span className="mr-1">🔷</span>}
                  {row.tarefa}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <div>Prev: <strong>{fmtPct(row.previsto)}%</strong></div>
                  <div>Real: <strong>{fmtPct(row.trabalhoConcluido)}%</strong></div>
                  <div>Desvio: <strong style={{ color: desvioColor }}>{fmtDesvio(row.desvio)}</strong></div>
                  <div>Status: <strong>{row.status || '—'}</strong></div>
                  <div className="col-span-2">Prev. de Término: <strong>{row.previsaoTermino || row.termino || '—'}</strong></div>
                </div>
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-current/20 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                    <div>Crítica: <strong>{row.critica === undefined ? '—' : row.critica ? 'Sim' : 'Não'}</strong></div>
                    <div>Custo: <strong>{fmtCusto(row.custo)}</strong></div>
                    <div>Dur. real: <strong>{row.duracaoReal || '—'}</strong></div>
                    <div>Dur. restante: <strong>{row.duracaoRestante || '—'}</strong></div>
                    <div>Início LB: <span style={baselineStyle(row.inicioBase)}><strong>{row.inicioBase || '—'}</strong></span></div>
                    <div>Término LB: <span style={baselineStyle(row.terminoBase)}><strong>{row.terminoBase || '—'}</strong></span></div>
                    <div>Início Real: <strong>{row.inicioReal || '—'}</strong></div>
                    <div>Término Real: <strong>{row.terminoReal || '—'}</strong></div>
                    <div className="col-span-2">Prev. de Início: <strong>{row.previsaoInicio || row.inicio || '—'}</strong></div>
                  </div>
                )}
              </div>
            );
          })}
          {visibleIdx.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa encontrada.</p>
          )}
        </div>
      ) : colunasImportadas.length > 0 ? (
        /* Cronograma colado: mostra as colunas do arquivo, com os títulos dele. */
        <TabelaImportada
          rows={all}
          indices={visibleIdx}
          colunas={colunasImportadas}
          collapsed={collapsed}
          onToggle={toggleCollapse}
          semBusca={!search}
        />
      ) : (
        /* Desktop: as 15 colunas do "Template - Cronograma", para o cronograma
           que veio por arquivo e não traz a lista de colunas. */
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[1500px]">
            <thead>
              {/* Colunas do "Template - Cronograma", na mesma ordem do arquivo */}
              <tr className="bg-table-header text-table-header-foreground">
                <th className="px-2 py-2 text-center w-16 rounded-tl-lg border border-border/30">Nível</th>
                <th className="px-2 py-2 text-center border border-border/30 w-24">Status</th>
                <th className="px-2 py-2 text-center border border-border/30 w-16">Crítica</th>
                <th className="px-2 py-2 text-left border border-border/30 min-w-[220px]">Nome da Tarefa</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">% LB Prev.</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">% Real</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">Desvio</th>
                <th className="px-2 py-2 text-center border border-border/30 w-24">Dur. real</th>
                <th className="px-2 py-2 text-center border border-border/30 w-24">Dur. restante</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Início LB</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Início Real</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Prev. de Início</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Término LB</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Término Real</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Prev. de Término</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28 rounded-tr-lg">Custo</th>
              </tr>
            </thead>
            <tbody>
              {visibleIdx.map((i) => {
                const row = all[i];
                const level = row.outlineLevel ?? 1;
                const isMilestone = !!row.milestone && !row.summary;
                const indentPx = Math.min(Math.max(level - 1, 0), 5) * 16;
                const hasKids = !search && rowHasChildren(all, i);
                const isCollapsed = collapsed.has(i);

                const rowStyle: React.CSSProperties = {
                  ...levelStyle(level),
                  fontSize: level <= 2 ? '13px' : level === 3 ? '12px' : '12px',
                };

                const desvioStyle: React.CSSProperties =
                  row.desvio < 0 ? { color: '#dc2626', fontWeight: 600 } :
                  row.desvio > 0 ? { color: '#16a34a', fontWeight: 600 } :
                                   { color: '#999999' };

                const baselineStyle = (v: string): React.CSSProperties =>
                  v === 'ND' ? { fontStyle: 'italic', color: '#aaaaaa' } : {};

                return (
                  <tr
                    key={i}
                    style={rowStyle}
                    className={`border-b border-border/30 ${row.highlight ? 'ring-1 ring-warning/40 ring-inset' : ''}`}
                  >
                    <td className="px-2 py-1.5 text-center border border-border/30" style={{ fontFamily: 'monospace', fontSize: '11px', color: level <= 2 ? '#ffffff' : '#444444' }}>{row.outlineNumber || ''}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={statusStyle(row.status)}>{row.status || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30" style={row.critica ? { color: '#dc2626', fontWeight: 700 } : undefined}>
                      {row.critica === undefined ? '—' : row.critica ? 'Sim' : 'Não'}
                    </td>
                    <td className="px-2 py-1.5 border border-border/30">
                      <span style={{ paddingLeft: `${indentPx}px` }} className="inline-flex items-center gap-1 align-middle">
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
                        {isMilestone && <span>🔷</span>}
                        <span>{row.tarefa}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center border border-border/30">{fmtPct(row.previsto)}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30">{fmtPct(row.trabalhoConcluido)}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30" style={desvioStyle}>
                      {fmtDesvio(row.desvio)}
                    </td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.duracaoReal || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.duracaoRestante || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.inicioBase)}>{row.inicioBase || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.inicioReal ?? '')}>{row.inicioReal || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.previsaoInicio || row.inicio || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.terminoBase)}>{row.terminoBase || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.terminoReal ?? '')}>{row.terminoReal || '—'}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.previsaoTermino || row.termino || '—'}</td>
                    <td className="px-2 py-1.5 text-right border border-border/30 whitespace-nowrap">{fmtCusto(row.custo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">
        Exibindo {visibleIdx.length} de {all.length} linhas.
      </p>
    </div>
  );
};

export default ScheduleTable;
