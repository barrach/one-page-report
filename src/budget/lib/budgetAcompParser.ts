import * as XLSX from "xlsx";
import { isValidPgCode } from "./pgCodes";

export interface ParsedBudgetRow {
  descricao: string;
  codigoPg: string | null;
  origem: "auto" | null;
  /** Valores PREVISTO por mês (mesmo índice de `months`) */
  valoresPrevistos: number[];
}

export interface ParsedBudgetAcomp {
  contractCode: string | null;
  contractName: string | null;
  months: string[]; // YYYY-MM-01
  rows: ParsedBudgetRow[];
}

const SHEET_BUDGET = "Budget_Acomp";
const SHEET_CADASTRO = "Cadastro Budget";

const PG_PREFIX_RE = /^\s*([A-Z0-9.\-]+(?:-[A-Z]+)?)\s*[-–]\s*/;

function clean(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function excelDateToISO(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  if (typeof value === "number") {
    // Excel serial date
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const s = String(value).trim();
  // try DD/MM/YYYY or MM/YYYY
  const m1 = s.match(/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[2]}-${m1[1].padStart(2, "0")}-01`;
  const m2 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-01`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  return null;
}

function extractPgCodeInline(desc: string): string | null {
  const m = desc.match(PG_PREFIX_RE);
  if (!m) return null;
  const candidate = m[1].trim();
  return isValidPgCode(candidate) ? candidate : null;
}

function readCadastro(wb: XLSX.WorkBook): { code: string | null; name: string | null } {
  const ws = wb.Sheets[SHEET_CADASTRO];
  if (!ws) return { code: null, name: null };
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  let code: string | null = null;
  let name: string | null = null;
  for (const row of data) {
    if (!row) continue;
    const label = clean(row[1]).toLowerCase();
    if (!code && (label === "cr" || label.includes("cadastro") || label === "código" || label === "codigo")) {
      const v = clean(row[2]);
      if (v) code = v.match(/\d+/)?.[0] ?? v;
    }
    if (!name && (label.includes("contrato") || label.includes("cliente") || label.includes("nome"))) {
      const v = clean(row[2]);
      if (v) name = v;
    }
  }
  return { code, name };
}

export async function parseBudgetAcompWorkbook(file: File): Promise<ParsedBudgetAcomp> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  const ws = wb.Sheets[SHEET_BUDGET];
  if (!ws) throw new Error(`Aba '${SHEET_BUDGET}' não encontrada na planilha.`);

  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  if (data.length < 5) throw new Error("Aba Budget_Acomp tem menos de 5 linhas — formato inválido.");

  // Linha 1, col A (índice 0,0): "5040109 - RHODIA"
  const headerCellA1 = clean(data[0]?.[0]);
  let contractCode: string | null = null;
  let contractName: string | null = null;
  if (headerCellA1) {
    const m = headerCellA1.match(/^(\d+)\s*[-–]\s*(.+)$/);
    if (m) {
      contractCode = m[1];
      contractName = m[2].trim();
    } else {
      contractName = headerCellA1;
    }
  }

  // Cadastro Budget - prioridade
  const cad = readCadastro(wb);
  if (cad.code) contractCode = cad.code;
  if (cad.name) contractName = cad.name;

  // Linha 3 (índice 2) = datas, Linha 4 (índice 3) = labels (PREVISTO/REALIZADO/DIFERENÇA)
  const dateRow = data[2] ?? [];
  const labelRow = data[3] ?? [];

  // Identifica as colunas de mês: a cada 3 colunas a partir da col 3 (índice 3 = col D)
  // Mas só se a célula for uma data válida e a label seguinte for PREVISTO
  const monthCols: { col: number; iso: string }[] = [];
  for (let c = 3; c < dateRow.length; c += 3) {
    const cell = dateRow[c];
    const label = clean(labelRow[c]).toUpperCase();
    if (label.includes("TOTAL") || label.includes("ACUMULADO")) continue;
    const iso = excelDateToISO(cell);
    if (!iso) continue;
    // Confirma que offset+0 é PREVISTO
    if (label && !label.includes("PREVIS")) continue;
    monthCols.push({ col: c, iso });
  }

  if (monthCols.length === 0) {
    // fallback: scan all cols looking for dates
    for (let c = 3; c < dateRow.length; c++) {
      const label = clean(labelRow[c]).toUpperCase();
      if (!label.includes("PREVIS")) continue;
      const iso = excelDateToISO(dateRow[c]);
      if (iso) monthCols.push({ col: c, iso });
    }
  }

  const months = monthCols.map((m) => m.iso);

  const rows: ParsedBudgetRow[] = [];
  for (let r = 4; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    const descricao = clean(row[0]);
    if (!descricao) continue;
    if (/^total$|^subtotal$/i.test(descricao)) continue;

    const valoresPrevistos = monthCols.map(({ col }) => toNum(row[col]));
    const allZero = valoresPrevistos.every((v) => v === 0);

    const codigoPg = extractPgCodeInline(descricao);

    // Pula apenas se for linha sem nada útil (sem código E sem valores)
    if (allZero && !codigoPg) continue;

    rows.push({
      descricao,
      codigoPg,
      origem: codigoPg ? "auto" : null,
      valoresPrevistos,
    });
  }

  return { contractCode, contractName, months, rows };
}
