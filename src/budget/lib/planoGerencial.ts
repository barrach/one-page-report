// ============================================================
// Plano Gerencial — estrutura ÚNICA do Acompanhamento Executivo
// ============================================================
// Espelho 1:1 da aba Budget_Acomp da Megasteam.
// Toda a sequência abaixo é OBRIGATÓRIA — não reordenar.
//
// Tipos de linha:
//   • group   → cabeçalho/agrupador visual (RECEITA, II, III, IV, V, VI,
//               ANÁLISE DO RESULTADO, INFORMAÇÕES, HISTOGRAMA, separadores).
//               Sem valores próprios. Quando `label` é vazio, atua como
//               SEPARADOR visual (linha em branco entre blocos).
//   • input   → editável pelo usuário (1.01, OS, CUSTO_FILIAL).
//   • cost    → vem do CUSTOS_MES. Override manual permitido.
//   • tax     → calculada: 1.01 × alíquota. Read-only.
//   • calc    → derivada (TI, VL, CO, MB, CT, CSLL_602, RL, CM4, %s,
//               headcount). Read-only.
// ============================================================

export type PgRowKind = "group" | "input" | "cost" | "tax" | "calc";

export interface PgRow {
  code: string;
  label: string;
  kind: PgRowKind;
  groupLabel?: string;
  taxRate?:
    | "pis_pct"
    | "cofins_pct"
    | "csll_pct"
    | "inss_fat_pct"
    | "icms_pct"
    | "iss_pct";
  formula?:
    | "TI"
    | "VL"
    | "CO"
    | "MB"
    | "MB_PCT"
    | "TA"
    | "TAXA_PCT"
    | "CT"
    | "CSLL_602"
    | "RL"
    | "ML_PCT"
    | "CM4"
    | "ML_FILIAL_PCT"
    | "IMP_REAL_PCT"
    | "ENC_MOI_PCT"
    | "ENC_MOD_PCT"
    | "TAXA_SEDE_PCT"
    | "TAXA_FILIAL_PCT"
    | "MOI_QTY"
    | "MOD_QTY"
    | "MOI_MOD_TOTAL";
  isPercentage?: boolean;
  /** Linhas de contagem (HISTOGRAMA): exibir como número absoluto, não BRL nem %. */
  isCount?: boolean;
  costSign?: 1 | -1;
}

