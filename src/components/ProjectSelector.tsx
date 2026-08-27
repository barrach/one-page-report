import { useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

/**
 * Escolha em dois passos: primeiro o CLIENTE, depois a OBRA daquele cliente.
 *
 * Uma lista única com todas as obras funciona com meia dúzia; com trinta, quem
 * abre o relatório procura o contrato numa lista onde UNIPAR, Rhodia e
 * ArcelorMittal estão misturadas. O cliente é o primeiro filtro que a pessoa
 * tem na cabeça.
 */

/** Obra sem cliente preenchido não pode sumir da lista — cai neste balde. */
const SEM_CLIENTE = 'Sem cliente';

interface Props {
  /** Exibe o botão de excluir o projeto selecionado. */
  showDelete?: boolean;
  /** 'dark' adapta as cores para uso sobre o fundo escuro do cabeçalho do relatório. */
  tone?: 'light' | 'dark';
}

const ProjectSelector = ({ showDelete = false, tone = 'light' }: Props) => {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore();
  const { canManageProjects } = useAuth();
  const dark = tone === 'dark';

  const clienteDe = (id: string) =>
    projects.find((p) => p.id === id)?.info?.cliente?.trim() || SEM_CLIENTE;

  const clienteAtual = clienteDe(selectedProjectId);

  const clientes = useMemo(() => {
    const nomes = new Set(projects.map((p) => p.info?.cliente?.trim() || SEM_CLIENTE));
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [projects]);

  const obrasDoCliente = useMemo(
    () => projects.filter((p) => (p.info?.cliente?.trim() || SEM_CLIENTE) === clienteAtual),
    [projects, clienteAtual],
  );

  /**
   * Trocar de cliente já abre a primeira obra dele.
   *
   * Deixar a obra anterior selecionada mostraria o relatório de um cliente com o
   * nome de outro no seletor ao lado — pior que trocar sem pedir.
   */
  const trocarCliente = (cliente: string) => {
    const primeira = projects.find((p) => (p.info?.cliente?.trim() || SEM_CLIENTE) === cliente);
    if (primeira) selectProject(primeira.id);
  };

  const gatilho = cn(
    'h-8 w-auto text-sm whitespace-nowrap',
    dark &&
      'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 focus:ring-primary-foreground/30',
  );

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
      {/* Com um cliente só, o primeiro seletor não decide nada e sai da frente. */}
      {clientes.length > 1 && (
        <Select value={clienteAtual} onValueChange={trocarCliente}>
          <SelectTrigger className={cn(gatilho, 'min-w-[140px] max-w-[240px]')} title="Cliente">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedProjectId} onValueChange={selectProject}>
        <SelectTrigger className={cn(gatilho, 'min-w-[180px] max-w-[440px]')} title="Obra / contrato">
          <SelectValue placeholder="Selecione a obra" />
        </SelectTrigger>
        <SelectContent>
          {obrasDoCliente.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Excluir projeto é exclusivo de quem administra. */}
      {showDelete && canManageProjects && projects.length > 1 && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 px-2 shrink-0',
            dark
              ? 'text-primary-foreground/60 hover:text-destructive hover:bg-primary-foreground/10'
              : 'text-muted-foreground hover:text-destructive'
          )}
          title="Excluir obra"
          onClick={() => deleteProject(selectedProjectId)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

export default ProjectSelector;
