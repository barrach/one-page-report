import { useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Textarea } from "@budget/components/ui/textarea";
import { Badge } from "@budget/components/ui/badge";
import { Switch } from "@budget/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@budget/components/ui/dialog";
import { FilePlus, FileSpreadsheet, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import {
  CpuClientTemplate, useCpuClientTemplates, useUpsertCpuClientTemplate,
  useDeleteCpuClientTemplate, useUploadCpuTemplateFile,
} from "@budget/hooks/useCpuClientTemplates";
import { toast } from "sonner";

const HEADER_FIELDS = [
  { value: "projectName", label: "Nome do Projeto" },
  { value: "proposalNumber", label: "Nº da Proposta" },
  { value: "budgetVersion", label: "Versão" },
  { value: "date", label: "Data" },
  { value: "legalName", label: "Razão Social" },
  { value: "cnpj", label: "CNPJ" },
  { value: "contactName", label: "Responsável" },
  { value: "contactEmail", label: "E-mail" },
  { value: "contactPhone", label: "Telefone" },
  { value: "totalGeral", label: "Total Geral" },
  { value: "totalServicos", label: "Total Serviços" },
  { value: "totalMateriais", label: "Total Materiais" },
];

const empty: Partial<CpuClientTemplate> = {
  client_name: "",
  description: "",
  is_active: true,
  sheet_name: "",
  start_row: 2,
  col_numero: "A",
  col_descricao: "B",
  col_quantidade: "C",
  col_unidade: "D",
  col_valor_unitario: "E",
  col_valor_total: "F",
  header_mappings: [],
  notes: "",
};

const CpuTemplatesPanel = () => {
  const { data: templates = [], isLoading } = useCpuClientTemplates();
  const upsert = useUpsertCpuClientTemplate();
  const remove = useDeleteCpuClientTemplate();
  const upload = useUploadCpuTemplateFile();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CpuClientTemplate>>(empty);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const startNew = () => {
    setEditing({ ...empty });
    setPendingFile(null);
    setOpen(true);
  };
  const startEdit = (tpl: CpuClientTemplate) => {
    setEditing({ ...tpl });
    setPendingFile(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editing.client_name?.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (!editing.id && !pendingFile) {
      toast.error("Selecione o arquivo .xlsx do template");
      return;
    }
    try {
      const payload: any = {
        ...editing,
        header_mappings: editing.header_mappings || [],
      };
      if (!editing.id) {
        payload.storage_path = "pending";
        payload.original_file_name = pendingFile?.name || "template.xlsx";
      }
      const id = await upsert.mutateAsync(payload);
      if (pendingFile) {
        await upload.mutateAsync({ file: pendingFile, templateId: id });
      }
      setOpen(false);
    } catch (e) {
      // hooks já avisam
    }
  };

  const updateMapping = (idx: number, patch: Partial<{ cell: string; field: string }>) => {
    setEditing((prev) => {
      const list = [...((prev.header_mappings as any[]) || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, header_mappings: list };
    });
  };
  const addMapping = () => {
    setEditing((prev) => ({
      ...prev,
      header_mappings: [...((prev.header_mappings as any[]) || []), { cell: "", field: "projectName" }],
    }));
  };
  const removeMapping = (idx: number) => {
    setEditing((prev) => ({
      ...prev,
      header_mappings: ((prev.header_mappings as any[]) || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <Card className="p-4 space-y-4 bg-card border-border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Templates de CPU por cliente
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre o arquivo .xlsx que cada cliente exige e configure onde injetar os dados.
          </p>
        </div>
        <Button size="sm" onClick={startNew} className="gap-1">
          <FilePlus className="w-4 h-4" /> Novo template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
        </div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded">
          Nenhum template cadastrado. O sistema usará o formato padrão Megasteam.
        </p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium">Cliente</th>
                <th className="text-left p-2 font-medium">Arquivo</th>
                <th className="text-center p-2 font-medium w-20">Ativo</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="p-2">
                    <p className="font-medium text-foreground">{t.client_name}</p>
                    {t.description && <p className="text-muted-foreground text-[11px]">{t.description}</p>}
                  </td>
                  <td className="p-2 text-muted-foreground">{t.original_file_name}</td>
                  <td className="p-2 text-center">
                    {t.is_active ? <Badge variant="outline" className="text-[10px]">ativo</Badge>
                      : <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                  </td>
                  <td className="p-2 flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(t)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                      onClick={() => { if (confirm(`Remover template "${t.client_name}"?`)) remove.mutate(t.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar template" : "Novo template de cliente"}</DialogTitle>
            <DialogDescription className="text-xs">
              O sistema preencherá este arquivo com os dados da CPU. Defina onde colocar cada coluna.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cliente *</Label>
                <Input value={editing.client_name || ""}
                  onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-5">
                <Label className="text-xs">Ativo</Label>
                <Switch checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={editing.description || ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>

            <div>
              <Label className="text-xs">Arquivo .xlsx do cliente *</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".xlsx"
                  onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
              {editing.id && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Atual: {editing.original_file_name} {pendingFile && "(será substituído)"}
                </p>
              )}
            </div>

            <div className="border border-border rounded p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground">Mapeamento de itens</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Aba alvo (vazio = primeira)</Label>
                  <Input value={editing.sheet_name || ""}
                    onChange={(e) => setEditing({ ...editing, sheet_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[10px]">Linha inicial dos itens</Label>
                  <Input type="number" min={1} value={editing.start_row || 2}
                    onChange={(e) => setEditing({ ...editing, start_row: +e.target.value || 2 })} />
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {([
                  ["col_numero", "Item"],
                  ["col_descricao", "Descrição"],
                  ["col_quantidade", "Qtde"],
                  ["col_unidade", "Un."],
                  ["col_valor_unitario", "Vl. Unit."],
                  ["col_valor_total", "Vl. Total"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-[10px]">{label}</Label>
                    <Input value={(editing as any)[key] || ""}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.value.toUpperCase() } as any)}
                      placeholder="A" maxLength={3} className="text-center font-mono" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Mapeamento de cabeçalho (opcional)</p>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addMapping}>+ Adicionar</Button>
              </div>
              {((editing.header_mappings as any[]) || []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  Nenhum cabeçalho mapeado. Você pode adicionar células onde injetar projeto, data, totais etc.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {((editing.header_mappings as any[]) || []).map((m, idx) => (
                    <div key={idx} className="grid grid-cols-[100px_1fr_30px] gap-2 items-center">
                      <Input value={m.cell || ""} placeholder="B3"
                        onChange={(e) => updateMapping(idx, { cell: e.target.value.toUpperCase() })}
                        className="text-center font-mono h-8 text-xs" />
                      <select value={m.field}
                        onChange={(e) => updateMapping(idx, { field: e.target.value })}
                        className="h-8 text-xs rounded border border-input bg-background px-2">
                        {HEADER_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeMapping(idx)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Anotações</Label>
              <Textarea rows={2} value={editing.notes || ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || upload.isPending}>
              {(upsert.isPending || upload.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CpuTemplatesPanel;
