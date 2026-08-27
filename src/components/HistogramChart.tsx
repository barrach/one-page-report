import { useMemo } from 'react';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { filtrarPeriodo, ROTULO_PERIODO, type PeriodoHistograma } from '@/lib/histograma';
import ChartInsight from '@/components/ChartInsight';
import ObservacoesDoCard from '@/components/ObservacoesDoCard';
import ChartExpandModal from '@/components/ChartExpandModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Cell, ReferenceLine,
} from 'recharts';

const HistogramChart = () => {
  const { histogramData, info } = useCurrentProject();
  const setInfo = useProjectStore((s) => s.setInfo);
  const { selectedDate, setSelectedDate } = useReportInteraction();
  const isMobile = useIsMobile();

  const periodo: PeriodoHistograma = info?.histPeriodo ?? 'tudo';
  const allData = useMemo(
    () => filtrarPeriodo((histogramData || []).filter(h => h.date), info?.atualizadoEm || '', periodo),
    [histogramData, info?.atualizadoEm, periodo],
  );
  // No celular o recorte já é curto; sem ele, as últimas 8 semanas continuam
  // sendo o que cabe na tela.
  const data = isMobile && periodo === 'tudo' ? allData.slice(-8) : allData;
  const temReplanejado = data.some((d) => (d.replanejado ?? 0) > 0);

  // Boundary between last real week and first future (previsto) week
  let lastRealIdx = -1;
  data.forEach((d, i) => { if ((d.real ?? 0) > 0) lastRealIdx = i; });
  const firstFutureIdx = data.findIndex((d, i) => i > lastRealIdx && (d.previsto ?? 0) > 0);
  const boundaryLabel =
    lastRealIdx >= 0 && firstFutureIdx > lastRealIdx ? data[firstFutureIdx].date : null;

  const handleClick = (data: any) => {
    if (data?.activeLabel) setSelectedDate(data.activeLabel, 'histogram');
  };

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
        <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-wider">Histograma MOD</h3>
        <p className="text-xs text-muted-foreground">Nenhum dado de histograma. Adicione dados na aba Dados.</p>
      </div>
    );
  }

  const chartContent = (height: string) => (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} onClick={handleClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tickFormatter={(v: string) => {
              // "Dez/25 S2" → "S2" ; "Dez/25 S1" → "Dez/25 S1"
              const m = /^(.+)\s(S[1-4])$/.exec(v);
              if (m && m[2] !== 'S1') return m[2];
              return v;
            }}
          />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [value, name === 'previsto' ? 'MOD Previsto' : 'MOD Real']}
            labelFormatter={(label) => {
              const item = data.find(d => d.date === label);
              return `${label}${item?.semana ? ` (Sem. ${item.semana})` : ''}`;
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 12 }}>
                {value === 'previsto' ? 'MOD Prevista' : 'MOD Real'}
              </span>
            )}
            wrapperStyle={{ paddingTop: 8 }}
            content={({ payload }) => (
              <div className="flex gap-4 justify-center pt-2">
                {(payload || []).map((entry, i) => {
                  const cores: Record<string, string> = {
                    real: 'hsl(var(--chart-real))',
                    previsto: 'hsl(var(--chart-previsto))',
                    replanejado: '#f97316',
                  };
                  const nomes: Record<string, string> = {
                    real: 'MOD Real',
                    previsto: 'MOD Prevista',
                    replanejado: 'MOD Replanejada',
                  };
                  const chave = String(entry.dataKey ?? 'previsto');
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cores[chave] ?? cores.previsto }} />
                      <span className="text-xs text-muted-foreground">{nomes[chave] ?? chave}</span>
                    </div>
                  );
                })}
              </div>
            )}
          />

          {selectedDate && data.some(d => d.date === selectedDate) && (
            <ReferenceLine x={selectedDate} stroke="hsl(var(--primary))" strokeWidth={2} strokeOpacity={0.5} />
          )}

          {boundaryLabel && (
            <ReferenceLine
              x={boundaryLabel}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          )}

          <Bar dataKey="previsto" name="previsto" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="previsto" position="top" fontSize={11} fill="hsl(var(--chart-previsto))" />
            {data.map((entry, i) => (
              <Cell key={i}
                fill={selectedDate === null || selectedDate === entry.date
                  ? 'hsl(var(--chart-previsto))'
                  : 'hsl(var(--chart-previsto) / 0.3)'}
              />
            ))}
          </Bar>
          <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="real" position="top" fontSize={11} fill="hsl(var(--chart-real))" formatter={(v: number) => v > 0 ? v : ''} />
            {data.map((entry, i) => (
              <Cell key={i}
                fill={selectedDate === null || selectedDate === entry.date
                  ? 'hsl(var(--chart-real))'
                  : 'hsl(var(--chart-real) / 0.3)'}
              />
            ))}
          </Bar>
          {/* Só aparece quando existe replanejamento — barra vazia em toda semana
              só polui o gráfico de quem não replanejou. */}
          {temReplanejado && (
            <Bar dataKey="replanejado" name="replanejado" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="replanejado" position="top" fontSize={11} fill="#f97316" formatter={(v: number) => v > 0 ? v : ''} />
              {data.map((entry, i) => (
                <Cell key={i}
                  fill={selectedDate === null || selectedDate === entry.date ? '#f97316' : '#f9731640'}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Histograma MOD</h3>
        <div className="flex items-center gap-2 shrink-0">
          {/* Recorte fica fora do papel: no PDF vale a janela escolhida, não o seletor. */}
          <div className="flex gap-1 print:hidden" data-html2canvas-ignore>
            {(['tudo', '15', '30'] as PeriodoHistograma[]).map((p) => (
              <button
                key={p}
                onClick={() => setInfo({ histPeriodo: p })}
                className={cn(
                  'px-2 py-1 rounded border text-[11px] font-medium transition-colors',
                  periodo === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {ROTULO_PERIODO[p]}
              </button>
            ))}
          </div>
          <ChartExpandModal
            title="Histograma MOD"
            subtitle="Mão de obra prevista × real por período"
            expandedHeight="h-full"
          >
            {chartContent('h-full min-h-0')}
          </ChartExpandModal>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Mão de obra prevista × real por período
        {periodo !== 'tudo' && ` · ${ROTULO_PERIODO[periodo]} em torno da data de status`}
      </p>
      {/* Altura mínima como piso; a sobra da linha do grid é absorvida pelo flex-1. */}
      {chartContent('flex-1 min-h-[260px] sm:min-h-[450px]')}
      <ChartInsight chartType="histogram" data={data} projectInfo={info} />
      <ObservacoesDoCard card="histogram" />
    </div>
  );
};

export default HistogramChart;

