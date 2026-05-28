import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "@budget/hooks/use-toast";
import { supabase } from "@budget/integrations/supabase/client";

interface FormState {
  dept_code: string;
  project_name: string;
  client: string;
  dept_group: string;
  status: string;
  contract_type: string;
  notes: string;
}

const EMPTY: FormState = {
  dept_code: "",
  project_name: "",
  client: "Megasteam",
  dept_group: "OPERACIONAL",
  status: "active",
  contract_type: "",
  notes: "",
};

const NewContractDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const qc = useQueryClient();

  const upd = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const createContract = useMutation({
    mutationFn: async () => {
      if (!form.project_name.trim()) throw new Error("Informe o nome do contrato");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        user_id: user.id,
        project_name: form.project_name.trim(),
        client: form.client.trim() || "Megasteam",
        dept_code: form.dept_code.trim() || null,
        dept_group: form.dept_group || null,
        status: form.status,
        contract_type: form.contract_type.trim() || null,
        notes: form.notes.trim() || null,
        is_cost_center: true,
      };
      const { data, error } = await supabase.from("projects").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-master"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts-health-portal"] });
      toast({ title: "Contrato criado", description: form.project_name });
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro ao criar contrato", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Novo Contrato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar novo contrato</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Código (dept_code)</Label>
              <Input
                value={form.dept_code}
                onChange={(e) => upd("dept_code", e.target.value)}
                placeholder="Ex.: 5040.110"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do contrato *</Label>
            <Input
              value={form.project_name}
              onChange={(e) => upd("project_name", e.target.value)}
              placeholder="Ex.: ENEVA Parnaíba"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Input value={form.client} onChange={(e) => upd("client", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo</Label>
              <Select value={form.dept_group} onValueChange={(v) => upd("dept_group", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERACIONAL">Operacional</SelectItem>
                  <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de contrato</Label>
            <Input
              value={form.contract_type}
              onChange={(e) => upd("contract_type", e.target.value)}
              placeholder="Ex.: BM, Preço fechado, Homem-hora..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => upd("notes", e.target.value)}
              rows={3}
              placeholder="Notas internas sobre o contrato..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => createContract.mutate()} disabled={createContract.isPending} className="gap-2">
            {createContract.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewContractDialog;
