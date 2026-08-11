import { useProjectStore } from '@/store/projectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface Props {
  /** Exibe o botão de excluir o projeto selecionado. */
  showDelete?: boolean;
}

const ProjectSelector = ({ showDelete = false }: Props) => {
  const { projects, selectedProjectId, selectProject, deleteProject } = useProjectStore();

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Select value={selectedProjectId} onValueChange={selectProject}>
        <SelectTrigger className="h-8 w-auto min-w-[180px] max-w-[440px] text-sm whitespace-nowrap">
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
          className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
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