export const PLAN_GERENCIAL: PgRow[] = [
  // ───────────────── BLOCO 1 — RECEITA E IMPOSTOS ─────────────────
  { code: "G1", label: "RECEITA", kind: "group", groupLabel: "RECEITA" },
  { code: "1.01", label: "Venda de Serviços Prestados", kind: "input" },
  { code: "2.01", label: "PIS s/ Faturamento", kind: "tax", taxRate: "pis_pct" },
  { code: "2.02", label: "COFINS s/ Faturamento", kind: "tax", taxRate: "cofins_pct" },
  { code: "2.03", label: "CSLL s/ Faturamento", kind: "tax", taxRate: "csll_pct" },
  { code: "2.04", label: "INSS s/ Faturamento", kind: "tax", taxRate: "inss_fat_pct" },
  { code: "2.05", label: "ICMS s/ Faturamento", kind: "tax", taxRate: "icms_pct" },
  { code: "2.06", label: "ISS s/ Faturamento", kind: "tax", taxRate: "iss_pct" },
  { code: "TI", label: "(-) TOTAL DE IMPOSTOS", kind: "calc", formula: "TI" },
  { code: "VL", label: "VENDAS LÍQUIDAS", kind: "calc", formula: "VL" },

  // separador
  { code: "SEP1", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 2 — II PESSOAL (SALÁRIOS/ENCARG.) ─────────────────
  { code: "G2", label: "II — PESSOAL (SALÁRIOS/ENCARG.)", kind: "group",
    groupLabel: "II — PESSOAL (SALÁRIOS/ENCARG.)" },
  { code: "3.01", label: "Salários", kind: "cost" },
  { code: "PET", label: "Provisão Encargos Trabalhistas", kind: "cost" },
  { code: "3.02", label: "PLR Programa Particip. Resultados", kind: "cost" },
  { code: "3.03", label: "Adiantamento Salarial", kind: "cost" },
  { code: "3.04", label: "Férias", kind: "cost" },
  { code: "3.05", label: "13º Salário", kind: "cost" },
  { code: "3.06", label: "INSS", kind: "cost" },
  { code: "3.07", label: "FGTS", kind: "cost" },

  // separador
  { code: "SEP2", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 3 — III PESSOAL (OUTROS CUSTOS) ─────────────────
  { code: "G3", label: "III — PESSOAL (OUTROS CUSTOS)", kind: "group",
    groupLabel: "III — PESSOAL (OUTROS CUSTOS)" },
  { code: "3.08", label: "Bolsa Estágio", kind: "cost" },
  { code: "3.09", label: "Rescisão Trabalhista", kind: "cost" },
  { code: "3.11", label: "Pensão Alimentícia", kind: "cost" },
  { code: "3.12", label: "Assistência Médica / Odontológica", kind: "cost" },
  { code: "3.13", label: "Vale Transporte", kind: "cost" },
  { code: "3.14", label: "PAT — Programa Alimentação Trabalhador", kind: "cost" },
  { code: "3.15", label: "Seguro de Vida", kind: "cost" },
  { code: "3.16", label: "Contribuições Sindicais / Assistenciais", kind: "cost" },
  { code: "3.79", label: "Cursos e Treinamentos", kind: "cost" },

  // separador
  { code: "SEP3", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 4 — IV SERVIÇOS ─────────────────
  { code: "G4", label: "IV — SERVIÇOS", kind: "group", groupLabel: "IV — SERVIÇOS" },
  { code: "3.50", label: "Aluguéis e Condomínios", kind: "cost" },
  { code: "3.51", label: "Viagens e Estadias", kind: "cost" },
  { code: "3.52", label: "Despesas Postais", kind: "cost" },
  { code: "3.53", label: "Despesas de Informática", kind: "cost" },
  { code: "3.54", label: "Água e Esgoto", kind: "cost" },
  { code: "3.56", label: "Bens de Pequeno Valor", kind: "cost" },
  { code: "3.57", label: "Cartório e Firmas", kind: "cost" },
  { code: "3.59", label: "Despesas Telefônicas", kind: "cost" },
  { code: "3.60", label: "Energia Elétrica", kind: "cost" },
  { code: "3.61", label: "Impostos e Taxas Diversas", kind: "cost" },
  { code: "3.72", label: "Serviços Subcontratados", kind: "cost" },
  { code: "3.73", label: "Mão de Obra Terceirizada — PJ", kind: "cost" },
  { code: "3.74", label: "Exames Médicos", kind: "cost" },

  // separador
  { code: "SEP4", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 5 — V MATERIAL ─────────────────
  { code: "G5", label: "V — MATERIAL", kind: "group", groupLabel: "V — MATERIAL" },
  { code: "3.77", label: "Material de Uso e Consumo", kind: "cost" },
  { code: "3.78", label: "Uniformes e EPIs", kind: "cost" },
  { code: "3.64", label: "Material de Higiene e Limpeza", kind: "cost" },
  { code: "3.63", label: "Material de Escritório", kind: "cost" },

  // separador
  { code: "SEP5", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 6 — VI CUSTOS GERAIS ─────────────────
  { code: "G6", label: "VI — CUSTOS GERAIS", kind: "group", groupLabel: "VI — CUSTOS GERAIS" },
  { code: "3.62", label: "Infração de Trânsito", kind: "cost" },
  { code: "3.66", label: "Serviço de Limpeza e Vigilância Patrimonial", kind: "cost" },
  { code: "3.67", label: "Manutenção e Conservação Predial", kind: "cost" },
  { code: "3.68", label: "Manutenção e Conservação de Veículos", kind: "cost" },
  { code: "3.69", label: "Manutenção de Máquinas, Móveis e Equip.", kind: "cost" },
  { code: "3.70", label: "Locação de Máquinas e Equipamentos", kind: "cost" },
  { code: "3.71", label: "Fretes e Carretos", kind: "cost" },
  { code: "3.75", label: "Combustíveis e Lubrificantes", kind: "cost" },
  { code: "3.76", label: "Locação de Veículos", kind: "cost" },
  { code: "3.81", label: "Revenda", kind: "cost" },
  { code: "3.82", label: "Comissões Representantes", kind: "cost" },
  { code: "7.04", label: "(-) Reembolso de Despesas / Nota de Débito", kind: "cost", costSign: -1 },

  // separador
  { code: "SEP6", label: "", kind: "group", groupLabel: "" },

  // ───────────────── TOTAL CUSTO OPERACIONAL ─────────────────
  { code: "CO", label: "TOTAL CUSTO OPERACIONAL", kind: "calc", formula: "CO" },

  // separador
  { code: "SEP7", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 7 — ANÁLISE DO RESULTADO ─────────────────
  { code: "H_ANALISE", label: "ANÁLISE DO RESULTADO", kind: "group",
    groupLabel: "ANÁLISE DO RESULTADO" },
  { code: "MB", label: "MARGEM BRUTA >>", kind: "calc", formula: "MB" },
  { code: "MB_PCT", label: "MARGEM BRUTA (%) (1A)", kind: "calc",
    formula: "MB_PCT", isPercentage: true },
  { code: "OS", label: "OS — OUTRAS SAÍDAS", kind: "input" },
  { code: "TA", label: "Absorção Rateio Administrativo", kind: "calc", formula: "TA" },
  { code: "CT", label: "CUSTO TOTAL", kind: "calc", formula: "CT" },
  { code: "6.02", label: "6.02 — CSLL", kind: "calc", formula: "CSLL_602" },
  { code: "RL", label: "RESULTADO LÍQUIDO (CM2)", kind: "calc", formula: "RL" },
  { code: "ML_PCT", label: "MARGEM LÍQUIDA (%) (2)", kind: "calc",
    formula: "ML_PCT", isPercentage: true },
  { code: "CUSTO_FILIAL", label: "CUSTO FILIAL (ADM)", kind: "input" },
  { code: "CM4", label: "RESULTADO LÍQUIDO (CM4)", kind: "calc", formula: "CM4" },
  { code: "ML_FILIAL_PCT", label: "MARGEM LÍQUIDA COM FILIAL (%)", kind: "calc",
    formula: "ML_FILIAL_PCT", isPercentage: true },

  // separador
  { code: "SEP8", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 8 — INFORMAÇÕES COMPLEMENTARES ─────────────────
  { code: "H_INFO", label: "INFORMAÇÕES COMPLEMENTARES", kind: "group",
    groupLabel: "INFORMAÇÕES COMPLEMENTARES" },
  { code: "IMP_REAL_PCT", label: "PERCENTUAL DE IMPOSTO REAL", kind: "calc",
    formula: "IMP_REAL_PCT", isPercentage: true },
  { code: "ENC_MOI_PCT", label: "PERCENTUAL DE ENCARGO REAL MOI", kind: "calc",
    formula: "ENC_MOI_PCT", isPercentage: true },
  { code: "ENC_MOD_PCT", label: "PERCENTUAL DE ENCARGO REAL MOD", kind: "calc",
    formula: "ENC_MOD_PCT", isPercentage: true },
  { code: "TAXA_SEDE_PCT", label: "PERCENTUAL DE TAXA ADM SEDE", kind: "calc",
    formula: "TAXA_SEDE_PCT", isPercentage: true },
  { code: "TAXA_FILIAL_PCT", label: "PERCENTUAL DE TAXA ADM FILIAL", kind: "calc",
    formula: "TAXA_FILIAL_PCT", isPercentage: true },

  // separador
  { code: "SEP9", label: "", kind: "group", groupLabel: "" },

  // ───────────────── BLOCO 9 — HISTOGRAMA ─────────────────
  { code: "H_HISTO", label: "HISTOGRAMA", kind: "group", groupLabel: "HISTOGRAMA" },
  { code: "MOI", label: "MÃO DE OBRA INDIRETA", kind: "calc", formula: "MOI_QTY", isCount: true },
  { code: "MOD", label: "MÃO DE OBRA DIRETA", kind: "calc", formula: "MOD_QTY", isCount: true },
  { code: "TOTAL_HC", label: "TOTAL", kind: "calc", formula: "MOI_MOD_TOTAL", isCount: true },
];

/** Conjunto rápido com TODOS os códigos de custo (3.xx + 7.04 + PET). */
export const COST_CODES = PLAN_GERENCIAL
  .filter((r) => r.kind === "cost")
  .map((r) => r.code);

/** Conjunto rápido com códigos de imposto. */
export const TAX_CODES = PLAN_GERENCIAL
  .filter((r) => r.kind === "tax")
  .map((r) => r.code);

/** Códigos editáveis pelo usuário. */
export const EDITABLE_INPUT_CODES = new Set(
  PLAN_GERENCIAL.filter((r) => r.kind === "input").map((r) => r.code),
);

/** Códigos `cost` também são editáveis (override do CUSTOS_MES). */
export const EDITABLE_COST_CODES = new Set(COST_CODES);

/** Conveniência: lookup por código. */
export const PLAN_BY_CODE: Record<string, PgRow> = Object.fromEntries(
  PLAN_GERENCIAL.map((r) => [r.code, r]),
);
