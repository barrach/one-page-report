import * as XLSX from "xlsx";

export interface CadastroBudget {
  cr_number?: string;
  cr_description?: string;
  responsible?: string;
  responsible_id?: string;
  fiscal_period_start?: string;
  client_name?: string;
  client_legal_name?: string;
  client_cnpj?: string;
  client_business?: string;
  client_city?: string;
  client_address?: string;
  client_manager?: string;
  client_fiscal?: string;
  contract_type?: string;
  contract_number?: string;
  specialty?: string;
  contract_start_date?: string;
  contract_duration_days?: number;
  contract_end_date?: string;
  contract_total_value?: number;
  measurement_modality?: string;
}

export interface RevenueItem {
  external_id: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unit_value: number;
  total_value: number;
  monthly_distribution: Record<string, number>;
  sort_order: number;
  parent_external_id: string | null;
}

export interface CostLineItem {
  /** Texto da descrição da linha como veio na planilha. */
  description: string;
  /** Aba de origem (ex: "II Imposto", "III Custo Pessoal"). Usado como hint de grupo DRG. */
  sheet_name: string;
  /** Tipo inferido pela aba: 'tax' | 'cost' | 'expense' | 'asset'. */
  kind: "tax" | "cost" | "expense" | "asset" | "revenue";
  /** Total da linha (quando presente em coluna dedicada). */
  total_value: number;
  /** Distribuição mensal {YYYY-MM: valor}. Valores negativos da planilha são preservados (impostos costumam vir negativos). */
  monthly_distribution: Record<string, number>;
  /** Código PG vindo da coluna D (ex: "2.01", "3.12"). Usado para preservar a ordem da planilha. */
  code?: string | null;
  /** Posição absoluta da linha na planilha (0-based, monotônica). */
  source_order: number;
  /** Marca linhas que existem no budget mas não têm valor (preservar a estrutura do orçamento). */
  is_zero?: boolean;
  /** Indica se a linha veio de uma seção/grupo da planilha (ex: PE, PL, SE, MA, OC). */
  section_label?: string | null;
}

export interface AuditReport {
  budget_rows_total: number;
  budget_rows_with_values: number;
  budget_rows_zero: number;
  budget_codes_seen: string[];
  fallback_codes_added: string[];
  warnings: string[];
}

export interface ParsedUniparBaseline {
  file_name: string;
  cadastro: CadastroBudget;
  items: RevenueItem[];
  cost_lines: CostLineItem[];
  months: string[];
  audit?: AuditReport;
}

/**
 * Mapeia o prefixo da aba (algarismo romano) ao tipo financeiro.
 * Baseado na estrutura padrão da planilha UNIPAR.
 */
const SHEET_KIND_MAP: Array<{ match: RegExp; kind: CostLineItem["kind"] }> = [
  { match: /^I\s+Receita/i, kind: "revenue" },
  { match: /^II\s+Imposto/i, kind: "tax" },
  { match: /^III\s+Custo\s+Pessoal/i, kind: "cost" },
  { match: /^IV\s+Custo\s+Direto/i, kind: "cost" },
  { match: /^V\s+Custo\s+Indireto/i, kind: "cost" },
  { match: /^VI\s+Despesa\s+Adm/i, kind: "expense" },
  { match: /^VII\s+Despesa\s+Financ/i, kind: "expense" },
  { match: /^VIII\s+Imobilizado/i, kind: "asset" },
  { match: /^IX\s+CSLL|IRPJ/i, kind: "tax" },
];

function detectSheetKind(name: string): CostLineItem["kind"] | null {
  for (const { match, kind } of SHEET_KIND_MAP) {
    if (match.test(name)) return kind;
  }
  return null;
}

const CADASTRO_FIELD_MAP: Record<string, keyof CadastroBudget> = {
  "1.1": "cr_number",
  "1.2": "cr_description",
  "1.3": "responsible",
  "1.4": "responsible_id",
  "1.5": "fiscal_period_start",
  "2.1": "client_name",
  "2.2": "client_legal_name",
  "2.3": "client_cnpj",
  "2.4": "client_business",
  "2.5": "client_city",
  "2.6": "client_address",
  "2.7": "client_manager",
  "2.8": "client_fiscal",
  "3.1": "contract_type",
  "3.2": "contract_number",
  "3.3": "specialty",
  "3.4": "contract_start_date",
  "3.5": "contract_duration_days",
  "3.6": "contract_end_date",
  "3.7": "contract_total_value",
  "3.8": "measurement_modality",
};

