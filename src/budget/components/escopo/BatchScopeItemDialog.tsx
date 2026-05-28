import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { ScrollArea } from "@budget/components/ui/scroll-area";
import {
  Plus, Trash2, Copy, Save, Database, ListPlus, Loader2, CheckSquare
} from "lucide-react";
import LibraryPickerDialog from "./LibraryPickerDialog";

interface BatchRow {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  discipline: string;
  notes: string;
  linked_library_item_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaveBatch: (items: Omit<BatchRow, "id">[]) => void;
  category: string;
  categoryLabel: string;
  saving?: boolean;
}

const DISCIPLINES = [
  "", "Mecânica", "Elétrica", "Instrumentação", "Tubulação", "Civil",
  "Estrutura Metálica", "Pintura", "Isolamento", "Caldeiraria",
  "Comissionamento", "Geral"
];

let rowIdCounter = 0;
const newRow = (): BatchRow => ({
  id: `row_${++rowIdCounter}`,
  title: "",
  description: "",
  quantity: 1,
  unit: "un",
  discipline: "",
  notes: "",
  linked_library_item_id: null,
});

export default function BatchScopeItemDialog({ open, onClose, onSaveBatch, category, categoryLabel, saving }: Props) {
  const [rows, setRows] = useState<BatchRow[]>([newRow()]);
  const [tab, setTab] = useState("manual");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedLibraryItems, setSelectedLibraryItems] = useState<any[]>([]);
  const titleRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const updateRow = (id: string, field: keyof BatchRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = useCallback(() => {
    const r = newRow();
    setRows(prev => [...prev, r]);
    setTimeout(() => titleRefs.current[r.id]?.focus(), 50);
  }, []);

  const removeRow = (id: string) => {
    setRows(prev => {
      if (prev.length <= 1) return [newRow()];
      return prev.filter(r => r.id !== id);
    });
  };

  const duplicateRow = (id: string) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const source = prev[idx];
      const dup = { ...source, id: `row_${++rowIdCounter}`, title: source.title + " (cópia)" };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addRow();
    }
  };

  // Library multi-select handler
  const handleLibrarySelect = (item: any) => {
    const r = newRow();
    r.title = [item.discipline, item.group_name, item.item_type, item.operation, item.material].filter(Boolean).join(" — ");
    r.unit = item.unit || "un";
    r.discipline = item.discipline || "";
    r.notes = item.source_workbook_name ? `Fonte: ${item.source_workbook_name}` : "";
    r.linked_library_item_id = item.id;
    setRows(prev => [...prev.filter(r2 => r2.title.trim()), r]);
    setLibraryOpen(false);
  };

  const validRows = rows.filter(r => r.title.trim());

  const handleSave = () => {
    if (validRows.length === 0) return;
    onSaveBatch(validRows.map(({ id, ...rest }) => rest));
    setRows([newRow()]);
  };

  const handleClose = () => {
    setRows([newRow()]);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-primary" />
              Adicionar Itens — {categoryLabel}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-fit">
              <TabsTrigger value="manual" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Manual
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-1.5 text-xs">
                <Database className="w-3.5 h-3.5" /> Biblioteca
              </TabsTrigger>
            </TabsList>

            {/* MANUAL MODE */}
            <TabsContent value="manual" className="flex-1 flex flex-col min-h-0 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {validRows.length} item(ns) preenchido(s) • Enter para nova linha
                </span>
                <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Nova Linha
                </Button>
              </div>

              <ScrollArea className="flex-1 border border-border rounded-md">
                <div className="min-w-[700px]">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_80px_60px_120px_auto] gap-1 p-2 bg-muted/50 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-medium sticky top-0">
                    <span>Título *</span>
                    <span>Descrição</span>
                    <span>Qtd</span>
                    <span>Un</span>
                    <span>Disciplina</span>
                    <span className="w-[72px]">Ações</span>
                  </div>

                  {/* Rows */}
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1fr_1fr_80px_60px_120px_auto] gap-1 p-1.5 border-b border-border/30 hover:bg-muted/10 items-center"
                    >
                      <div className="relative">
                        <Input
                          ref={(el) => { titleRefs.current[row.id] = el; }}
                          value={row.title}
                          onChange={(e) => updateRow(row.id, "title", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, row.id)}
                          placeholder={`Item ${idx + 1}`}
                          className="h-8 text-xs"
                        />
                        {row.linked_library_item_id && (
                          <Database className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-primary" />
                        )}
                      </div>
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, "description", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, row.id)}
                        placeholder="Descrição"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs font-mono"
                      />
                      <Input
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Select value={row.discipline} onValueChange={(v) => updateRow(row.id, "discipline", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCIPLINES.map((d) => (
                            <SelectItem key={d || "__none"} value={d || "__none"}>{d || "—"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-0.5 w-[72px]">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRow(row.id)} title="Duplicar">
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.id)} title="Remover">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* LIBRARY MODE */}
            <TabsContent value="library" className="flex-1 mt-3">
              <div className="text-center py-8 space-y-3">
                <Database className="w-10 h-10 mx-auto text-primary/50" />
                <p className="text-sm text-muted-foreground">
                  Busque e selecione itens da Biblioteca Técnica para importar ao escopo.
                </p>
                <Button variant="outline" onClick={() => setLibraryOpen(true)} className="gap-2">
                  <Database className="w-4 h-4" /> Abrir Biblioteca Técnica
                </Button>
                {rows.some(r => r.linked_library_item_id) && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Itens importados da biblioteca:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {rows.filter(r => r.linked_library_item_id).map(r => (
                        <Badge key={r.id} variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
                          <Database className="w-2.5 h-2.5" /> {r.title.substring(0, 40)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>

          <DialogFooter className="border-t border-border pt-3 mt-3">
            <div className="flex items-center gap-2 mr-auto">
              <Badge variant="secondary" className="text-xs">
                <CheckSquare className="w-3 h-3 mr-1" /> {validRows.length} item(ns)
              </Badge>
            </div>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={validRows.length === 0 || saving} className="gap-1.5">
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Salvar {validRows.length} Item(ns)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LibraryPickerDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibrarySelect} />
    </>
  );
}
