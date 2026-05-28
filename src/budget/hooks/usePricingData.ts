import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import type { Tables, TablesUpdate } from "@budget/integrations/supabase/types";

export type ScenarioPricing = Tables<"scenario_pricing">;

const DEFAULT_PRICING = {
  bdi_service_admin: 8,
  bdi_service_profit: 8,
  bdi_service_risk: 2,
  bdi_service_insurance: 1,
  bdi_material_admin: 5,
  bdi_material_profit: 5,
  bdi_material_risk: 1,
  bdi_material_insurance: 0.5,
  tax_service_issqn: 5,
  tax_service_pis: 0.65,
  tax_service_cofins: 3,
  tax_service_ir: 1.2,
  tax_service_cssl: 1.08,
  tax_service_cprb: 0,
  tax_service_outras: 0,
  tax_material_issqn: 0,
  tax_material_pis: 1.65,
  tax_material_cofins: 7.6,
  tax_material_ir: 1.2,
  tax_material_cssl: 1.08,
  target_profit_percent: 8,
  contingency_pct: 2,
  reference_price_per_hh: 487,
  reference_label: "Serra do Salitre/MG",
  monthly_distribution: [],
};

export function useScenarioPricing(scenarioId: string | undefined) {
  return useQuery({
    queryKey: ["scenario_pricing", scenarioId],
    queryFn: async () => {
      if (!scenarioId) return null;
      const { data, error } = await supabase
        .from("scenario_pricing")
        .select("*")
        .eq("scenario_id", scenarioId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!scenarioId,
  });
}

export function useEnsurePricing(scenarioId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user || !scenarioId) throw new Error("Missing data");
      const { data: existing } = await supabase
        .from("scenario_pricing")
        .select("id")
        .eq("scenario_id", scenarioId)
        .maybeSingle();
      if (existing) return;
      const { error } = await supabase.from("scenario_pricing").insert({
        scenario_id: scenarioId,
        user_id: user.id,
        ...DEFAULT_PRICING,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
    },
  });
}

export function useUpdatePricing(scenarioId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"scenario_pricing"> & { id: string }) => {
      const { error } = await supabase.from("scenario_pricing").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario_pricing", scenarioId] });
    },
  });
}

// Pricing calculation engine
export interface PricingCalc {
  serviceCost: number;
  materialCost: number;
  totalDirectCost: number;
  contingencyPct: number;
  contingencyValue: number;
  globalCost: number;            // direct + contingency
  bdiServicePct: number;
  bdiMaterialPct: number;
  bdiServiceValue: number;
  bdiMaterialValue: number;
  taxServicePct: number;
  taxMaterialPct: number;
  taxServiceValue: number;
  taxMaterialValue: number;
  totalIndirect: number;         // total BDI (services + materials)
  totalTaxes: number;            // total taxes on revenue
  salePrice: number;             // gross sale price (with taxes)
  netRevenue: number;            // sale price - taxes
  profitValue: number;
  profitPct: number;
  markup: number;
  costPerHH: number;
  pricePerHH: number;
  pricePerProductiveHH: number;
  factorK: number;               // direct cost / productive HH
  grossMarginValue: number;      // sale price - total cost
  grossMarginPct: number;
  benchmarkStatus: "competitive" | "warning" | "above" | "no_ref";
  alerts: PricingAlert[];
}

export interface PricingAlert {
  type: "error" | "warning" | "info";
  message: string;
}