function excelDateToISO(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const raw = String(value).trim();
  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString().slice(0, 10);
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  const raw = String(value).trim().replace(/\s+/g, "").replace(/R\$/gi, "");
  if (!raw) return undefined;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw.replace(/[^\d,.-]/g, "");

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCadastroBudget(sheet: XLSX.WorkSheet): CadastroBudget {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const output: CadastroBudget = {};

  for (const row of rows) {
    const id = row[0] != null ? String(row[0]).trim() : "";
    const value = row[2];
    const field = CADASTRO_FIELD_MAP[id];
    if (!field || value == null || value === "") continue;

    if (["fiscal_period_start", "contract_start_date", "contract_end_date"].includes(field)) {
      const iso = excelDateToISO(value);
      if (iso) (output as Record<string, unknown>)[field] = iso;
      continue;
    }

    if (field === "contract_duration_days") {
      const parsed = parseNumber(value);
      if (parsed != null) output.contract_duration_days = Math.round(parsed);
      continue;
    }

    if (field === "contract_total_value") {
      const parsed = parseNumber(value);
      if (parsed != null) output.contract_total_value = parsed;
      continue;
    }

    (output as Record<string, unknown>)[field] = String(value).trim();
  }

  return output;
}

function detectReceitaHeaderRow(rows: unknown[][]): number {
  let bestIndex = 1;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 8); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    let score = 0;
    for (let column = 6; column < row.length; column += 1) {
      if (excelDateToISO(row[column])) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
    }
  }

  return bestIndex;
}

function parseReceitaSheet(sheet: XLSX.WorkSheet): { items: RevenueItem[]; months: string[] } {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = detectReceitaHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];
  const months: string[] = [];
  const monthColumns: Array<{ col: number; month: string }> = [];

  for (let column = 6; column < headerRow.length; column += 1) {
    const iso = excelDateToISO(headerRow[column]);
    if (!iso) continue;
    const month = iso.slice(0, 7);
    if (!months.includes(month)) months.push(month);
    monthColumns.push({ col: column, month });
  }

  const items: RevenueItem[] = [];
  let sortOrder = 0;

  for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const idRaw = row[0];
    const desc = row[1];
    const unit = row[2];
    const qty = row[3];
    const unitVal = row[4];

    if ((idRaw == null || idRaw === "") && (desc == null || desc === "")) continue;
    if (typeof desc === "string" && /^total/i.test(desc.trim())) continue;

    const externalId = idRaw != null && idRaw !== "" ? String(idRaw).trim() : null;
    const description = desc != null ? String(desc).trim() : "";
    if (!description) continue;

    const parentExternalId = externalId?.includes(".") ? externalId.split(".")[0] : null;
    const quantity = parseNumber(qty) ?? 0;
    const unit_value = parseNumber(unitVal) ?? 0;
    const total_value = parseNumber(row[5]) ?? unit_value * quantity;
    const monthly_distribution: Record<string, number> = {};

    for (const { col, month } of monthColumns) {
      const value = parseNumber(row[col]);
      if (value && value !== 0) monthly_distribution[month] = value;
    }

    items.push({
      external_id: externalId,
      description,
      unit: unit != null ? String(unit).trim() : null,
      quantity,
      unit_value,
      total_value,
      monthly_distribution,
      sort_order: sortOrder++,
      parent_external_id: parentExternalId,
    });
  }

  return { items, months };
}

/**
 * Lê apenas códigos 4.x / 5.x / 6.x da aba "I Receita" (despesas adm, financeiras, imobilizado).
 * Esses códigos NÃO existem na aba "Budget" padrão UNIPAR — precisamos deles para o budget completo.
 * Retorna como CostLineItem (kind: expense | asset). Preserva linhas zeradas.
 */
