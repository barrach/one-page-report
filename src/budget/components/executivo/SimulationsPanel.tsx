import { useNavigate } from "react-router-dom";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { GitBranch, Plus, ArrowRight } from "lucide-react";
import { useToast } from "@budget/hooks/use-toast";
import {
  useExecutiveBudgetSimulations,
  useCreateExecutiveBudget,
  STATUS_LABELS,
  type ExecutiveBudget,
} from "@budget/hooks/useExecutiveBudgets";
import { defaultParams } from "@budget/lib/executiveSimulation";

interface Props {
  parent: ExecutiveBudget;
}

const SimulationsPanel = ({ parent }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: simulations = [], isLoading } = useExecutiveBudgetSimulations(parent.id);
  const createSim = useCreateExecutiveBudget();

  const handleCreate = async () => {
    try {
      const baseTitle = parent.title?.replace(/^Or[çc]amento Executivo —?\s*/i, "") || "";
      const created = await createSim.mutateAsync({
        projectId: parent.project_id,
        scenarioId: parent.scenario_id,
        title: `Simulação ${simulations.length + 1} — ${baseTitle}`.trim(),
        snapshotData: {
          ...parent.snapshot_data,
          simulation_params: defaultParams,
          simulation_of: parent.document_number,
        },
        parentExecutiveId: parent.id,
        isSimulation: true,
      });
      toast({ title: "Simulação criada", description: created.document_number });
      navigate(`/orcamento-executivo/${created.id}`);
    } catch (e: any) {
      toast({ title: "Erro ao criar simulação", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Simulações e Revisões</h2>
          <Badge variant="outline">{simulations.length}</Badge>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={createSim.isPending} className="gap-1">
          <Plus className="w-4 h-4" /> Nova simulação
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Cria uma cópia editável vinculada ao orçamento original. As simulações não alteram o orçamento aprovado.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : simulations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma simulação criada ainda.</p>
      ) : (
        <div className="space-y-2">
          {simulations.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/orcamento-executivo/${s.id}`)}
              className="w-full flex items-center justify-between text-left p-3 rounded-md border border-border/60 hover:bg-muted/30 transition-colors"
            >
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.document_number} · criada em {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{STATUS_LABELS[s.status]}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default SimulationsPanel;
