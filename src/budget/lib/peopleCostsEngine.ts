/**
 * Motor de custos paramétricos derivados da equipe (pessoas em campo).
 * Calcula 4 categorias a partir de headcount × período × parâmetros do orçamento.
 *
 *  - EPI/Uniformes
 *  - Hospedagem & Translados
 *  - Saúde Ocupacional
 *  - Mobilização / Desmobilização
 *
 * Cada categoria possui modo "fórmula" (auto) com possibilidade de override manual.
 */

export interface PeopleCostInputs {
  headcount_total: number;       // pico/efetivo total (MOD + MOI)
  homem_mes_total: number;       // soma de pessoas × meses de toda a equipe
  period_months_max: number;     // duração máxima do contrato em meses (para mob/desmob)
}

export interface PeopleCostParams {
  // EPI
  epi_kit_inicial_pessoa: number;
  epi_mensal_pessoa: number;
  epi_override_enabled: boolean;
  epi_override_value: number;

  // Hospedagem
  hospedagem_diaria: number;
  hospedagem_dias_mes: number;
  translado_mensal_pessoa: number;
  pct_alojados: number;
  hospedagem_override_enabled: boolean;
  hospedagem_override_value: number;

  // Saúde
  saude_aso_admissional: number;
  saude_exames_periodicos: number;
  saude_periodicidade_meses: number;
  saude_nr_mensal_pessoa: number;
  saude_override_enabled: boolean;
  saude_override_value: number;

  // Mob / Desmob
  mob_custo_pessoa: number;
  desmob_custo_pessoa: number;
  pct_transferidos: number;
  mob_override_enabled: boolean;
  mob_override_value: number;
}

export interface CategoryResult {
  key: "epi" | "hospedagem" | "saude" | "mob";
  label: string;
  total: number;
  formula_total: number; // valor calculado pela fórmula (mesmo que override esteja ligado)
  is_override: boolean;
  detalhe: { label: string; value: number }[];
}

export function computeEPI(i: PeopleCostInputs, p: PeopleCostParams): CategoryResult {
  const kit = p.epi_kit_inicial_pessoa * i.headcount_total;
  const mensal = p.epi_mensal_pessoa * i.homem_mes_total;
  const formula = kit + mensal;
  const total = p.epi_override_enabled ? p.epi_override_value : formula;
  return {
    key: "epi",
    label: "EPI / Uniformes",
    total,
    formula_total: formula,
    is_override: p.epi_override_enabled,
    detalhe: [
      { label: `Kit inicial (${i.headcount_total} pess. × R$ ${p.epi_kit_inicial_pessoa.toFixed(2)})`, value: kit },
      { label: `Reposição mensal (${i.homem_mes_total.toFixed(1)} h-m × R$ ${p.epi_mensal_pessoa.toFixed(2)})`, value: mensal },
    ],
  };
}

export function computeHospedagem(i: PeopleCostInputs, p: PeopleCostParams): CategoryResult {
  const homem_mes_alojado = i.homem_mes_total * (p.pct_alojados / 100);
  const hospedagem = homem_mes_alojado * p.hospedagem_diaria * p.hospedagem_dias_mes;
  const translado = homem_mes_alojado * p.translado_mensal_pessoa;
  const formula = hospedagem + translado;
  const total = p.hospedagem_override_enabled ? p.hospedagem_override_value : formula;
  return {
    key: "hospedagem",
    label: "Hospedagem & Translados",
    total,
    formula_total: formula,
    is_override: p.hospedagem_override_enabled,
    detalhe: [
      { label: `Hospedagem (${homem_mes_alojado.toFixed(1)} h-m × ${p.hospedagem_dias_mes} dias × R$ ${p.hospedagem_diaria.toFixed(2)})`, value: hospedagem },
      { label: `Translados (${homem_mes_alojado.toFixed(1)} h-m × R$ ${p.translado_mensal_pessoa.toFixed(2)})`, value: translado },
    ],
  };
}

export function computeSaude(i: PeopleCostInputs, p: PeopleCostParams): CategoryResult {
  const aso = p.saude_aso_admissional * i.headcount_total;
  // exames periódicos: nº de ciclos durante o contrato
  const ciclos = p.saude_periodicidade_meses > 0
    ? Math.max(0, Math.floor(i.period_months_max / p.saude_periodicidade_meses))
    : 0;
  const periodicos = p.saude_exames_periodicos * i.headcount_total * ciclos;
  const nrs = p.saude_nr_mensal_pessoa * i.homem_mes_total;
  const formula = aso + periodicos + nrs;
  const total = p.saude_override_enabled ? p.saude_override_value : formula;
  return {
    key: "saude",
    label: "Saúde Ocupacional",
    total,
    formula_total: formula,
    is_override: p.saude_override_enabled,
    detalhe: [
      { label: `ASO admissional (${i.headcount_total} pess. × R$ ${p.saude_aso_admissional.toFixed(2)})`, value: aso },
      { label: `Exames periódicos (${ciclos} ciclo(s) × ${i.headcount_total} pess.)`, value: periodicos },
      { label: `Treinamentos NR (${i.homem_mes_total.toFixed(1)} h-m × R$ ${p.saude_nr_mensal_pessoa.toFixed(2)})`, value: nrs },
    ],
  };
}

export function computeMob(i: PeopleCostInputs, p: PeopleCostParams): CategoryResult {
  const transferidos = i.headcount_total * (p.pct_transferidos / 100);
  const mob = p.mob_custo_pessoa * transferidos;
  const desmob = p.desmob_custo_pessoa * transferidos;
  const formula = mob + desmob;
  const total = p.mob_override_enabled ? p.mob_override_value : formula;
  return {
    key: "mob",
    label: "Mobilização / Desmobilização",
    total,
    formula_total: formula,
    is_override: p.mob_override_enabled,
    detalhe: [
      { label: `Mobilização (${transferidos.toFixed(1)} pess. × R$ ${p.mob_custo_pessoa.toFixed(2)})`, value: mob },
      { label: `Desmobilização (${transferidos.toFixed(1)} pess. × R$ ${p.desmob_custo_pessoa.toFixed(2)})`, value: desmob },
    ],
  };
}

export function computePeopleCosts(i: PeopleCostInputs, p: PeopleCostParams) {
  const epi = computeEPI(i, p);
  const hospedagem = computeHospedagem(i, p);
  const saude = computeSaude(i, p);
  const mob = computeMob(i, p);
  const total = epi.total + hospedagem.total + saude.total + mob.total;
  return { epi, hospedagem, saude, mob, total, categories: [epi, hospedagem, saude, mob] };
}

export const DEFAULT_PEOPLE_COST_PARAMS: PeopleCostParams = {
  epi_kit_inicial_pessoa: 850,
  epi_mensal_pessoa: 180,
  epi_override_enabled: false,
  epi_override_value: 0,
  hospedagem_diaria: 120,
  hospedagem_dias_mes: 26,
  translado_mensal_pessoa: 350,
  pct_alojados: 60,
  hospedagem_override_enabled: false,
  hospedagem_override_value: 0,
  saude_aso_admissional: 180,
  saude_exames_periodicos: 220,
  saude_periodicidade_meses: 12,
  saude_nr_mensal_pessoa: 35,
  saude_override_enabled: false,
  saude_override_value: 0,
  mob_custo_pessoa: 1200,
  desmob_custo_pessoa: 900,
  pct_transferidos: 40,
  mob_override_enabled: false,
  mob_override_value: 0,
};
