import { useState, useEffect, useMemo } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Slider } from "@budget/components/ui/slider";
import { Plus, Pencil, Trash2, Calculator, FolderOpen, Users, TrendingUp, AlertTriangle, Upload } from "lucide-react";
import { useUserProjects, useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import {
  useScenarioPhases, usePhaseMutations, useAllScopeComponents,
  computeProductivitySummary, computeHistogram, computeTeamSize,
  type ScenarioPhase, type ProductivitySummary,
} from "@budget/hooks/useScheduleData";
import { formatNumber } from "@budget/lib/format";
import ScheduleImportDialog, { type ImportedPhase, type ImportedResource, type ImportMode } from "@budget/components/cronograma/ScheduleImportDialog";
import { toast } from "sonner";

const DAILY_HOURS = 8.8;

const Cronograma = () => {
  const { data: projects = [] } = useUserProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(selectedProjectId);
  const ensureScenario = useEnsureScenario(selectedProjectId);
  const scenarioId = scenario?.id;

  const { data: phases = [], isLoading: phasesLoading } = useScenarioPhases(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);
  const { addPhase, updatePhase, removePhase } = usePhaseMutations(scenarioId);

  const [editPhase, setEditPhase] = useState<ScenarioPhase | null>(null);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newPhase, setNewPhase] = useState({
    phase_name: "", start_day: 0, duration_days: 30, team_size: 10, color_token: "bg-primary",
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [selectedProjectId, scenario, scenarioLoading]);

  const prodSummary: ProductivitySummary = useMemo(
    () => computeProductivitySummary(allComponents),
    [allComponents]
  );

  const totalDays = Math.max(...phases.map((p) => p.start_day + p.duration_days), 90);
  const totalMonths = Math.ceil(totalDays / 30);
  const histogram = useMemo(() => computeHistogram(phases, totalMonths), [phases, totalMonths]);
  const maxPersons = Math.max(...histogram.map((d) => d.total), 1);

  const totalPhaseHH = phases.reduce((s, p) => s + Number(p.calculated_hh), 0);
  const peakTeam = Math.max(...phases.map((p) => p.team_size), 0);
  const suggestedTeam = computeTeamSize(prodSummary.totalAdjustedHH, totalDays, DAILY_HOURS);

  const handleAdd = () => {
    const hh = newPhase.team_size * newPhase.duration_days * DAILY_HOURS;
    addPhase.mutate({
      phase_name: newPhase.phase_name,
      start_day: newPhase.start_day,
      duration_days: newPhase.duration_days,
      team_size: newPhase.team_size,
      calculated_hh: hh,
      color_token: newPhase.color_token,
      sort_order: phases.length,
    });
    setAdding(false);
    setNewPhase({ phase_name: "", start_day: 0, duration_days: 30, team_size: 10, color_token: "bg-primary" });
  };

  const handleSaveEdit = () => {
    if (!editPhase) return;
    const hh = editPhase.team_size * editPhase.duration_days * DAILY_HOURS;
    updatePhase.mutate({
      id: editPhase.id,
      phase_name: editPhase.phase_name,
      start_day: editPhase.start_day,
      duration_days: editPhase.duration_days,
      team_size: editPhase.team_size,
      calculated_hh: hh,
    });
    setEditPhase(null);
  };

  const handleScheduleImport = async (imported: ImportedPhase[], _resources?: ImportedResource[], mode?: ImportMode) => {
    if (!scenarioId) return;

    if (mode === "replace" && phases.length > 0) {
      for (const phase of phases) {
        try {
          await removePhase.mutateAsync(phase.id);
        } catch (e) {
          console.error("Error removing phase:", e);
        }
      }
    }

    const colorTokens = ["bg-primary", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
    const startOffset = mode === "merge" ? phases.length : 0;
    let added = 0;
    let skipped = 0;
    let runningDay = 0;

    for (let i = 0; i < imported.length; i++) {
      const p = imported[i];

      const phaseName = (p.phase_name || "").trim();
      if (!phaseName) { skipped++; continue; }

      const durationDays = typeof p.duration_days === "number" && p.duration_days >= 0 ? p.duration_days : 1;
      const teamSize = typeof p.team_size === "number" && p.team_size >= 0 ? p.team_size : 1;

      let startDay: number;
      if (typeof p.start_day === "number" && !isNaN(p.start_day)) {
        startDay = p.start_day;
      } else {
        startDay = runningDay;
      }
      runningDay = startDay + durationDays;

      const hh = teamSize * durationDays * DAILY_HOURS;
      try {
        await addPhase.mutateAsync({
          phase_name: phaseName,
          start_day: startDay,
          duration_days: durationDays,
          team_size: teamSize,
          calculated_hh: hh,
          color_token: colorTokens[i % colorTokens.length],
          sort_order: startOffset + i,
          notes: [
            p.type !== "task" ? `Tipo: ${p.type}` : null,
            p.predecessors ? `Predecessoras: ${p.predecessors}` : null,
            p.resources ? `Recursos: ${p.resources}` : null,
            p.start_date ? `Data início: ${p.start_date}` : null,
            p.end_date ? `Data fim: ${p.end_date}` : null,
          ].filter(Boolean).join(" | ") || null,
        });
        added++;
      } catch (e) {
        console.error("Error adding phase:", e);
        skipped++;
      }
    }
    const modeLabel = mode === "replace" ? "substituídas" : mode === "merge" ? "mescladas" : "importadas";
    if (skipped > 0) {
      toast.warning(`${added} fases ${modeLabel}. ${skipped} fase(s) ignorada(s) por falta de informações obrigatórias.`);
    } else {
      toast.success(`${added} fases ${modeLabel} com sucesso!`);
    }
  };

  return (
    <AppLayout>
      {/* Sticky header with always-visible import button */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-4 -mx-6 px-6 pt-2 border-b border-border/50 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cronograma & Dimensionamento</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Escopo → Produtividade → HH → Equipe → Cronograma
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="gap-2" size="sm" onClick={() => setImportOpen(true)} disabled={!scenarioId}>
              <Upload className="w-4 h-4" /> Importar Cronograma
            </Button>
            <Button variant="outline" className="gap-2" size="sm" onClick={() => setAdding(true)} disabled={!scenarioId}>
              <Plus className="w-4 h-4" /> Nova Fase
            </Button>
          </div>
        </div>
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

      {/* Productivity summary from scope */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">HH Base (Escopo)</p>
          <p className="text-2xl font-bold font-mono text-foreground">{formatNumber(prodSummary.totalBaseHH)}</p>
          <p className="text-[10px] text-muted-foreground">Sem fatores de ajuste</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">HH Ajustado</p>
          <p className="text-2xl font-bold font-mono text-primary">{formatNumber(prodSummary.totalAdjustedHH)}</p>
          <p className="text-[10px] text-muted-foreground">
            Fator médio: {prodSummary.totalAdjustmentFactor.toFixed(2)}x
          </p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">HH Cronograma</p>
          <p className="text-2xl font-bold font-mono text-accent">{formatNumber(totalPhaseHH)}</p>
          <p className="text-[10px] text-muted-foreground">Σ fases = equipe × dias × {DAILY_HOURS}h</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pico de Efetivo</p>
          <p className="text-2xl font-bold font-mono text-foreground">{peakTeam}</p>
          <p className="text-[10px] text-muted-foreground">
            Sugestão: {suggestedTeam} (baseado no HH ajustado)
          </p>
        </Card>
      </div>

      {/* Adjustment factors info */}
      {prodSummary.totalBaseHH > 0 && prodSummary.totalAdjustedHH !== prodSummary.totalBaseHH && (
        <Card className="p-3 bg-accent/10 border-accent/20 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <p className="text-xs text-foreground">
              <strong>Produtividade ajustada:</strong> O HH base foi corrigido por fatores de complexidade, interferência, acesso, clima, turno e restrição.
              Fator combinado médio: <span className="font-mono font-bold">{prodSummary.totalAdjustmentFactor.toFixed(2)}x</span>
            </p>
          </div>
        </Card>
      )}

      {/* Productivity by resource type */}
      {Object.keys(prodSummary.byCategory).length > 0 && (
        <Card className="p-4 bg-card border-border mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Produtividade por Tipo de Recurso
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(prodSummary.byCategory).map(([cat, data]) => (
              <div key={cat} className="p-3 rounded-md bg-muted/30 border border-border">
                <p className="text-xs font-medium text-foreground">{cat}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base: <span className="font-mono">{formatNumber(data.baseHH)}</span> HH
                </p>
                <p className="text-xs text-muted-foreground">
                  Ajustado: <span className="font-mono text-primary">{formatNumber(data.adjustedHH)}</span> HH
                </p>
                <p className="text-[10px] text-muted-foreground">{data.count} componentes</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(scenarioLoading || phasesLoading) && selectedProjectId && (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      )}

      {/* Upload area - always visible when no phases */}
      {scenarioId && phases.length === 0 && (
        <Card
          className="p-8 bg-card border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors mb-6 cursor-pointer text-center"
          onClick={() => setImportOpen(true)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) {
              setImportOpen(true);
              setTimeout(() => {
                const input = document.getElementById("schedule-file-input") as HTMLInputElement;
                if (input) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  input.files = dt.files;
                  input.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }, 300);
            }
          }}
        >
          <Upload className="w-10 h-10 text-primary/60 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Importar Cronograma</p>
          <p className="text-xs text-muted-foreground mb-2">Arraste um arquivo aqui ou clique para selecionar</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">.xlsx</Badge>
            <Badge variant="secondary" className="text-[10px]">.xls</Badge>
            <Badge variant="secondary" className="text-[10px]">.csv</Badge>
            <Badge variant="secondary" className="text-[10px]">.mpp</Badge>
          </div>
        </Card>
      )}

      {/* Gantt */}
      {scenarioId && (
        <Card className="p-6 bg-card border-border mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Fases do Orçamento</h3>
          </div>
          {phases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma fase definida. Adicione fases para montar o cronograma.
            </p>
          ) : (
            <div className="space-y-2.5">
              {phases.map((phase) => (
                <div key={phase.id} className="flex items-center gap-3 group">
                  <span className="text-xs text-muted-foreground w-36 truncate">{phase.phase_name}</span>
                  <div className="flex-1 h-7 bg-muted rounded relative">
                    <div
                      className={`absolute h-full rounded ${phase.color_token || "bg-primary"} opacity-80 flex items-center px-2 overflow-hidden`}
                      style={{
                        left: `${(phase.start_day / totalDays) * 100}%`,
                        width: `${Math.max((phase.duration_days / totalDays) * 100, 4)}%`,
                      }}
                    >
                      <span className="text-[10px] font-medium text-foreground truncate">
                        {phase.team_size}p • {formatNumber(Number(phase.calculated_hh))}HH
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditPhase({ ...phase })}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePhase.mutate(phase.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Histogram */}
      {phases.length > 0 && (
        <Card className="p-6 bg-card border-border mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Histograma de Efetivo
          </h3>
          <div className="flex items-end gap-3 h-40">
            {histogram.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: "130px" }}>
                  <div className="w-full flex flex-col justify-end h-full gap-0.5">
                    <div className="w-full bg-primary/30 rounded-t transition-all" style={{ height: `${(d.moi / maxPersons) * 100}%` }} />
                    <div className="w-full bg-primary rounded-t transition-all" style={{ height: `${(d.mod / maxPersons) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.month}</span>
                <span className="text-xs font-medium text-foreground">{d.total}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-3 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-primary" /><span className="text-muted-foreground">MOD (85%)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-primary/30" /><span className="text-muted-foreground">MOI (15%)</span></div>
          </div>
        </Card>
      )}

      {/* Phase summary table */}
      {phases.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Resumo por Fase</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-2.5 font-medium text-muted-foreground">Fase</th>
                <th className="text-right p-2.5 font-medium text-muted-foreground">Início</th>
                <th className="text-right p-2.5 font-medium text-muted-foreground">Duração</th>
                <th className="text-right p-2.5 font-medium text-muted-foreground">Equipe</th>
                <th className="text-right p-2.5 font-medium text-muted-foreground">HH Total</th>
                <th className="text-left p-2.5 font-medium text-muted-foreground">Fórmula</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setEditPhase({ ...p })}>
                  <td className="p-2.5 text-foreground font-medium">{p.phase_name}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">Dia {p.start_day}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">{p.duration_days}d</td>
                  <td className="p-2.5 text-right font-mono text-foreground">{p.team_size}</td>
                  <td className="p-2.5 text-right font-mono font-medium text-primary">{formatNumber(Number(p.calculated_hh))}</td>
                  <td className="p-2.5 text-muted-foreground italic text-[10px]">
                    {p.team_size} × {p.duration_days}d × {DAILY_HOURS}h
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className="p-2.5 font-semibold text-foreground" colSpan={4}>Total</td>
                <td className="p-2.5 text-right font-mono font-bold text-accent">{formatNumber(totalPhaseHH)}</td>
                <td className="p-2.5 text-muted-foreground italic text-[10px]">Σ fases</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editPhase} onOpenChange={() => setEditPhase(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Fase</DialogTitle></DialogHeader>
          {editPhase && (
            <div className="space-y-3">
              <Input value={editPhase.phase_name} onChange={(e) => setEditPhase({ ...editPhase, phase_name: e.target.value })} placeholder="Nome da fase" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Início (dia)</label>
                  <Input type="number" value={editPhase.start_day} onChange={(e) => setEditPhase({ ...editPhase, start_day: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duração (dias)</label>
                  <Input type="number" value={editPhase.duration_days} onChange={(e) => setEditPhase({ ...editPhase, duration_days: +e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Equipe (pessoas)</label>
                <Input type="number" value={editPhase.team_size} onChange={(e) => setEditPhase({ ...editPhase, team_size: +e.target.value })} />
              </div>
              <Card className="p-3 bg-primary/10 border-primary/20">
                <p className="text-xs text-muted-foreground">HH Calculado Automaticamente:</p>
                <p className="text-xl font-bold font-mono text-primary">
                  {formatNumber(editPhase.team_size * editPhase.duration_days * DAILY_HOURS)} HH
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {editPhase.team_size} pessoas × {editPhase.duration_days} dias × {DAILY_HOURS} h/dia
                </p>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhase(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Fase</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newPhase.phase_name} onChange={(e) => setNewPhase({ ...newPhase, phase_name: e.target.value })} placeholder="Nome da fase" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Início (dia)</label>
                <Input type="number" value={newPhase.start_day} onChange={(e) => setNewPhase({ ...newPhase, start_day: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Duração (dias)</label>
                <Input type="number" value={newPhase.duration_days} onChange={(e) => setNewPhase({ ...newPhase, duration_days: +e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Equipe (pessoas)</label>
              <Input type="number" value={newPhase.team_size} onChange={(e) => setNewPhase({ ...newPhase, team_size: +e.target.value })} />
            </div>
            <Card className="p-3 bg-primary/10 border-primary/20">
              <p className="text-xs text-muted-foreground">HH Calculado:</p>
              <p className="text-lg font-bold font-mono text-primary">
                {formatNumber(newPhase.team_size * newPhase.duration_days * DAILY_HOURS)} HH
              </p>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newPhase.phase_name}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Import Dialog */}
      <ScheduleImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleScheduleImport}
        existingPhasesCount={phases.length}
      />
    </AppLayout>
  );
};

export default Cronograma;
