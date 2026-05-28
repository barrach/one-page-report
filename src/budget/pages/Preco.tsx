import { useState, useEffect, useMemo } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Separator } from "@budget/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import {
  FolderOpen, Calculator, TrendingUp, Users, CalendarClock, DollarSign,
  FileText, ArrowRight,
} from "lucide-react";
import { useUserProjects, useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import { useCostStages, useCostItems, useEnsureCostStages, computeStageSummaries } from "@budget/hooks/useCostData";
import { useScenarioPhases, useAllScopeComponents, computeProductivitySummary } from "@budget/hooks/useScheduleData";
import { useScenarioPricing, useEnsurePricing, useUpdatePricing, computePricing } from "@budget/hooks/usePricingData";
import { formatBRL, formatPct, formatNumber } from "@budget/lib/format";

const Preco = () => {
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
  const updatePricing = useUpdatePricing(scenarioId);

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

  const handlePricingChange = (field: string, value: number) => {
    if (!pricing) return;
    updatePricing.mutate({ id: pricing.id, [field]: value });
  };

  const pctField = (label: string, field: string, value: number) => (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          className="w-20 h-7 text-xs text-right font-mono"
          value={value}
          onChange={(e) => handlePricingChange(field, +e.target.value)}
        />
        <span className="text-xs text-muted-foreground w-4">%</span>
      </div>
    </div>
  );

  const readonlyRow = (label: string, value: string, bold = false, accent = false, formula?: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex justify-between px-5 py-2.5 cursor-help ${bold ? "bg-muted/20" : ""}`}>
          <span className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
          <span className={`text-sm font-mono ${bold ? "font-bold" : ""} ${accent ? "text-accent" : "text-foreground"}`}>{value}</span>
        </div>
      </TooltipTrigger>
      {formula && <TooltipContent className="text-xs max-w-xs">{formula}</TooltipContent>}
    </Tooltip>
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Formação do Preço Final</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escopo → Produtividade → HH → Equipe → Cronograma → Custos → BDI/Impostos → Preço
        </p>
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
          {selectedProject && (
            <Badge variant="outline" className="text-xs">v{selectedProject.version || 1}</Badge>
          )}
        </div>
      </Card>

      {/* Executive Summary */}
      <Card className="p-5 bg-card border-border mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Resumo Executivo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { icon: DollarSign, label: "Custo Direto", value: formatBRL(calc.totalDirectCost), sub: `${costItems.length} itens` },
            { icon: Calculator, label: "BDI + Impostos", value: formatBRL(calc.totalIndirect + calc.totalTaxes), sub: `${formatPct(calc.totalDirectCost > 0 ? ((calc.totalIndirect + calc.totalTaxes) / calc.totalDirectCost) * 100 : 0)}` },
            { icon: TrendingUp, label: "Lucro", value: formatBRL(calc.profitValue), sub: formatPct(calc.profitPct) },
            { icon: DollarSign, label: "Preço de Venda", value: formatBRL(calc.salePrice), sub: "Gross-up", accent: true },
            { icon: Calculator, label: "HH Total", value: formatNumber(totalPhaseHH), sub: `Base: ${formatNumber(prodSummary.totalBaseHH)}` },
            { icon: Users, label: "Pico Efetivo", value: String(peakTeam), sub: "pessoas" },
            { icon: CalendarClock, label: "R$/HH", value: formatBRL(calc.pricePerHH), sub: `Custo: ${formatBRL(calc.costPerHH)}` },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className={`w-4 h-4 mx-auto mb-1 ${(item as any).accent ? "text-accent" : "text-primary"}`} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-sm font-bold font-mono ${(item as any).accent ? "text-accent" : "text-foreground"}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Traceability chain */}
      <Card className="p-3 bg-primary/5 border-primary/20 mb-6">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="outline" className="text-[10px]">Escopo: {allComponents.length} comp.</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">HH Base: {formatNumber(prodSummary.totalBaseHH)}</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">HH Ajust: {formatNumber(prodSummary.totalAdjustedHH)}</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">Fases: {phases.length}</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">HH Crono: {formatNumber(totalPhaseHH)}</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">Custos: {formatBRL(calc.totalDirectCost)}</Badge>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">PV: {formatBRL(calc.salePrice)}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Costs */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">CUSTOS DIRETOS</h3>
            </div>
            <div className="divide-y divide-border/30">
               {readonlyRow("Custo Direto — Serviços", formatBRL(calc.serviceCost), false, false, `Σ itens de custo classe=serviço (${costItems.length} itens)`)}
               {readonlyRow("Custo Direto — Materiais", formatBRL(calc.materialCost), false, false, `Σ itens de custo classe=material`)}
               {readonlyRow("Total Custos Diretos", formatBRL(calc.totalDirectCost), true, false, `Serviços (${formatBRL(calc.serviceCost)}) + Materiais (${formatBRL(calc.materialCost)})`)}
            </div>
          </Card>

          {/* BDI Service */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">BDI — SERVIÇO ({formatPct(calc.bdiServicePct)})</h3>
            </div>
            <div className="px-5 py-2">
              {pricing && pctField("Administração Central", "bdi_service_admin", Number(pricing.bdi_service_admin))}
              {pricing && pctField("Lucro/Margem", "bdi_service_profit", Number(pricing.bdi_service_profit))}
              <Separator className="my-1" />
              <div className="flex justify-between py-1.5">
                <span className="text-sm font-semibold text-foreground">Subtotal BDI Serviço</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatBRL(calc.bdiServiceValue)}</span>
              </div>
            </div>
          </Card>

          {/* BDI Material */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">BDI — MATERIAL ({formatPct(calc.bdiMaterialPct)})</h3>
            </div>
            <div className="px-5 py-2">
              {pricing && pctField("Administração Central", "bdi_material_admin", Number(pricing.bdi_material_admin))}
              {pricing && pctField("Lucro/Margem", "bdi_material_profit", Number(pricing.bdi_material_profit))}
              <Separator className="my-1" />
              <div className="flex justify-between py-1.5">
                <span className="text-sm font-semibold text-foreground">Subtotal BDI Material</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatBRL(calc.bdiMaterialValue)}</span>
              </div>
            </div>
          </Card>

          {/* Tax Service */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">IMPOSTOS — SERVIÇO ({formatPct(calc.taxServicePct)})</h3>
            </div>
            <div className="px-5 py-2">
              {pricing && pctField("ISSQN/ICMS", "tax_service_issqn", Number(pricing.tax_service_issqn))}
              {pricing && pctField("PIS", "tax_service_pis", Number(pricing.tax_service_pis))}
              {pricing && pctField("COFINS", "tax_service_cofins", Number(pricing.tax_service_cofins))}
              {pricing && pctField("IR", "tax_service_ir", Number(pricing.tax_service_ir))}
              {pricing && pctField("CSSL", "tax_service_cssl", Number(pricing.tax_service_cssl))}
              <Separator className="my-1" />
              <div className="flex justify-between py-1.5">
                <span className="text-sm font-semibold text-foreground">Subtotal Impostos Serviço</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatBRL(calc.taxServiceValue)}</span>
              </div>
            </div>
          </Card>

          {/* Tax Material */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">IMPOSTOS — MATERIAL ({formatPct(calc.taxMaterialPct)})</h3>
            </div>
            <div className="px-5 py-2">
              {pricing && pctField("ISSQN/ICMS", "tax_material_issqn", Number(pricing.tax_material_issqn))}
              {pricing && pctField("PIS", "tax_material_pis", Number(pricing.tax_material_pis))}
              {pricing && pctField("COFINS", "tax_material_cofins", Number(pricing.tax_material_cofins))}
              {pricing && pctField("IR", "tax_material_ir", Number(pricing.tax_material_ir))}
              {pricing && pctField("CSSL", "tax_material_cssl", Number(pricing.tax_material_cssl))}
              <Separator className="my-1" />
              <div className="flex justify-between py-1.5">
                <span className="text-sm font-semibold text-foreground">Subtotal Impostos Material</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatBRL(calc.taxMaterialValue)}</span>
              </div>
            </div>
          </Card>

          {/* Profit / Target */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">MARGEM E LUCRO</h3>
            </div>
            <div className="px-5 py-2">
              {pricing && pctField("Meta de Lucro", "target_profit_percent", Number(pricing.target_profit_percent))}
              <Separator className="my-1" />
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Lucro Calculado</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatBRL(calc.profitValue)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Margem Real</span>
                <span className={`text-sm font-mono font-bold ${calc.profitPct >= Number(pricing?.target_profit_percent || 0) ? "text-green-500" : "text-destructive"}`}>
                  {formatPct(calc.profitPct)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Preço de Venda</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviços (c/ BDI + Imp.)</span>
                <span className="font-mono text-foreground">{formatBRL(calc.serviceCost + calc.bdiServiceValue + calc.taxServiceValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Materiais (c/ BDI + Imp.)</span>
                <span className="font-mono text-foreground">{formatBRL(calc.materialCost + calc.bdiMaterialValue + calc.taxMaterialValue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">PREÇO FINAL</span>
                <span className="text-2xl font-bold text-accent">{formatBRL(calc.salePrice)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Indicadores</h3>
            <div className="space-y-3">
              {[
                { label: "BDI Total Serviço", value: formatPct(calc.bdiServicePct + calc.taxServicePct) },
                { label: "BDI Total Material", value: formatPct(calc.bdiMaterialPct + calc.taxMaterialPct) },
                { label: "R$/HH (Preço)", value: formatBRL(calc.pricePerHH) },
                { label: "R$/HH (Custo)", value: formatBRL(calc.costPerHH) },
                { label: "Margem Real", value: formatPct(calc.profitPct) },
                { label: "Custo Direto / PV", value: formatPct(calc.salePrice > 0 ? (calc.totalDirectCost / calc.salePrice) * 100 : 0) },
                { label: "Impostos / PV", value: formatPct(calc.salePrice > 0 ? (calc.totalTaxes / calc.salePrice) * 100 : 0) },
              ].map((ind) => (
                <div key={ind.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{ind.label}</span>
                  <span className="font-mono font-medium text-foreground">{ind.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Composição %</h3>
            <div className="space-y-2">
              {[
                { label: "Custos Diretos", pct: calc.salePrice > 0 ? (calc.totalDirectCost / calc.salePrice) * 100 : 0, color: "bg-primary" },
                { label: "BDI", pct: calc.salePrice > 0 ? (calc.totalIndirect / calc.salePrice) * 100 : 0, color: "bg-accent" },
                { label: "Impostos", pct: calc.salePrice > 0 ? (calc.totalTaxes / calc.salePrice) * 100 : 0, color: "bg-destructive" },
                { label: "Lucro", pct: calc.profitPct, color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-foreground font-mono">{formatPct(item.pct)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(item.pct, 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Version info */}
          {selectedProject && (
            <Card className="p-4 bg-muted/20 border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Versão do Orçamento</p>
              <p className="text-lg font-bold font-mono text-foreground">v{selectedProject.version || 1}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {selectedProject.project_name} — {selectedProject.client}
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Preco;
