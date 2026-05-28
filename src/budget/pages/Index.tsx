import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import StatCard from "@budget/components/dashboard/StatCard";
import NewProjectDialog from "@budget/components/dashboard/NewProjectDialog";
import { Clock, Users, DollarSign, TrendingUp, ArrowRight, FolderOpen } from "lucide-react";
import { Card } from "@budget/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/components/ui/tooltip";
import { Badge } from "@budget/components/ui/badge";
import { useUserProjects, useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import { useCostStages, useCostItems, useEnsureCostStages, computeStageSummaries } from "@budget/hooks/useCostData";
import { useScenarioPhases, useAllScopeComponents, computeProductivitySummary } from "@budget/hooks/useScheduleData";
import { useScenarioPricing, useEnsurePricing, computePricing } from "@budget/hooks/usePricingData";
import { formatBRL, formatPct, formatNumber } from "@budget/lib/format";

const quickLinks = [
  { label: "Escopo & Análise", path: "/escopo", desc: "Decomponha o serviço em atividades" },
  { label: "Custos por Etapa", path: "/custos", desc: "Detalhe cada categoria de custo" },
  { label: "Formação do Preço", path: "/preco", desc: "BDI, impostos e preço final" },
  { label: "Cronograma", path: "/cronograma", desc: "Fases, equipe e histograma" },
  { label: "Biblioteca Técnica", path: "/biblioteca", desc: "Base de produtividade, salários e índices" },
  { label: "Importação", path: "/importacao", desc: "Importar planilhas e arquivos" },
];

const Index = () => {
  const { data: projects = [] } = useUserProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(selectedProjectId);
  const ensureScenario = useEnsureScenario(selectedProjectId);
  const scenarioId = scenario?.id;

  const { data: stages = [] } = useCostStages(scenarioId);
  const { data: costItems = [] } = useCostItems(scenarioId);
  const ensureStages = useEnsureCostStages(scenarioId);
  const { data: phases = [] } = useScenarioPhases(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);
  const { data: pricing, isLoading: pricingLoading } = useScenarioPricing(scenarioId);
  const ensurePricing = useEnsurePricing(scenarioId);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [selectedProjectId, scenario, scenarioLoading]);

  useEffect(() => {
    if (scenarioId && stages.length === 0) ensureStages.mutate();
  }, [scenarioId, stages.length]);

  useEffect(() => {
    if (scenarioId && !pricing && !pricingLoading) ensurePricing.mutate();
  }, [scenarioId, pricing, pricingLoading]);

  const summaries = useMemo(() => computeStageSummaries(stages, costItems), [stages, costItems]);
  const serviceCost = summaries.filter((s) => s.stage.cost_class === "service").reduce((a, s) => a + s.total, 0);
  const materialCost = summaries.filter((s) => s.stage.cost_class === "material").reduce((a, s) => a + s.total, 0);

  const totalPhaseHH = phases.reduce((s, p) => s + Number(p.calculated_hh), 0);
  const peakTeam = Math.max(...phases.map((p) => p.team_size), 0);
  const prodSummary = useMemo(() => computeProductivitySummary(allComponents), [allComponents]);

  const calc = useMemo(
    () => computePricing(serviceCost, materialCost, totalPhaseHH, pricing ?? null),
    [serviceCost, materialCost, totalPhaseHH, pricing]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Top cost categories for the summary
  const topCategories = useMemo(() =>
    summaries
      .map((s) => ({ label: s.stage.label, total: s.total, count: s.items.length }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    [summaries]
  );

  // Composition percentages
  const composition = useMemo(() => {
    if (calc.salePrice <= 0) return [];
    return [
      { label: "Custos Diretos", pct: (calc.totalDirectCost / calc.salePrice) * 100, color: "bg-primary" },
      { label: "BDI", pct: (calc.totalIndirect / calc.salePrice) * 100, color: "bg-accent" },
      { label: "Impostos", pct: (calc.totalTaxes / calc.salePrice) * 100, color: "bg-destructive" },
      { label: "Lucro", pct: calc.profitPct, color: "bg-green-500" },
    ];
  }, [calc]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do orçamento — dados reais do banco de dados
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {/* Project selector */}
      <Card className="p-4 bg-card border-border mb-6">
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
          {selectedProject && (
            <Badge variant="outline" className="text-xs">v{selectedProject.version || 1}</Badge>
          )}
        </div>
      </Card>

      {/* Stats from real data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <StatCard
                label="HH Total"
                value={formatNumber(totalPhaseHH)}
                subtitle={`Base: ${formatNumber(prodSummary.totalBaseHH)} | Ajustado: ${formatNumber(prodSummary.totalAdjustedHH)}`}
                icon={Clock}
                variant="default"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">Fórmula: Σ (equipe × dias × 8.8h) por fase</p>
            <p>Base do escopo: {formatNumber(prodSummary.totalBaseHH)} HH</p>
            <p>Ajustado por fatores: {formatNumber(prodSummary.totalAdjustedHH)} HH</p>
            <p>Cronograma: {formatNumber(totalPhaseHH)} HH ({phases.length} fases)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <StatCard
                label="Pico Efetivo"
                value={String(peakTeam)}
                subtitle={`${phases.length} fases no cronograma`}
                icon={Users}
                variant="default"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            <p className="font-semibold">Fórmula: max(equipe) entre todas as fases</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <StatCard
                label="Custo Direto"
                value={formatBRL(calc.totalDirectCost)}
                subtitle={`Serv: ${formatBRL(serviceCost)} | Mat: ${formatBRL(materialCost)}`}
                icon={DollarSign}
                variant="primary"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">Fórmula: Σ (qtd × custo_unit) de {costItems.length} itens em {stages.length} etapas</p>
            <p>Serviços: {formatBRL(serviceCost)}</p>
            <p>Materiais: {formatBRL(materialCost)}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <StatCard
                label="Preço de Venda"
                value={formatBRL(calc.salePrice)}
                subtitle={`Margem: ${formatPct(calc.profitPct)}`}
                icon={TrendingUp}
                variant="accent"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">Fórmula (Gross-up): PV = (Custo + BDI) / (1 - Impostos%)</p>
            <p>BDI Serviço: {formatPct(calc.bdiServicePct)} | Material: {formatPct(calc.bdiMaterialPct)}</p>
            <p>Impostos Serviço: {formatPct(calc.taxServicePct)} | Material: {formatPct(calc.taxMaterialPct)}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Quick access */}
          <h2 className="text-lg font-semibold text-foreground">Módulos do Orçamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickLinks.map((l) => (
              <Link key={l.path} to={l.path}>
                <Card className="p-4 bg-card border-border hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{l.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Top cost categories from DB */}
          <Card className="bg-card border-border overflow-hidden mt-2">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Top 5 Categorias de Custo</h3>
              <p className="text-[10px] text-muted-foreground">Dados reais — Σ (qtd × custo_unit) por etapa</p>
            </div>
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Adicione itens de custo em <Link to="/custos" className="text-primary underline">Custos por Etapa</Link>
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {topCategories.map((cat) => (
                  <Tooltip key={cat.label}>
                    <TooltipTrigger asChild>
                      <Link to="/custos">
                        <div className="flex justify-between px-5 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors">
                          <span className="text-sm text-muted-foreground">{cat.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">{cat.count} itens</span>
                            <span className="text-sm font-mono text-foreground">{formatBRL(cat.total)}</span>
                          </div>
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Clique para detalhar — {cat.count} subitens com composição completa
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right panel — Composition from real data */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Composição do Preço</h2>
          <Card className="p-5 bg-card border-border">
            <div className="space-y-3">
              {composition.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Configure custos e BDI para ver a composição
                </p>
              ) : (
                composition.map((s) => (
                  <Tooltip key={s.label}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="text-foreground font-medium font-mono">{formatPct(s.pct)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.color} transition-all duration-700`}
                            style={{ width: `${Math.max(s.pct, 0)}%` }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {s.label}: {formatPct(s.pct)} do Preço de Venda ({formatBRL(calc.salePrice)})
                    </TooltipContent>
                  </Tooltip>
                ))
              )}
            </div>
            <div className="mt-5 pt-4 border-t border-border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between items-center cursor-help">
                    <span className="text-sm text-muted-foreground">Preço de Venda</span>
                    <span className="text-xl font-bold text-accent">{formatBRL(calc.salePrice)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold">Gross-up: (Custo + BDI) / (1 - Impostos%)</p>
                  <p>Custo direto: {formatBRL(calc.totalDirectCost)}</p>
                  <p>BDI: {formatBRL(calc.totalIndirect)}</p>
                  <p>Impostos: {formatBRL(calc.totalTaxes)}</p>
                  <p>Lucro: {formatBRL(calc.profitValue)} ({formatPct(calc.profitPct)})</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </Card>

          {/* Project info from DB */}
          {selectedProject && (
            <Card className="p-5 bg-card border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Dados do Orçamento</h3>
              <div className="space-y-2 text-sm">
                {[
                  { l: "Proposta", v: selectedProject.proposal || "—" },
                  { l: "Local", v: [selectedProject.unit, selectedProject.location].filter(Boolean).join(", ") || "—" },
                  { l: "Prazo", v: selectedProject.expected_duration_days ? `${selectedProject.expected_duration_days} dias` : "—" },
                  { l: "Contrato", v: selectedProject.contract_type || "—" },
                  { l: "Versão", v: `v${selectedProject.version || 1}` },
                  { l: "Status", v: selectedProject.status || "draft" },
                ].map((r) => (
                  <div key={r.l} className="flex justify-between">
                    <span className="text-muted-foreground">{r.l}</span>
                    <span className="text-foreground font-medium">{r.v}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* R$/HH indicators */}
          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Indicadores</h3>
            <div className="space-y-2 text-sm">
              {[
                { l: "R$/HH (Custo)", v: formatBRL(calc.costPerHH), f: "Custo Direto / HH Total" },
                { l: "R$/HH (Preço)", v: formatBRL(calc.pricePerHH), f: "Preço de Venda / HH Total" },
                { l: "Componentes", v: `${allComponents.length}`, f: "Total de componentes no escopo" },
                { l: "Itens de Custo", v: `${costItems.length}`, f: "Total de subitens nas etapas" },
              ].map((r) => (
                <Tooltip key={r.l}>
                  <TooltipTrigger asChild>
                    <div className="flex justify-between cursor-help">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="text-foreground font-medium font-mono">{r.v}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">{r.f}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
