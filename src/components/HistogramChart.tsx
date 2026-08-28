import SeloDeFrescor from '@/components/SeloDeFrescor';
import { useMemo } from 'react';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import { useReportInteraction } from '@/store/reportInteraction';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { alinharComCurva, filtrarPeriodo, ROTULO_PERIODO, type PeriodoHistograma } from '@/lib/histograma';
import { anoDeReferencia } from '@/lib/dateUtils';
import ChartInsight from '@/components/ChartInsight';
import ObservacoesDoCard from '@/components/ObservacoesDoCard';
import ChartExpandModal from '@/components/ChartExpandModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Cell, ReferenceLine,
} from 'recharts';

/**
 * Histograma de mão de obra.
 *
 * Com MOI lançada, cada período vira DUAS colunas empilhadas: previsto
 * (MOD + MOI) e real (MOD + MOI). O empilhamento é o ponto — o que se compara
 * é o efetivo total de cada semana, e dentro da mesma coluna dá para ver quanto
 * dele é indireta. Quatro barras soltas lado a lado obrigariam a somar de
 * cabeça justamente o número que decide a conversa.
 *
 * Sem MOI lançada nada muda: continuam as barras simples de antes.
 */

const CORES = {
  previsto: 'hsl(var(--chart-previsto))',
  real: 'hsl(var(--chart-real))',
  replanejado: '#f97316',
  // A MOI é o mesmo tom da sua dupla, mais claro: dentro da coluna a leitura é
  // "quanto disto é indireta", e não uma terceira série concorrendo por atenção.
  moiPrevisto: 'hsl(var(--chart-previsto) / 0.45)',
  moiReal: 'hsl(var(--chart-real) / 0.45)',
  moiReplanejado: '#f9731777',
} as const;

const APAGADAS = {
  previsto: 'hsl(var(--chart-previsto) / 0.3)',
  real: 'hsl(var(--chart-real) / 0.3)',
  replanejado: '#f9731740',
  moiPrevisto: 'hsl(var(--chart-previsto) / 0.14)',
  moiReal: 'hsl(var(--chart-real) / 0.14)',
  moiReplanejado: '#f9731722',
} as const;

const NOMES: Record<string, string> = {
  previsto: 'MOD Prevista',
  real: 'MOD Real',
  replanejado: 'MOD Replanejada',
  moiPrevisto: 'MOI Prevista',
  moiReal: 'MOI Real',
  moiReplanejado: 'MOI Replanejada',
};

type Serie = keyof typeof CORES;