function parseReceitaExtraCodes(sheet: XLSX.WorkSheet, knownMonths: string[]): CostLineItem[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = detectReceitaHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];

  const monthColumns: Array<{ col: number; month: string }> = [];
  const seenMonths = new Set<string>();
  for (let column = 6; column < headerRow.length; column += 1) {
    const iso = excelDateToISO(headerRow[column]);
    if (!iso) continue;
    const month = iso.slice(0, 7);
    if (seenMonths.has(month)) continue;
    seenMonths.add(month);
    monthColumns.push({ col: column, month });
  }
  if (monthColumns.length === 0 && knownMonths.length === 0) return [];

  const out: CostLineItem[] = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const codeRaw = row[0];
    const descRaw = row[1];
    const code = codeRaw != null ? String(codeRaw).trim() : "";
    const description = descRaw != null ? String(descRaw).trim() : "";
    if (!code || !description) continue;

    let kind: CostLineItem["kind"] | null = null;
    if (/^4\./.test(code)) kind = "expense";
    else if (/^5\./.test(code)) kind = "expense";
    else if (/^6\./.test(code)) kind = "asset";
    if (!kind) continue;

    const monthly_distribution: Record<string, number> = {};
    let total = 0;
    let hasValue = false;
    for (const { col, month } of monthColumns) {
      const v = parseNumber(row[col]);
      if (v == null) continue;
      monthly_distribution[month] = v;
      total += v;
      if (v !== 0) hasValue = true;
    }
    out.push({
      description,
      sheet_name: "I Receita",
      kind,
      total_value: total,
      monthly_distribution,
      code,
      source_order: 100000 + rowIndex, // depois das linhas do Budget
      is_zero: !hasValue,
      section_label: kind === "asset" ? "VIII - IMOBILIZADO" : "VII - DESPESAS",
    });
  }
  return out;
}

/**
 * Lê uma aba de custo/imposto/despesa no formato UNIPAR (fallback layout antigo).
 */
function parseCostSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  kind: CostLineItem["kind"],
): { lines: CostLineItem[]; months: string[] } {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = detectReceitaHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];

  const monthColumns: Array<{ col: number; month: string }> = [];
  const months: string[] = [];
  for (let column = 0; column < headerRow.length; column += 1) {
    const iso = excelDateToISO(headerRow[column]);
    if (!iso) continue;
    const month = iso.slice(0, 7);
    if (!months.includes(month)) months.push(month);
    monthColumns.push({ col: column, month });
  }
  if (monthColumns.length === 0) return { lines: [], months: [] };

  const firstMonthCol = monthColumns[0].col;
  const lines: CostLineItem[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    let description = "";
    for (let c = 0; c < firstMonthCol; c += 1) {
      const v = row[c];
      if (v == null || v === "") continue;
      const s = String(v).trim();
      if (s.length < 3 || /^\d+([.,]\d+)?$/.test(s)) continue;
      description = s;
      break;
    }
    if (!description) continue;
    if (/^total/i.test(description) || /^subtotal/i.test(description)) continue;

    const monthly_distribution: Record<string, number> = {};
    let total = 0;
    let hasValue = false;
    for (const { col, month } of monthColumns) {
      const v = parseNumber(row[col]);
      if (v == null || v === 0) continue;
      monthly_distribution[month] = (monthly_distribution[month] ?? 0) + v;
      total += v;
      hasValue = true;
    }
    if (!hasValue) continue;

    lines.push({ description, sheet_name: sheetName, kind, total_value: total, monthly_distribution, source_order: rowIndex });
  }

  return { lines, months };
}

/**
 * Classifica uma linha da aba "Budget" pelo código (coluna PG/D).
 * Códigos seguem o padrão UNIPAR: 1.xx receita; 2.xx imposto; 3.xx custo (pessoal/material/serviço);
 * cabeçalhos de bloco usam siglas: PE, PL (pessoal), SE (serviços), MA (material), OC (custos gerais),
 * TI (total impostos), VL (vendas líquidas), RT (rateio), etc.
 */
function classifyBudgetRow(code: string, description: string): {
  kind: CostLineItem["kind"] | "subtotal" | null;
  isRevenue: boolean;
  isSectionHeader: boolean;
} {
  const c = code.trim().toUpperCase();
  const d = description.trim().toUpperCase();

  // Cabeçalhos visuais de bloco — agrupam linhas analíticas. Preservados como section markers.
  if (["PE", "PL", "SE", "MA", "OC"].includes(c)) {
    return { kind: "subtotal", isRevenue: false, isSectionHeader: true };
  }
  // Subtotais agregadores que duplicam linhas analíticas — ignorados para evitar dupla contagem
  if (["TI", "VL", "RT", "PG"].includes(c)) {
    return { kind: "subtotal", isRevenue: false, isSectionHeader: false };
  }
  if (/^TOTAL|^SUBTOTAL|RESULTADO|MARGEM|RECEITA L[IÍ]QUIDA|CUSTO TOTAL|CUSTO FILIAL|MARGEM (BRUTA|LIQUIDA)/i.test(d)) {
    return { kind: "subtotal", isRevenue: false, isSectionHeader: false };
  }
  // 1.xx → receita
  if (/^1\./.test(c)) return { kind: "revenue", isRevenue: true, isSectionHeader: false };
  // 2.xx → imposto
  if (/^2\./.test(c)) return { kind: "tax", isRevenue: false, isSectionHeader: false };
  // 3.xx → custo (pessoal, material, serviço, geral). 7.xx (reembolsos / outras saídas) tratamos como custo.
  if (/^3\./.test(c) || /^7\./.test(c)) return { kind: "cost", isRevenue: false, isSectionHeader: false };
  // 4.xx/5.xx → despesa administrativa
  if (/^4\./.test(c) || /^5\./.test(c)) return { kind: "expense", isRevenue: false, isSectionHeader: false };
  // 6.xx → imobilizado
  if (/^6\./.test(c)) return { kind: "asset", isRevenue: false, isSectionHeader: false };
  // Códigos com sigla provisão (PET, PFR, etc.) — linhas analíticas de pessoal
  if (/^P[A-Z]{2,}$/.test(c)) return { kind: "cost", isRevenue: false, isSectionHeader: false };
  return { kind: null, isRevenue: false, isSectionHeader: false };
}

