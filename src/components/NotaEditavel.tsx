import { useEffect, useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { NotaDeTexto } from '@/store/projectStore';
import { cn } from '@/lib/utils';

/**
 * Campo de texto salvo, para o que o sistema não tem como calcular.
 *
 * Nem toda obra importa a Programação Semanal, e a reunião tem problema para
 * registrar do mesmo jeito. Sem este campo o bloco dizia "sem dado" e a
 * conversa acontecia fora do relatório — que é onde ela se perde.
 *
 * Só quem lança dado escreve; os demais leem o que foi escrito.
 */
const NotaEditavel = ({ nota, podeEditar, aoSalvar, placeholder, vazio, classe }: {
  nota: NotaDeTexto | null | undefined;
  podeEditar: boolean;
  aoSalvar: (texto: string) => void;
  placeholder: string;
  /** O que aparece quando não há nada escrito. */
  vazio: string;
  classe?: string;
}) => {
  const [texto, setTexto] = useState(nota?.texto ?? '');
  const [editando, setEditando] = useState(false);

  // Trocar de obra tem que trocar o texto: sem isto a nota de uma apareceria
  // na outra até alguém recarregar a página.
  useEffect(() => {
    setTexto(nota?.texto ?? '');
    setEditando(false);
  }, [nota?.texto, nota?.atualizadoEm]);

  const temTexto = (nota?.texto ?? '').trim().length > 0;

  if (editando) {
    return (
      <div className={cn('space-y-2', classe)}>
        <Textarea
          autoFocus rows={5} value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5" onClick={() => { aoSalvar(texto); setEditando(false); }}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
          <Button
            size="sm" variant="ghost" className="h-8"
            onClick={() => { setTexto(nota?.texto ?? ''); setEditando(false); }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-start justify-between gap-3', classe)}>
      <div className="min-w-0">
        {temTexto ? (
          <>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{nota?.texto}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {nota?.autor || 'equipe'}
              {nota?.atualizadoEm && ` · ${new Date(nota.atualizadoEm).toLocaleDateString('pt-BR')}`}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{vazio}</p>
        )}
      </div>
      {podeEditar && (
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0"
          onClick={() => setEditando(true)}
        >
          <Pencil className="h-3 w-3" /> {temTexto ? 'Editar' : 'Escrever'}
        </Button>
      )}
    </div>
  );
};

export default NotaEditavel;
