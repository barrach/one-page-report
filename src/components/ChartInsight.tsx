import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';

interface ChartInsightProps {
  chartType: 'fiveweek' | 'scurve' | 'histogram' | 'month';
  data: unknown;
  projectInfo?: { projeto?: string; avancoPrev?: number; avancoReal?: number };
}

const ChartInsight = ({ chartType, data, projectInfo }: ChartInsightProps) => {
  const { aiInsights } = useCurrentProject();
  const setAiInsight = useProjectStore(s => s.setAiInsight);
  const savedInsight = aiInsights?.[chartType] ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('chart-insight', {
        body: { chartType, data, projectInfo },
      });

      if (fnError) throw new Error(fnError.message);
      if (result?.error) {
        if (result.error.includes('Limite')) {
          toast({ title: 'Limite atingido', description: result.error, variant: 'destructive' });
        } else if (result.error.includes('Créditos')) {
          toast({ title: 'Créditos insuficientes', description: result.error, variant: 'destructive' });
        }
        throw new Error(result.error);
      }

      setAiInsight(chartType, result.insight);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar observação');
    } finally {
      setLoading(false);
    }
  };

  if (!savedInsight && !loading && !error) {
    return (
      <button
        onClick={generateInsight}
        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
      >
        <Sparkles className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
        Gerar observação com IA
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
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
          ) : (
            <p className="text-xs text-foreground leading-relaxed">{savedInsight}</p>
          )}
        </div>
        {!loading && (
          <button
            onClick={generateInsight}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            title="Regenerar"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChartInsight;
