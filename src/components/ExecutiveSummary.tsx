import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProject } from '@/store/projectStore';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ExecutiveSummary = () => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const project = useCurrentProject();

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('chart-insight', {
        body: {
          chartType: 'executive',
          data: {
            weeklyData: project.weeklyData,
            sCurveData: project.sCurveData,
            monthData: project.monthData,
            histogramData: project.histogramData,
            actions: project.actions,
            observations: project.observations,
          },
          projectInfo: project.info,
        },
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

      setSummary(result.insight);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar resumo');
    } finally {
      setLoading(false);
    }
  };

  if (!summary && !loading && !error) {
    return (
      <div className="bg-card rounded-xl border card-shadow p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Resumo Executivo com IA</p>
            <p className="text-xs text-muted-foreground">Análise completa de todos os indicadores do projeto</p>
          </div>
        </div>
        <button
          onClick={generateSummary}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Gerar Análise
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border card-shadow overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Resumo Executivo com IA</span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <button
              onClick={generateSummary}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Regenerar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analisando todos os indicadores do projeto...
                </div>
              ) : error ? (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{summary}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExecutiveSummary;
