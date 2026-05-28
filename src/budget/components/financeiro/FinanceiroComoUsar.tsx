import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  ListChecks,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { supabase } from "@budget/integrations/supabase/client";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { cn } from "@budget/lib/utils";
import type { SectionKey } from "./workspaceNav";

interface FinanceiroComoUsarProps {
  onNavigate?: (key: SectionKey) => void;
}

// Hook que verifica se cada "base" do fluxo já foi alimentada.
// Tudo é leve: apenas count com head=true.
const useFlowStatus = () => {
  const { competenceMonth } = useFinancialWorkspace();

  const contracts = useFinancialContracts({ onlyActive: false });

  const drg = useQuery({
    queryKey: ["flow-status", "drg-lines"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_drg_lines")
        .select("id", { head: true, count: "exact" });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const templates = useQuery({
    queryKey: ["flow-status", "templates"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("budget_templates")
        .select("id", { head: true, count: "exact" });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const monthlyEntries = useQuery({
    queryKey: ["flow-status", "monthly-entries", competenceMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_entries")
        .select("id", { head: true, count: "exact" })
        .eq("competence_date", competenceMonth);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pendingReview = useQuery({
    queryKey: ["flow-status", "pending-review", competenceMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_entries")
        .select("id", { head: true, count: "exact" })
        .eq("competence_date", competenceMonth)
        .is("contract_project_id", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const snapshots = useQuery({
    queryKey: ["flow-status", "snapshots", competenceMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_contract_snapshots")
        .select("id", { head: true, count: "exact" })
        .eq("competence_month", competenceMonth);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return {
    contractsCount: contracts.data?.length ?? 0,
    drgCount: drg.data ?? 0,
    templatesCount: templates.data ?? 0,
    monthlyEntriesCount: monthlyEntries.data ?? 0,
    pendingReviewCount: pendingReview.data ?? 0,
    snapshotsCount: snapshots.data ?? 0,
    isLoading:
      contracts.isLoading ||
      drg.isLoading ||
      templates.isLoading ||
      monthlyEntries.isLoading ||
      snapshots.isLoading,
  };
};

interface FlowStep {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  target: SectionKey;
  ctaLabel: string;
  done: boolean;
  badge?: string;
  badgeTone?: "ok" | "warn" | "info" | "muted";
}

const TONE: Record<NonNullable<FlowStep["badgeTone"]>, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  warn: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  muted: "bg-muted text-muted-foreground border-transparent",
};

const FinanceiroComoUsar = ({ onNavigate }: FinanceiroComoUsarProps) => {
  const status = useFlowStatus();
  const { competenceMonth } = useFinancialWorkspace();

  const competenceLabel = useMemo(() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    } catch {
      return competenceMonth;
    }
  }, [competenceMonth]);

  const steps: FlowStep[] = useMemo(
    () => [
      {
        number: 1,
        title: "Configurar contratos",
        description:
          "Cadastre os centros de custo e contratos que receberão dados de controladoria. Cada contrato vira uma área independente no sistema.",
        icon: Building2,
        target: "cost-centers",
        ctaLabel: "Abrir Centros de Custo",
        done: status.contractsCount > 0,
        badge:
          status.contractsCount > 0
            ? `${status.contractsCount} contrato(s)`
            : "Nenhum contrato",
        badgeTone: status.contractsCount > 0 ? "ok" : "warn",
      },
      {
        number: 2,
        title: "Importar bases estruturais",
        description:
          "Suba uma vez (ou raramente): Template UNIPAR e DRG Workbook completo. Essas bases populam o banco com a estrutura de orçamento. O Resumo do Resultado é gerado automaticamente pelo sistema.",
        icon: Database,
        target: "drg-import",
        ctaLabel: "Abrir Bases Estruturais",
        done: status.drgCount > 0 || status.templatesCount > 0,
        badge:
          status.drgCount > 0
            ? `${status.drgCount} linhas DRG`
            : status.templatesCount > 0
              ? `${status.templatesCount} template(s)`
              : "Nenhuma base",
        badgeTone: status.drgCount > 0 || status.templatesCount > 0 ? "ok" : "warn",
      },
      {
        number: 3,
        title: "Importar planilha mensal (CUSTOS_MES)",
        description:
          "ÚNICA planilha que sobe todo mês. O sistema lê a 'Descrição do Centro de Custo' e distribui automaticamente cada despesa ao contrato correto.",
        icon: Calendar,
        target: "real",
        ctaLabel: "Abrir Real Mensal",
        done: status.monthlyEntriesCount > 0,
        badge:
          status.monthlyEntriesCount > 0
            ? `${status.monthlyEntriesCount} lançamentos`
            : "Sem lançamentos",
        badgeTone: status.monthlyEntriesCount > 0 ? "ok" : "muted",
      },
      {
        number: 4,
        title: "Revisar vínculos pendentes",
        description:
          "Lançamentos que o sistema não conseguiu vincular automaticamente ficam em revisão manual. Atribua o contrato e a categoria certos.",
        icon: ListChecks,
        target: "real",
        ctaLabel: "Revisar pendentes",
        done: status.monthlyEntriesCount > 0 && status.pendingReviewCount === 0,
        badge:
          status.pendingReviewCount > 0
            ? `${status.pendingReviewCount} pendente(s)`
            : status.monthlyEntriesCount > 0
              ? "Tudo vinculado"
              : "—",
        badgeTone:
          status.pendingReviewCount > 0
            ? "warn"
            : status.monthlyEntriesCount > 0
              ? "ok"
              : "muted",
      },
      {
        number: 5,
        title: "Editar dados manualmente",
        description:
          "Abra a Área do Contrato e ajuste Baseline, Produção (BM), Pessoal, Imobilizado e Rateio Admin como uma planilha viva — com auto-salvamento.",
        icon: Pencil,
        target: "contract-hub",
        ctaLabel: "Abrir Área do Contrato",
        done: status.snapshotsCount > 0,
        badge:
          status.snapshotsCount > 0
            ? `${status.snapshotsCount} snapshot(s)`
            : "Sem ajustes",
        badgeTone: status.snapshotsCount > 0 ? "ok" : "muted",
      },
      {
        number: 6,
        title: "Conferir resumos e dashboards",
        description:
          "Tudo recalcula automaticamente. Acompanhe o resultado executivo da empresa e a posição individual de cada contrato.",
        icon: LayoutDashboard,
        target: "dashboard",
        ctaLabel: "Abrir Dashboard",
        done: false,
        badge: "Sempre disponível",
        badgeTone: "info",
      },
      {
        number: 7,
        title: "Repetir no mês seguinte",
        description:
          "Mude a competência ativa no topo, suba o novo CUSTOS_MES e revise os vínculos. Os meses anteriores permanecem intactos.",
        icon: RefreshCw,
        target: "real",
        ctaLabel: "Trocar competência",
        done: false,
        badge: competenceLabel,
        badgeTone: "info",
      },
    ],
    [status, competenceLabel],
  );

  const completedSteps = steps.filter((s) => s.done).length;
  const progress = Math.round((completedSteps / 5) * 100); // primeiros 5 passos pesam

  return (
    <div className="space-y-5">
      {/* Hero / progresso global */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Fluxo recomendado
              </p>
              <h2 className="text-xl font-semibold mt-1">
                Como operar a Controladoria mês a mês
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Um fluxo de 7 passos que conecta contratos, bases estruturais e a
                entrada mensal real. Siga na ordem para garantir dashboards
                confiáveis.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-3xl font-bold leading-none">{progress}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {completedSteps} de 5 etapas-chave concluídas
                </p>
              </div>
              <div className="w-14 h-14 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <CheckCircle2
                  className={cn(
                    "h-6 w-6",
                    completedSteps >= 5 ? "text-emerald-600" : "text-muted-foreground/40",
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartões de papéis das planilhas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Papel de cada planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "UNIPAR",
              role: "Template estrutural de orçamento",
              tone: "structural",
              icon: Layers,
            },
            {
              label: "DRG Workbook",
              role: "Base DRG mensal (Produção, Pessoal, etc)",
              tone: "structural",
              icon: Database,
            },
            {
              label: "Resumo do Resultado",
              role: "Visão gerada pelo sistema (não é upload)",
              tone: "structural",
              icon: Sparkles,
            },
            {
              label: "CUSTOS MES",
              role: "Entrada mensal real — sobe todo mês",
              tone: "monthly",
              icon: Calendar,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={cn(
                  "rounded-lg border p-3",
                  card.tone === "monthly"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-purple-500/20 bg-purple-500/5",
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      card.tone === "monthly" ? "text-amber-600" : "text-purple-600",
                    )}
                  />
                  <p className="text-xs font-bold tracking-wide">{card.label}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {card.role}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Linha do tempo dos passos */}
      <div className="space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const tone = TONE[step.badgeTone ?? "muted"];
          return (
            <Card
              key={step.number}
              className={cn(
                "transition-colors",
                step.done && "border-emerald-500/30 bg-emerald-500/[0.02]",
              )}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {/* Número + ícone */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm",
                        step.done
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold">{step.title}</p>
                      {step.badge && (
                        <Badge
                          variant="outline"
                          className={cn("h-5 px-1.5 text-[10px]", tone)}
                        >
                          {step.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {step.description}
                    </p>
                  </div>

                  {/* CTA */}
                  {onNavigate && (
                    <Button
                      size="sm"
                      variant={step.done ? "outline" : "default"}
                      className="h-7 text-xs gap-1.5 shrink-0"
                      onClick={() => onNavigate(step.target)}
                    >
                      {step.ctaLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FinanceiroComoUsar;
