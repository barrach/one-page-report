import { useMemo } from "react";
import type { ScopeItem, ScopeComponent } from "@budget/hooks/useScopeData";
import type { CostStage, CostItem, StageSummary } from "@budget/hooks/useCostData";
import type { ScenarioPhase } from "@budget/hooks/useScheduleData";
import type { ScenarioPricing, PricingCalc } from "@budget/hooks/usePricingData";

export type CheckStatus = "done" | "pending" | "warning" | "critical";

export interface CheckItem {
  id: string;
  label: string;
  message: string;
  status: CheckStatus;
  action?: { label: string; tab: string };
}

export interface CheckGroup {
  key: string;
  label: string;
  icon: string;
  checks: CheckItem[];
  score: number;
}

export interface BudgetValidation {
  groups: CheckGroup[];
  overallScore: number;
  criticalCount: number;
  warningCount: number;
  pendingCount: number;
  doneCount: number;
  canGenerateProposal: boolean;
}

interface ValidationInput {
  project: any;
  scopeItems: ScopeItem[];
  allComponents: ScopeComponent[];
  stages: CostStage[];
  costItems: CostItem[];
  summaries: StageSummary[];
  phases: ScenarioPhase[];
  pricing: ScenarioPricing | null;
  calc: PricingCalc;
  totalHH: number;
}

function check(id: string, label: string, ok: boolean, message: string, warnMsg?: string, action?: { label: string; tab: string }): CheckItem {
  return {
    id,
    label,
    message: ok ? message : (warnMsg || message),
    status: ok ? "done" : "pending",
    action: ok ? undefined : action,
  };
}

function criticalCheck(id: string, label: string, ok: boolean, okMsg: string, failMsg: string, action?: { label: string; tab: string }): CheckItem {
  return {
    id,
    label,
    message: ok ? okMsg : failMsg,
    status: ok ? "done" : "critical",
    action: ok ? undefined : action,
  };
}

function warnCheck(id: string, label: string, ok: boolean, okMsg: string, failMsg: string, action?: { label: string; tab: string }): CheckItem {
  return {
    id,
    label,
    message: ok ? okMsg : failMsg,
    status: ok ? "done" : "warning",
    action: ok ? undefined : action,
  };
}

function groupScore(checks: CheckItem[]): number {
  if (checks.length === 0) return 100;
  const done = checks.filter(c => c.status === "done").length;
  return Math.round((done / checks.length) * 100);
}

