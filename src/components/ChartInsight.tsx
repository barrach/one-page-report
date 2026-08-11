import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { oprDataClient as supabase } from '@/integrations/supabase/oprDataClient';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import { useTvMode } from '@/hooks/use-tv-mode';
import { useExportMode } from '@/hooks/use-export-mode';
import { mensagemDaFunction } from '@/lib/functionError';

interface ChartInsightProps {
  chartType: 'fiveweek' | 'scurve' | 'histogram' | 'month' | 'financialcurve';
  data: unknown;
  projectInfo?: { projeto?: string; avancoPrev?: number; avancoReal?: number };
}

const ChartInsight = ({ chartType, data, projectInfo }: ChartInsightProps) => {
  const { aiInsights } = useCurrentProject();
  const setAiInsight = useProjectStore(s => s.setAiInsight);
  const savedInsight = aiInsights?.[chartType] ?? null;
  const { tvMode } = useTvMode();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recolhido, setRecolhido] = useState(false);
  const { exportando } = useExportMode();
  const { toast } = useToast();

  const generateInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('chart-insight', {
        body: { chartType, data, projectInfo },
      });

      if (fnError) throw new Error(await mensagemDaFunction(fnError));
      if (result?.error) {
        if (result.error.includes('Limite')) {
          toast({ title: 'Limite atingido', description: result.error, variant: 'destructive' });
        } else if (result.error.includes('Créditos')) {
          toast({ title: 'Créditos insuficientes', description: result.error, variant: 'destructive' });
        }
        throw new Error(result.error);
      }

      setAiInsight(chartType, result.insight);
      setRecolhido(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar observação');
    } finally {
      setLoading(false);
    }
  };

  // Na TV não há interação nem espaço a perder: o gráfico é o que importa.
  if (tvMode) return null;

  if (!savedInsight && !loading && !error) {
    return (
      <button
        onClick={generateInsight}
        data-pdf-hide
        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
      >
        <Sparkles className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
        Gerar observação com IA
      </button>
    );
  }

  // No PDF a observação sai sempre visível: recolhida, ela sumiria do papel.
  const fechado = recolhido && !exportando;

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Analisando dados...
            </div>
          ) : error ? (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          ) : fechado ? (
            <button
              onClick={() => setRecolhido(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              Observação da IA
            </button>
          ) : (
            <p className="text-xs text-foreground leading-relaxed">{savedInsight}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!loading && (
            <button
              onClick={generateInsight}
              data-pdf-hide
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Regenerar"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          {/* Recolher: a observação fica guardada, só sai da frente do gráfico */}
          {savedInsight && !loading && !error && (
            <button
              onClick={() => setRecolhido((v) => !v)}
              data-pdf-hide
              className="text-muted-foreground hover:text-primary transition-colors"
              title={recolhido ? 'Mostrar observação' : 'Recolher observação'}
            >
              {recolhido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartInsight;
