import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Separator } from "@budget/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/components/ui/tooltip";
import { Alert, AlertDescription } from "@budget/components/ui/alert";
import {
  Calculator, TrendingUp, DollarSign, FileText, Send, AlertTriangle,
  AlertCircle, Info, Shield, Umbrella, FileSpreadsheet, FileBarChart2,
  Target,
} from "lucide-react";
import { useActiveScenario, useEnsureScenario } from "@budget/hooks/useScopeData";
import { useCostStages, useCostItems, useEnsureCostStages, computeStageSummaries } from "@budget/hooks/useCostData";
import { useAllScopeComponents } from "@budget/hooks/useScheduleData";
import { useWorkforceRows, computeScheduleIndicators } from "@budget/hooks/useScheduleEngine";
import {
  useScenarioPricing, useEnsurePricing, useUpdatePricing,
  computePricing, type PricingAlert,
} from "@budget/hooks/usePricingData";
import { useProjectParameters, calcularEncargosPonderados } from "@budget/hooks/useProjectParameters";
import { useCreateProposal } from "@budget/hooks/useProposals";
import { useCreateExecutiveBudget } from "@budget/hooks/useExecutiveBudgets";
import { buildSnapshot } from "@budget/lib/executiveBudgetSnapshot";
import { formatBRL, formatPct, formatNumber } from "@budget/lib/format";
import { useToast } from "@budget/hooks/use-toast";

import CpuExportDialog from "@budget/components/cpu/CpuExportDialog";
import CpuExportHistoryPanel from "@budget/components/cpu/CpuExportHistoryPanel";
import { buildDefaultCpuItems } from "@budget/lib/cpuItemsBuilder";

interface Props {
  projectId: string;
  project: any;
}

const AlertIcon = ({ type }: { type: PricingAlert["type"] }) => {
  if (type === "error") return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 text-accent" />;
  return <Info className="w-4 h-4 text-primary" />;
};

