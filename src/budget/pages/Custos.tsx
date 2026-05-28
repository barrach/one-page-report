import { useState, useEffect, useMemo } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Calculator,
  Database, Link2, FolderOpen, FileText,
} from "lucide-react";
import { useUserProjects, useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import {
  useCostStages, useCostItems, useEnsureCostStages, useCostMutations,
  computeStageSummaries, type CostItem, type StageSummary,
} from "@budget/hooks/useCostData";
import { formatBRL, formatPct, formatNumber } from "@budget/lib/format";

const originIcons: Record<string, React.ElementType> = {
  manual: Pencil, formula: Calculator, library: Database, scope: Link2,
  schedule: FileText, import: Database,
};
const originLabels: Record<string, string> = {
  manual: "Manual", formula: "Fórmula", library: "Biblioteca",
  scope: "Escopo", schedule: "Cronograma", import: "Importação",
};

const Custos = () => {
  const { data: projects = [] } = useUserProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(selectedProjectId);
  const ensureScenario = useEnsureScenario(selectedProjectId);
  const scenarioId = scenario?.id;

  const { data: stages = [], isLoading: stagesLoading } = useCostStages(scenarioId);
  const { data: items = [], isLoading: itemsLoading } = useCostItems(scenarioId);
  const ensureStages = useEnsureCostStages(scenarioId);
  const { addItem, updateItem, removeItem } = useCostMutations(scenarioId);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ stageId: string; item: CostItem } | null>(null);
  const [addingToStageId, setAddingToStageId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    description: "", quantity: 1, unit: "un", unit_cost: 0,
    notes: "", origin: "manual" as string, formula_label: "", origin_reference: "",
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [selectedProjectId, scenario, scenarioLoading]);

  useEffect(() => {
    if (scenarioId && stages.length === 0 && !stagesLoading) ensureStages.mutate();
  }, [scenarioId, stages.length, stagesLoading]);

  const summaries = useMemo(() => computeStageSummaries(stages, items), [stages, items]);

  const serviceTotal = summaries.filter((s) => s.stage.cost_class === "service").reduce((a, s) => a + s.total, 0);
  const materialTotal = summaries.filter((s) => s.stage.cost_class === "material").reduce((a, s) => a + s.total, 0);
  const totalDirect = serviceTotal + materialTotal;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (!addingToStageId) return;
    addItem.mutate({
      cost_stage_id: addingToStageId,
      description: newItem.description,
      quantity: newItem.quantity,
      unit: newItem.unit,
      unit_cost: newItem.unit_cost,
      notes: newItem.notes || null,
      origin: newItem.origin as any,
      formula_label: newItem.formula_label || null,
      origin_reference: newItem.origin_reference || null,
    });
    setAddingToStageId(null);
    setNewItem({ description: "", quantity: 1, unit: "un", unit_cost: 0, notes: "", origin: "manual", formula_label: "", origin_reference: "" });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const i = editingItem.item;
    updateItem.mutate({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit,
      unit_cost: Number(i.unit_cost),
      notes: i.notes,
      origin: i.origin,
      formula_label: i.formula_label,
      origin_reference: i.origin_reference,
    });
    setEditingItem(null);
  };

  const renderOriginBadge = (item: CostItem) => {
    const Icon = originIcons[item.origin] || Pencil;
    const label = originLabels[item.origin] || item.origin;
    return (
      <Badge variant="outline" className="text-[10px] gap-1 font-normal h-5">
        <Icon className="w-2.5 h-2.5" />{label}
      </Badge>
    );
  };

  const renderStageSection = (title: string, sums: StageSummary[], sectionTotal: number, colorClass: string) => (
    <div className="space-y-1 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-[10px]">{formatBRL(sectionTotal)}</Badge>
      </div>
      <Card className="bg-card border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {sums.map((s) => {
            const isOpen = expandedIds.has(s.stage.id);
            const pct = totalDirect > 0 ? (s.total / totalDirect) * 100 : 0;
            return (
              <div key={s.stage.id}>
                <div
                  onClick={() => toggleExpand(s.stage.id)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className={`w-4 h-4 ${colorClass}`} />
                    ) : (
                      <ChevronRight className={`w-4 h-4 text-muted-foreground group-hover:${colorClass}`} />
                    )}
                    <span className="text-sm text-foreground">{s.stage.label}</span>
                    <span className="text-[10px] text-muted-foreground">({s.items.length})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colorClass === "text-primary" ? "bg-primary" : "bg-accent"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-12 text-right">{formatPct(pct, 1)}</span>
                    <span className="text-sm font-mono font-medium text-foreground w-32 text-right">{formatBRL(s.total)}</span>
                  </div>
                </div>
                {isOpen && (
                  <div className="bg-muted/10 border-t border-border/30">
                    {s.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum item. Adicione um subitem.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/30 bg-muted/20">
                            <th className="text-left p-2 pl-10 font-medium text-muted-foreground">Descrição</th>
                            <th className="text-center p-2 font-medium text-muted-foreground w-14">Origem</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-16">Qtd</th>
                            <th className="text-left p-2 font-medium text-muted-foreground w-16">Un</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-28">C. Unit.</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-28">C. Total</th>
                            <th className="text-left p-2 font-medium text-muted-foreground w-40">Fórmula</th>
                            <th className="p-2 w-16" />
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item) => {
                            const itemTotal = Number(item.quantity) * Number(item.unit_cost);
                            return (
                              <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20">
                                <td className="p-2 pl-10 text-foreground">
                                  {item.description}
                                  {item.notes && <span className="text-muted-foreground italic ml-2">({item.notes})</span>}
                                </td>
                                <td className="p-2 text-center">{renderOriginBadge(item)}</td>
                                <td className="p-2 text-right font-mono text-foreground">{Number(item.quantity)}</td>
                                <td className="p-2 text-muted-foreground">{item.unit}</td>
                                <td className="p-2 text-right font-mono text-foreground">{formatBRL(Number(item.unit_cost))}</td>
                                <td className="p-2 text-right font-mono font-medium text-foreground">{formatBRL(itemTotal)}</td>
                                <td className="p-2 text-muted-foreground text-[10px] italic">{item.formula_label || `${Number(item.quantity)} × unit`}</td>
                                <td className="p-2">
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingItem({ stageId: s.stage.id, item: { ...item } }); }}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); removeItem.mutate(item.id); }}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    <div className="px-10 py-2 flex justify-between items-center border-t border-border/30">
                      <Button variant="ghost" size="sm" className="gap-1 text-primary text-xs h-7" onClick={() => setAddingToStageId(s.stage.id)}>
                        <Plus className="w-3 h-3" /> Adicionar
                      </Button>
                      <span className="text-xs font-mono font-medium text-foreground">Subtotal: {formatBRL(s.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );

  const serviceSummaries = summaries.filter((s) => s.stage.cost_class === "service");
  const materialSummaries = summaries.filter((s) => s.stage.cost_class === "material");

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Custos por Etapa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Composição detalhada — cada valor tem origem, fórmula e composição editável
        </p>
      </div>

      {/* Project selector */}
      <Card className="p-4 bg-card border-border mb-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-5 h-5 text-primary" />
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Selecione um orçamento" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.project_name} — {p.client}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Serviços</p>
          <p className="text-sm font-bold text-foreground font-mono">{formatBRL(serviceTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{totalDirect > 0 ? formatPct(serviceTotal / totalDirect * 100) : "—"}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Materiais</p>
          <p className="text-sm font-bold text-foreground font-mono">{formatBRL(materialTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{totalDirect > 0 ? formatPct(materialTotal / totalDirect * 100) : "—"}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Direto Total</p>
          <p className="text-sm font-bold text-accent font-mono">{formatBRL(totalDirect)}</p>
          <p className="text-[10px] text-muted-foreground">{summaries.length} etapas</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Itens</p>
          <p className="text-sm font-bold text-foreground font-mono">{items.length}</p>
          <p className="text-[10px] text-muted-foreground">subitens cadastrados</p>
        </Card>
      </div>

      {(scenarioLoading || stagesLoading || itemsLoading) && selectedProjectId && (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando custos...</p>
      )}

      {scenarioId && (
        <>
          {renderStageSection("CUSTOS DIRETOS — SERVIÇOS", serviceSummaries, serviceTotal, "text-primary")}
          {renderStageSection("CUSTOS DIRETOS — MATERIAIS", materialSummaries, materialTotal, "text-accent")}

          <Card className="p-4 bg-muted/20 border-border">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-foreground">TOTAL CUSTOS DIRETOS</span>
                <p className="text-[10px] text-muted-foreground">
                  Serviços: {formatBRL(serviceTotal)} + Materiais: {formatBRL(materialTotal)}
                </p>
              </div>
              <span className="text-xl font-bold font-mono text-accent">{formatBRL(totalDirect)}</span>
            </div>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Item de Custo</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-3">
              <Input
                value={editingItem.item.description}
                onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, description: e.target.value } })}
                placeholder="Descrição"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Input type="number" value={Number(editingItem.item.quantity)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, quantity: +e.target.value } })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unidade</label>
                  <Input value={editingItem.item.unit || ""} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, unit: e.target.value } })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Custo Unitário</label>
                  <Input type="number" value={Number(editingItem.item.unit_cost)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, unit_cost: +e.target.value } })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fórmula / Memória de cálculo</label>
                <Input value={editingItem.item.formula_label || ""} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, formula_label: e.target.value } })} placeholder="Ex: qty × salário × meses" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Origem</label>
                  <Select value={editingItem.item.origin} onValueChange={(v) => setEditingItem({ ...editingItem, item: { ...editingItem.item, origin: v as any } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="formula">Fórmula</SelectItem>
                      <SelectItem value="library">Biblioteca</SelectItem>
                      <SelectItem value="scope">Escopo</SelectItem>
                      <SelectItem value="schedule">Cronograma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Referência</label>
                  <Input value={editingItem.item.origin_reference || ""} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, origin_reference: e.target.value } })} />
                </div>
              </div>
              <Input value={editingItem.item.notes || ""} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, notes: e.target.value } })} placeholder="Observações" />
              <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground">Custo Total:</p>
                <p className="text-lg font-bold font-mono text-foreground">{formatBRL(Number(editingItem.item.quantity) * Number(editingItem.item.unit_cost))}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={!!addingToStageId} onOpenChange={() => setAddingToStageId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Item de Custo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descrição" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade</label>
                <Input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade</label>
                <Input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Custo Unitário</label>
                <Input type="number" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: +e.target.value })} />
              </div>
            </div>
            <Input value={newItem.formula_label} onChange={(e) => setNewItem({ ...newItem, formula_label: e.target.value })} placeholder="Fórmula (opcional)" />
            <Input value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Observações" />
            {newItem.quantity > 0 && newItem.unit_cost > 0 && (
              <div className="p-2 bg-primary/10 rounded text-xs">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-mono font-bold text-primary">{formatBRL(newItem.quantity * newItem.unit_cost)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingToStageId(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newItem.description}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Custos;
