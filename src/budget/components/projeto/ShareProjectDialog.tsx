import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@budget/components/ui/radio-group";
import { Send, Loader2 } from "lucide-react";
import { useCollaboration } from "@budget/hooks/useCollaboration";

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const ShareProjectDialog = ({ open, onOpenChange, projectId }: ShareProjectDialogProps) => {
  const { invite } = useCollaboration(projectId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email.trim()) return;
    setError("");
    setSending(true);
    const result = await invite(email.trim(), role);
    if (result.error) {
      setError(result.error);
    } else {
      setEmail("");
      setRole("viewer");
      onOpenChange(false);
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email do usuário</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              type="email"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Tipo de acesso</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="editor" id="editor" />
                <Label htmlFor="editor" className="text-sm cursor-pointer">
                  Editor <span className="text-muted-foreground text-xs">— pode editar tudo</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="viewer" id="viewer" />
                <Label htmlFor="viewer" className="text-sm cursor-pointer">
                  Visualizador <span className="text-muted-foreground text-xs">— somente leitura</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || !email.trim()} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareProjectDialog;
