/**
 * Build the snapshot stored in executive_budgets.snapshot_data.
 * Captures all data needed to reproduce the PDF later, even if the
 * source budget changes.
 */
export interface ExecutiveBudgetSnapshot {
  generated_at: string;
  project: {
    id: string;
    name?: string;
    client?: string;
    location?: string;
    proposal?: string;
    version?: number;
    expected_duration_days?: number;
  };
  scenario: { id: string; name?: string };
  indicators: {
    durationMonths: number;
    peakEffective: number;
    peakMOI: number;
    peakMOD: number;
    totalHH: number;
    totalHHMOD: number;
    totalHHMOI: number;
    productiveHH: number;
    directCost: number;
    salePrice: number;
    grossMargin: number;
    pricePerHH: number;
    pricePerProductiveHH: number;
  };
  hhBySpecialty: Array<{ specialty: string; hh: number; pct: number }>;
  monthlyHistogram: Array<{ month: string; hh: number; cumulativePct: number }>;
  team: {
    moi: Array<{ role: string; qty: number; period: string }>;
    mod: Array<{ specialty: string; role: string; qty: number; period: string }>;
  };
  costs: Array<{ category: string; value: number; pct: number }>;
  pricing: {
    serviceCost: number;
    materialCost: number;
    contingencyValue: number;
    bdiServiceValue: number;
    bdiMaterialValue: number;
    taxServiceValue: number;
    taxMaterialValue: number;
    salePrice: number;
    netRevenue: number;
    profitValue: number;
    profitPct: number;
  };
}

export function buildSnapshot(input: {
  project: any;
  scenario: any;
  calc: any;
  indicators: any;
  durationMonths: number;
  workforceRows: any[];
  allComponents: any[];
  costSummaries: any[];
  monthly: number[];
}): ExecutiveBudgetSnapshot {
  const { project, scenario, calc, indicators, durationMonths, workforceRows, allComponents, costSummaries, monthly } =
    input;

  // HH por especialidade (a partir dos componentes do escopo)
  const bySpec = new Map<string, number>();
  for (const c of allComponents) {
    const k = c.discipline || c.specialty || "Geral";
    const hh = Number(c.hh_total_produtivo) || Number(c.adjusted_hh) || Number(c.calculated_hh) || 0;
    bySpec.set(k, (bySpec.get(k) || 0) + hh);
  }
  const totalSpecHH = Array.from(bySpec.values()).reduce((a, b) => a + b, 0) || 1;
  const hhBySpecialty = Array.from(bySpec.entries())
    .map(([specialty, hh]) => ({ specialty, hh, pct: (hh / totalSpecHH) * 100 }))
    .sort((a, b) => b.hh - a.hh);

  // Histograma mensal — distribuição uniforme se sem dados
  const totalHH = Number(indicators?.totalHH || 0);
  const perMonth = totalHH / Math.max(1, durationMonths);
  let acc = 0;
  const monthlyHistogram = Array.from({ length: durationMonths }).map((_, i) => {
    acc += perMonth;
    return {
      month: `M${i + 1}`,
      hh: perMonth,
      cumulativePct: (acc / Math.max(1, totalHH)) * 100,
    };
  });

  // Equipe
  const moi: Array<{ role: string; qty: number; period: string }> = [];
  const mod: Array<{ specialty: string; role: string; qty: number; period: string }> = [];
  for (const r of workforceRows) {
    const period = r.period_label || `${r.start_month || ""}–${r.end_month || ""}`;
    const item = { role: r.role_name || r.role || "—", qty: Number(r.headcount || 0), period };
    if (r.kind === "MOI" || r.team_type === "MOI") {
      moi.push(item);
    } else {
      mod.push({ ...item, specialty: r.specialty || r.discipline || "—" });
    }
  }

  // Custos
  const totalCosts = costSummaries.reduce((a: number, s: any) => a + (s.total || 0), 0) || 1;
  const costs = costSummaries.map((s: any) => ({
    category: s.stage?.label || s.label || "—",
    value: s.total || 0,
    pct: ((s.total || 0) / totalCosts) * 100,
  }));

  return {
    generated_at: new Date().toISOString(),
    project: {
      id: project?.id,
      name: project?.project_name,
      client: project?.client,
      location: project?.location,
      proposal: project?.proposal,
      version: project?.version || 1,
      expected_duration_days: project?.expected_duration_days,
    },
    scenario: { id: scenario?.id, name: scenario?.name },
    indicators: {
      durationMonths,
      peakEffective: Number(indicators?.peakEffective || 0),
      peakMOI: Number(indicators?.peakMOI || 0),
      peakMOD: Number(indicators?.peakMOD || 0),
      totalHH,
      totalHHMOD: Number(indicators?.totalHHMOD || 0),
      totalHHMOI: Number(indicators?.totalHHMOI || 0),
      productiveHH: Number(calc?.productiveHH || 0),
      directCost: Number(calc?.totalDirectCost || 0),
      salePrice: Number(calc?.salePrice || 0),
      grossMargin: Number(calc?.profitPct || 0),
      pricePerHH: totalHH > 0 ? Number(calc?.salePrice || 0) / totalHH : 0,
      pricePerProductiveHH: Number(calc?.pricePerProductiveHH || 0),
    },
    hhBySpecialty,
    monthlyHistogram,
    team: { moi, mod },
    costs,
    pricing: {
      serviceCost: Number(calc?.serviceCost || 0),
      materialCost: Number(calc?.materialCost || 0),
      contingencyValue: Number(calc?.contingencyValue || 0),
      bdiServiceValue: Number(calc?.bdiServiceValue || 0),
      bdiMaterialValue: Number(calc?.bdiMaterialValue || 0),
      taxServiceValue: Number(calc?.taxServiceValue || 0),
      taxMaterialValue: Number(calc?.taxMaterialValue || 0),
      salePrice: Number(calc?.salePrice || 0),
      netRevenue: Number(calc?.netRevenue || 0),
      profitValue: Number(calc?.profitValue || 0),
      profitPct: Number(calc?.profitPct || 0),
    },
  };
}
