import { useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore, type MotivoDesvio, type Project } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';

/**
 * Motivos do desvio do mês, um embaixo do outro.
 *
 * Lista e não campo único: a reunião levanta um motivo por vez, e sobrescrever
 * o anterior apagaria o histórico do mês — que é justamente o que se quer ler
 * na revisão seguinte. Cada motivo salva sozinho, com autor e data, e a caixa
 * de escrever volta vazia para o próximo.
 */
const MotivosDoDesvio = ({ projeto }: { projeto: Project }) => {
  const setMotivosDesvio = useProjectStore((s) => s.setMotivosDesvio);
  const { canEdit, user } = useAuth();

  const [novo, setNovo] = useState('');
  const [escrevendo, setEscrevendo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');

  // O campo único da versão anterior entra como o primeiro motivo da lista, em
  // vez de sumir da tela de quem já tinha escrito nele.
  const motivos: MotivoDesvio[] = projeto.motivosDesvio?.length
    ? projeto.motivosDesvio
    : projeto.notaProblemas?.texto?.trim()
      ? [{
        id: 'legado',
        texto: projeto.notaProblemas.texto,
        data: projeto.notaProblemas.atualizadoEm,
        autor: projeto.notaProblemas.autor,
      }]
      : [];

  const gravar = (lista: MotivoDesvio[]) => setMotivosDesvio(projeto.id, lista);

  const adicionar = () => {
    const texto = novo.trim();
    if (!texto) return;
    gravar([...motivos, {
      // Sem Date.now sozinho: dois motivos escritos no mesmo milissegundo
      // teriam a mesma chave e o React embaralharia as caixas.
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      texto,
      data: new Date().toISOString(),
      autor: user?.email ?? undefined,
    }]);
    setNovo('');
    setEscrevendo(false);
  };

  const salvarEdicao = (id: string) => {
    const texto = rascunho.trim();
    if (!texto) return;
    gravar(motivos.map((m) => (m.id === id ? { ...m, texto } : m)));
    setEditandoId(null);
  };

  const data = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-2">
      {motivos.length === 0 && !escrevendo && (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? 'Qual o motivo do desvio em relação ao previsto para o mês e o realizado?'
            : 'Nenhum motivo registrado para o desvio do mês.'}
        </p>
      )}

      {motivos.map((m, i) => (
        <div key={m.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          {editandoId === m.id ? (
            <>
              <Textarea
                autoFocus rows={3} value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                className="text-sm"
              />
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => salvarEdicao(m.id)}>
                  <Save className="h-3 w-3" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditandoId(null)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  <span className="text-muted-foreground font-semibold mr-1.5">{i + 1}.</span>
                  {m.texto}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {m.autor || 'equipe'}{m.data && ` · ${data(m.data)}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditandoId(m.id); setRascunho(m.texto); }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Editar motivo"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => gravar(motivos.filter((x) => x.id !== m.id))}
                    className="p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remover motivo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {canEdit && (escrevendo ? (
        <div className="rounded-lg border border-primary/40 bg-card px-3 py-2">
          <Textarea
            autoFocus rows={3} value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Qual o motivo do desvio em relação ao previsto para o mês e o realizado?"
            className="text-sm"
          />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={adicionar} disabled={!novo.trim()}>
              <Save className="h-3 w-3" /> Salvar motivo
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
              onClick={() => { setNovo(''); setEscrevendo(false); }}
            >
              <X className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
          onClick={() => setEscrevendo(true)}
        >
          <Plus className="h-3 w-3" /> {motivos.length > 0 ? 'Outro motivo' : 'Escrever motivo'}
        </Button>
      ))}
    </div>
  );
};

export default MotivosDoDesvio;
