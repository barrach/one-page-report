import type { ExecutiveBudgetSnapshot } from "./executiveBudgetSnapshot";

/**
 * Parâmetros de ajuste aplicáveis a um snapshot original para gerar um cenário simulado.
 * Todos os fatores são multiplicadores (1.0 = sem mudança); margem é em pontos percentuais.
 */
export interface SimulationParameters {
  hh_factor: number;            // 1.0 = mantém. 1.10 = +10% HH
  headcount_factor: number;     // afeta pico de efetivo
  duration_factor: number;      // afeta prazo (meses)
  cost_factor: number;          // multiplica custos diretos
  contingency_delta_pct: number;// pontos % adicionais de contingência
  bdi_delta_pct: number;        // pontos % adicionais de BDI (serviços)
  margin_delta_pct: number;     // pontos % adicionais de margem
  notes?: string;
}

export const defaultParams: SimulationParameters = {
  hh_factor: 1,
  headcount_factor: 1,
  duration_factor: 1,
  cost_factor: 1,
  contingency_delta_pct: 0,
  bdi_delta_pct: 0,
  margin_delta_pct: 0,
};

/**
 * Aplica os parâmetros sobre o snapshot original e retorna um novo snapshot
 * com indicadores, custos e pricing recalculados de forma proporcional.
 */
export function applySimulation(
  original: ExecutiveBudgetSnapshot,
  params: SimulationParameters
): ExecutiveBudgetSnapshot {
  const i = original.indicators;
  const p = original.pricing;

  const newDirectCost = i.directCost * params.cost_factor;
  const contingencyAdd = newDirectCost * (params.contingency_delta_pct / 100);
  const bdiAdd = newDirectCost * (params.bdi_delta_pct / 100);
  const marginAdd = newDirectCost * (params.margin_delta_pct / 100);

  const baseSale = p.salePrice * params.cost_factor;
  const newSalePrice = baseSale + contingencyAdd + bdiAdd + marginAdd;

  const newTotalHH = i.totalHH * params.hh_factor;
  const newProductiveHH = i.productiveHH * params.hh_factor;
  const newDuration = Math.max(1, Math.round(i.durationMonths * params.duration_factor));
  const newPeak = Math.max(1, Math.round(i.peakEffective * params.headcount_factor));
  const newPeakMOI = Math.round(i.peakMOI * params.headcount_factor);
  const newPeakMOD = Math.round(i.peakMOD * params.headcount_factor);

  const profitValue = (p.profitValue * params.cost_factor) + marginAdd;
  const profitPct = newSalePrice > 0 ? (profitValue / newSalePrice) * 100 : 0;

  // Reescala custos e histograma proporcionalmente
  const costs = original.costs.map((c) => ({ ...c, value: c.value * params.cost_factor }));
  const totalCostsRecalc = costs.reduce((a, c) => a + c.value, 0) || 1;
  costs.forEach((c) => (c.pct = (c.value / totalCostsRecalc) * 100));

  const monthlyHistogram = redistributeHistogram(newTotalHH, newDuration);

  return {
    ...original,
    generated_at: new Date().toISOString(),
    indicators: {
      ...i,
      durationMonths: newDuration,
      peakEffective: newPeak,
      peakMOI: newPeakMOI,
      peakMOD: newPeakMOD,
      totalHH: newTotalHH,
      totalHHMOD: i.totalHHMOD * params.hh_factor,
      totalHHMOI: i.totalHHMOI * params.hh_factor,
      productiveHH: newProductiveHH,
      directCost: newDirectCost,
      salePrice: newSalePrice,
      grossMargin: profitPct,
      pricePerHH: newTotalHH > 0 ? newSalePrice / newTotalHH : 0,
      pricePerProductiveHH: newProductiveHH > 0 ? newSalePrice / newProductiveHH : 0,
    },
    hhBySpecialty: original.hhBySpecialty.map((h) => ({ ...h, hh: h.hh * params.hh_factor })),
    monthlyHistogram,
    costs,
    pricing: {
      ...p,
      serviceCost: p.serviceCost * params.cost_factor,
      materialCost: p.materialCost * params.cost_factor,
      contingencyValue: p.contingencyValue * params.cost_factor + contingencyAdd,
      bdiServiceValue: p.bdiServiceValue * params.cost_factor + bdiAdd,
      bdiMaterialValue: p.bdiMaterialValue * params.cost_factor,
      taxServiceValue: p.taxServiceValue * params.cost_factor,
      taxMaterialValue: p.taxMaterialValue * params.cost_factor,
      salePrice: newSalePrice,
      netRevenue: p.netRevenue * params.cost_factor + marginAdd,
      profitValue,
      profitPct,
    },
  };
}

function redistributeHistogram(totalHH: number, durationMonths: number) {
  const per = totalHH / Math.max(1, durationMonths);
  let acc = 0;
  return Array.from({ length: durationMonths }).map((_, i) => {
    acc += per;
    return {
      month: `M${i + 1}`,
      hh: per,
      cumulativePct: (acc / Math.max(1, totalHH)) * 100,
    };
  });
}

/**
 * Tenta recuperar parâmetros previamente salvos no snapshot da simulação.
 */
export function readParamsFromSnapshot(snapshot: any): SimulationParameters {
  const stored = snapshot?.simulation_params;
  if (stored && typeof stored === "object") {
    return { ...defaultParams, ...stored };
  }
  return { ...defaultParams };
}
