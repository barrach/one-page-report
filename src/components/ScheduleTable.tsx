import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useCurrentProject } from '@/store/projectStore';
import { useIsMobile } from '@/hooks/use-mobile';

const fmtPct = (n: number) => Math.round(n).toString();

const fmtDesvio = (n: number) => {
  if (!n) return '0';
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2).replace('.', ',');
  return n < 0 ? `-${str}` : str;
};

const levelStyle = (level: number): React.CSSProperties =>
  level === 1 ? { backgroundColor: '#1a3158', color: '#ffffff', fontWeight: 700 } :
  level === 2 ? { backgroundColor: '#2e5fa3', color: '#ffffff', fontWeight: 700 } :
  level === 3 ? { backgroundColor: '#d6e4f0', color: '#1a3158', fontWeight: 700 } :
  level === 4 ? { backgroundColor: '#ffffff', color: '#333333' } :
                { backgroundColor: '#ffffff', color: '#555555' };

const ScheduleTable = () => {
  const { scheduleData } = useCurrentProject();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const all = (scheduleData || []).filter(r => r.tarefa);
  const data = search
    ? all.filter(r =>
        r.tarefa.toLowerCase().includes(search.toLowerCase()) ||
        String(r.id ?? '').includes(search) ||
        (r.outlineNumber || '').includes(search)
      )
    : all;

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
      <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Cronograma</h3>
      <p className="text-xs text-muted-foreground mb-3">Status das atividades planejadas</p>

      {/* Search */}
      <div className="relative mb-3">
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
          {data.map((row, i) => {
            const level = row.outlineLevel ?? 1;
            const isOpen = !!expanded[i];
            const isMilestone = !!row.milestone && !row.summary;
            const borderColor = row.desvio < 0 ? '#dc2626' : '#16a34a';
            const desvioColor = row.desvio < 0 ? '#dc2626' : row.desvio > 0 ? '#16a34a' : '#999';
            const baselineStyle = (v: string): React.CSSProperties =>
              v === 'ND' ? { fontStyle: 'italic', color: '#aaa' } : {};

            return (
              <div
                key={i}
                onClick={() => setExpanded(s => ({ ...s, [i]: !s[i] }))}
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
                  <div>Início: <strong>{row.inicio || '—'}</strong></div>
                  <div className="col-span-2">Término: <strong>{row.termino || '—'}</strong></div>
                </div>
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-current/20 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                    <div>Início Base: <span style={baselineStyle(row.inicioBase)}><strong>{row.inicioBase || '—'}</strong></span></div>
                    <div>Término Base: <span style={baselineStyle(row.terminoBase)}><strong>{row.terminoBase || '—'}</strong></span></div>
                  </div>
                )}
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa encontrada.</p>
          )}
        </div>
      ) : (
        /* Desktop: table */
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-table-header text-table-header-foreground">
                <th className="px-2 py-2 text-center w-16 rounded-tl-lg border border-border/30">+</th>
                <th className="px-2 py-2 text-center w-12 border border-border/30">Id</th>
                <th className="px-2 py-2 text-left border border-border/30 min-w-[220px]">Nome da Tarefa</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">Prev. %</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">% Trab.</th>
                <th className="px-2 py-2 text-center border border-border/30 w-20">Desvio</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Início</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Término</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28">Início Base</th>
                <th className="px-2 py-2 text-center border border-border/30 w-28 rounded-tr-lg">Término Base</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const level = row.outlineLevel ?? 1;
                const isMilestone = !!row.milestone && !row.summary;
                const indentPx = Math.min(Math.max(level - 1, 0), 5) * 16;

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
                    <td className="px-2 py-1.5 text-center border border-border/30 opacity-80">{row.id}</td>
                    <td className="px-2 py-1.5 border border-border/30">
                      <span style={{ paddingLeft: `${indentPx}px` }} className="inline-block">
                        {isMilestone && <span className="mr-1">🔷</span>}
                        {row.tarefa}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center border border-border/30">{fmtPct(row.previsto)}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30">{fmtPct(row.trabalhoConcluido)}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30" style={desvioStyle}>
                      {fmtDesvio(row.desvio)}
                    </td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.inicio}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap">{row.termino}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.inicioBase)}>{row.inicioBase}</td>
                    <td className="px-2 py-1.5 text-center border border-border/30 whitespace-nowrap" style={baselineStyle(row.terminoBase)}>{row.terminoBase}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScheduleTable;
