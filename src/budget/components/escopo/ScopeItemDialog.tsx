import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Textarea } from "@budget/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Badge } from "@budget/components/ui/badge";
import { Database, Layers } from "lucide-react";
import type { ScopeItem } from "@budget/hooks/useScopeData";
import LibraryPickerDialog from "./LibraryPickerDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string | null;
    quantity: number;
    unit: string | null;
    notes: string | null;
    category: string;
    sort_order: number;
    discipline: string | null;
    status: string;
    linked_library_item_id: string | null;
  }) => void;
  editItem?: ScopeItem | null;
  category: string;
  nextOrder: number;
}

const DISCIPLINES = [
  "Mecânica", "Elétrica", "Instrumentação", "Tubulação", "Civil",
  "Estrutura Metálica", "Pintura", "Isolamento", "Caldeiraria",
  "Comissionamento", "Geral"
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho", color: "bg-muted text-muted-foreground" },
  { value: "confirmed", label: "Confirmado", color: "bg-primary/10 text-primary" },
  { value: "linked", label: "Vinculado", color: "bg-green-500/10 text-green-500" },
];

export default function ScopeItemDialog({ open, onClose, onSave, editItem, category, nextOrder }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("un");
  const [notes, setNotes] = useState("");
  const [discipline, setDiscipline] = useState<string>("");
  const [status, setStatus] = useState("draft");
  const [libraryItemId, setLibraryItemId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setDescription(editItem.description || "");
      setQuantity(Number(editItem.quantity));
      setUnit(editItem.unit || "un");
      setNotes(editItem.notes || "");
      setDiscipline((editItem as any).discipline || "");
      setStatus((editItem as any).status || "draft");
      setLibraryItemId(editItem.linked_library_item_id || null);
    } else {
      setTitle(""); setDescription(""); setQuantity(1); setUnit("un");
      setNotes(""); setDiscipline(""); setStatus("draft"); setLibraryItemId(null);
    }
  }, [editItem, open]);

  const handleLibrarySelect = (item: any) => {
    setTitle([item.discipline, item.group_name, item.item_type, item.operation, item.material].filter(Boolean).join(" — "));
    setUnit(item.unit || unit);
    setDiscipline(item.discipline || discipline);
    setLibraryItemId(item.id);
    setNotes(item.source_workbook_name ? `Fonte: ${item.source_workbook_name}` : notes);
    setLibraryOpen(false);
  };

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      quantity,
      unit: unit || null,
      notes: notes || null,
      category,
      sort_order: editItem?.sort_order ?? nextOrder,
      discipline: discipline || null,
      status,
      linked_library_item_id: libraryItemId,
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Item" : "Novo Item do Escopo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs border-dashed"
                onClick={() => setLibraryOpen(true)}
              >
                <Database className="w-3.5 h-3.5 text-primary" /> Da Biblioteca Técnica
              </Button>
            </div>

            {libraryItemId && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
                <Database className="w-2.5 h-2.5" /> Vinculado à Biblioteca
                <button className="ml-1 text-destructive" onClick={() => setLibraryItemId(null)}>×</button>
              </Badge>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Título *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da atividade ou recurso" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhamento técnico" className="min-h-[60px]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade</label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(+e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Disciplina</label>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Observações</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LibraryPickerDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibrarySelect} />
    </>
  );
}
