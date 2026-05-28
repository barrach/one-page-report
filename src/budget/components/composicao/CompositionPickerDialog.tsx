import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@budget/components/ui/dialog";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Card } from "@budget/components/ui/card";
import { Search, Layers, Package, Loader2, ChevronRight } from "lucide-react";
import { useCompositions, useCompositionItems, getStageCodeForResourceType, type Composition, type CompositionItem } from "@budget/hooks/useCompositions";
import { useCostMutations, type CostStage } from "@budget/hooks/useCostData";
import { formatBRL } from "@budget/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  stages: CostStage[];
  scenarioId: string;
}

const RESOURCE_COLORS: Record<string, string> = {
  MOD: "bg-primary/10 text-primary",
  MOI: "bg-accent/10 text-accent",
  MATERIAL: "bg-green-500/10 text-green-500",
  EQUIPAMENTO: "bg-purple-500/10 text-purple-500",
};

const CompositionPickerDialog = ({ open, onClose, stages, scenarioId }: Props) => {
  const [search, setSearch] = useState("");
  const [selectedComp, setSelectedComp] = useState<Composition | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [generating, setGenerating] = useState(false);

  const { data: compositions = [], isLoading } = useCompositions(search);
  const { data: compItems = [] } = useCompositionItems(selectedComp?.id);
  const { addItem } = useCostMutations(scenarioId);

  const previewCosts = useMemo(() => {
    if (!compItems.length) return [];
    return compItems.map((ci) => ({
      ...ci,
      totalQty: ci.consumption * quantity,
      totalCost: ci.consumption * quantity * ci.unit_cost,
    }));
  }, [compItems, quantity]);

  const totalCost = previewCosts.reduce((s, c) => s + c.totalCost, 0);
  const totalHH = previewCosts
    .filter((c) => c.resource_type === "MOD" || c.resource_type === "MOI")
    .reduce((s, c) => s + c.totalQty, 0);

  const handleApply = async () => {
    if (!selectedComp || !stages.length) return;
    setGenerating(true);

    try {
      for (const ci of previewCosts) {
        const stageCode = getStageCodeForResourceType(ci.resource_type);
        const stage = stages.find((s) => s.stage_code === stageCode);
        if (!stage) continue;

        await addItem.mutateAsync({
          cost_stage_id: stage.id,
          description: `${ci.resource_name} — ${selectedComp.name}`,
          quantity: ci.totalQty,
          unit: ci.unit || "un",
          unit_cost: ci.unit_cost,
          origin: "formula" as any,
          formula_label: `${ci.consumption} × ${quantity} ${selectedComp.base_unit || "un"}`,
          origin_reference: `CPU: ${selectedComp.name}`,
          notes: ci.notes || null,
          library_item_id: ci.library_item_id,
        });
      }
      onClose();
      setSelectedComp(null);
      setQuantity(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleBack = () => {
    setSelectedComp(null);
    setQuantity(1);
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setSelectedComp(null); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {selectedComp ? selectedComp.name : "Selecionar Composição (CPU)"}
          </DialogTitle>
          <DialogDescription>
            {selectedComp
              ? "Defina a quantidade e aplique — os custos serão gerados automaticamente"
              : "Escolha uma composição para gerar itens de custo automaticamente"}
          </DialogDescription>
        </DialogHeader>

        {!selectedComp ? (
          /* ── List view ── */
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar composição..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : compositions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma composição encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">Crie composições na Biblioteca Técnica</p>
              </div>
            ) : (
              <div className="space-y-2">
                {compositions.map((comp) => (
                  <Card
                    key={comp.id}
                    className="p-3 hover:bg-muted/30 cursor-pointer transition-colors border-border"
                    onClick={() => setSelectedComp(comp)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{comp.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {comp.discipline && <Badge variant="outline" className="text-[10px]">{comp.discipline}</Badge>}
                          <span className="text-[10px] text-muted-foreground">Unidade base: {comp.base_unit || "un"}</span>
                        </div>
                        {comp.description && <p className="text-xs text-muted-foreground mt-1">{comp.description}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Detail + quantity view ── */
          <div className="flex-1 overflow-y-auto space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="text-xs gap-1 text-muted-foreground">
              ← Voltar à lista
            </Button>

            <div>
              <label className="text-xs text-muted-foreground">Quantidade do serviço ({selectedComp.base_unit || "un"})</label>
              <Input
                type="number" min={0.01} step="0.01" value={quantity}
                onChange={(e) => setQuantity(Math.max(0.01, +e.target.value))}
                className="mt-1"
              />
            </div>

            {compItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum recurso nesta composição</p>
            ) : (
              <Card className="bg-card border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left p-2 font-medium text-muted-foreground">Recurso</th>
                      <th className="text-center p-2 font-medium text-muted-foreground w-20">Tipo</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-20">Consumo</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-20">Qtd Final</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-24">C. Unit.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-24">C. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCosts.map((ci) => (
                      <tr key={ci.id} className="border-b border-border/20">
                        <td className="p-2 text-foreground">{ci.resource_name}</td>
                        <td className="p-2 text-center">
                          <Badge className={`text-[9px] ${RESOURCE_COLORS[ci.resource_type] || ""}`}>
                            {ci.resource_type}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {ci.consumption.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {ci.unit}
                        </td>
                        <td className="p-2 text-right font-mono text-foreground font-medium">
                          {ci.totalQty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono text-foreground">{formatBRL(ci.unit_cost)}</td>
                        <td className="p-2 text-right font-mono font-bold text-foreground">{formatBRL(ci.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-primary/5 border-primary/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">HH Total</p>
                <p className="text-sm font-bold font-mono text-primary">{totalHH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p>
              </Card>
              <Card className="p-3 bg-accent/5 border-accent/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Custo Total</p>
                <p className="text-sm font-bold font-mono text-accent">{formatBRL(totalCost)}</p>
              </Card>
              <Card className="p-3 bg-muted/20 border-border text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Itens a Gerar</p>
                <p className="text-sm font-bold font-mono text-foreground">{previewCosts.length}</p>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setSelectedComp(null); }}>Cancelar</Button>
          {selectedComp && (
            <Button onClick={handleApply} disabled={generating || previewCosts.length === 0}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
              Aplicar Composição ({previewCosts.length} itens)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompositionPickerDialog;
