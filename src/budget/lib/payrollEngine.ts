/**
 * Motor puro de folha de pagamento por linha de equipe.
 *
 * Cada linha gera 4 famílias de custo:
 *   1. Salário-base    = salário × pessoas × meses
 *   2. Encargos         = salário-base × % encargos (INSS médio + FGTS + CPRB médio + férias + 13º + outros)
 *   3. Adicionais       = periculosidade (30% sal_base) + insalubridade (% sal_min) — apenas se aplicáveis
 *   4. Benefícios       = cesta + assiduidade + convênio + folga campo + PLR — por pessoa × período
 */

export interface TeamLineInput {
  classification: "MOD" | "MOI_CLT" | "MOI_PJ";
  people_count: number;
  period_months: number;
  hours_per_month: number;
  base_salary: number;
  pericul_enabled: boolean;
  insalub_enabled: boolean;
}

export interface PayrollParams {
  // Encargos
  cprb_medio_pct: number; // ex: 2.85
  inss_medio_pct: number; // ex: 9.17
  fgts_pct: number; // 8
  outros_encargos_pct: number; // 5 (RAT, FAP, sistema S, etc.)
  // Adicionais
  insalubridade_pct: number; // % sobre salário mínimo
  periculosidade_pct: number; // 30
  salario_minimo_regional: number;
  // Benefícios mensais por pessoa (CLT)
  cesta_basica_mensal: number;
  premio_assiduidade_mensal: number;
  convenio_medico_mensal: number;
  // Folga de campo (R$/dia × dias estimados/mês)
  folga_campo_diaria: number;
  folga_campo_dias_mes: number; // padrão 4
  // PLR (n salários por ano)
  plr_salarios_ano: number;
}

export const DEFAULT_PAYROLL_PARAMS: PayrollParams = {
  cprb_medio_pct: 4.5,
  inss_medio_pct: 0,
  fgts_pct: 8,
  outros_encargos_pct: 5,
  insalubridade_pct: 20,
  periculosidade_pct: 30,
  salario_minimo_regional: 1518,
  cesta_basica_mensal: 580,
  premio_assiduidade_mensal: 500,
  convenio_medico_mensal: 200,
  folga_campo_diaria: 90,
  folga_campo_dias_mes: 4,
  plr_salarios_ano: 1,
};

export interface PayrollResult {
  hh_total: number;
  salario_base_total: number;
  encargos_total: number;
  adicionais_total: number;
  beneficios_total: number;
  custo_total: number;
  // Detalhe por componente
  detalhe: {
    salario_mensal_pessoa: number;
    encargos_pct_efetivo: number;
    pericul_mensal_pessoa: number;
    insalub_mensal_pessoa: number;
    cesta_total: number;
    assiduidade_total: number;
    convenio_total: number;
    folga_campo_total: number;
    plr_total: number;
  };
}

/** Encargos efetivos depende da classificação. PJ não tem FGTS/INSS. */
function encargosPctFor(line: TeamLineInput, p: PayrollParams): number {
  if (line.classification === "MOI_PJ") {
    // PJ: só CPRB sobre faturamento (modelo simplificado: 0 sobre o valor mensal contratado)
    return 0;
  }
  // CLT (MOD ou MOI_CLT)
  // Acréscimos típicos: férias 1/12 ≈ 8.33%, 13º 1/12 ≈ 8.33%
  const ferias_terco = 8.33 + 2.78; // férias + 1/3
  const decimoTerceiro = 8.33;
  return (
    p.inss_medio_pct +
    p.cprb_medio_pct +
    p.fgts_pct +
    ferias_terco +
    decimoTerceiro +
    p.outros_encargos_pct
  );
}

