// ============================================================
// Parser XLSX da aba "Imobilizado" do workbook Megasteam
// ============================================================
// Formato esperado (header na linha 6, dados a partir da linha 7):
//   B  Mês de Competência  (string "M+YYYY", ex "32026")
//   C  Mês                 (Date — preferencial)
//   D  Item                (number — ID do ativo)
//   E  Tipo                ("Aquisição" | "Depreciação")
//   F  Conta               (string PG: "7.51", "7.54"…)
//   G  Depto.              (number — depto Megasteam)
//   I  Valor               (number)
//   J  NF/CF               (string)
//   K  Fornecedor          (string)
//   L  Descrição do Bem    (string)
// ============================================================

import * as XLSX from "xlsx";
import { deptoToDeptCode, isHeadquartersDepto } from "./imobilizadoMapping";

export interface ImobAssetParsed {
  external_item_id: number;
  description: string;
  supplier: string | null;
  nf: string | null;
  conta_pg: string;          // "7.51" etc
  depto: number | null;      // numérico
  dept_code: string | null;  // "5040.107"
  is_headquarters: boolean;  // 1/2/3 → admin
  acquisition_date: string;  // YYYY-MM-DD
  acquisition_value: number; // positivo
  amortization_months: number;
  quota_mensal: number;
}

export interface ImobEntryParsed {
  external_item_id: number;
  entry_type: "aquisicao" | "depreciacao";
  competence_month: string; // YYYY-MM-01
  entry_date: string;       // YYYY-MM-DD
  conta_pg: string;
  value: number;            // positivo
  installment_index: number | null;
}

export interface ImobParseReport {
  assets: ImobAssetParsed[];
  entries: ImobEntryParsed[];
  totalRows: number;
  skippedRows: number;
  warnings: string[];
}

function toDateString(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return toDateString(d);
  }
  if (typeof v === "string") {
    // Try parse as "M+YYYY" e.g. "32026"
    if (/^\d{5,6}$/.test(v)) {
      const y = Number(v.slice(-4));
      const m = Number(v.slice(0, -4));
      if (m >= 1 && m <= 12 && y > 1900) {
        return `${y}-${String(m).padStart(2, "0")}-01`;
      }
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) return toDateString(d);
  }
  return null;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.replace(/\./g, "").replace(",", ".").replace(/[^\d\-.]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

/** Lê o workbook e devolve assets + entries da aba Imobilizado. */
export async function parseImobilizadoFromFile(file: File): Promise<ImobParseReport> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return parseImobilizadoFromWorkbook(wb);
}

export function parseImobilizadoFromWorkbook(wb: XLSX.WorkBook): ImobParseReport {
  const sheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "imobilizado");
  if (!sheetName) {
    throw new Error("Aba 'Imobilizado' não encontrada no arquivo.");
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const warnings: string[] = [];
  const assetsByItem = new Map<number, ImobAssetParsed>();
  // perItemRows tracks all entries for an item to compute amortization_months & quota
  const perItem: Record<number, { acq?: ImobEntryParsed; dep: ImobEntryParsed[] }> = {};
  const entries: ImobEntryParsed[] = [];

  let totalDataRows = 0;
  let skipped = 0;

  // Data starts at row 7 (index 6)
  for (let i = 6; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    // Columns: A=0 (skip), B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11
    const item = row[3];
    const tipo = row[4];
    if (item == null || tipo == null) {
      skipped++;
      continue;
    }
    const itemId = Number(item);
    if (!Number.isFinite(itemId)) { skipped++; continue; }

    const tipoStr = String(tipo).trim().toLowerCase();
    const isAcq = tipoStr.startsWith("aquisi");
    const isDep = tipoStr.startsWith("deprecia");
    if (!isAcq && !isDep) { skipped++; continue; }

    const dateStr = toDateString(row[2]) ?? toDateString(row[1]);
    if (!dateStr) {
      warnings.push(`Linha ${i + 1} (item ${itemId}): data inválida — ignorada`);
      skipped++; continue;
    }
    const competence = `${dateStr.slice(0, 7)}-01`;

    const contaPg = str(row[5]) ?? "";
    const depto = row[6] != null ? Number(row[6]) : null;
    const valor = Math.abs(num(row[8]));
    const nf = str(row[9]);
    const fornecedor = str(row[10]);
    const desc = str(row[11]) ?? `Item ${itemId}`;

    totalDataRows++;

    const entry: ImobEntryParsed = {
      external_item_id: itemId,
      entry_type: isAcq ? "aquisicao" : "depreciacao",
      competence_month: competence,
      entry_date: dateStr,
      conta_pg: contaPg,
      value: valor,
      installment_index: null,
    };
    entries.push(entry);

    if (!perItem[itemId]) perItem[itemId] = { dep: [] };
    if (isAcq) {
      perItem[itemId].acq = entry;
      // create / update asset master
      const dept_code = deptoToDeptCode(depto);
      if (!assetsByItem.has(itemId)) {
        assetsByItem.set(itemId, {
          external_item_id: itemId,
          description: desc,
          supplier: fornecedor,
          nf,
          conta_pg: contaPg,
          depto,
          dept_code,
          is_headquarters: isHeadquartersDepto(depto),
          acquisition_date: dateStr,
          acquisition_value: valor,
          amortization_months: 0,
          quota_mensal: 0,
        });
      } else {
        const a = assetsByItem.get(itemId)!;
        a.acquisition_date = dateStr;
        a.acquisition_value = valor;
        a.conta_pg = contaPg;
        a.depto = depto;
        a.dept_code = dept_code;
        a.is_headquarters = isHeadquartersDepto(depto);
        a.supplier ??= fornecedor;
        a.nf ??= nf;
      }
    } else {
      perItem[itemId].dep.push(entry);
      // ensure asset exists even without an Aquisição line
      if (!assetsByItem.has(itemId)) {
        assetsByItem.set(itemId, {
          external_item_id: itemId,
          description: desc,
          supplier: fornecedor,
          nf,
          conta_pg: contaPg,
          depto,
          dept_code: deptoToDeptCode(depto),
          is_headquarters: isHeadquartersDepto(depto),
          acquisition_date: dateStr,
          acquisition_value: 0,
          amortization_months: 0,
          quota_mensal: 0,
        });
      }
    }
  }

  // Compute amortization_months & quota_mensal per asset, assign installment_index
  for (const [itemId, a] of assetsByItem) {
    const deps = (perItem[itemId]?.dep ?? []).slice().sort(
      (x, y) => x.competence_month.localeCompare(y.competence_month),
    );
    a.amortization_months = deps.length || 1;
    a.quota_mensal = deps.length ? deps.reduce((s, e) => s + e.value, 0) / deps.length : 0;
    deps.forEach((e, idx) => { e.installment_index = idx + 1; });
    // also tag aquisicao
    if (perItem[itemId]?.acq) perItem[itemId].acq!.installment_index = 0;
  }

  return {
    assets: [...assetsByItem.values()],
    entries,
    totalRows: totalDataRows,
    skippedRows: skipped,
    warnings,
  };
}