const ProjectPrecoTab = ({ projectId, project }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createProposal = useCreateProposal();
  const createExecBudget = useCreateExecutiveBudget();
  const [cpuOpen, setCpuOpen] = useState(false);

  const { data: scenario, isLoading: scenarioLoading } = useActiveScenario(projectId);
  const ensureScenario = useEnsureScenario(projectId);
  const scenarioId = scenario?.id;

  const { data: stages = [] } = useCostStages(scenarioId);
  const { data: costItems = [] } = useCostItems(scenarioId);
  const ensureStages = useEnsureCostStages(scenarioId);
  const { data: allComponents = [] } = useAllScopeComponents(scenarioId);
  const { data: workforceRows = [] } = useWorkforceRows(scenarioId);
  const { data: pricing } = useScenarioPricing(scenarioId);
  const ensurePricing = useEnsurePricing(scenarioId);
  const updatePricing = useUpdatePricing(scenarioId);
  const { data: projectParams } = useProjectParameters(projectId);

  useEffect(() => {
    if (projectId && !scenario && !scenarioLoading) ensureScenario.mutate();
  }, [projectId, scenario, scenarioLoading]);

  useEffect(() => {
    if (scenarioId && stages.length === 0) ensureStages.mutate();
  }, [scenarioId, stages.length]);

  // ── Custos
  const summaries = useMemo(() => computeStageSummaries(stages, costItems), [stages, costItems]);
  const serviceCost = summaries.filter((s) => s.stage.cost_class === "service").reduce((a, s) => a + s.total, 0);
  const materialCost = summaries.filter((s) => s.stage.cost_class === "material").reduce((a, s) => a + s.total, 0);
  const hasCosts = costItems.length > 0;

  // ── HH
  const indicators = useMemo(() => computeScheduleIndicators(workforceRows), [workforceRows]);
  const totalPhaseHH = indicators.totalHH;
  const productiveHH = useMemo(
    () =>
      allComponents.reduce(
        (s: number, c: any) =>
          s + (Number(c.hh_total_produtivo) || Number(c.adjusted_hh) || Number(c.calculated_hh) || 0),
        0
      ),
    [allComponents]
  );

  // ── CPRB médio ponderado (vem dos parâmetros do projeto)
  const cprbAuto = useMemo(() => {
    if (!projectParams) return null;
    return calcularEncargosPonderados(
      projectParams.contrato_inicio,
      projectParams.contrato_fim,
      projectParams.encargos_por_ano
    );
  }, [projectParams]);

  // Auto-inicializa precificação se ainda não existir
  useEffect(() => {
    if (!scenarioId) return;
    if (pricing === null || pricing === undefined) {
      // pricing query returned and no row exists
      if (pricing === null && !ensurePricing.isPending) {
        ensurePricing.mutate();
      }
    }
  }, [scenarioId, pricing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync CPRB no scenario_pricing quando muda o cálculo
  useEffect(() => {
    if (!pricing || !cprbAuto) return;
    const current = Number((pricing as any).tax_service_cprb || 0);
    const target = Number(cprbAuto.cprbMedio.toFixed(2));
    if (Math.abs(current - target) > 0.01) {
      updatePricing.mutate({ id: pricing.id, tax_service_cprb: target } as any);
    }
  }, [cprbAuto, pricing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const calc = useMemo(
    () => computePricing(serviceCost, materialCost, totalPhaseHH, pricing ?? null, productiveHH),
    [serviceCost, materialCost, totalPhaseHH, pricing, productiveHH]
  );

  // ── Distribuição mensal
  const durationMonths = useMemo(() => {
    if (project?.expected_duration_days) return Math.max(1, Math.ceil(project.expected_duration_days / 30));
    if (projectParams?.contrato_inicio && projectParams?.contrato_fim) {
      const ini = new Date(projectParams.contrato_inicio);
      const fim = new Date(projectParams.contrato_fim);
      const meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth()) + 1;
      return Math.max(1, meses);
    }
    return 12;
  }, [project, projectParams]);

  const monthly: number[] = useMemo(() => {
    const stored = Array.isArray((pricing as any)?.monthly_distribution)
      ? ((pricing as any).monthly_distribution as number[])
      : [];
    if (stored.length === durationMonths && stored.length > 0) return stored;
    if (calc.salePrice > 0) {
      const per = calc.salePrice / durationMonths;
      return Array(durationMonths).fill(per);
    }
    return Array(durationMonths).fill(0);
  }, [pricing, calc.salePrice, durationMonths]);

  const monthlySum = monthly.reduce((a, b) => a + b, 0);
  const monthlyDelta = calc.salePrice - monthlySum;

  const handleMonthlyChange = (idx: number, value: number) => {
    if (!pricing) return;
    const next = [...monthly];
    next[idx] = value;
    updatePricing.mutate({ id: pricing.id, monthly_distribution: next as any } as any);
  };

  const resetMonthly = () => {
    if (!pricing || calc.salePrice <= 0) return;
    const per = calc.salePrice / durationMonths;
    updatePricing.mutate({
      id: pricing.id,
      monthly_distribution: Array(durationMonths).fill(per) as any,
    } as any);
  };

  const handlePricingChange = (field: string, value: number | string) => {
    if (!pricing) return;
    updatePricing.mutate({ id: pricing.id, [field]: value } as any);
  };

  // ── Helpers de UI
  const pctField = (label: string, field: string, value: number, opts?: { icon?: React.ReactNode; readOnly?: boolean; hint?: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-between items-center py-1.5">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            {opts?.icon}
            {label}
            {opts?.readOnly && <Badge variant="outline" className="text-[9px] h-4">auto</Badge>}
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number" step="0.01" min={0}
              className="w-20 h-7 text-xs text-right font-mono"
              value={value}
              readOnly={opts?.readOnly}
              onChange={(e) => handlePricingChange(field, Math.max(0, +e.target.value))}
            />
            <span className="text-xs text-muted-foreground w-4">%</span>
          </div>
        </div>
      </TooltipTrigger>
      {opts?.hint && <TooltipContent className="text-xs max-w-xs">{opts.hint}</TooltipContent>}
    </Tooltip>
  );

  const handleGenerateProposal = async () => {
    if (!scenarioId) return;
    try {
      const proposalNumber = `PROP-${project.proposal || project.project_name.substring(0, 10)}-${Date.now().toString(36).toUpperCase()}`;
      const result = await createProposal.mutateAsync({
        projectId,
        scenarioId,
        client: project.client,
        proposalNumber,
        location: project.location,
        executionDays: project.expected_duration_days,
        salePrice: calc.salePrice,
        directCost: calc.totalDirectCost,
        indirectCost: calc.totalIndirect,
        taxes: calc.totalTaxes,
        profit: calc.profitValue,
        totalHH: totalPhaseHH,
        peakTeam: indicators.peakEffective,
        snapshotData: {
          pricing,
          calc,
          monthly,
          version: project.version || 1,
        },
      });
      toast({ title: "Proposta gerada com sucesso!" });
      navigate(`/proposta/${result.id}`);
    } catch {
      toast({ title: "Erro ao gerar proposta", variant: "destructive" });
    }
  };

  const cpuInitialItems = useMemo(
    () => buildDefaultCpuItems({
      scopeComponents: allComponents,
      costSummaries: summaries,
      serviceCost,
      materialCost,
      durationMonths,
    }),
    [allComponents, summaries, serviceCost, materialCost, durationMonths],
  );

  const handleOpenCpu = () => {
    if (!scenarioId || calc.salePrice === 0) return;
    setCpuOpen(true);
  };

  const handleExecutiveBudget = async () => {
    if (!scenarioId) return;
    try {
      const snapshot = buildSnapshot({
        project,
        scenario,
        calc,
        indicators,
        durationMonths,
        workforceRows,
        allComponents,
        costSummaries: summaries,
        monthly,
      });
      const created = await createExecBudget.mutateAsync({
        projectId,
        scenarioId,
        title: `Orçamento Executivo — ${project?.project_name || ""}`.trim(),
        snapshotData: snapshot,
      });
      toast({ title: "Orçamento Executivo criado", description: created.document_number });
      navigate(`/orcamento-executivo/${created.id}`);
    } catch (e: any) {
      toast({
        title: "Erro ao criar orçamento executivo",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // ── Benchmarks
  const refPrice = Number((pricing as any)?.reference_price_per_hh || 0);
  const refLabel = (pricing as any)?.reference_label || "Mercado";
  const benchmarkMeta: Record<string, { label: string; cls: string }> = {
    competitive: { label: "Competitivo", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
    warning: { label: "Atenção", cls: "bg-accent/10 text-accent border-accent/30" },
    above: { label: "Acima do mercado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    no_ref: { label: "Sem referência", cls: "bg-muted/30 text-muted-foreground" },
  };
  const benchMeta = benchmarkMeta[calc.benchmarkStatus];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Preço Final</h2>
        <p className="text-xs text-muted-foreground mt-1">
          BDI decomposto, impostos sobre faturamento, distribuição mensal e benchmarking de R$/HH.
        </p>
      </div>

      {!pricing ? (
        <Card className="p-6 bg-card border-border">
          <p className="text-sm text-muted-foreground">Carregando precificação…</p>
        </Card>
      ) : (
        <>
          {/* ── KPIs / Indicadores de Performance + Benchmark ── */}
          <Card className="p-5 bg-card border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Indicadores de Performance
              </h3>
              <Badge variant="outline" className={`text-[10px] ${benchMeta.cls}`}>
                <Target className="w-3 h-3 mr-1" /> {benchMeta.label}
                {refPrice > 0 && <span className="ml-2 opacity-70">ref. {refLabel}: R$ {refPrice}/HH</span>}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "R$/HH total", value: formatBRL(calc.pricePerHH), sub: `${formatNumber(totalPhaseHH)} HH` },
                {
                  label: "R$/HH produtivo",
                  value: formatBRL(calc.pricePerProductiveHH),
                  sub: `${formatNumber(productiveHH)} HH prod.`,
                  color:
                    calc.benchmarkStatus === "competitive" ? "text-green-500" :
                    calc.benchmarkStatus === "warning" ? "text-accent" :
                    calc.benchmarkStatus === "above" ? "text-destructive" : "",
                },
                { label: "Fator K", value: formatBRL(calc.factorK), sub: "custo/HH prod." },
                { label: "Margem Bruta", value: formatBRL(calc.grossMarginValue), sub: formatPct(calc.grossMarginPct) },
                { label: "Markup", value: `${(calc.markup * 100).toFixed(1)}%`, sub: `lucro: ${formatPct(calc.profitPct)}` },
                { label: "Receita Líquida", value: formatBRL(calc.netRevenue), sub: `bruta: ${formatBRL(calc.salePrice)}` },
              ].map((ind) => (
                <div key={ind.label} className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ind.label}</p>
                  <p className={`text-base font-bold font-mono ${(ind as any).color || "text-foreground"}`}>{ind.value}</p>
                  <p className="text-[10px] text-muted-foreground">{ind.sub}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Alerts ── */}
          {calc.alerts.length > 0 && (
            <div className="space-y-2 mb-6">
              {calc.alerts.map((alert, i) => (
                <Alert
                  key={i}
                  variant={alert.type === "error" ? "destructive" : "default"}
                  className={alert.type === "warning" ? "border-accent/50 bg-accent/5" : ""}
                >
                  <AlertIcon type={alert.type} />
                  <AlertDescription className="ml-2 text-sm">{alert.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* ── BDI SERVIÇOS ── */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">
                  BDI SERVIÇOS — {formatPct(calc.bdiServicePct + calc.taxServicePct)}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Aplicado sobre R$ {formatBRL(calc.serviceCost)} (custo de serviços)
                </p>
              </div>
              <div className="px-5 py-2">
                {pctField("Margem de lucro", "bdi_service_profit", Number(pricing.bdi_service_profit))}
                {pctField("Administração", "bdi_service_admin", Number(pricing.bdi_service_admin))}
                {pctField("Riscos / Contingências", "bdi_service_risk", Number((pricing as any).bdi_service_risk ?? 2), { icon: <Shield className="w-3 h-3" /> })}
                {pctField("Seguros", "bdi_service_insurance", Number((pricing as any).bdi_service_insurance ?? 1), { icon: <Umbrella className="w-3 h-3" /> })}
                <Separator className="my-2" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Impostos sobre faturamento</p>
                {pctField("ISS", "tax_service_issqn", Number(pricing.tax_service_issqn))}
                {pctField("PIS", "tax_service_pis", Number(pricing.tax_service_pis))}
                {pctField("COFINS", "tax_service_cofins", Number(pricing.tax_service_cofins))}
                {pctField("CPRB médio ponderado", "tax_service_cprb", Number((pricing as any).tax_service_cprb || 0), {
                  readOnly: !!cprbAuto,
                  hint: cprbAuto
                    ? `Calculado dos parâmetros do projeto: ${cprbAuto.detalhamento.map(d => `${d.ano} (${d.meses}m × ${d.cprb}%)`).join(", ")}`
                    : "Configure as datas do contrato e CPRB por ano nos parâmetros do projeto.",
                })}
                {pctField("Outras onerações", "tax_service_outras", Number((pricing as any).tax_service_outras || 0))}
                <Separator className="my-2" />
                <div className="flex justify-between py-1.5">
                  <span className="text-sm font-semibold text-foreground">BDI Total Serviços</span>
                  <span className="text-sm font-mono font-bold text-primary">
                    {formatPct(calc.bdiServicePct + calc.taxServicePct)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-xs text-muted-foreground">
                  <span>Preço Serviços</span>
                  <span className="font-mono">{formatBRL(calc.serviceCost + calc.bdiServiceValue + calc.taxServiceValue)}</span>
                </div>
              </div>
            </Card>

            {/* ── BDI MATERIAIS ── */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">
                  BDI MATERIAIS — {formatPct(calc.bdiMaterialPct + calc.taxMaterialPct)}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Aplicado sobre R$ {formatBRL(calc.materialCost)} (custo de materiais)
                </p>
              </div>
              <div className="px-5 py-2">
                {pctField("Margem sobre materiais", "bdi_material_profit", Number(pricing.bdi_material_profit))}
                {pctField("Administração", "bdi_material_admin", Number(pricing.bdi_material_admin))}
                {pctField("Riscos / Contingências", "bdi_material_risk", Number((pricing as any).bdi_material_risk ?? 1), { icon: <Shield className="w-3 h-3" /> })}
                {pctField("Seguros", "bdi_material_insurance", Number((pricing as any).bdi_material_insurance ?? 0.5), { icon: <Umbrella className="w-3 h-3" /> })}
                <Separator className="my-2" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Impostos sobre materiais</p>
                {pctField("ICMS / ISS", "tax_material_issqn", Number(pricing.tax_material_issqn))}
                {pctField("PIS", "tax_material_pis", Number(pricing.tax_material_pis))}
                {pctField("COFINS", "tax_material_cofins", Number(pricing.tax_material_cofins))}
                {pctField("IR", "tax_material_ir", Number(pricing.tax_material_ir))}
                {pctField("CSSL", "tax_material_cssl", Number(pricing.tax_material_cssl))}
                <Separator className="my-2" />
                <div className="flex justify-between py-1.5">
                  <span className="text-sm font-semibold text-foreground">BDI Total Materiais</span>
                  <span className="text-sm font-mono font-bold text-accent">
                    {formatPct(calc.bdiMaterialPct + calc.taxMaterialPct)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-xs text-muted-foreground">
                  <span>Preço Materiais</span>
                  <span className="font-mono">{formatBRL(calc.materialCost + calc.bdiMaterialValue + calc.taxMaterialValue)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Contingência + Benchmark ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5 bg-card border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Contingências
              </h3>
              {pctField("% sobre custo direto", "contingency_pct", Number((pricing as any).contingency_pct || 0))}
              <Separator className="my-2" />
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">Valor de contingência</span>
                <span className="font-mono font-bold text-foreground">{formatBRL(calc.contingencyValue)}</span>
              </div>
            </Card>

            <Card className="p-5 bg-card border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Benchmark de R$/HH
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Referência (rótulo)</label>
                  <Input
                    value={refLabel}
                    onChange={(e) => handlePricingChange("reference_label", e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">R$/HH de referência</label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={refPrice}
                    onChange={(e) => handlePricingChange("reference_price_per_hh", Math.max(0, +e.target.value))}
                    className="h-7 text-xs font-mono text-right"
                  />
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={`text-[10px] ${benchMeta.cls}`}>{benchMeta.label}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Verde ≤ ref ×1,05 · Amarelo ≤ ref ×1,15 · Vermelho &gt; ref ×1,15
                </p>
              </div>
            </Card>
          </div>

          {/* ── Distribuição Mensal ── */}
          <Card className="bg-card border-border mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Distribuição Mensal de Faturamento</h3>
                <p className="text-[10px] text-muted-foreground">
                  {durationMonths} meses · soma: {formatBRL(monthlySum)}
                  {Math.abs(monthlyDelta) > 0.5 && (
                    <span className="text-accent ml-2">(Δ {formatBRL(monthlyDelta)} vs PV)</span>
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={resetMonthly}>
                Distribuir uniformemente
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left p-2 px-4 font-medium text-muted-foreground">Item</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-32">Total (R$)</th>
                    {Array.from({ length: durationMonths }).map((_, i) => (
                      <th key={i} className="text-right p-2 font-medium text-muted-foreground w-24">Mês {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-2 px-4 text-foreground font-medium">Faturamento total</td>
                    <td className="p-2 text-right font-mono font-bold text-accent">{formatBRL(calc.salePrice)}</td>
                    {monthly.map((v, i) => (
                      <td key={i} className="p-1">
                        <Input
                          type="number" step="0.01" min={0}
                          value={Number(v.toFixed(2))}
                          onChange={(e) => handleMonthlyChange(i, +e.target.value)}
                          className="h-7 text-[11px] font-mono text-right"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Resumo Final ── */}
          <Card className="bg-card border-2 border-primary/40 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-border bg-primary/5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> RESUMO FINAL
              </h3>
            </div>
            <div className="divide-y divide-border/30">
              <SummaryRow label="Custo total direto" value={calc.totalDirectCost} />
              <SummaryRow label="Contingências" value={calc.contingencyValue} sub={formatPct(calc.contingencyPct)} />
              <SummaryRow label="Custo global" value={calc.globalCost} bold />
              <SummaryRow label="BDI aplicado" value={calc.totalIndirect} sub={`Serv: ${formatPct(calc.bdiServicePct)} · Mat: ${formatPct(calc.bdiMaterialPct)}`} />
              <SummaryRow label="PREÇO DE VENDA" value={calc.salePrice} bold accent="primary" big />
              <SummaryRow label="Impostos sobre faturamento" value={calc.totalTaxes} sub={`Serv: ${formatPct(calc.taxServicePct)} · Mat: ${formatPct(calc.taxMaterialPct)}`} />
              <SummaryRow label="RECEITA LÍQUIDA" value={calc.netRevenue} bold accent="accent" />
              <SummaryRow
                label="Lucro operacional"
                value={calc.profitValue}
                sub={formatPct(calc.profitPct)}
                bold
                accent={calc.profitPct < 0 ? "destructive" : "green"}
              />
            </div>
          </Card>

          {/* ── Ações finais ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="gap-2 flex-1"
              onClick={handleGenerateProposal}
              disabled={createProposal.isPending || calc.salePrice === 0}
            >
              <Send className="w-4 h-4" /> Gerar Proposta PDF
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 flex-1"
              onClick={handleExecutiveBudget}
              disabled={calc.salePrice === 0}
            >
              <FileBarChart2 className="w-4 h-4" /> Gerar Orçamento Executivo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 flex-1"
              onClick={handleOpenCpu}
              disabled={calc.salePrice === 0}
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar CPU (.xlsx)
            </Button>
          </div>

          {scenarioId && (
            <CpuExportDialog
              open={cpuOpen}
              onOpenChange={setCpuOpen}
              initialItems={cpuInitialItems}
              projectId={projectId}
              scenarioId={scenarioId}
              projectName={project?.project_name || "Orçamento"}
              proposalNumber={project?.proposal}
              budgetVersion={project?.version || 1}
              bdiServicePct={calc.bdiServicePct + calc.taxServicePct}
              bdiMaterialPct={calc.bdiMaterialPct + calc.taxMaterialPct}
            />
          )}

          <CpuExportHistoryPanel projectId={projectId} />
        </>
      )}
    </div>
  );
};

const SummaryRow = ({
  label, value, sub, bold, accent, big,
}: {
  label: string; value: number; sub?: string; bold?: boolean;
  accent?: "primary" | "accent" | "destructive" | "green"; big?: boolean;
}) => {
  const colorClass =
    accent === "primary" ? "text-primary" :
    accent === "accent" ? "text-accent" :
    accent === "destructive" ? "text-destructive" :
    accent === "green" ? "text-green-500" :
    "text-foreground";
  return (
    <div className={`flex justify-between items-center px-5 py-2.5 ${bold ? "bg-muted/20" : ""}`}>
      <div>
        <span className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
      <span className={`font-mono ${big ? "text-xl" : "text-sm"} ${bold ? "font-bold" : ""} ${colorClass}`}>
        {formatBRL(value)}
      </span>
    </div>
  );
};

export default ProjectPrecoTab;
