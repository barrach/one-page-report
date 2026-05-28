import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@budget/hooks/use-toast";
import { supabase } from "@budget/integrations/supabase/client";
import type { ContractMaster } from "@budget/hooks/useContractsMaster";

interface Props {
  contract: ContractMaster | null;
  onOpenChange: (open: boolean) => void;
}

const EditContractDialog = ({ contract, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    project_name: "",
    client: "",
    dept_code: "",
    dept_group: "OPERACIONAL",
    status: "active",
    contract_type: "",
    notes: "",
  });

  useEffect(() => {
    if (contract) {
      setForm({
        project_name: contract.project_name ?? "",
        client: contract.client ?? "",
        dept_code: contract.dept_code ?? "",
        dept_group: contract.dept_group ?? "OPERACIONAL",
        status: contract.status ?? "active",
        contract_type: contract.contract_type ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [contract]);

  const upd = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const update = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("Sem contrato selecionado");
      const { error } = await supabase
        .from("projects")
        .update({
          project_name: form.project_name.trim(),
          client: form.client.trim() || "Megasteam",
          dept_code: form.dept_code.trim() || null,
          dept_group: form.dept_group || null,
          status: form.status,
          contract_type: form.contract_type.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts-master"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts"] });
      toast({ title: "Contrato atualizado" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!contract} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar contrato</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Código</Label>
              <Input value={form.dept_code} onChange={(e) => upd("dept_code", e.target.value)} className="font-mono" />
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
            <Input value={form.project_name} onChange={(e) => upd("project_name", e.target.value)} />
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
            <Input value={form.contract_type} onChange={(e) => upd("contract_type", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => update.mutate()} disabled={update.isPending} className="gap-2">
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractDialog;