export function computePayroll(line: TeamLineInput, p: PayrollParams): PayrollResult {
  const people = Number(line.people_count) || 0;
  const months = Number(line.period_months) || 0;
  const hpm = Number(line.hours_per_month) || 0;
  const sal = Number(line.base_salary) || 0;

  const hh_total = people * months * hpm;
  const salario_base_total = sal * people * months;

  const encargos_pct = encargosPctFor(line, p);
  const encargos_total = salario_base_total * (encargos_pct / 100);

  // Adicionais (CLT apenas)
  let pericul_mensal_pessoa = 0;
  let insalub_mensal_pessoa = 0;
  if (line.classification !== "MOI_PJ") {
    if (line.pericul_enabled) {
      pericul_mensal_pessoa = sal * (p.periculosidade_pct / 100);
    }
    if (line.insalub_enabled) {
      insalub_mensal_pessoa = p.salario_minimo_regional * (p.insalubridade_pct / 100);
    }
  }
  // Periculosidade e insalubridade não acumulam — usa o maior
  const adicional_mensal_pessoa = Math.max(pericul_mensal_pessoa, insalub_mensal_pessoa);
  // Adicional também sofre encargos
  const adicionais_brutos = adicional_mensal_pessoa * people * months;
  const adicionais_total = adicionais_brutos * (1 + encargos_pct / 100);

  // Benefícios (apenas CLT — MOD e MOI_CLT)
  let cesta = 0,
    assid = 0,
    conv = 0,
    folga = 0,
    plr = 0;
  if (line.classification !== "MOI_PJ") {
    cesta = p.cesta_basica_mensal * people * months;
    assid = p.premio_assiduidade_mensal * people * months;
    conv = p.convenio_medico_mensal * people * months;
    folga = p.folga_campo_diaria * p.folga_campo_dias_mes * people * months;
    plr = (sal * p.plr_salarios_ano / 12) * people * months;
  }
  const beneficios_total = cesta + assid + conv + folga + plr;

  const custo_total = salario_base_total + encargos_total + adicionais_total + beneficios_total;

  return {
    hh_total,
    salario_base_total,
    encargos_total,
    adicionais_total,
    beneficios_total,
    custo_total,
    detalhe: {
      salario_mensal_pessoa: sal,
      encargos_pct_efetivo: encargos_pct,
      pericul_mensal_pessoa,
      insalub_mensal_pessoa,
      cesta_total: cesta,
      assiduidade_total: assid,
      convenio_total: conv,
      folga_campo_total: folga,
      plr_total: plr,
    },
  };
}

export interface TeamTotals {
  hh_mod: number;
  hh_moi: number;
  hh_total: number;
  salario_mod: number;
  salario_moi: number;
  encargos_mod: number;
  encargos_moi: number;
  adicionais_total: number;
  beneficios_total: number;
  custo_mod: number;
  custo_moi: number;
  custo_total: number;
  homem_mes_mod: number;
  homem_mes_moi: number;
  pico_mod: number;
  pico_moi: number;
}

export function computeTeamTotals(
  lines: TeamLineInput[],
  params: PayrollParams,
): TeamTotals {
  let t: TeamTotals = {
    hh_mod: 0, hh_moi: 0, hh_total: 0,
    salario_mod: 0, salario_moi: 0,
    encargos_mod: 0, encargos_moi: 0,
    adicionais_total: 0, beneficios_total: 0,
    custo_mod: 0, custo_moi: 0, custo_total: 0,
    homem_mes_mod: 0, homem_mes_moi: 0,
    pico_mod: 0, pico_moi: 0,
  };
  for (const l of lines) {
    const r = computePayroll(l, params);
    const isMOD = l.classification === "MOD";
    const people = Number(l.people_count) || 0;
    const months = Number(l.period_months) || 0;
    if (isMOD) {
      t.hh_mod += r.hh_total;
      t.salario_mod += r.salario_base_total;
      t.encargos_mod += r.encargos_total;
      t.custo_mod += r.custo_total;
      t.homem_mes_mod += people * months;
      t.pico_mod += people; // pico simplificado: soma dos picos individuais
    } else {
      t.hh_moi += r.hh_total;
      t.salario_moi += r.salario_base_total;
      t.encargos_moi += r.encargos_total;
      t.custo_moi += r.custo_total;
      t.homem_mes_moi += people * months;
      t.pico_moi += people;
    }
    t.adicionais_total += r.adicionais_total;
    t.beneficios_total += r.beneficios_total;
  }
  t.hh_total = t.hh_mod + t.hh_moi;
  t.custo_total = t.custo_mod + t.custo_moi;
  return t;
}
