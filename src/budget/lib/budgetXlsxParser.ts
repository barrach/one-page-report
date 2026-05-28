import * as XLSX from "xlsx";

export type BudgetMonthCell = {
  /** YYYY-MM-01 */
  monthKey: string;
  /** "MM/YYYY" for display */
  label: string;
  value: number;
};

export type BudgetXlsxRow = {
  pgCode: string;
  description: string | null;
  cells: BudgetMonthCell[];
};

export type BudgetXlsxParseResult = {
  rows: BudgetXlsxRow[];
  monthHeaders: { monthKey: string; label: string }[];
  /** Distinct YYYY years detected */
  years: number[];
  fileName: string;
  /**
   * Diagnostic: column indices that were rejected and the reason.
   * Useful for debugging "phantom month" bugs.
   */
  rejectedColumns: { colIdx: number; reason: string }[];
  /** Contract identification extracted from the workbook + filename. */
  contractHint: ContractHint;
  /** Budget_Acomp structural validation outcome (null if sheet absent). */
  budgetAcompStructure: BudgetAcompStructure | null;
};

export type ContractHint = {
  /** DRG code in canonical "XXXX.XXX" format if found. */
  drgCode: string | null;
  /** Human contract name (e.g. "UNIPAR"). */
  name: string | null;
  /** Normalized (casefold + sem acento) name for comparison. */
  nameNorm: string | null;
  /** Where the hint came from. */
  source:
    | "cadastro_budget"
    | "budget_acomp_row1"
    | "filename"
    | "none";
};

export type BudgetAcompStructure = {
  ok: boolean;
  /** Number of valid month columns detected (datetime in row 3 with valid year). */
  monthColumns: number;
  /** Whether row 4 alternates PREVISTO/REALIZADO/DIFERENÇA as expected. */
  hasPRDPattern: boolean;
  errors: string[];
};

/** Valid year window for budget months. Anything outside is metadata garbage. */
const MIN_YEAR = 2023;
const MAX_YEAR = 2030;

/**
 * Convert a header cell value to a `{year, month}` only if it is a real datetime
 * (Date object or Excel serial inside the valid year window).
 *
 * STRICT: rejects strings, year-as-number, and any serial outside MIN_YEAR/MAX_YEAR.
 */
