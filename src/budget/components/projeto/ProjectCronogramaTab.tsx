import { useEffect, useMemo } from "react";
import { useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import { useWorkforceRows, useTimelinePhases } from "@budget/hooks/useScheduleEngine";
import { useAllScopeComponents } from "@budget/hooks/useScheduleData";
import ScheduleSpreadsheet from "@budget/components/cronograma/ScheduleSpreadsheet";
import TeamPlanningPanel from "@budget/components/cronograma/TeamPlanningPanel";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@budget/components/ui/tabs";

interface Props {
  projectId: string;
}

const ProjectCronogramaTab = ({ projectId }: Props) => {
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: workforceRows = [] } = useWorkforceRows(scenarioId);
  const { data: timelinePhases = [] } = useTimelinePhases(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

  // HH MOD esperado vindo do escopo (estimativa: 85% do HH ajustado total)
  const expectedMODHH = useMemo(() => {
    const total = allComponents.reduce(
      (s, c: any) => s + (Number(c.adjusted_hh) || Number(c.calculated_hh) || 0),
      0,
    );
    return total * 0.85;
  }, [allComponents]);

  if (scenarioLoading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;
  if (!scenarioId) return <p className="text-sm text-muted-foreground text-center py-8">Criando cenário...</p>;

  const hasStructure = timelinePhases.length > 0 || workforceRows.length > 0;
  const hasHH =
    workforceRows.some((r: any) => Number(r.people_count) > 0 && Number(r.period_months) > 0) ||
    workforceRows.filter((r) => r.row_type === "function").some((r) => r.weekly_values.some((v: any) => Number(v) > 0));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Cronograma & Equipe</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Planeje a equipe (qtde × período × horas/mês) com custos de folha calculados automaticamente.
        </p>
      </div>
      <Tabs defaultValue="equipe" className="mt-2">
        <TabsList>
          <TabsTrigger value="equipe" className="text-xs">Equipe & Folha</TabsTrigger>
          <TabsTrigger value="histograma" className="text-xs">Histograma Semanal (legado)</TabsTrigger>
        </TabsList>
        <TabsContent value="equipe" className="mt-3">
          <TeamPlanningPanel projectId={projectId} scenarioId={scenarioId} expectedMODHH={expectedMODHH} />
        </TabsContent>
        <TabsContent value="histograma" className="mt-3">
          <ScheduleSpreadsheet scenarioId={scenarioId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectCronogramaTab;
