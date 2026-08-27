import { useCurrentProject } from '@/store/projectStore';
import { cn } from '@/lib/utils';

/**
 * Há quanto tempo o dado daquele card foi atualizado.
 *
 * O app sempre gravou a data de cada importação e nunca a mostrou. Sem ela, um
 * cronograma de três semanas atrás aparece ao lado de uma Curva S de ontem com
 * exatamente a mesma cara — e o relatório passa a mentir com aparência de
 * atualizado. Quem lê precisa saber a que momento cada número se refere.
 *
 * Vai para o papel de propósito: no PDF a dúvida sobre o frescor é ainda maior,
 * porque o arquivo circula por dias.
 */

/** Depois de quantos dias a idade do dado deixa de ser detalhe e vira alerta. */
const DIAS_ATENCAO = 8;
const DIAS_CRITICO = 15;

type Secao = 'sCurve' | 'weekly' | 'month' | 'histogram' | 'schedule' | 'progSemanal' | 'curvaSFinanceira';

const diasDesde = (iso: string): number | null => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

const texto = (dias: number): string => {
  if (dias <= 0) return 'atualizado hoje';
  if (dias === 1) return 'atualizado ontem';
  return `atualizado há ${dias} dias`;
};

const SeloDeFrescor = ({ secao }: { secao: Secao }) => {
  const { lastImports } = useCurrentProject();
  const iso = lastImports?.[secao];
  if (!iso) return null;

  const dias = diasDesde(iso);
  if (dias == null) return null;

  const nivel = dias >= DIAS_CRITICO ? 'critico' : dias >= DIAS_ATENCAO ? 'atencao' : 'ok';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap',
        nivel === 'critico' && 'text-destructive',
        nivel === 'atencao' && 'text-amber-600 dark:text-amber-500',
        nivel === 'ok' && 'text-muted-foreground',
      )}
      title={`Última importação: ${new Date(iso).toLocaleString('pt-BR')}`}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          nivel === 'critico' && 'bg-destructive',
          nivel === 'atencao' && 'bg-amber-500',
          nivel === 'ok' && 'bg-success',
        )}
      />
      {texto(dias)}
    </span>
  );
};

export default SeloDeFrescor;