const HistogramChart = () => {
  const { histogramData, sCurveData, info } = useCurrentProject();
  const setInfo = useProjectStore((s) => s.setInfo);
  const { selectedDate, setSelectedDate } = useReportInteraction();
  const isMobile = useIsMobile();

  const periodo: PeriodoHistograma = info?.histPeriodo ?? 'tudo';
  const anoRef = anoDeReferencia(info?.atualizadoEm);

  /**
   * As colunas do relatório são as semanas da Curva S — as mesmas da planilha
   * de Dados.
   *
   * Sem isto o histograma desenha os rótulos como vieram da importação
   * ("Dez/25 S2") enquanto a Curva S desenha os dela ("08/dez"): dois gráficos
   * lado a lado no mesmo relatório, com eixos que não batem, e ninguém consegue
   * ler a semana de um no outro. O casamento é por DATA, não por texto.
   *
   * Histograma vazio segue vazio: alinhar produziria uma grade de zeros no
   * lugar do aviso de "sem dado".
   */
  const alinhado = useMemo(() => {
    const bruto = (histogramData || []).filter((h) => h.date);
    if (bruto.length === 0) return bruto;
    return alinharComCurva(bruto, sCurveData, anoRef);
  }, [histogramData, sCurveData, anoRef]);

  const allData = useMemo(
    () => filtrarPeriodo(alinhado, info?.atualizadoEm || '', periodo),
    [alinhado, info?.atualizadoEm, periodo],
  );
  // No celular o recorte já é curto; sem ele, as últimas 8 semanas continuam
  // sendo o que cabe na tela.
  const recorte = isMobile && periodo === 'tudo' ? allData.slice(-8) : allData;

  // Os totais entram nos dados porque é neles que vai o rótulo do topo da
  // pilha: o recharts rotula segmento a segmento, e quem lê quer o efetivo.
  const data = useMemo(
    () => recorte.map((d) => ({
      ...d,
      totalPrev: (d.previsto ?? 0) + (d.moiPrevisto ?? 0),
      totalReal: (d.real ?? 0) + (d.moiReal ?? 0),
      totalReplan: (d.replanejado ?? 0) + (d.moiReplanejado ?? 0),
    })),
    [recorte],
  );

  const temReplanejado = data.some((d) => d.totalReplan > 0);
  const temMoi = data.some((d) => (d.moiPrevisto ?? 0) > 0 || (d.moiReal ?? 0) > 0);

  // Fronteira entre a última semana com apontamento e a primeira futura.
  let lastRealIdx = -1;
  data.forEach((d, i) => { if (d.totalReal > 0) lastRealIdx = i; });
  const firstFutureIdx = data.findIndex((d, i) => i > lastRealIdx && d.totalPrev > 0);
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

  const titulo = temMoi ? 'Histograma MOD + MOI' : 'Histograma MOD';
  const legenda = temMoi
    ? 'Efetivo previsto × real por período — cada coluna empilha MOD e MOI'
    : 'Mão de obra prevista × real por período';

  /**
   * Uma série do gráfico.
   *
   * `pilha` só é passada quando há MOI: sem ela o recharts volta sozinho ao
   * lado-a-lado de antes. O canto arredondado fica no segmento de cima da
   * pilha, senão o arredondado do meio abriria uma fresta entre as duas partes.
   */
  const barra = (serie: Serie, pilha: string | undefined, topo: boolean, rotulo?: string) => (
    <Bar
      key={serie}
      dataKey={serie}
      name={serie}
      stackId={pilha}
      radius={topo ? [4, 4, 0, 0] : [0, 0, 0, 0]}
    >
      {rotulo && (
        <LabelList
          dataKey={rotulo}
          position="top"
          fontSize={11}
          fill={CORES[serie]}
          formatter={(v: number) => (v > 0 ? v : '')}
        />
      )}
      {data.map((entry, i) => (
        <Cell
          key={i}
          fill={selectedDate === null || selectedDate === entry.date ? CORES[serie] : APAGADAS[serie]}
        />
      ))}
    </Bar>
  );

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
            formatter={(value: number, name: string) => [value, NOMES[name] ?? name]}
            labelFormatter={(label) => {
              const item = data.find(d => d.date === label);
              const sufixo = item?.semana ? ` (Sem. ${item.semana})` : '';
              // Com pilha, o total é o número da conversa — e o tooltip só
              // mostraria as partes.
              const total = temMoi && item
                ? ` · prev. ${item.totalPrev} / real ${item.totalReal}`
                : '';
              return `${label}${sufixo}${total}`;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            content={({ payload }) => (
              <div className="flex gap-x-4 gap-y-1 justify-center pt-2 flex-wrap">
                {(payload || []).map((entry, i) => {
                  const chave = String(entry.dataKey ?? 'previsto');
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: CORES[chave as Serie] ?? CORES.previsto }}
                      />
                      <span className="text-xs text-muted-foreground">{NOMES[chave] ?? chave}</span>
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

          {/* Previsto: MOD embaixo, MOI em cima, rótulo com o efetivo total. */}
          {barra('previsto', temMoi ? 'prev' : undefined, !temMoi, temMoi ? undefined : 'previsto')}
          {temMoi && barra('moiPrevisto', 'prev', true, 'totalPrev')}

          {barra('real', temMoi ? 'real' : undefined, !temMoi, temMoi ? undefined : 'real')}
          {temMoi && barra('moiReal', 'real', true, 'totalReal')}

          {/* Só aparece quando existe replanejamento — barra vazia em toda semana
              só polui o gráfico de quem não replanejou. */}
          {temReplanejado && barra('replanejado', temMoi ? 'replan' : undefined, !temMoi, temMoi ? undefined : 'replanejado')}
          {temReplanejado && temMoi && barra('moiReplanejado', 'replan', true, 'totalReplan')}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{titulo}</h3>
          <SeloDeFrescor secao="histogram" />
        </div>
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
            title={titulo}
            subtitle={legenda}
            expandedHeight="h-full"
          >
            {chartContent('h-full min-h-0')}
          </ChartExpandModal>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {legenda}
        {periodo !== 'tudo' && ` · ${ROTULO_PERIODO[periodo]} a partir da semana de análise`}
      </p>
      {/* Altura mínima como piso; a sobra da linha do grid é absorvida pelo flex-1. */}
      {chartContent('flex-1 min-h-[260px] sm:min-h-[450px]')}
      <ChartInsight chartType="histogram" data={data} projectInfo={info} />
      <ObservacoesDoCard card="histogram" />
    </div>
  );
};

export default HistogramChart;