/**
 * Lê a aba "Budget" — visão consolidada com todas as linhas (receita + impostos + custos + despesas)
 * e todos os meses (Previsto + Realizado). É a fonte preferida para baseline quando disponível.
 *
 * Estrutura esperada:
 *  - linha 4 (índice 3): "Previsto" / "Realizado" por coluna
 *  - linha 5 (índice 4): datas dos meses
 *  - coluna D (índice 3): código PG (1.01, 2.01, 3.01, PE, TI, VL, etc.)
 *  - coluna E (índice 4): descrição
 *  - colunas G+ (índice 6+): valores mensais
 */
function parseBudgetSheet(sheet: XLSX.WorkSheet): {
  items: RevenueItem[];
  cost_lines: CostLineItem[];
  months: string[];
  audit: Pick<AuditReport, "budget_rows_total" | "budget_rows_with_values" | "budget_rows_zero" | "budget_codes_seen">;
} {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  // Encontra a linha de header com mais datas (esperado: índice 4 = linha 5)
  const headerRowIndex = detectReceitaHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];

  // Mapeia colunas mensais únicas. A planilha repete meses para colunas "TOTAL" e "ACUMULADO" —
  // mantemos só a primeira ocorrência de cada YYYY-MM.
  const monthColumns: Array<{ col: number; month: string }> = [];
  const seenMonths = new Set<string>();
  for (let column = 5; column < headerRow.length; column += 1) {
    const iso = excelDateToISO(headerRow[column]);
    if (!iso) continue;
    const month = iso.slice(0, 7);
    if (seenMonths.has(month)) continue;
    seenMonths.add(month);
    monthColumns.push({ col: column, month });
  }
  const months = monthColumns.map((m) => m.month);
  if (monthColumns.length === 0) {
    return {
      items: [],
      cost_lines: [],
      months: [],
      audit: { budget_rows_total: 0, budget_rows_with_values: 0, budget_rows_zero: 0, budget_codes_seen: [] },
    };
  }

  const items: RevenueItem[] = [];
  const cost_lines: CostLineItem[] = [];
  const codesSeen: string[] = [];
  let revenueOrder = 0;
  let totalParsed = 0;
  let withValues = 0;
  let zeroRows = 0;
  let currentSection: string | null = null;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    // Código fica na coluna D (índice 3); descrição na coluna E (índice 4).
    const codeRaw = row[3];
    const descRaw = row[4];
    const code = codeRaw != null ? String(codeRaw).trim() : "";
    const description = descRaw != null ? String(descRaw).trim() : "";
    if (!code && !description) continue;

    const cls = classifyBudgetRow(code, description);

    // Cabeçalhos de seção (PE, PL, SE, MA, OC) atualizam contexto e não viram linhas analíticas
    if (cls.isSectionHeader) {
      currentSection = description || code;
      continue;
    }
    if (!cls.kind || cls.kind === "subtotal") continue;
    if (!description) continue;

    const monthly_distribution: Record<string, number> = {};
    let total = 0;
    let hasValue = false;
    for (const { col, month } of monthColumns) {
      const v = parseNumber(row[col]);
      if (v == null) continue;
      monthly_distribution[month] = v;
      total += v;
      if (v !== 0) hasValue = true;
    }

    totalParsed += 1;
    if (hasValue) withValues += 1;
    else zeroRows += 1;
    if (code) codesSeen.push(code);

    if (cls.isRevenue) {
      // Receita: sempre incluímos, mesmo zerada (mantém estrutura)
      items.push({
        external_id: code || null,
        description,
        unit: null,
        quantity: 1,
        unit_value: Math.abs(total),
        total_value: Math.abs(total),
        monthly_distribution: Object.fromEntries(
          Object.entries(monthly_distribution).map(([m, v]) => [m, Math.abs(v)]),
        ),
        sort_order: revenueOrder++,
        parent_external_id: null,
      });
    } else {
      // Custo/imposto/despesa/ativo: SEMPRE preserva, mesmo zerado, para manter o
      // budget completo conforme a planilha original.
      cost_lines.push({
        description,
        sheet_name: "Budget",
        kind: cls.kind,
        total_value: total,
        monthly_distribution,
        code: code || null,
        source_order: rowIndex,
        is_zero: !hasValue,
        section_label: currentSection,
      });
    }
  }

  return {
    items,
    cost_lines,
    months,
    audit: {
      budget_rows_total: totalParsed,
      budget_rows_with_values: withValues,
      budget_rows_zero: zeroRows,
      budget_codes_seen: codesSeen,
    },
  };
}

