import { useProjectStore } from '@/store/projectStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  showCreate?: boolean;
}

const ProjectSelector = ({ showCreate = false }: Props) => {
  const { projects, selectedProjectId, selectProject, addProject, deleteProject } = useProjectStore();
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addProject(newName.trim().toUpperCase());
    setNewName('');
    setShowNew(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedProjectId} onValueChange={selectProject}>
        <SelectTrigger className="w-[180px] h-8 text-sm bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
          <SelectValue placeholder="Selecione o projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCreate && (
        <>
          {showNew ? (
            <div className="flex items-center gap-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nome do projeto"
                className="h-8 w-[140px] text-sm bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
              />
              <Button size="sm" variant="secondary" className="h-8 px-2" onClick={handleCreate}>OK</Button>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-primary-foreground" onClick={() => setShowNew(false)}>✕</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost"
              className="h-8 gap-1 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          )}

          {projects.length > 1 && (
            <Button size="sm" variant="ghost"
              className="h-8 px-2 text-primary-foreground/60 hover:text-destructive hover:bg-primary-foreground/10"
              onClick={() => deleteProject(selectedProjectId)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectSelector;