function toRealMonth(raw: unknown): { year: number; month: number } | null {
  if (raw == null || raw === "") return null;

  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    if (!Number.isFinite(y) || y < MIN_YEAR || y > MAX_YEAR) return null;
    return { year: y, month: m };
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Excel serials for 2023-01-01 ≈ 44927; 2030-12-31 ≈ 47848.
    // Reject anything outside that window — protects against "year as number"
    // (e.g., 2025) and metadata serials like 45689 in column 0.
    if (raw < 44900 || raw > 47900) return null;
    const dateObj = XLSX.SSF.parse_date_code(raw);
    if (!dateObj || !dateObj.y || !dateObj.m) return null;
    if (dateObj.y < MIN_YEAR || dateObj.y > MAX_YEAR) return null;
    return { year: dateObj.y, month: dateObj.m };
  }

  return null;
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthLabelOf(year: number, month: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function toNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Returns true if any cell in column `colIdx` from row 0 to `headerRowIdx`
 * (inclusive) contains text matching the forbidden pattern (ACUMULADO / TOTAL).
 *
 * Per spec, the marker row is row index 1 (the 2nd row of the file), but we
 * scan all metadata rows above the header to be safe — a column flagged as
 * accumulator/total in any of them is excluded.
 */
function isAccumulatorOrTotalColumn(
  matrix: unknown[][],
  headerRowIdx: number,
  colIdx: number,
): boolean {
  const re = /(ACUMULADO|TOTAL)/i;
  for (let r = 0; r <= headerRowIdx; r++) {
    const row = matrix[r];
    if (!row) continue;
    const v = row[colIdx];
    if (typeof v === "string" && re.test(v)) return true;
  }
  return false;
}

/** Casefold + remove diacritics for fuzzy contract-name comparison. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Match XXXX.XXX or XXXXX (4-5 digits + optional .XXX). */
const DRG_CODE_RE = /\b(\d{4,5})\.?(\d{2,3})\b/;

function canonicalDrgCode(raw: string): string | null {
  const m = raw.match(DRG_CODE_RE);
  if (!m) return null;
  return `${m[1]}.${m[2]}`;
}

/**
 * Try to identify the contract from the workbook + filename.
 * Priority:
 *   1) Aba "Cadastro Budget": any cell containing a DRG code or "DRG ..."
 *   2) Aba "Budget_Acomp" linha 1, coluna 0: " - NOME"
 *   3) Filename: "Comparativo_real_x_orçado_-_NOME_DRG.xlsx"
 */
function extractContractHint(wb: XLSX.WorkBook, fileName: string): ContractHint {
  // 1) Cadastro Budget — varre primeiras 30 linhas procurando código DRG e nome
  const cadName = wb.SheetNames.find((n) => normalizeName(n) === "cadastro budget");
  if (cadName) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[cadName], {
      header: 1,
      defval: null,
      raw: true,
    });
    let drg: string | null = null;
    let name: string | null = null;
    for (let r = 0; r < Math.min(grid.length, 40); r++) {
      const row = grid[r] ?? [];
      for (const cell of row) {
        if (typeof cell !== "string") continue;
        if (!drg) {
          const code = canonicalDrgCode(cell);
          if (code) drg = code;
        }
        // Linha "Cliente / Contrato / Empresa : NOME" → captura nome após :
        if (!name) {
          const m = cell.match(/(?:cliente|contrato|empresa|drg)\s*[:\-]\s*(.+)$/i);
          if (m && m[1] && m[1].trim().length > 1) name = m[1].trim();
        }
      }
      if (drg && name) break;
    }
    if (drg || name) {
      return {
        drgCode: drg,
        name,
        nameNorm: name ? normalizeName(name) : null,
        source: "cadastro_budget",
      };
    }
  }

  // 2) Budget_Acomp linha 1 coluna 0 — formato " - UNIPAR"
  const acompName = wb.SheetNames.find((n) => normalizeName(n) === "budget acomp");
  if (acompName) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[acompName], {
      header: 1,
      defval: null,
      raw: true,
    });
    const cell = grid[0]?.[0];
    if (typeof cell === "string" && cell.trim()) {
      const drg = canonicalDrgCode(cell);
      // remove código + separadores; sobra o nome
      const cleaned = cell
        .replace(DRG_CODE_RE, "")
        .replace(/[-–—:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (drg || cleaned) {
        return {
          drgCode: drg,
          name: cleaned || null,
          nameNorm: cleaned ? normalizeName(cleaned) : null,
          source: "budget_acomp_row1",
        };
      }
    }
  }

  // 3) Filename: Comparativo_real_x_orçado_-_NOME_(DRG).xlsx
  const baseName = fileName.replace(/\.xlsx?$/i, "").replace(/_/g, " ");
  const drgFromFile = canonicalDrgCode(baseName);
  const fnameMatch = baseName.match(/comparativo[^a-z0-9]+real[^a-z0-9]+x[^a-z0-9]+orcado[^a-z0-9]+(.+)$/i);
  if (fnameMatch && fnameMatch[1]) {
    const cleaned = fnameMatch[1]
      .replace(DRG_CODE_RE, "")
      .replace(/[-–—:()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned || drgFromFile) {
      return {
        drgCode: drgFromFile,
        name: cleaned || null,
        nameNorm: cleaned ? normalizeName(cleaned) : null,
        source: "filename",
      };
    }
  }

  return { drgCode: drgFromFile, name: null, nameNorm: null, source: drgFromFile ? "filename" : "none" };
}

/**
 * Validate the structural shape of the Budget_Acomp sheet (when present).
 * Spec:
 *   - Linha 3 (idx 2): datetime nas colunas múltiplas de 3 (col3, col6, ...)
 *   - Linha 4 (idx 3): "PREVISTO" / "REALIZADO" / "DIFERENÇA" alternando
 *   - Linha 5+ (idx 4+): código PG na coluna 0 ("1.01 - …")
 */
function validateBudgetAcompStructure(wb: XLSX.WorkBook): BudgetAcompStructure | null {
  const sheetName = wb.SheetNames.find((n) => normalizeName(n) === "budget acomp");
  if (!sheetName) return null;

  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  });
  const errors: string[] = [];

  const monthsRow = grid[2] ?? [];
  const labelRow = grid[3] ?? [];

  let monthCols = 0;
  for (let c = 0; c < monthsRow.length; c++) {
    if (toRealMonth(monthsRow[c])) monthCols++;
  }
  if (monthCols === 0) {
    errors.push("Linha 3 não contém datetimes de mês válidos.");
  }

  // Verifica se aparece pelo menos um trio PREVISTO/REALIZADO/DIFERENÇA na linha 4
  const labelText = labelRow
    .map((c) => (typeof c === "string" ? c.toUpperCase() : ""))
    .join(" | ");
  const hasPRDPattern =
    /PREVISTO/.test(labelText) &&
    /REALIZADO/.test(labelText) &&
    /DIFEREN[ÇC]A/.test(labelText);
  if (!hasPRDPattern) {
    errors.push("Linha 4 não contém o padrão PREVISTO / REALIZADO / DIFERENÇA.");
  }

  // Verifica se há pelo menos uma linha 5+ com código PG na col 0
  let pgRows = 0;
  for (let r = 4; r < Math.min(grid.length, 80); r++) {
    const v = grid[r]?.[0];
    if (typeof v === "string" && /^\s*\d+\.\d+/.test(v)) pgRows++;
  }
  if (pgRows === 0) {
    errors.push("Nenhuma linha de PG (formato '1.01 - …') encontrada a partir da linha 5.");
  }

  return {
    ok: errors.length === 0,
    monthColumns: monthCols,
    hasPRDPattern,
    errors,
  };
}

