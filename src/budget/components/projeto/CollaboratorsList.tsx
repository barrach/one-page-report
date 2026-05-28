import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Trash2, Users } from "lucide-react";
import { useCollaboration } from "@budget/hooks/useCollaboration";

interface CollaboratorsListProps {
  projectId: string;
  isOwner: boolean;
}

const CollaboratorsList = ({ projectId, isOwner }: CollaboratorsListProps) => {
  const { collaborators, loading, removeCollaborator, updateRole } = useCollaboration(projectId);

  if (loading) return null;
  if (collaborators.length === 0) return null;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-500",
    active: "bg-emerald-500/10 text-emerald-500",
    declined: "bg-destructive/10 text-destructive",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    active: "Ativo",
    declined: "Recusado",
  };

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Colaboradores</h3>
        <Badge variant="secondary" className="text-[10px]">{collaborators.length}</Badge>
      </div>
      <div className="space-y-2">
        {collaborators.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/30">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {c.full_name || c.email}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
            </div>
            <Badge className={`text-[10px] ${statusColors[c.status]}`}>
              {statusLabels[c.status] || c.status}
            </Badge>
            {isOwner && c.status === "active" && (
              <Select
                value={c.role}
                onValueChange={(v) => updateRole(c.id, v as "editor" | "viewer")}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            )}
            {!isOwner && (
              <span className="text-[10px] text-muted-foreground">
                {c.role === "editor" ? "Editor" : "Visualizador"}
              </span>
            )}
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => removeCollaborator(c.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollaboratorsList;
