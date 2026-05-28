import { useState, useEffect, useMemo } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Calculator, FolderOpen, FileText, Clock } from "lucide-react";
import { useScopeItems, useScopeMutations, useUserProjects, useActiveScenario, useEnsureScenario, SCOPE_CATEGORIES, type ScopeItem } from "@budget/hooks/useScopeData";
import { useAllScopeComponents, computeProductivitySummary } from "@budget/hooks/useScheduleData";
import ScopeCategoryCard from "@budget/components/escopo/ScopeCategoryCard";
import ScopeItemSheet from "@budget/components/escopo/ScopeItemSheet";
import ScopeItemDialog from "@budget/components/escopo/ScopeItemDialog";
import RawScopeSection from "@budget/components/escopo/RawScopeSection";
import HHCalculationPanel from "@budget/components/escopo/HHCalculationPanel";
import { formatNumber } from "@budget/lib/format";
import { supabase } from "@budget/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function useProjectDetailForScope(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_detail_scope", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("scope_description, premises, exclusions, notes")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

const Escopo = () => {
  const { data: projects = [] } = useUserProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(selectedProjectId);
  const ensureScenario = useEnsureScenario(selectedProjectId);
  const scenarioId = scenario?.id;

  const { data: items = [], isLoading: itemsLoading } = useScopeItems(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);
  const mutations = useScopeMutations(scenarioId);
  const { data: projectDetail } = useProjectDetailForScope(selectedProjectId);

  const [openCatKey, setOpenCatKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScopeItem | null>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [selectedProjectId, scenario, scenarioLoading]);

  const itemsByCategory = useMemo(() => {
    const map: Record<string, ScopeItem[]> = {};
    for (const cat of SCOPE_CATEGORIES) map[cat.key] = [];
    for (const item of items) {
      if (map[item.category]) map[item.category].push(item);
      else map[item.category] = [item];
    }
    return map;
  }, [items]);

  const hhByCategory = useMemo(() => {
    const itemCatMap: Record<string, string> = {};
    for (const item of items) itemCatMap[item.id] = item.category;
    const result: Record<string, number> = {};
    for (const c of allComponents) {
      const cat = itemCatMap[c.scope_item_id] || "other";
      const hh = Number(c.adjusted_hh) || Number(c.calculated_hh) || 0;
      result[cat] = (result[cat] || 0) + hh;
    }
    return result;
  }, [items, allComponents]);

  const prodSummary = useMemo(() => computeProductivitySummary(allComponents), [allComponents]);

  const openCat = SCOPE_CATEGORIES.find((c) => c.key === openCatKey);
  const openCatItems = openCatKey ? (itemsByCategory[openCatKey] || []) : [];

  const handleAdd = (data: any) => {
    if (!scenarioId) return;
    mutations.addItem.mutate(data);
  };

  const handleEdit = (data: any) => {
    if (!editItem) return;
    mutations.updateItem.mutate({ id: editItem.id, ...data });
    setEditItem(null);
  };

  const handleRemove = (id: string) => {
    mutations.removeItem.mutate(id);
  };

  const totalItems = items.length;
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Escopo & Análise Técnica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Motor de decomposição: escopo bruto → itens técnicos → composição → HH → custos
        </p>
      </div>

      {/* Project selector + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 bg-card border-border lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <FolderOpen className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Orçamento Ativo</span>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento cadastrado.</p>
          ) : (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione um orçamento" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.project_name} — {p.client}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Card>
        <Card className="p-5 bg-card border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Itens do Escopo</p>
          <p className="text-3xl font-bold text-primary font-mono">{totalItems}</p>
          <p className="text-xs text-muted-foreground mt-1">em {SCOPE_CATEGORIES.length} categorias</p>
          {prodSummary.totalBaseHH > 0 && (
            <p className="text-xs font-mono text-primary mt-1">{formatNumber(prodSummary.totalAdjustedHH)} HH total</p>
          )}
        </Card>
      </div>

      {/* Raw scope section */}
      {selectedProjectId && projectDetail && (
        <div className="mb-6">
          <RawScopeSection projectId={selectedProjectId} initialData={projectDetail} />
        </div>
      )}

      {/* Engine chain */}
      {prodSummary.totalBaseHH > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20 mb-6">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Motor:</span>
            <span className="font-mono text-foreground">{totalItems} itens</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono text-foreground">{allComponents.length} componentes</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono text-primary font-medium">{formatNumber(prodSummary.totalBaseHH)} HH base</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono text-accent font-medium">{formatNumber(prodSummary.totalAdjustedHH)} HH ajustado</span>
          </div>
        </Card>
      )}

      {(scenarioLoading || itemsLoading) && selectedProjectId && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando escopo...</p>
      )}

      {scenarioId && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Decomposição Técnica</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SCOPE_CATEGORIES.map((cat) => (
              <ScopeCategoryCard
                key={cat.key}
                categoryKey={cat.key}
                label={cat.label}
                icon={cat.icon}
                items={itemsByCategory[cat.key] || []}
                totalHH={hhByCategory[cat.key]}
                onClick={() => setOpenCatKey(cat.key)}
              />
            ))}
          </div>
        </div>
      )}

      {scenarioId && selectedProjectId && items.length > 0 && (
        <div className="mt-6">
          <HHCalculationPanel
            projectId={selectedProjectId}
            scenarioId={scenarioId}
            scopeItems={items}
          />
        </div>
      )}

      {openCat && scenarioId && (
        <ScopeItemSheet
          open={!!openCatKey}
          onClose={() => setOpenCatKey(null)}
          categoryLabel={openCat.label}
          categoryKey={openCat.key}
          items={openCatItems}
          scenarioId={scenarioId}
          onAdd={() => { setEditItem(null); setDialogOpen(true); }}
          onEdit={(item) => { setEditItem(item); setDialogOpen(true); }}
          onRemove={handleRemove}
        />
      )}

      <ScopeItemDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={editItem ? handleEdit : handleAdd}
        editItem={editItem}
        category={openCatKey || "atividades_principais"}
        nextOrder={openCatItems.length}
      />
    </AppLayout>
  );
};

export default Escopo;
