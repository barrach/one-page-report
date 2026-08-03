import { useProjectStore } from '@/store/projectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  showCreate?: boolean;
  className?: string;
}

const ProjectSelector = ({ className = '' }: Props) => {
  const { projects, selectedProjectId, selectProject } = useProjectStore();

  return (
    <Select value={selectedProjectId} onValueChange={selectProject}>
      <SelectTrigger className={`w-[200px] h-8 text-xs font-medium bg-card border-border ${className}`}>
        <SelectValue placeholder="Selecione o projeto" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProjectSelector;