export async function parseUniparBaselineWorkbook(file: File): Promise<ParsedUniparBaseline> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    bookFiles: false,
    bookProps: false,
    bookSheets: false,
    bookVBA: false,
    cellHTML: false,
    cellFormula: false,
    cellStyles: false,
    cellNF: false,
    dense: true,
  });

  const cadastroSheet = workbook.Sheets["Cadastro Budget"];
  if (!cadastroSheet) {
    throw new Error("A planilha precisa conter a aba 'Cadastro Budget'.");
  }
  const cadastro = parseCadastroBudget(cadastroSheet);

  // PREFERÊNCIA: aba "Budget" — consolidada (todas as linhas + meses Previsto/Realizado).
  const budgetSheet = workbook.Sheets["Budget"];
  if (budgetSheet) {
    const { items, cost_lines, months, audit: budgetAudit } = parseBudgetSheet(budgetSheet);
    if (items.length === 0 && cost_lines.length === 0) {
      throw new Error("A aba 'Budget' não contém linhas válidas. Verifique o layout.");
    }

    // COMPLEMENTO: a aba "Budget" da UNIPAR padrão NÃO contém códigos 4.x (despesas adm),
    // 5.x (despesas financeiras) nem 6.x (imobilizado). Esses ficam na aba "I Receita".
    const fallbackCodesAdded: string[] = [];
    const warnings: string[] = [];
    const receitaSheet = workbook.Sheets["I Receita"];
    if (receitaSheet) {
      const seenCodes = new Set(cost_lines.map((l) => (l.code ?? "").trim()).filter(Boolean));
      const extraLines = parseReceitaExtraCodes(receitaSheet, months);
      for (const line of extraLines) {
        const codeKey = (line.code ?? "").trim();
        if (codeKey && !seenCodes.has(codeKey)) {
          cost_lines.push(line);
          fallbackCodesAdded.push(codeKey);
          seenCodes.add(codeKey);
        }
      }
    }

    return {
      file_name: file.name,
      cadastro,
      items,
      cost_lines,
      months: months.slice().sort(),
      audit: {
        ...budgetAudit,
        fallback_codes_added: fallbackCodesAdded,
        warnings,
      },
    };
  }

  // FALLBACK: layout antigo — aba "I Receita" + abas separadas (II Imposto, III Pessoal, ...)
  const receitaSheet = workbook.Sheets["I Receita"];
  if (!receitaSheet) {
    throw new Error("A planilha precisa conter a aba 'Budget' (consolidada) ou 'I Receita'.");
  }
  const { items, months } = parseReceitaSheet(receitaSheet);
  if (items.length === 0) {
    throw new Error("Nenhum item de receita válido foi encontrado na aba 'I Receita'.");
  }

  const cost_lines: CostLineItem[] = [];
  const allMonths = new Set<string>(months);
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === "Cadastro Budget" || sheetName === "I Receita") continue;
    const kind = detectSheetKind(sheetName);
    if (!kind || kind === "revenue") continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const { lines, months: sheetMonths } = parseCostSheet(sheet, sheetName, kind);
    cost_lines.push(...lines);
    sheetMonths.forEach((m) => allMonths.add(m));
  }

  return {
    file_name: file.name,
    cadastro,
    items,
    cost_lines,
    months: Array.from(allMonths).sort(),
  };
}