export function computePricing(
  serviceCost: number,
  materialCost: number,
  totalHH: number,
  p: ScenarioPricing | null,
  productiveHH: number = 0,
): PricingCalc {
  const empty: PricingCalc = {
    serviceCost, materialCost, totalDirectCost: serviceCost + materialCost,
    contingencyPct: 0, contingencyValue: 0, globalCost: serviceCost + materialCost,
    bdiServicePct: 0, bdiMaterialPct: 0, bdiServiceValue: 0, bdiMaterialValue: 0,
    taxServicePct: 0, taxMaterialPct: 0, taxServiceValue: 0, taxMaterialValue: 0,
    totalIndirect: 0, totalTaxes: 0, salePrice: 0, netRevenue: 0,
    profitValue: 0, profitPct: 0, markup: 0,
    costPerHH: 0, pricePerHH: 0, pricePerProductiveHH: 0, factorK: 0,
    grossMarginValue: 0, grossMarginPct: 0,
    benchmarkStatus: "no_ref",
    alerts: [{ type: "info", message: "Inicie a precificação para calcular o preço final." }],
  };
  if (!p) return empty;

  const totalDirectCost = serviceCost + materialCost;

  // Contingências: aplicada antes do BDI sobre o custo direto
  const contingencyPct = Number((p as any).contingency_pct ?? 0);
  const contingencyValue = totalDirectCost * (contingencyPct / 100);
  const globalCost = totalDirectCost + contingencyValue;

  // Distribui contingência proporcionalmente entre serviço e material
  const serviceShare = totalDirectCost > 0 ? serviceCost / totalDirectCost : 1;
  const serviceCostWithCont = serviceCost + contingencyValue * serviceShare;
  const materialCostWithCont = materialCost + contingencyValue * (1 - serviceShare);

  // BDI = admin + risk + insurance + profit  (apenas o "lucro" do BDI; impostos vão no gross-up)
  const bdiServicePct =
    Number(p.bdi_service_admin) +
    Number((p as any).bdi_service_risk || 0) +
    Number((p as any).bdi_service_insurance || 0) +
    Number(p.bdi_service_profit);
  const bdiMaterialPct =
    Number(p.bdi_material_admin) +
    Number((p as any).bdi_material_risk || 0) +
    Number((p as any).bdi_material_insurance || 0) +
    Number(p.bdi_material_profit);
  const bdiServiceValue = serviceCostWithCont * (bdiServicePct / 100);
  const bdiMaterialValue = materialCostWithCont * (bdiMaterialPct / 100);

  // Impostos sobre faturamento (decompostos)
  const taxServicePct =
    Number(p.tax_service_issqn) +
    Number(p.tax_service_pis) +
    Number(p.tax_service_cofins) +
    Number(p.tax_service_ir) +
    Number(p.tax_service_cssl) +
    Number((p as any).tax_service_cprb || 0) +
    Number((p as any).tax_service_outras || 0);
  const taxMaterialPct =
    Number(p.tax_material_issqn) +
    Number(p.tax_material_pis) +
    Number(p.tax_material_cofins) +
    Number(p.tax_material_ir) +
    Number(p.tax_material_cssl);

  // Gross-up: PV = (Custo + BDI) / (1 - taxPct/100)
  const serviceBase = serviceCostWithCont + bdiServiceValue;
  const materialBase = materialCostWithCont + bdiMaterialValue;
  const servicePV = taxServicePct < 100 ? serviceBase / (1 - taxServicePct / 100) : serviceBase;
  const materialPV = taxMaterialPct < 100 ? materialBase / (1 - taxMaterialPct / 100) : materialBase;

  const taxServiceValue = servicePV - serviceBase;
  const taxMaterialValue = materialPV - materialBase;
  const salePrice = servicePV + materialPV;
  const totalIndirect = bdiServiceValue + bdiMaterialValue;
  const totalTaxes = taxServiceValue + taxMaterialValue;
  const netRevenue = salePrice - totalTaxes;
  const profitValue = salePrice - globalCost - totalIndirect - totalTaxes;
  const profitPct = salePrice > 0 ? (profitValue / salePrice) * 100 : 0;
  const markup = totalDirectCost > 0 ? (salePrice / totalDirectCost) - 1 : 0;

  // KPIs
  const costPerHH = totalHH > 0 ? totalDirectCost / totalHH : 0;
  const pricePerHH = totalHH > 0 ? salePrice / totalHH : 0;
  const productiveHHEff = productiveHH > 0 ? productiveHH : totalHH;
  const pricePerProductiveHH = productiveHHEff > 0 ? salePrice / productiveHHEff : 0;
  const factorK = productiveHHEff > 0 ? totalDirectCost / productiveHHEff : 0;
  const grossMarginValue = salePrice - (globalCost + totalIndirect + totalTaxes - totalIndirect);
  // grossMarginValue = salePrice - totalCost (totalCost = globalCost + taxes pq BDI vira receita do contratante)
  const grossMarginValueReal = salePrice - globalCost - totalTaxes;
  const grossMarginPct = salePrice > 0 ? (grossMarginValueReal / salePrice) * 100 : 0;

  // Benchmark
  const ref = Number((p as any).reference_price_per_hh || 0);
  let benchmarkStatus: PricingCalc["benchmarkStatus"] = "no_ref";
  if (ref > 0 && pricePerProductiveHH > 0) {
    if (pricePerProductiveHH <= ref * 1.05) benchmarkStatus = "competitive";
    else if (pricePerProductiveHH <= ref * 1.15) benchmarkStatus = "warning";
    else benchmarkStatus = "above";
  }

  // Alerts
  const alerts: PricingAlert[] = [];
  if (profitPct < 0) alerts.push({ type: "error", message: "Margem negativa! O preço não cobre os custos." });
  else if (profitPct < 5) alerts.push({ type: "warning", message: `Margem muito baixa (${profitPct.toFixed(1)}%). Considere revisar.` });
  if (bdiServicePct < 5 && serviceCost > 0) alerts.push({ type: "warning", message: "BDI de serviço muito baixo. Verifique riscos e seguros." });
  if (taxServicePct === 0 && serviceCost > 0) alerts.push({ type: "warning", message: "Impostos sobre serviço não configurados." });
  if (taxMaterialPct === 0 && materialCost > 0) alerts.push({ type: "warning", message: "Impostos sobre material não configurados." });
  if (totalDirectCost === 0) alerts.push({ type: "info", message: "Sem custos diretos. Configure itens na aba Custos." });
  if (benchmarkStatus === "above") alerts.push({ type: "warning", message: `R$/HH (${pricePerProductiveHH.toFixed(0)}) acima do benchmark (R$ ${ref.toFixed(0)}) em mais de 15%.` });

  return {
    serviceCost, materialCost, totalDirectCost,
    contingencyPct, contingencyValue, globalCost,
    bdiServicePct, bdiMaterialPct, bdiServiceValue, bdiMaterialValue,
    taxServicePct, taxMaterialPct, taxServiceValue, taxMaterialValue,
    totalIndirect, totalTaxes, salePrice, netRevenue,
    profitValue, profitPct, markup,
    costPerHH, pricePerHH, pricePerProductiveHH, factorK,
    grossMarginValue: grossMarginValueReal, grossMarginPct,
    benchmarkStatus,
    alerts,
  };
}
