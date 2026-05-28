import { useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Plus, Trash2, Pencil, Layers, ChevronDown, ChevronRight, Loader2, Copy } from "lucide-react";
import { useCompositions, useCompositionItems, useCompositionMutations, type Composition } from "@budget/hooks/useCompositions";
import { formatBRL } from "@budget/lib/format";
import LibraryPickerDialog from "@budget/components/escopo/LibraryPickerDialog";

const RESOURCE_TYPES = ["MOD", "MOI", "MATERIAL", "EQUIPAMENTO"];
const RESOURCE_COLORS: Record<string, string> = {
  MOD: "bg-primary/10 text-primary",
  MOI: "bg-accent/10 text-accent",
  MATERIAL: "bg-green-500/10 text-green-500",
  EQUIPAMENTO: "bg-purple-500/10 text-purple-500",
};

const CompositionManager = () => {
  const [search, setSearch] = useState("");
  const { data: compositions = [], isLoading } = useCompositions(search);
  const mutations = useCompositionMutations();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [newCompOpen, setNewCompOpen] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", discipline: "", base_unit: "ton", description: "" });
  const [addItemCompId, setAddItemCompId] = useState<string | null>(null);
  const [newRes, setNewRes] = useState({ resource_type: "MOD", resource_name: "", consumption: 0, unit: "HH", unit_cost: 0, library_item_id: null as string | null, notes: "" });
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleCreateComp = () => {
    if (!newComp.name) return;
    mutations.addComposition.mutate(newComp);
    setNewCompOpen(false);
    setNewComp({ name: "", discipline: "", base_unit: "ton", description: "" });
  };

  const handleAddResource = () => {
    if (!addItemCompId || !newRes.resource_name) return;
    mutations.addItem.mutate({ composition_id: addItemCompId, ...newRes, unit_cost: newRes.unit_cost });
    setAddItemCompId(null);
    setNewRes({ resource_type: "MOD", resource_name: "", consumption: 0, unit: "HH", unit_cost: 0, library_item_id: null, notes: "" });
  };

  const handleLibSelect = (item: any) => {
    setNewRes({
      ...newRes,
      resource_name: [item.item_type, item.operation, item.material].filter(Boolean).join(" — ") || item.discipline || "",
      unit_cost: item.index_value || 0,
      unit: item.unit || newRes.unit,
      library_item_id: item.id,
    });
    setLibraryOpen(false);
  };

  const handleDuplicate = (comp: Composition) => {
    mutations.addComposition.mutate({
      name: `${comp.name} (cópia)`,
      discipline: comp.discipline || undefined,
      base_unit: comp.base_unit || undefined,
      description: comp.description || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input placeholder="Buscar composição..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button className="gap-2" onClick={() => setNewCompOpen(true)}>
          <Plus className="w-4 h-4" /> Nova Composição
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : compositions.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma composição cadastrada</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {compositions.map((comp) => (
            <CompositionRow
              key={comp.id}
              comp={comp}
              isExpanded={expanded === comp.id}
              onToggle={() => setExpanded(expanded === comp.id ? null : comp.id)}
              onAddItem={() => setAddItemCompId(comp.id)}
              onDelete={() => mutations.removeComposition.mutate(comp.id)}
              onDuplicate={() => handleDuplicate(comp)}
              mutations={mutations}
            />
          ))}
        </div>
      )}

      {/* New Composition Dialog */}
      <Dialog open={newCompOpen} onOpenChange={setNewCompOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Composição (CPU)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome (ex: Solda leve)" value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} />
            <Input placeholder="Disciplina (ex: Estruturas Metálicas)" value={newComp.discipline} onChange={(e) => setNewComp({ ...newComp, discipline: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Unidade Base</label>
                <Input value={newComp.base_unit} onChange={(e) => setNewComp({ ...newComp, base_unit: e.target.value })} />
              </div>
            </div>
            <Input placeholder="Descrição (opcional)" value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCompOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateComp} disabled={!newComp.name}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Resource Dialog */}
      <Dialog open={!!addItemCompId} onOpenChange={() => setAddItemCompId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Recurso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed" onClick={() => setLibraryOpen(true)}>
              Selecionar da Biblioteca Técnica
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={newRes.resource_type} onValueChange={(v) => setNewRes({ ...newRes, resource_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade</label>
                <Input value={newRes.unit} onChange={(e) => setNewRes({ ...newRes, unit: e.target.value })} />
              </div>
            </div>
            <Input placeholder="Recurso (ex: Soldador, Eletrodo)" value={newRes.resource_name} onChange={(e) => setNewRes({ ...newRes, resource_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Consumo por unidade base</label>
                <Input type="number" step="0.01" min={0} value={newRes.consumption} onChange={(e) => setNewRes({ ...newRes, consumption: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Custo Unitário (R$)</label>
                <Input type="number" step="0.01" min={0} value={newRes.unit_cost} onChange={(e) => setNewRes({ ...newRes, unit_cost: +e.target.value })} />
              </div>
            </div>
            <Input placeholder="Observações (opcional)" value={newRes.notes} onChange={(e) => setNewRes({ ...newRes, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemCompId(null)}>Cancelar</Button>
            <Button onClick={handleAddResource} disabled={!newRes.resource_name}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LibraryPickerDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibSelect} />
    </div>
  );
};

/* ── Single composition row ── */
const CompositionRow = ({
  comp, isExpanded, onToggle, onAddItem, onDelete, onDuplicate, mutations,
}: {
  comp: Composition;
  isExpanded: boolean;
  onToggle: () => void;
  onAddItem: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  mutations: ReturnType<typeof useCompositionMutations>;
}) => {
  const { data: items = [] } = useCompositionItems(isExpanded ? comp.id : undefined);
  const totalCost = items.reduce((s, i) => s + i.consumption * i.unit_cost, 0);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{comp.name}</span>
          {comp.discipline && <Badge variant="outline" className="text-[10px]">{comp.discipline}</Badge>}
          <span className="text-[10px] text-muted-foreground">({comp.base_unit})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/{comp.base_unit}</span>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title="Duplicar"><Copy className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Excluir"><Trash2 className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/10">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum recurso nesta composição</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-2 pl-10 font-medium text-muted-foreground">Recurso</th>
                  <th className="text-center p-2 font-medium text-muted-foreground w-20">Tipo</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-24">Consumo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground w-12">Un</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-24">C. Unit.</th>
                  <th className="text-right p-2 font-medium text-muted-foreground w-24">C./Un Base</th>
                  <th className="p-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20 group">
                    <td className="p-2 pl-10 text-foreground">{item.resource_name}</td>
                    <td className="p-2 text-center">
                      <Badge className={`text-[9px] ${RESOURCE_COLORS[item.resource_type] || ""}`}>{item.resource_type}</Badge>
                    </td>
                    <td className="p-2 text-right font-mono text-foreground">{item.consumption.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>
                    <td className="p-2 text-muted-foreground">{item.unit}</td>
                    <td className="p-2 text-right font-mono text-foreground">{formatBRL(item.unit_cost)}</td>
                    <td className="p-2 text-right font-mono font-bold text-foreground">{formatBRL(item.consumption * item.unit_cost)}</td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100"
                        onClick={() => mutations.removeItem.mutate({ id: item.id, compositionId: comp.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-10 py-2 flex justify-between items-center border-t border-border/30">
            <Button variant="ghost" size="sm" className="gap-1 text-primary text-xs h-7" onClick={onAddItem}>
              <Plus className="w-3 h-3" /> Adicionar Recurso
            </Button>
            <span className="text-xs font-mono font-bold text-foreground">
              Custo por {comp.base_unit}: {formatBRL(totalCost)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CompositionManager;