/**
 * Parse a Megasteam-format Budget worksheet.
 *
 * Rules (from spec):
 *   - Sheet name: "Budget" (case-insensitive)
 *   - Header row with month datetimes: row index 4 (5ª linha do arquivo)
 *   - Metadata row to detect accumulator/total columns: row index 1 (2ª linha)
 *   - Data rows start at row index 6 (linha 7)
 *   - Code + description live in column B (idx 1) as "CODIGO - DESCRICAO".
 *     Column A (idx 0) is a stray Excel serial (e.g. 45689) and is ignored.
 *   - A column is a valid PLANNED month iff:
 *       (a) header cell at row 4 is a Date with year in [2023, 2030], AND
 *       (b) row 1 of the same column does NOT contain "ACUMULADO" nor "TOTAL"
 *   - Skip rows whose column B does not yield a valid PG code.
 */

/**
 * Códigos especiais que contêm hífen interno e devem ser tratados como
 * bloco único — NÃO sofrem split no primeiro " - ".
 */
const COMPOUND_CODE_PREFIXES = ["PE-", "PL-", "SE-", "MA-", "OC-", "RT-"];

/** Códigos atômicos especiais (sem padrão N.NN). */
const ATOMIC_SPECIAL_CODES = new Set(["TI", "VL", "PET", "OS"]);

/** Validação final do código PG extraído. */
function isValidPgCode(code: string): boolean {
  if (!code) return false;
  if (/^\d+\.\d+$/.test(code)) return true;
  if (ATOMIC_SPECIAL_CODES.has(code)) return true;
  for (const p of COMPOUND_CODE_PREFIXES) {
    if (code.startsWith(p) && code.length > p.length) return true;
  }
  return false;
}

/**
 * Extrai {code, description} da célula coluna B (índice 1) seguindo as 5 regras:
 *  - Ignora separadores ("-", " - ", vazio).
 *  - Ignora linhas que começam com "-" (totalizadores calculados:
 *    "-TOTAL CUSTO OPERACIONAL", "-MARGEM BRUTA", etc.).
 *    EXCEÇÃO: "-OS - OUTRAS SAÍDAS" → vira código "OS" (linha manual).
 *  - Reconhece prefixos compostos PE-/PL-/SE-/MA-/OC-/RT- como bloco único.
 *  - Demais casos: split no primeiro " - ".
 *  - Valida o código contra padrões aceitos; descarta se inválido.
 */
