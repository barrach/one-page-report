import { useState } from "react";
import { useScopeComponents, useScopeMutations } from "@budget/hooks/useScopeData";
import { computeAdjustedHH } from "@budget/hooks/useScheduleData";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Slider } from "@budget/components/ui/slider";
import { Plus, Pencil, Trash2, Calculator, Save, X, SlidersHorizontal, Database } from "lucide-react";
import LibraryPickerDialog from "./LibraryPickerDialog";

interface Props {
  scopeItemId: string;
  scenarioId?: string;
}

const FACTOR_LABELS: Record<string, string> = {
  factor_complexity: "Complexidade",
  factor_interference: "Interferência",
  factor_access: "Acesso",
  factor_climate: "Clima",
  factor_shift: "Turno",
  factor_restriction: "Restrição",
};

const DEFAULT_FACTORS = {
  factor_complexity: 1.0,
  factor_interference: 1.0,
  factor_access: 1.0,
  factor_climate: 1.0,
  factor_shift: 1.0,
  factor_restriction: 1.0,
};

export default function ScopeComponentList({ scopeItemId, scenarioId }: Props) {
  const { data: components = [], isLoading } = useScopeComponents(scopeItemId);
  const { addComponent, updateComponent, removeComponent } = useScopeMutations(scenarioId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFactors, setShowFactors] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    quantity: 1,
    unit: "un",
    productivity_index: null as number | null,
    productivity_unit: "",
    resource_type: "",
    notes: "",
    library_item_id: null as string | null,
    ...DEFAULT_FACTORS,
  });

  const resetForm = () => {
    setForm({
      description: "", quantity: 1, unit: "un", productivity_index: null,
      productivity_unit: "", resource_type: "", notes: "", library_item_id: null,
      ...DEFAULT_FACTORS,
    });
  };

  const baseHH = (form.productivity_index && form.quantity) ? form.quantity * form.productivity_index : 0;
  const adjHH = computeAdjustedHH(baseHH, form);
  const combinedFactor = baseHH > 0 ? adjHH / baseHH : 1;

  const handleLibrarySelect = (item: any) => {
    setForm({
      ...form,
      description: [item.discipline, item.group_name, item.item_type, item.operation, item.material].filter(Boolean).join(" — "),
      productivity_index: item.index_value,
      productivity_unit: item.unit || "",
      unit: item.unit || form.unit,
      library_item_id: item.id,
      notes: item.source_workbook_name ? `Fonte: ${item.source_workbook_name}` : form.notes,
    });
    setLibraryOpen(false);
  };

  const handleAdd = () => {
    addComponent.mutate({
      scope_item_id: scopeItemId,
      description: form.description,
      quantity: form.quantity,
      unit: form.unit,
      productivity_index: form.productivity_index,
      productivity_unit: form.productivity_unit || null,
      resource_type: form.resource_type || null,
      notes: form.notes || null,
      library_item_id: form.library_item_id,
      calculated_hh: baseHH,
      adjusted_hh: adjHH,
      origin: form.library_item_id ? "library" as const : "manual" as const,
      factor_complexity: form.factor_complexity,
      factor_interference: form.factor_interference,
      factor_access: form.factor_access,
      factor_climate: form.factor_climate,
      factor_shift: form.factor_shift,
      factor_restriction: form.factor_restriction,
    });
    setAdding(false);
    resetForm();
  };

  const handleSaveEdit = (id: string) => {
    updateComponent.mutate({
      id,
      scope_item_id: scopeItemId,
      description: form.description,
      quantity: form.quantity,
      unit: form.unit,
      productivity_index: form.productivity_index,
      productivity_unit: form.productivity_unit || null,
      resource_type: form.resource_type || null,
      notes: form.notes || null,
      library_item_id: form.library_item_id,
      calculated_hh: baseHH,
      adjusted_hh: adjHH,
      factor_complexity: form.factor_complexity,
      factor_interference: form.factor_interference,
      factor_access: form.factor_access,
      factor_climate: form.factor_climate,
      factor_shift: form.factor_shift,
      factor_restriction: form.factor_restriction,
    });
    setEditingId(null);
    resetForm();
  };

  const startEdit = (c: typeof components[0]) => {
    setEditingId(c.id);
    setForm({
      description: c.description,
      quantity: Number(c.quantity),
      unit: c.unit || "un",
      productivity_index: c.productivity_index ? Number(c.productivity_index) : null,
      productivity_unit: c.productivity_unit || "",
      resource_type: c.resource_type || "",
      notes: c.notes || "",
      library_item_id: c.library_item_id || null,
      factor_complexity: Number(c.factor_complexity) || 1,
      factor_interference: Number(c.factor_interference) || 1,
      factor_access: Number(c.factor_access) || 1,
      factor_climate: Number(c.factor_climate) || 1,
      factor_shift: Number(c.factor_shift) || 1,
      factor_restriction: Number(c.factor_restriction) || 1,
    });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando composição...</p>;

  const renderFactorSliders = () => (
    <div className="space-y-2 p-3 bg-muted/30 rounded-md border border-border">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <SlidersHorizontal className="w-3 h-3" /> Fatores de Ajuste de Produtividade
      </p>
      {Object.entries(FACTOR_LABELS).map(([key, label]) => {
        const val = form[key as keyof typeof form] as number;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-24">{label}</span>
            <Slider
              min={50} max={200} step={5}
              value={[val * 100]}
              onValueChange={([v]) => setForm({ ...form, [key]: v / 100 })}
              className="flex-1"
            />
            <span className="text-[10px] font-mono text-foreground w-10 text-right">{val.toFixed(2)}x</span>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] font-medium text-muted-foreground">Fator combinado</span>
        <span className="text-xs font-mono font-bold text-primary">{combinedFactor.toFixed(2)}x</span>
      </div>
    </div>
  );

  const renderForm = (onSave: () => void, onCancel: () => void) => (
    <div className="space-y-2 p-3 bg-card rounded-md border border-border">
      {/* Library picker button */}
      <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed" onClick={() => setLibraryOpen(true)}>
        <Database className="w-3 h-3 text-primary" /> Selecionar da Biblioteca Técnica
      </Button>
      {form.library_item_id && (
        <Badge variant="outline" className="text-[9px] gap-1 bg-primary/5">
          <Database className="w-2.5 h-2.5" /> Vinculado à biblioteca
        </Badge>
      )}

      <Input placeholder="Descrição do componente" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Quantidade</label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Unidade</label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Tipo Recurso</label>
          <Input value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} placeholder="MO, Mat, Equip" className="text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Índice Produtividade</label>
          <Input type="number" step="0.01" value={form.productivity_index ?? ""} onChange={(e) => setForm({ ...form, productivity_index: +e.target.value || null })} placeholder="Ex: 0.45" className="text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Un. Produtividade</label>
          <Input value={form.productivity_unit} onChange={(e) => setForm({ ...form, productivity_unit: e.target.value })} placeholder="HH/m" className="text-sm" />
        </div>
      </div>

      {baseHH > 0 && (
        <div className="p-2 bg-primary/10 rounded text-xs space-y-1">
          <div className="flex items-center gap-1">
            <Calculator className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">Base:</span>
            <span className="font-mono text-foreground">{baseHH.toFixed(1)} HH</span>
            <span className="text-muted-foreground">= {form.quantity} × {form.productivity_index}</span>
          </div>
          {combinedFactor !== 1 && (
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-accent" />
              <span className="text-muted-foreground">Ajustado:</span>
              <span className="font-mono font-bold text-primary">{adjHH.toFixed(1)} HH</span>
              <span className="text-muted-foreground">({combinedFactor.toFixed(2)}x)</span>
            </div>
          )}
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full gap-1 text-xs" onClick={() => setShowFactors(showFactors ? null : "open")}>
        <SlidersHorizontal className="w-3 h-3" /> {showFactors ? "Ocultar" : "Fatores de Ajuste"}
      </Button>
      {showFactors && renderFactorSliders()}

      <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" className="text-sm" />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="w-3 h-3 mr-1" />Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={!form.description}><Save className="w-3 h-3 mr-1" />Salvar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Composição Técnica</p>
      {components.map((c) =>
        editingId === c.id ? (
          <div key={c.id}>{renderForm(() => handleSaveEdit(c.id), () => { setEditingId(null); resetForm(); })}</div>
        ) : (
          <div key={c.id} className="flex items-center gap-2 p-2 rounded bg-card border border-border text-xs">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground">{c.description}</span>
              <div className="flex flex-wrap gap-2 mt-0.5">
                <span className="text-muted-foreground">Qtd: <span className="font-mono text-foreground">{Number(c.quantity)}</span> {c.unit}</span>
                {c.resource_type && <Badge variant="outline" className="text-[9px]">{c.resource_type}</Badge>}
                {c.library_item_id && (
                  <Badge variant="outline" className="text-[9px] gap-0.5 bg-primary/5 border-primary/20">
                    <Database className="w-2 h-2" /> Biblioteca
                  </Badge>
                )}
                {Number(c.productivity_index) > 0 && (
                  <span className="text-muted-foreground">Prod: <span className="font-mono text-primary">{Number(c.productivity_index)} {c.productivity_unit}</span></span>
                )}
                {Number(c.calculated_hh) > 0 && (
                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                    <Calculator className="w-2.5 h-2.5 mr-0.5" />{Number(c.calculated_hh).toFixed(1)} HH
                  </Badge>
                )}
                {Number(c.adjusted_hh) > 0 && Number(c.adjusted_hh) !== Number(c.calculated_hh) && (
                  <Badge className="text-[9px] bg-accent/10 text-accent border-accent/20">
                    <SlidersHorizontal className="w-2.5 h-2.5 mr-0.5" />{Number(c.adjusted_hh).toFixed(1)} HH adj
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(c)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeComponent.mutate({ id: c.id, scope_item_id: scopeItemId })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )
      )}
      {adding ? (
        renderForm(handleAdd, () => { setAdding(false); resetForm(); })
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 gap-1 text-xs" onClick={() => { setAdding(true); resetForm(); }}>
            <Plus className="w-3 h-3" /> Manual
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => { setAdding(true); resetForm(); setLibraryOpen(true); }}>
            <Database className="w-3 h-3" /> Da Biblioteca
          </Button>
        </div>
      )}

      <LibraryPickerDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibrarySelect} />
    </div>
  );
}