export function useBudgetValidation(input: ValidationInput): BudgetValidation {
  return useMemo(() => {
    const { project, scopeItems, allComponents, stages, costItems, summaries, phases, pricing, calc, totalHH } = input;

    const itemsByCategory = (cat: string) => scopeItems.filter(i => i.category === cat);
    const hasScope = !!project?.scope_description?.trim();

    // A. STRUCTURE
    const structureChecks: CheckItem[] = [
      criticalCheck("s1", "Escopo definido", hasScope, "Escopo bruto preenchido.", "Escopo bruto não preenchido.", { label: "Preencher escopo", tab: "escopo" }),
      criticalCheck("s2", "Atividades principais", itemsByCategory("atividades_principais").length > 0, `${itemsByCategory("atividades_principais").length} atividades principais.`, "Nenhuma atividade principal cadastrada.", { label: "Adicionar atividades", tab: "escopo" }),
      check("s3", "Atividades auxiliares", itemsByCategory("atividades_auxiliares").length > 0, `${itemsByCategory("atividades_auxiliares").length} atividades auxiliares.`, "Nenhuma atividade auxiliar cadastrada.", { label: "Adicionar", tab: "escopo" }),
      check("s4", "Pré-requisitos", itemsByCategory("pre_requisitos").length > 0, `${itemsByCategory("pre_requisitos").length} pré-requisitos.`, "Nenhum pré-requisito cadastrado.", { label: "Adicionar", tab: "escopo" }),
      check("s5", "Materiais", itemsByCategory("materiais").length > 0, `${itemsByCategory("materiais").length} materiais.`, "Nenhum material cadastrado.", { label: "Adicionar", tab: "escopo" }),
      check("s6", "Recursos humanos", itemsByCategory("recursos_humanos").length > 0, `${itemsByCategory("recursos_humanos").length} recursos humanos.`, "Nenhum recurso humano cadastrado.", { label: "Adicionar", tab: "escopo" }),
      check("s7", "Equipamentos", itemsByCategory("equipamentos").length > 0, `${itemsByCategory("equipamentos").length} equipamentos.`, "Nenhum equipamento cadastrado.", { label: "Adicionar", tab: "escopo" }),
      criticalCheck("s8", "Custos cadastrados", costItems.length > 0, `${costItems.length} itens de custo.`, "Nenhum custo cadastrado.", { label: "Cadastrar custos", tab: "custos" }),
      criticalCheck("s9", "Preço final", calc.salePrice > 0, "Preço final calculado.", "Preço final não calculado.", { label: "Calcular preço", tab: "preco" }),
    ];

    // B. TECHNICAL
    const itemsNoDesc = scopeItems.filter(i => !i.description?.trim());
    const itemsNoUnit = scopeItems.filter(i => !i.unit?.trim());
    const itemsNoQty = scopeItems.filter(i => Number(i.quantity) <= 0);
    const itemsNoDiscipline = scopeItems.filter(i => !i.discipline?.trim());
    const technicalChecks: CheckItem[] = [
      warnCheck("t1", "Descrições adequadas", itemsNoDesc.length === 0, "Todos os itens possuem descrição.", `${itemsNoDesc.length} item(ns) sem descrição.`, { label: "Revisar itens", tab: "escopo" }),
      warnCheck("t2", "Unidades definidas", itemsNoUnit.length === 0, "Todos os itens possuem unidade.", `${itemsNoUnit.length} item(ns) sem unidade.`, { label: "Revisar itens", tab: "escopo" }),
      warnCheck("t3", "Quantidades preenchidas", itemsNoQty.length === 0, "Todas as quantidades preenchidas.", `${itemsNoQty.length} item(ns) com quantidade zerada.`, { label: "Revisar itens", tab: "escopo" }),
      check("t4", "Disciplinas definidas", itemsNoDiscipline.length === 0, "Todas as disciplinas definidas.", `${itemsNoDiscipline.length} item(ns) sem disciplina.`, { label: "Revisar itens", tab: "escopo" }),
    ];

    // C. PRODUCTIVITY
    const compsNoProd = allComponents.filter(c => !c.productivity_index || Number(c.productivity_index) <= 0);
    const compsZeroHH = allComponents.filter(c => Number(c.calculated_hh) <= 0);
    const productivityChecks: CheckItem[] = [
      criticalCheck("p1", "HH calculado", totalHH > 0, `HH total: ${totalHH.toFixed(0)}.`, "HH total não calculado.", { label: "Definir cronograma", tab: "cronograma" }),
      warnCheck("p2", "Produtividade vinculada", compsNoProd.length === 0, "Todos os componentes possuem produtividade.", `${compsNoProd.length} componente(s) sem produtividade.`, { label: "Vincular produtividade", tab: "escopo" }),
      warnCheck("p3", "HH dos componentes", compsZeroHH.length === 0 || allComponents.length === 0, "HH dos componentes calculado.", `${compsZeroHH.length} componente(s) com HH zerado.`, { label: "Revisar componentes", tab: "escopo" }),
    ];

    // D. RESOURCES
    const itemsNoComposition = scopeItems.filter(i => !i.composition_id && ["atividades_principais", "atividades_auxiliares"].includes(i.category));
    const itemsNoLibrary = scopeItems.filter(i => !i.linked_library_item_id);
    const resourceChecks: CheckItem[] = [
      check("r1", "Composições vinculadas", itemsNoComposition.length === 0, "Todas as atividades possuem composição.", `${itemsNoComposition.length} atividade(s) sem composição.`, { label: "Vincular composição", tab: "escopo" }),
      check("r2", "Biblioteca técnica vinculada", itemsNoLibrary.length === 0 || scopeItems.length === 0, "Itens vinculados à biblioteca.", `${itemsNoLibrary.length} item(ns) sem vínculo com biblioteca.`, { label: "Vincular biblioteca", tab: "escopo" }),
    ];

    // E. COSTS
    const costItemsZero = costItems.filter(i => Number(i.quantity) * Number(i.unit_cost) <= 0);
    const emptyStages = summaries.filter(s => s.total <= 0);
    const costChecks: CheckItem[] = [
      criticalCheck("c1", "Custos calculados", calc.totalDirectCost > 0, `Custo direto: R$ ${calc.totalDirectCost.toFixed(2)}.`, "Nenhum custo calculado.", { label: "Adicionar custos", tab: "custos" }),
      warnCheck("c2", "Itens com custo zerado", costItemsZero.length === 0, "Nenhum item com custo zerado.", `${costItemsZero.length} item(ns) com custo zerado.`, { label: "Revisar custos", tab: "custos" }),
      warnCheck("c3", "Etapas com custo", emptyStages.length === 0 || stages.length === 0, "Todas as etapas possuem custo.", `${emptyStages.length} etapa(s) sem custo.`, { label: "Preencher etapas", tab: "custos" }),
    ];

    // F. PRICING
    const hasBDI = pricing && (Number(pricing.bdi_service_admin) > 0 || Number(pricing.bdi_service_profit) > 0);
    const hasTaxes = pricing && (Number(pricing.tax_service_issqn) > 0 || Number(pricing.tax_service_pis) > 0);
    const hasProfit = pricing && Number(pricing.target_profit_percent) > 0;
    const priceChecks: CheckItem[] = [
      criticalCheck("f1", "BDI definido", !!hasBDI, "BDI configurado.", "BDI não configurado.", { label: "Configurar BDI", tab: "preco" }),
      warnCheck("f2", "Impostos configurados", !!hasTaxes, "Impostos configurados.", "Impostos não configurados.", { label: "Configurar impostos", tab: "preco" }),
      warnCheck("f3", "Margem definida", !!hasProfit, "Margem de lucro definida.", "Margem de lucro não definida.", { label: "Definir margem", tab: "preco" }),
      criticalCheck("f4", "Preço final calculado", calc.salePrice > 0, `Preço final: R$ ${calc.salePrice.toFixed(2)}.`, "Preço final não calculado.", { label: "Calcular preço", tab: "preco" }),
      warnCheck("f5", "Preço coerente", calc.profitPct >= 0, `Margem: ${calc.profitPct.toFixed(1)}%.`, "Margem negativa! Preço inferior ao custo.", { label: "Revisar preço", tab: "preco" }),
    ];

    // G. RISK
    const hasRisks = itemsByCategory("riscos").length > 0;
    const hasContingency = summaries.some(s => s.stage.stage_code === "riscos" && s.total > 0);
    const hasPremises = !!project?.premises?.trim();
    const riskChecks: CheckItem[] = [
      warnCheck("g1", "Riscos identificados", hasRisks, `${itemsByCategory("riscos").length} risco(s) identificado(s).`, "Nenhum risco identificado.", { label: "Adicionar riscos", tab: "escopo" }),
      warnCheck("g2", "Contingência orçamentária", hasContingency, "Contingência definida nos custos.", "Sem contingência orçamentária.", { label: "Adicionar contingência", tab: "custos" }),
      check("g3", "Premissas definidas", hasPremises, "Premissas do orçamento definidas.", "Premissas não definidas.", { label: "Definir premissas", tab: "escopo" }),
    ];

    const groups: CheckGroup[] = [
      { key: "structure", label: "Estrutura", icon: "LayoutDashboard", checks: structureChecks, score: groupScore(structureChecks) },
      { key: "technical", label: "Técnica", icon: "FileText", checks: technicalChecks, score: groupScore(technicalChecks) },
      { key: "productivity", label: "Produtividade", icon: "Clock", checks: productivityChecks, score: groupScore(productivityChecks) },
      { key: "resources", label: "Recursos", icon: "Package", checks: resourceChecks, score: groupScore(resourceChecks) },
      { key: "costs", label: "Custos", icon: "DollarSign", checks: costChecks, score: groupScore(costChecks) },
      { key: "pricing", label: "Preço", icon: "TrendingUp", checks: priceChecks, score: groupScore(priceChecks) },
      { key: "risk", label: "Risco", icon: "AlertTriangle", checks: riskChecks, score: groupScore(riskChecks) },
    ];

    const allChecks = groups.flatMap(g => g.checks);
    const criticalCount = allChecks.filter(c => c.status === "critical").length;
    const warningCount = allChecks.filter(c => c.status === "warning").length;
    const pendingCount = allChecks.filter(c => c.status === "pending").length;
    const doneCount = allChecks.filter(c => c.status === "done").length;
    const overallScore = allChecks.length > 0 ? Math.round((doneCount / allChecks.length) * 100) : 0;

    return {
      groups,
      overallScore,
      criticalCount,
      warningCount,
      pendingCount,
      doneCount,
      canGenerateProposal: criticalCount === 0,
    };
  }, [input]);
}