function extractPgFromColumnB(
  raw: unknown,
): { code: string; description: string | null } | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text === "-" || text === "—" || /^-+$/.test(text)) return null;

  if (text.startsWith("-")) {
    const stripped = text.replace(/^-+\s*/, "");
    if (/^OS\s*-\s*/i.test(stripped)) {
      const desc = stripped.replace(/^OS\s*-\s*/i, "").trim();
      return { code: "OS", description: desc || null };
    }
    return null;
  }

  const firstSpace = text.indexOf(" ");
  const firstToken = firstSpace === -1 ? text : text.slice(0, firstSpace);
  for (const p of COMPOUND_CODE_PREFIXES) {
    if (firstToken.startsWith(p) && firstToken.length > p.length) {
      const rest = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
      const desc = rest.replace(/^-\s*/, "").trim() || null;
      return { code: firstToken, description: desc };
    }
  }

  const sepIdx = text.indexOf(" - ");
  let code: string;
  let desc: string | null;
  if (sepIdx === -1) {
    code = text.trim();
    desc = null;
  } else {
    code = text.slice(0, sepIdx).trim();
    desc = text.slice(sepIdx + 3).trim() || null;
  }

  if (!isValidPgCode(code)) return null;
  return { code, description: desc };
}
export async function parseBudgetXlsx(file: File): Promise<BudgetXlsxParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const sheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "budget");
  if (!sheetName) {
    throw new Error(
      `Aba "Budget" não encontrada. Abas disponíveis: ${wb.SheetNames.join(", ")}`,
    );
  }

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  // FIXED header row per spec: row index 4 (linha 5).
  const HEADER_ROW_IDX = 4;
  // FIXED first data row per spec: row index 6 (linha 7).
  const FIRST_DATA_ROW_IDX = 6;

  const headerRow = matrix[HEADER_ROW_IDX] ?? [];
  if (headerRow.length === 0) {
    throw new Error(
      "Linha 5 do arquivo está vazia. A planilha Budget deve conter os meses como datetime na 5ª linha.",
    );
  }

  // Determine widest column index among the metadata rows + header.
  const maxCols = Math.max(
    headerRow.length,
    ...matrix.slice(0, FIRST_DATA_ROW_IDX).map((r) => (r ? r.length : 0)),
  );

  const monthHeaders: { colIdx: number; monthKey: string; label: string }[] = [];
  const rejectedColumns: { colIdx: number; reason: string }[] = [];
  const seenMonthKeys = new Set<string>();

  // Start scanning at column index 5 (column F). Columns 0..4 hold metadata
  // (index 3 = PG code, index 4 = description). Column 0 frequently contains
  // a stray Excel serial (e.g., 45689) that must NEVER become a month.
  for (let c = 5; c < maxCols; c++) {
    // Rule (b): forbid columns flagged as ACUMULADO / TOTAL above the header.
    if (isAccumulatorOrTotalColumn(matrix, HEADER_ROW_IDX, c)) {
      rejectedColumns.push({ colIdx: c, reason: "ACUMULADO/TOTAL na metadata" });
      continue;
    }

    // Rule (a): the header cell MUST be a real datetime in the valid window.
    const month = toRealMonth(headerRow[c]);
    if (!month) {
      rejectedColumns.push({ colIdx: c, reason: "header não é datetime válido" });
      continue;
    }

    const key = monthKeyOf(month.year, month.month);
    if (seenMonthKeys.has(key)) {
      // Duplicated month (e.g., sub-total column with same date). Drop it
      // — never overwrite the first legitimate occurrence.
      rejectedColumns.push({ colIdx: c, reason: `mês duplicado (${key})` });
      continue;
    }
    seenMonthKeys.add(key);
    monthHeaders.push({
      colIdx: c,
      monthKey: key,
      label: monthLabelOf(month.year, month.month),
    });
  }

  if (monthHeaders.length === 0) {
    throw new Error(
      "Nenhuma coluna de mês válida detectada. Verifique se a 5ª linha contém datetimes reais e se a 2ª linha não marca todas as colunas como ACUMULADO/TOTAL.",
    );
  }

  // Read data rows starting at row index 6 per spec.
  // IMPORTANT: column A (idx 0) contains a stray Excel serial (e.g. 45689) and
  // must be ignored. Code + description live in column B (idx 1) as
  // "CODIGO - DESCRICAO".
  const rows: BudgetXlsxRow[] = [];
  for (let r = FIRST_DATA_ROW_IDX; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const parsed = extractPgFromColumnB(row[1]);
    if (!parsed) continue;

    const cells: BudgetMonthCell[] = monthHeaders.map((h) => ({
      monthKey: h.monthKey,
      label: h.label,
      value: toNumber(row[h.colIdx]),
    }));

    rows.push({ pgCode: parsed.code, description: parsed.description, cells });
  }

  if (rows.length === 0) {
    throw new Error(
      "Nenhuma linha de PG válida encontrada a partir da linha 7. Verifique se a coluna B contém códigos no formato 'CODIGO - DESCRICAO'.",
    );
  }

  // Filter out months that are entirely zero across all PG rows
  // (contratos curtos / com início no meio do ano).
  const monthAllZero = new Set<string>();
  for (const h of monthHeaders) {
    let nonZero = false;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.monthKey === h.monthKey);
      if (cell && cell.value !== 0) {
        nonZero = true;
        break;
      }
    }
    if (!nonZero) monthAllZero.add(h.monthKey);
  }
  for (const k of monthAllZero) {
    rejectedColumns.push({ colIdx: -1, reason: `mês ${k} sem valores — ignorado` });
  }
  const finalMonthHeaders = monthHeaders.filter((h) => !monthAllZero.has(h.monthKey));
  const finalRows = rows.map((r) => ({
    ...r,
    cells: r.cells.filter((c) => !monthAllZero.has(c.monthKey)),
  }));

  const years = Array.from(
    new Set(finalMonthHeaders.map((h) => Number(h.monthKey.slice(0, 4)))),
  ).sort((a, b) => a - b);

  const contractHint = extractContractHint(wb, file.name);
  const budgetAcompStructure = validateBudgetAcompStructure(wb);

  return {
    rows: finalRows,
    monthHeaders: finalMonthHeaders.map(({ monthKey, label }) => ({ monthKey, label })),
    years,
    fileName: file.name,
    rejectedColumns,
    contractHint,
    budgetAcompStructure,
  };
}
