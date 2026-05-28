import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@budget/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Calculator,
  Database, Link2, FileText, Zap, Loader2, Save, Layers,
} from "lucide-react";
import { useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import {
  useCostStages, useCostItems, useEnsureCostStages, useCostMutations,
  computeStageSummaries, type CostItem, type StageSummary,
} from "@budget/hooks/useCostData";
import { useScenarioPhases, useAllScopeComponents } from "@budget/hooks/useScheduleData";
import { useGenerateCostsFromScope, useGenerateCostsFromSchedule } from "@budget/hooks/useBudgetEngine";
import LibraryPickerDialog from "@budget/components/escopo/LibraryPickerDialog";
import CompositionPickerDialog from "@budget/components/composicao/CompositionPickerDialog";
import { formatBRL, formatNumber } from "@budget/lib/format";

import PeopleCostsPanel from "@budget/components/custos/PeopleCostsPanel";
import CostSummaryTable from "@budget/components/custos/CostSummaryTable";

/* ── Inline editable cell ── */
const InlineNumber = ({
  value,
  onCommit,
  prefix = "",
  min = 0,
  className = "",
}: {
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  min?: number;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= min && n !== value) {
      onCommit(n);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={startEdit}
        className={`cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 transition-colors font-mono ${className}`}
        title="Clique para editar"
      >
        {prefix}{value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }

  return (
    <Input
      ref={inputRef}
      type="number"
      step="0.01"
      min={min}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-6 w-24 text-xs font-mono px-1 py-0 text-right"
      autoFocus
    />
  );
};

const originLabels: Record<string, string> = {
  manual: "Manual", formula: "Fórmula", library: "Biblioteca",
  scope: "Escopo", schedule: "Cronograma", import: "Importação",
};

interface Props {
  projectId: string;
}

const ProjectCustosTab = ({ projectId }: Props) => {
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: stages = [], isLoading: stagesLoading } = useCostStages(scenarioId);
  const { data: items = [], isLoading: itemsLoading } = useCostItems(scenarioId);
  const ensureStages = useEnsureCostStages(scenarioId);
  const { addItem, updateItem, removeItem } = useCostMutations(scenarioId);
  const { data: phases = [] } = useScenarioPhases(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);

  const generateFromScope = useGenerateCostsFromScope(scenarioId);
  const generateFromSchedule = useGenerateCostsFromSchedule(scenarioId);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingToStageId, setAddingToStageId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [costPerHH, setCostPerHH] = useState(76.28);
  const [detailItem, setDetailItem] = useState<CostItem | null>(null);
  const [newItem, setNewItem] = useState({
    description: "", quantity: 1, unit: "un", unit_cost: 0,
    notes: "", origin: "manual" as string, formula_label: "", origin_reference: "",
    library_item_id: null as string | null,
  });

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

  useEffect(() => {
    if (scenarioId && stages.length === 0 && !stagesLoading) ensureStages.mutate();
  }, [scenarioId, stages.length, stagesLoading]);

  const summaries = useMemo(() => computeStageSummaries(stages, items), [stages, items]);
  const serviceTotal = summaries.filter((s) => s.stage.cost_class === "service").reduce((a, s) => a + s.total, 0);
  const materialTotal = summaries.filter((s) => s.stage.cost_class === "material").reduce((a, s) => a + s.total, 0);
  const totalDirect = serviceTotal + materialTotal;

  const totalScopeHH = allComponents.reduce((s, c) => s + (Number(c.adjusted_hh) || Number(c.calculated_hh) || 0), 0);
  const scopeItemsWithHH = allComponents.filter((c) => (Number(c.adjusted_hh) || Number(c.calculated_hh)) > 0).length;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  /* ── Inline update handlers (auto-save) ── */
  const handleInlineUpdate = useCallback((itemId: string, field: "quantity" | "unit_cost", value: number) => {
    updateItem.mutate({ id: itemId, [field]: value });
  }, [updateItem]);

  const handleLibrarySelect = (item: any) => {
    setNewItem({
      ...newItem,
      description: [item.discipline, item.group_name, item.item_type, item.operation, item.material].filter(Boolean).join(" — "),
      unit_cost: item.index_value || 0,
      unit: item.unit || newItem.unit,
      library_item_id: item.id,
      origin: "library",
      origin_reference: item.source_workbook_name || "",
      notes: item.notes || "",
    });
    setLibraryOpen(false);
  };

  const handleAdd = () => {
    if (!addingToStageId || !newItem.description) return;
    addItem.mutate({
      cost_stage_id: addingToStageId, description: newItem.description,
      quantity: newItem.quantity, unit: newItem.unit, unit_cost: newItem.unit_cost,
      notes: newItem.notes || null, origin: newItem.origin as any,
      formula_label: newItem.formula_label || null, origin_reference: newItem.origin_reference || null,
      library_item_id: newItem.library_item_id,
    });
    setAddingToStageId(null);
    setNewItem({ description: "", quantity: 1, unit: "un", unit_cost: 0, notes: "", origin: "manual", formula_label: "", origin_reference: "", library_item_id: null });
  };

  const handleSaveDetail = () => {
    if (!detailItem) return;
    updateItem.mutate({
      id: detailItem.id, description: detailItem.description, quantity: Number(detailItem.quantity),
      unit: detailItem.unit, unit_cost: Number(detailItem.unit_cost), notes: detailItem.notes,
      origin: detailItem.origin, formula_label: detailItem.formula_label,
      origin_reference: detailItem.origin_reference,
    });
    setDetailItem(null);
  };

  const handleGenerateFromScope = () => {
    generateFromScope.mutate({ stages, costPerHH });
    setGenerateDialogOpen(false);
  };

  const handleGenerateFromSchedule = () => {
    generateFromSchedule.mutate({ stages, phases });
  };

  /* ── Render a cost stage accordion ── */
  const renderStageRow = (s: StageSummary, colorClass: string) => {
    const isOpen = expandedIds.has(s.stage.id);
    const pct = totalDirect > 0 ? (s.total / totalDirect) * 100 : 0;

    return (
      <div key={s.stage.id}>
        {/* Header row */}
        <div
          onClick={() => toggleExpand(s.stage.id)}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            {isOpen
              ? <ChevronDown className={`w-4 h-4 ${colorClass}`} />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm text-foreground font-medium">{s.stage.label}</span>
            <span className="text-[10px] text-muted-foreground">({s.items.length})</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colorClass === "text-primary" ? "bg-primary" : "bg-accent"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
            <span className="text-sm font-mono font-bold text-foreground w-32 text-right">{formatBRL(s.total)}</span>
          </div>
        </div>

        {/* Expanded items */}
        {isOpen && (
          <div className="bg-muted/10 border-t border-border/30">
            {s.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum item nesta etapa.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left p-2 pl-10 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-center p-2 font-medium text-muted-foreground w-16">Origem</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-24">Quantidade</th>
                    <th className="text-left p-2 font-medium text-muted-foreground w-12">Un</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-28">Custo Unit.</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-28">Custo Total</th>
                    <th className="p-2 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((item) => {
                    const itemTotal = Number(item.quantity) * Number(item.unit_cost);
                    return (
                      <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20 group/row">
                        <td className="p-2 pl-10 text-foreground">
                          {item.description}
                          {item.notes && <span className="text-muted-foreground italic ml-1 text-[10px]">({item.notes})</span>}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className="text-[9px] font-normal h-5">
                            {originLabels[item.origin] || item.origin}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <InlineNumber
                            value={Number(item.quantity)}
                            onCommit={(v) => handleInlineUpdate(item.id, "quantity", v)}
                            className="text-foreground"
                          />
                        </td>
                        <td className="p-2 text-muted-foreground">{item.unit}</td>
                        <td className="p-2 text-right">
                          <InlineNumber
                            value={Number(item.unit_cost)}
                            onCommit={(v) => handleInlineUpdate(item.id, "unit_cost", v)}
                            prefix="R$ "
                            className="text-foreground"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-foreground">
                          {formatBRL(itemTotal)}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); setDetailItem({ ...item }); }}
                              title="Detalhes"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={(e) => { e.stopPropagation(); removeItem.mutate(item.id); }}
                              title="Excluir"
                            >
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
            {/* Add buttons */}
            <div className="px-10 py-2 flex justify-between items-center border-t border-border/30">
              <div className="flex gap-2">
                <Button
                  variant="ghost" size="sm" className="gap-1 text-primary text-xs h-7"
                  onClick={() => { setAddingToStageId(s.stage.id); setLibraryOpen(false); }}
                >
                  <Plus className="w-3 h-3" /> Adicionar Item
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1 text-xs h-7"
                  onClick={() => { setAddingToStageId(s.stage.id); setLibraryOpen(true); }}
                >
                  <Database className="w-3 h-3" /> Da Biblioteca
                </Button>
              </div>
              <span className="text-xs font-mono font-bold text-foreground">Subtotal: {formatBRL(s.total)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, sums: StageSummary[], sectionTotal: number, colorClass: string) => (
    <div className="space-y-1 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-[10px] font-mono">{formatBRL(sectionTotal)}</Badge>
      </div>
      <Card className="bg-card border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {sums.map((s) => renderStageRow(s, colorClass))}
        </div>
      </Card>
    </div>
  );

  // Stages que foram movidos/consolidados em outros lugares e não devem aparecer
  // novamente em CUSTOS DIRETOS — SERVIÇOS (evita duplicação visual com
  // PeopleCostsPanel e com o motor de Salários/Encargos):
  //  - mobilizacao  → já existe em "Custos de Pessoas em Campo"
  //  - epi_epc      → já existe como "EPI / Uniformes" em Pessoas em Campo
  //  - beneficios   → já coberto no motor de Salários/Encargos
  //  - veiculos_leves → consolidado dentro de "Hospedagem & Translados"
  const HIDDEN_SERVICE_CODES = new Set(["mobilizacao", "epi_epc", "beneficios", "veiculos_leves"]);
  // Ordem visual final solicitada
  const SERVICE_DISPLAY_ORDER = [
    "salarios",
    "canteiro",
    "ferramental",
    "pesados",
    "terceirizados",
    "riscos",
    "outros",
  ];
  const serviceSummariesRaw = summaries.filter((s) => s.stage.cost_class === "service");
  const serviceSummaries = serviceSummariesRaw
    .filter((s) => !HIDDEN_SERVICE_CODES.has(s.stage.stage_code))
    .sort(
      (a, b) =>
        SERVICE_DISPLAY_ORDER.indexOf(a.stage.stage_code) -
        SERVICE_DISPLAY_ORDER.indexOf(b.stage.stage_code)
    );
  const materialSummaries = summaries.filter((s) => s.stage.cost_class === "material");
  // Total de serviços considerando apenas as categorias visíveis (sem duplicar
  // o que já está nas linhas derivadas de Pessoas em Campo / Salários).
  const serviceTotalVisible = serviceSummaries.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Custos</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cadastre e organize todos os custos diretos e indiretos que compõem o orçamento do projeto.
          </p>
        </div>
        <div className="flex gap-2">
          {totalScopeHH > 0 && (
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setGenerateDialogOpen(true)} disabled={generateFromScope.isPending}>
              {generateFromScope.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-primary" />}
              Gerar do Escopo ({scopeItemsWithHH})
            </Button>
          )}
          {phases.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleGenerateFromSchedule} disabled={generateFromSchedule.isPending}>
              {generateFromSchedule.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-accent" />}
              Gerar do Cronograma
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setCompositionOpen(true)}>
            <Layers className="w-3.5 h-3.5 text-primary" />
            Aplicar Composição
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Serviços</p>
          <p className="text-sm font-bold text-foreground font-mono">{formatBRL(serviceTotal)}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Materiais</p>
          <p className="text-sm font-bold text-foreground font-mono">{formatBRL(materialTotal)}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Direto Total</p>
          <p className="text-sm font-bold text-accent font-mono">{formatBRL(totalDirect)}</p>
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Itens de Custo</p>
          <p className="text-sm font-bold text-foreground font-mono">{items.length}</p>
          {totalScopeHH > 0 && <p className="text-[10px] text-muted-foreground">HH Escopo: {formatNumber(totalScopeHH)}</p>}
        </Card>
      </div>

      {(scenarioLoading || stagesLoading || itemsLoading) && (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando custos...
        </div>
      )}

      {scenarioId && (
        <>
          {renderSection("CUSTOS DIRETOS — SERVIÇOS", serviceSummaries, serviceTotal, "text-primary")}
          {renderSection("CUSTOS DIRETOS — MATERIAIS", materialSummaries, materialTotal, "text-accent")}

          {/* People-derived parametric costs */}
          <div className="mb-6">
            <PeopleCostsPanel scenarioId={scenarioId} />
          </div>

          {/* Consolidated 14-line summary table */}
          <CostSummaryTable
            projectId={projectId}
            scenarioId={scenarioId}
            serviceTotal={serviceTotalVisible}
            materialTotal={materialTotal}
          />

          {/* Grand total */}
          <Card className="p-4 bg-muted/20 border-border mt-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-foreground">TOTAL CUSTOS DIRETOS (itens)</span>
                <p className="text-[10px] text-muted-foreground">
                  Serviços: {formatBRL(serviceTotal)} + Materiais: {formatBRL(materialTotal)}
                </p>
              </div>
              <span className="text-xl font-bold font-mono text-accent">{formatBRL(totalDirect)}</span>
            </div>
          </Card>
        </>
      )}

      {/* ── Generate from Scope Dialog ── */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Custos do Escopo</DialogTitle>
            <DialogDescription>
              Cria itens de custo em "Salários e Encargos" com base nos componentes com HH.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Componentes com HH</span>
                <span className="font-mono font-bold text-primary">{scopeItemsWithHH}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">HH Total</span>
                <span className="font-mono font-bold text-foreground">{formatNumber(totalScopeHH)} HH</span>
              </div>
            </Card>
            <div>
              <label className="text-xs text-muted-foreground">Custo por HH (R$/HH)</label>
              <Input type="number" step="0.01" value={costPerHH} onChange={(e) => setCostPerHH(+e.target.value)} />
            </div>
            <Card className="p-3 bg-accent/5 border-accent/20">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo estimado</span>
                <span className="font-mono font-bold text-accent">{formatBRL(totalScopeHH * costPerHH)}</span>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateFromScope} disabled={generateFromScope.isPending}>
              {generateFromScope.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Gerar {scopeItemsWithHH} Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail/Edit Dialog (for description, notes, origin etc.) ── */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Item</DialogTitle></DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Descrição</label>
                <Input value={detailItem.description} onChange={(e) => setDetailItem({ ...detailItem, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Input type="number" min={0} step="0.01" value={Number(detailItem.quantity)} onChange={(e) => setDetailItem({ ...detailItem, quantity: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unidade</label>
                  <Input value={detailItem.unit || ""} onChange={(e) => setDetailItem({ ...detailItem, unit: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Custo Unitário</label>
                  <Input type="number" min={0} step="0.01" value={Number(detailItem.unit_cost)} onChange={(e) => setDetailItem({ ...detailItem, unit_cost: +e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fórmula / Memória</label>
                <Input value={detailItem.formula_label || ""} onChange={(e) => setDetailItem({ ...detailItem, formula_label: e.target.value })} placeholder="Ex: equipe × dias × 8.8h" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Origem</label>
                  <Select value={detailItem.origin} onValueChange={(v) => setDetailItem({ ...detailItem, origin: v as any })}>
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
                  <Input value={detailItem.origin_reference || ""} onChange={(e) => setDetailItem({ ...detailItem, origin_reference: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Observações</label>
                <Input value={detailItem.notes || ""} onChange={(e) => setDetailItem({ ...detailItem, notes: e.target.value })} />
              </div>
              <Card className="p-3 bg-primary/5 border-primary/20">
                <p className="text-xs text-muted-foreground">Custo Total Calculado</p>
                <p className="text-lg font-bold font-mono text-foreground">{formatBRL(Number(detailItem.quantity) * Number(detailItem.unit_cost))}</p>
                <p className="text-[10px] text-muted-foreground">{Number(detailItem.quantity).toLocaleString("pt-BR")} × {formatBRL(Number(detailItem.unit_cost))}</p>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveDetail}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Item Dialog ── */}
      <Dialog open={!!addingToStageId} onOpenChange={() => setAddingToStageId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Item de Custo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed" onClick={() => setLibraryOpen(true)}>
              <Database className="w-3 h-3 text-primary" /> Selecionar da Biblioteca Técnica
            </Button>
            {newItem.library_item_id && (
              <Badge variant="outline" className="text-[9px] gap-1 bg-primary/5">
                <Database className="w-2.5 h-2.5" /> Vinculado à biblioteca
              </Badge>
            )}
            <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descrição do item" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade</label>
                <Input type="number" min={0} step="0.01" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade</label>
                <Input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Custo Unitário</label>
                <Input type="number" min={0} step="0.01" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: +e.target.value })} />
              </div>
            </div>
            <Input value={newItem.formula_label} onChange={(e) => setNewItem({ ...newItem, formula_label: e.target.value })} placeholder="Fórmula (opcional)" />
            <Input value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Observações (opcional)" />
            {newItem.quantity > 0 && newItem.unit_cost > 0 && (
              <Card className="p-2 bg-primary/10 border-primary/20">
                <span className="text-xs text-muted-foreground">Total: </span>
                <span className="font-mono font-bold text-primary">{formatBRL(newItem.quantity * newItem.unit_cost)}</span>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingToStageId(null)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newItem.description}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Library Picker */}
      <LibraryPickerDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibrarySelect} />

      {/* Composition Picker */}
      {scenarioId && (
        <CompositionPickerDialog
          open={compositionOpen}
          onClose={() => setCompositionOpen(false)}
          stages={stages}
          scenarioId={scenarioId}
        />
      )}
    </div>
  );
};

export default ProjectCustosTab;
