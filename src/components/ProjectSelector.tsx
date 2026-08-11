import { useProjectStore } from '@/store/projectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Exibe o botão de excluir o projeto selecionado. */
  showDelete?: boolean;
  /** 'dark' adapta as cores para uso sobre o fundo escuro do cabeçalho do relatório. */
  tone?: 'light' | 'dark';
}

const ProjectSelector = ({ showDelete = false, tone = 'light' }: Props) => {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore();
  const dark = tone === 'dark';

  return (
    <div className="flex items-center gap-1 min-w-0">
      <Select value={selectedProjectId} onValueChange={selectProject}>
        <SelectTrigger
          className={cn(
            'h-8 w-auto min-w-[180px] max-w-[440px] text-sm whitespace-nowrap',
            dark &&
              'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 focus:ring-primary-foreground/30'
          )}
        >
          <SelectValue placeholder="Selecione o projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showDelete && projects.length > 1 && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 px-2 shrink-0',
            dark
              ? 'text-primary-foreground/60 hover:text-destructive hover:bg-primary-foreground/10'
              : 'text-muted-foreground hover:text-destructive'
          )}
          title="Excluir projeto"
          onClick={() => deleteProject(selectedProjectId)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

export default ProjectSelector;
