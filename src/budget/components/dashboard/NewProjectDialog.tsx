import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "@budget/hooks/use-toast";

interface ProjectFormData {
  client: string;
  projectName: string;
  unit: string;
  location: string;
  proposalNumber: string;
  startDate: string;
  estimatedDuration: string;
  contractType: string;
  observations: string;
  scope: string;
}

const NewProjectDialog = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormData>({
    client: "",
    projectName: "",
    unit: "",
    location: "",
    proposalNumber: "",
    startDate: "",
    estimatedDuration: "",
    contractType: "",
    observations: "",
    scope: "",
  });

  const update = (field: keyof ProjectFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client || !form.projectName) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    toast({ title: "Orçamento criado com sucesso!", description: form.projectName });
    setOpen(false);
    setForm({
      client: "", projectName: "", unit: "", location: "",
      proposalNumber: "", startDate: "", estimatedDuration: "",
      contractType: "", observations: "", scope: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro de Novo Orçamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Input id="client" value={form.client} onChange={(e) => update("client", e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectName">Nome do Orçamento *</Label>
              <Input id="projectName" value={form.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="Ex: Bombeamento de Rejeito" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposalNumber">Nº da Proposta</Label>
              <Input id="proposalNumber" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value)} placeholder="Ex: 2026-0091" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input id="unit" value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="Ex: Serra do Salitre" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localidade (UF)</Label>
              <Input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Ex: MG" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Prazo Previsto (meses)</Label>
              <Input id="estimatedDuration" type="number" value={form.estimatedDuration} onChange={(e) => update("estimatedDuration", e.target.value)} placeholder="Ex: 5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo de Contrato</Label>
              <Select value={form.contractType} onValueChange={(v) => update("contractType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preco_global">Preço Global</SelectItem>
                  <SelectItem value="preco_unitario">Preço Unitário</SelectItem>
                  <SelectItem value="administracao">Administração</SelectItem>
                  <SelectItem value="empreitada">Empreitada</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope">Escopo Descritivo</Label>
            <Textarea
              id="scope"
              value={form.scope}
              onChange={(e) => update("scope", e.target.value)}
              placeholder="Descreva o escopo do serviço..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações Iniciais</Label>
            <Textarea
              id="observations"
              value={form.observations}
              onChange={(e) => update("observations", e.target.value)}
              placeholder="Observações relevantes para o orçamento..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar Projeto</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectDialog;
