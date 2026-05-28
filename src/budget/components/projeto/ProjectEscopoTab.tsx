import { useState, useEffect, useMemo } from "react";
import { Card } from "@budget/components/ui/card";
import { Calculator, Clock, FileText } from "lucide-react";
import { useActiveScenario, useEnsureScenario, useScopeItems, useScopeMutations, SCOPE_CATEGORIES, type ScopeItem } from "@budget/hooks/useScopeData";
import { useAllScopeComponents, computeProductivitySummary } from "@budget/hooks/useScheduleData";
import ScopeCategoryCard from "@budget/components/escopo/ScopeCategoryCard";
import ScopeItemSheet from "@budget/components/escopo/ScopeItemSheet";
import ScopeItemDialog from "@budget/components/escopo/ScopeItemDialog";
import RawScopeSection from "@budget/components/escopo/RawScopeSection";
import { formatNumber } from "@budget/lib/format";

import { supabase } from "@budget/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  projectId: string;
}

function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: ["project_detail_scope", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("scope_description, premises, exclusions, notes, project_name, client, location, contract_type")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

const ProjectEscopoTab = ({ projectId }: Props) => {
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: items = [], isLoading: itemsLoading } = useScopeItems(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);
  const mutations = useScopeMutations(scenarioId);
  const { data: projectDetail } = useProjectDetail(projectId);

  const [openCatKey, setOpenCatKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScopeItem | null>(null);

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

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

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, confirmed: 0, linked: 0 };
    for (const item of items) {
      const s = (item as any).status || "draft";
      if (s in counts) counts[s as keyof typeof counts]++;
    }
    return counts;
  }, [items]);

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

  const handleAddBatch = (batchItems: any[]) => {
    if (!scenarioId) return;
    mutations.addItemsBatch.mutate(batchItems);
  };

  const totalItems = items.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Escopo & Análise</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Defina o escopo do projeto e estruture os itens técnicos que serão utilizados na composição do orçamento.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {prodSummary.totalBaseHH > 0 && (
            <Card className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border-primary/20">
              <p className="text-[10px] text-muted-foreground">HH Total</p>
              <p className="text-base sm:text-lg font-bold text-primary font-mono">{formatNumber(prodSummary.totalAdjustedHH)}</p>
              <p className="text-[10px] text-muted-foreground">Base: {formatNumber(prodSummary.totalBaseHH)} | Fator: {prodSummary.totalAdjustmentFactor.toFixed(2)}x</p>
            </Card>
          )}
          <Card className="px-3 py-1.5 sm:px-4 sm:py-2 bg-card border-border">
            <p className="text-[10px] text-muted-foreground">Itens</p>
            <p className="text-base sm:text-lg font-bold text-foreground font-mono">{totalItems}</p>
            <div className="flex gap-1.5 mt-0.5">
              {statusCounts.draft > 0 && <span className="text-[9px] text-muted-foreground">{statusCounts.draft} rascunho</span>}
              {statusCounts.confirmed > 0 && <span className="text-[9px] text-primary">{statusCounts.confirmed} confirmado</span>}
              {statusCounts.linked > 0 && <span className="text-[9px] text-green-500">{statusCounts.linked} vinculado</span>}
            </div>
          </Card>
        </div>
      </div>

      {/* LEVEL 1: Raw scope from client */}
      {projectDetail && (
        <RawScopeSection
          projectId={projectId}
          initialData={projectDetail}
          projectMeta={{
            project_name: projectDetail.project_name,
            client: projectDetail.client,
            location: projectDetail.location,
            contract_type: projectDetail.contract_type,
          }}
          scopeItems={items.map(i => ({ title: i.title, category: i.category }))}
        />
      )}

      {/* Engine chain indicator */}
      {prodSummary.totalBaseHH > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20">
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

      {(scenarioLoading || itemsLoading) && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando escopo...</p>
      )}

      {/* LEVEL 2 & 3: Decomposition categories with technical items */}
      {scenarioId && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Decomposição Técnica</h3>
            <span className="text-xs text-muted-foreground">— Clique em uma categoria para gerenciar itens</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
          onAddBatch={handleAddBatch}
          batchSaving={mutations.addItemsBatch.isPending}
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
    </div>
  );
};

export default ProjectEscopoTab;
