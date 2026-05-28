import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@budget/components/ui/sheet";
import { Button } from "@budget/components/ui/button";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Database, Layers, ListPlus } from "lucide-react";
import type { ScopeItem } from "@budget/hooks/useScopeData";
import ScopeComponentList from "./ScopeComponentList";
import { useCompositions } from "@budget/hooks/useCompositions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@budget/components/ui/dialog";
import { Input } from "@budget/components/ui/input";
import { Search, Package, ChevronRight as ChevronR } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import BatchScopeItemDialog from "./BatchScopeItemDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  categoryLabel: string;
  categoryKey: string;
  items: ScopeItem[];
  scenarioId: string;
  onAdd: () => void;
  onEdit: (item: ScopeItem) => void;
  onRemove: (id: string) => void;
  onAddBatch?: (items: any[]) => void;
  batchSaving?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confirmado", className: "bg-primary/10 text-primary border-primary/20" },
  linked: { label: "Vinculado", className: "bg-green-500/10 text-green-500 border-green-500/20" },
};

export default function ScopeItemSheet({ open, onClose, categoryLabel, categoryKey, items, scenarioId, onAdd, onEdit, onRemove, onAddBatch, batchSaving }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compositionPickerFor, setCompositionPickerFor] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const handleBatchSave = (batchItems: any[]) => {
    if (onAddBatch) {
      const mapped = batchItems.map((item, i) => ({
        title: item.title,
        description: item.description || null,
        quantity: item.quantity || 1,
        unit: item.unit || null,
        notes: item.notes || null,
        category: categoryKey,
        sort_order: items.length + i,
        discipline: item.discipline === "__none" ? null : (item.discipline || null),
        status: "draft",
        linked_library_item_id: item.linked_library_item_id || null,
      }));
      onAddBatch(mapped);
    }
    setBatchOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{categoryLabel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum item nesta categoria. Clique em "Adicionar Itens" para começar.
              </p>
            )}
            {items.map((item) => {
              const statusInfo = STATUS_BADGE[(item as any).status || "draft"] || STATUS_BADGE.draft;
              return (
                <Card key={item.id} className="bg-muted/20 border-border overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {expandedId === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <Badge variant="outline" className={`text-[9px] ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">{item.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1.5 ml-6">
                          <span className="text-xs text-muted-foreground">
                            Qtd: <span className="font-mono text-foreground">{Number(item.quantity)}</span> {item.unit}
                          </span>
                          {(item as any).discipline && (
                            <Badge variant="secondary" className="text-[9px]">{(item as any).discipline}</Badge>
                          )}
                          {item.linked_library_item_id && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 bg-primary/5 border-primary/20">
                              <Database className="w-2 h-2" /> Biblioteca
                            </Badge>
                          )}
                          {(item as any).composition_id && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 bg-green-500/5 border-green-500/20">
                              <Layers className="w-2 h-2" /> Composição
                            </Badge>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6 italic">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        {!(item as any).composition_id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Vincular Composição" onClick={() => setCompositionPickerFor(item.id)}>
                            <Layers className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {expandedId === item.id && (
                    <div className="border-t border-border bg-muted/10 p-4">
                      <ScopeComponentList scopeItemId={item.id} scenarioId={scenarioId} />
                    </div>
                  )}
                </Card>
              );
            })}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setBatchOpen(true)}>
                <ListPlus className="w-4 h-4" /> Adicionar Itens
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5" /> Item Único
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {compositionPickerFor && (
        <CompositionLinkerDialog
          open={!!compositionPickerFor}
          onClose={() => setCompositionPickerFor(null)}
          scopeItemId={compositionPickerFor}
          scenarioId={scenarioId}
        />
      )}

      <BatchScopeItemDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onSaveBatch={handleBatchSave}
        category={categoryKey}
        categoryLabel={categoryLabel}
        saving={batchSaving}
      />
    </>
  );
}

/* Inline composition linker dialog */
function CompositionLinkerDialog({ open, onClose, scopeItemId, scenarioId }: { open: boolean; onClose: () => void; scopeItemId: string; scenarioId: string }) {
  const [search, setSearch] = useState("");
  const { data: compositions = [], isLoading } = useCompositions(search);
  const queryClient = useQueryClient();

  const handleLink = async (compositionId: string) => {
    const { error } = await supabase
      .from("scope_items")
      .update({ composition_id: compositionId, status: "linked" } as any)
      .eq("id", scopeItemId);
    if (error) {
      toast.error("Erro ao vincular composição");
    } else {
      toast.success("Composição vinculada ao item");
      queryClient.invalidateQueries({ queryKey: ["scope_items", scenarioId] });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Vincular Composição
          </DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar composição..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : compositions.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma composição encontrada</p>
            </div>
          ) : compositions.map((comp) => (
            <Card key={comp.id} className="p-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => handleLink(comp.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{comp.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {comp.discipline && <Badge variant="outline" className="text-[10px]">{comp.discipline}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{comp.base_unit || "un"}</span>
                  </div>
                </div>
                <ChevronR className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
