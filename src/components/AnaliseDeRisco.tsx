import { useEffect, useState } from 'react';
import { Sparkles, Save, RefreshCw, Pencil } from 'lucide-react';
import { oprDataClient as supabase } from '@/integrations/supabase/oprDataClient';
import { useProjectStore, type RiscoConsolidado } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mensagemDaFunction } from '@/lib/functionError';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Análise de risco da carteira do cliente — escrita à mão, com ajuda da IA.
 *
 * A IA escreve NO MESMO campo que a pessoa edita, de propósito. Um texto de IA
 * que não se pode corrigir é pior que inútil numa reunião: alguém vai discordar
 * de uma frase e a saída seria ignorar o bloco inteiro. Aqui a IA faz o
 * primeiro rascunho e quem responde pela obra dá a palavra final — e a tela
 * mostra qual dos dois está no ar.
 *
 * Só quem lança dado escreve; os demais leem.
 */
const AnaliseDeRisco = ({ cliente, idsDoCliente, salvo, dadosParaIa }: {
  cliente: string;
  idsDoCliente: string[];
  salvo: RiscoConsolidado | null;
  dadosParaIa: { data: unknown; projectInfo: unknown };
}) => {
  const setRiscoConsolidado = useProjectStore((s) => s.setRiscoConsolidado);
  const { canEdit, user } = useAuth();

  const [texto, setTexto] = useState(salvo?.texto ?? '');
  const [editando, setEditando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Trocar de cliente tem que trocar o texto — senão a análise da UNIPAR
  // apareceria no consolidado do FRIGO até alguém recarregar a página.
  useEffect(() => {
    setTexto(salvo?.texto ?? '');
    setEditando(false);
    setErro(null);
  }, [cliente, salvo?.atualizadoEm, salvo?.texto]);

  const salvar = (valor: string, porIa: boolean) => {
    if (idsDoCliente.length === 0) return;
    setRiscoConsolidado(idsDoCliente, valor.trim(), porIa, user?.email ?? undefined);
    setEditando(false);
  };

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const { data: r, error } = await supabase.functions.invoke('chart-insight', {
        body: { chartType: 'risco-consolidado', ...dadosParaIa },
      });
      if (error) throw new Error(await mensagemDaFunction(error));
      if (r?.error) throw new Error(r.error);

      const gerado = String(r?.insight ?? '').trim();
      if (!gerado) throw new Error('A IA respondeu vazio. Tente de novo.');

      setTexto(gerado);
      salvar(gerado, true);
      toast.success('Análise gerada. Revise e ajuste o que for preciso.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar a análise';
      setErro(
        msg.includes('chartType inválido')
          ? 'A função chart-insight ainda não conhece a análise de risco — falta publicar a versão nova dela no Supabase.'
          : msg,
      );
    } finally {
      setGerando(false);
    }
  };

  const temTexto = (salvo?.texto ?? '').trim().length > 0;

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Análise de risco
        </h3>
        {canEdit && !editando && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setEditando(true)}>
              <Pencil className="h-3 w-3" /> {temTexto ? 'Editar' : 'Escrever'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={gerar} disabled={gerando}>
              {gerando ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {gerando ? 'Gerando…' : temTexto ? 'Refazer com IA' : 'Gerar com IA'}
            </Button>
          </div>
        )}
      </div>

      {erro && <p className="text-xs text-destructive mb-2">{erro}</p>}

      {editando ? (
        <>
          <Textarea
            autoFocus
            rows={10}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={`Qual obra concentra o risco da carteira ${cliente}? O que decidir nesta semana?`}
            className="text-sm"
          />
          <div className="flex items-center gap-2 mt-2">
            {/* Salvar como texto de gente, mesmo quando a IA escreveu o rascunho:
                quem editou assumiu o texto, e o selo tem que dizer isso. */}
            <Button size="sm" className="h-8 gap-1.5" onClick={() => salvar(texto, false)}>
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8"
              onClick={() => { setTexto(salvo?.texto ?? ''); setEditando(false); }}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : temTexto ? (
        <>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{salvo?.texto}</p>
          <p className={cn('text-[10px] mt-2', salvo?.porIa ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground')}>
            {salvo?.porIa
              ? 'Rascunho da IA — ainda não revisado por ninguém.'
              : `Escrito por ${salvo?.autor || 'alguém da equipe'}`}
            {salvo?.atualizadoEm && ` · ${new Date(salvo.atualizadoEm).toLocaleDateString('pt-BR')}`}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? 'Nenhuma análise escrita. Gere um rascunho com IA ou escreva a sua — o gráfico mostra o risco de cada obra isolada, e é aqui que entra o que se soma entre elas.'
            : 'Nenhuma análise de risco registrada para este cliente.'}
        </p>
      )}
    </div>
  );
};

export default AnaliseDeRisco;
