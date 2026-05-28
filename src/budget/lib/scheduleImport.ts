import * as XLSX from "xlsx";

export interface WorksheetCellSnapshot {
  col: number;
  address: string;
  value: string;
}

export interface WorksheetRowSnapshot {
  rowIndex: number;
  values: string[];
  nonEmptyCells: WorksheetCellSnapshot[];
  text: string;
}

export interface PeriodColumn {
  index: number;
  label: string;
}

export interface WorksheetSnapshot {
  sheetName: string;
  rowCount: number;
  usedRowCount: number;
  usedColumnCount: number;
  mergedCells: number;
  rows: WorksheetRowSnapshot[];
  histogramHeader: WorksheetRowSnapshot | null;
  periodColumns: PeriodColumn[];
  cronogramaRows: WorksheetRowSnapshot[];
  histogramaRows: WorksheetRowSnapshot[];
  totalsRows: WorksheetRowSnapshot[];
  histogramBlocks: HistogramBlock[];
}

export interface HistogramBlock {
  title: string;
  category: string; // "moi" | "mod" | "equipamento" | "veiculo" | "ferramenta" | "outro"
  headerRow: WorksheetRowSnapshot | null;
  periodColumns: PeriodColumn[];
  dataRows: WorksheetRowSnapshot[];
  startRowIndex: number;
  endRowIndex: number;
}

export interface ScheduleAnalysisPayload {
  fileContent: string;
  fileName: string;
}

export interface ParsedHistogramDistribution {
  resource_name: string;
  period: string;
  quantity: number;
  original_row: number;
  original_column: number;
}

export interface ParsedHistogramResource {
  resource_name: string;
  resource_type: "labor" | "equipment" | "vehicle";
  category: string;
  quantity: number | null;
  total: number | null;
  average: number | null;
  hours: number | null;
  unit: string | null;
  phase_name: string | null;
  period: string | null;
  notes: string | null;
  original_row: number;
  distribution: ParsedHistogramDistribution[];
}

export interface ParsedWorksheetTotal {
  label: string;
  value: number | null;
  type: "total" | "subtotal" | "peak" | "hours";
  original_row: number;
  source_block: "cronograma" | "histograma" | "validation";
}

export interface ParsedWorksheetValidation {
  total_lines_read: number;
  cronograma_lines_read: number;
  histograma_lines_read: number;
  merged_headers_detected: number;
  quantity_fields_extracted: number;
  quantity_fields_unrecognized: number;
  warnings: string[];
  missing_blocks: string[];
  interpreted_blocks: string[];
  periods: string[];
  histogram_categories: string[];
}

const SCHEDULE_KEYWORDS = ["cronograma", "schedule", "gantt", "planejamento", "histograma", "planning", "timeline"];
const COST_KEYWORDS = ["custo", "cost", "preço", "pricing", "preços unitários"];
const TOTAL_KEYWORDS = /(total|subtotal|geral|resumo|sumário|sumario)/i;
const PEAK_KEYWORDS = /(pico|peak|máx|max)/i;
const HOURS_KEYWORDS = /(^hh$|hora|horas|diária|diarias)/i;

// Patterns that mark the start of a histogram/distribution block
const DISTRIBUTION_TITLE_PATTERNS = [
  /distribui[çc][ãa]o/i,
  /histograma/i,
  /recursos\s*(do\s*projeto|humanos)/i,
  /quadro\s*de\s*(pessoal|equipe)/i,
  /m[ãa]o\s*de\s*obra/i,
  /ferrament(a|as)\s*(e\s*equipamento|principa)/i,
  /equipamento(s)?\s*(principa|e\s*ferramenta)/i,
  /ve[íi]culo/i,
];

const LABOR_KEYWORDS = [
  "soldador", "caldeireiro", "montador", "encarregado", "supervisor", "engenheiro", "ajudante",
  "eletricista", "instrumentista", "pintor", "isolador", "técnico", "tecnico", "almoxarife", "operador",
  "mecânico", "mecanico", "inspetor", "auxiliar", "mestre", "pedreiro", "armador", "carpinteiro",
  "serralheiro", "funileiro", "torneiro", "fresador", "retificador", "coordenador", "assistente",
  "encanador", "tubista", "topografo", "topógrafo",
];
const EQUIPMENT_KEYWORDS = [
  "guindaste", "munck", "plataforma", "andaime", "gerador", "compressor", "máquina", "maquina",
  "solda", "escavadeira", "retroescavadeira", "caminhão munck", "empilhadeira", "ferramenta",
  "betoneira", "vibrador", "bomba", "transformador", "container", "contêiner",
  "alinhador", "relógio comparador", "paquimetro", "paquímetro", "termometro", "termômetro",
  "torquimetro", "torquímetro", "chave de impacto", "esmerilhadeira", "parafusadeira", "furadeira",
  "talha", "tifor", "maçarico", "maquina de corte", "saca rolamento", "extrator", "separador de flange",
  "tripé", "tripe", "caneta de vibração", "alinhador de correia",
];
const VEHICLE_KEYWORDS = ["caminhão", "caminhao", "pickup", "pick-up", "van", "ônibus", "onibus", "carreta", "veículo", "veiculo", "automóvel", "automovel", "utilitário", "utilitario"];

const PERIOD_PATTERNS = [
  /^m\d+$/i, /^s\d+$/i, /^semana\s*\d+$/i, /^sem\s*\d+$/i,
  /^m[êe]s\s*\d+$/i, /^week\s*\d+$/i, /^w\d+$/i,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/i, /^\d{1,2}-\d{1,2}(?:-\d{2,4})?$/i,
  /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{2,4})?$/i,
];

// Category detection from title text
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /m[ãa]o\s*de\s*obra\s*indireta|moi\b/i, category: "moi" },
  { pattern: /m[ãa]o\s*de\s*obra\s*direta|mod\b/i, category: "mod" },
  { pattern: /m[ãa]o\s*de\s*obra/i, category: "mod" }, // default to MOD if unspecified
  { pattern: /ve[íi]culo/i, category: "veiculo" },
  { pattern: /ferramenta|equipamento/i, category: "equipamento" },
];

function normalizeCellValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, " ").trim();
}

function parseNumericValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,(?=\d{1,2}(\D|$))/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "." || normalized === "-" || normalized === "--") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPeriodLabel(value: string): boolean {
  const normalized = normalizeCellValue(value);
  if (!normalized) return false;
  return PERIOD_PATTERNS.some((p) => p.test(normalized));
}

function columnToLetter(columnNumber: number): string {
  let result = "";
  let n = columnNumber;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function classifyResourceType(name: string): "labor" | "equipment" | "vehicle" {
  const lower = name.toLowerCase();
  if (VEHICLE_KEYWORDS.some((k) => lower.includes(k))) return "vehicle";
  if (EQUIPMENT_KEYWORDS.some((k) => lower.includes(k))) return "equipment";
  if (LABOR_KEYWORDS.some((k) => lower.includes(k))) return "labor";
  return "labor";
}

function detectCategoryFromTitle(text: string): string {
  const lower = text.toLowerCase();
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(lower)) return category;
  }
  if (VEHICLE_KEYWORDS.some((k) => lower.includes(k))) return "veiculo";
  if (EQUIPMENT_KEYWORDS.some((k) => lower.includes(k))) return "equipamento";
  return "outro";
}

function isDistributionTitle(text: string): boolean {
  return DISTRIBUTION_TITLE_PATTERNS.some((p) => p.test(text));
}

function detectPeriodColumnsInRow(row: WorksheetRowSnapshot): PeriodColumn[] {
  return row.values
    .map((v, i) => (isPeriodLabel(v) ? { index: i, label: normalizeCellValue(v) } : null))
    .filter((v): v is PeriodColumn => Boolean(v));
}

function pickRowLabel(row: WorksheetRowSnapshot, limit: number): string {
  const candidates = row.values.slice(0, limit).map(normalizeCellValue).filter(Boolean);
  return candidates[candidates.length - 1] || "";
}

export function detectSheetType(name: string): { suggested: boolean; label?: string } {
  const lower = name.toLowerCase();
  if (SCHEDULE_KEYWORDS.some((k) => lower.includes(k))) return { suggested: true, label: "Cronograma detectado" };
  if (COST_KEYWORDS.some((k) => lower.includes(k))) return { suggested: false, label: "Parece conter custos" };
  return { suggested: false };
}

/**
 * Create a snapshot of the worksheet, splitting into cronograma and histogram blocks.
 * 
 * Strategy: scan all rows for "DISTRIBUIÇÃO" title patterns. The first such title
 * marks the end of the cronograma block and the start of histogram blocks.
 * Each subsequent title starts a new histogram sub-block.
 */
export function createWorksheetSnapshot(ws: XLSX.WorkSheet, sheetName: string): WorksheetSnapshot {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const matrix = Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => ""));

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      matrix[row - range.s.r][col - range.s.c] = normalizeCellValue(cell?.w ?? cell?.v ?? "");
    }
  }

  const merges = ws["!merges"] || [];
  merges.forEach((merge) => {
    const mergedValue = matrix[merge.s.r - range.s.r]?.[merge.s.c - range.s.c] || "";
    for (let row = merge.s.r; row <= merge.e.r; row++) {
      for (let col = merge.s.c; col <= merge.e.c; col++) {
        if (!matrix[row - range.s.r]?.[col - range.s.c]) {
          if (matrix[row - range.s.r]) matrix[row - range.s.r][col - range.s.c] = mergedValue;
        }
      }
    }
  });

  const rows: WorksheetRowSnapshot[] = matrix
    .map((values, rowOffset) => {
      const nonEmptyCells = values
        .map((value, colOffset) => {
          const normalized = normalizeCellValue(value);
          if (!normalized) return null;
          return {
            col: colOffset,
            address: `${columnToLetter(range.s.c + colOffset + 1)}${range.s.r + rowOffset + 1}`,
            value: normalized,
          };
        })
        .filter((c): c is WorksheetCellSnapshot => Boolean(c));

      return {
        rowIndex: range.s.r + rowOffset + 1,
        values,
        nonEmptyCells,
        text: nonEmptyCells.map((c) => `${c.address}=${c.value}`).join(" | "),
      };
    })
    .filter((r) => r.nonEmptyCells.length > 0);

  // Find distribution title rows to split blocks
  const distributionTitleIndices: number[] = [];
  rows.forEach((row, idx) => {
    const fullText = row.values.join(" ");
    if (isDistributionTitle(fullText)) {
      distributionTitleIndices.push(idx);
    }
  });

  let cronogramaRows: WorksheetRowSnapshot[];
  let histogramaRows: WorksheetRowSnapshot[];
  const histogramBlocks: HistogramBlock[] = [];

  if (distributionTitleIndices.length > 0) {
    // Everything before the first distribution title is cronograma
    const firstDistIdx = distributionTitleIndices[0];
    cronogramaRows = rows.slice(0, firstDistIdx);
    histogramaRows = rows.slice(firstDistIdx);

    // Build histogram sub-blocks
    for (let b = 0; b < distributionTitleIndices.length; b++) {
      const startIdx = distributionTitleIndices[b];
      const endIdx = b + 1 < distributionTitleIndices.length ? distributionTitleIndices[b + 1] : rows.length;
      const blockRows = rows.slice(startIdx, endIdx);
      const titleRow = blockRows[0];
      const titleText = titleRow.values.join(" ");
      const category = detectCategoryFromTitle(titleText);

      // Find period columns within this block's header rows (first 4 rows)
      let blockPeriods: PeriodColumn[] = [];
      let headerRow: WorksheetRowSnapshot | null = null;
      for (let h = 1; h < Math.min(blockRows.length, 5); h++) {
        const periods = detectPeriodColumnsInRow(blockRows[h]);
        if (periods.length >= 2) {
          blockPeriods = periods;
          headerRow = blockRows[h];
          break;
        }
      }

      // Data rows start after the period header (or after title if no header)
      const dataStartOffset = headerRow
        ? blockRows.indexOf(headerRow) + 1
        : 1; // skip title row
      const dataRows = blockRows.slice(dataStartOffset);

      histogramBlocks.push({
        title: titleText.trim(),
        category,
        headerRow,
        periodColumns: blockPeriods,
        dataRows,
        startRowIndex: titleRow.rowIndex,
        endRowIndex: blockRows[blockRows.length - 1]?.rowIndex || titleRow.rowIndex,
      });
    }
  } else {
    // Fallback: no distribution titles found, try period-based detection
    // Find the first row with period columns that has mostly-numeric rows below it
    let bestSplitIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const periods = detectPeriodColumnsInRow(rows[i]);
      if (periods.length >= 4) {
        // Check if the next few rows have numeric data in those columns
        let numericCount = 0;
        for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
          const hasNumeric = periods.some((p) => parseNumericValue(rows[j].values[p.index]) !== null);
          if (hasNumeric) numericCount++;
        }
        if (numericCount >= 2 && bestSplitIdx === -1) {
          // This might be the cronograma header — look for a SECOND set
          // Skip ahead to find a different period header row
          for (let k = i + 5; k < rows.length; k++) {
            const p2 = detectPeriodColumnsInRow(rows[k]);
            if (p2.length >= 4) {
              bestSplitIdx = k - 1; // split before this header
              break;
            }
          }
          if (bestSplitIdx === -1) {
            // Only one set of headers: everything is cronograma
            bestSplitIdx = rows.length;
          }
        }
      }
    }

    if (bestSplitIdx > 0 && bestSplitIdx < rows.length) {
      cronogramaRows = rows.slice(0, bestSplitIdx);
      histogramaRows = rows.slice(bestSplitIdx);
    } else {
      cronogramaRows = rows;
      histogramaRows = [];
    }
  }

  // Detect period columns from the FIRST histogram block (for backward compat)
  const firstBlockPeriods = histogramBlocks.length > 0 ? histogramBlocks[0].periodColumns : [];
  const firstBlockHeader = histogramBlocks.length > 0 ? histogramBlocks[0].headerRow : null;

  const totalsRows = rows.filter((r) =>
    TOTAL_KEYWORDS.test(r.values.join(" ")) || PEAK_KEYWORDS.test(r.values.join(" ")) || HOURS_KEYWORDS.test(r.values.join(" "))
  );

  return {
    sheetName,
    rowCount: rows.length,
    usedRowCount: rowCount,
    usedColumnCount: colCount,
    mergedCells: merges.length,
    rows,
    histogramHeader: firstBlockHeader,
    periodColumns: firstBlockPeriods,
    cronogramaRows,
    histogramaRows,
    totalsRows,
    histogramBlocks,
  };
}

export function buildScheduleAnalysisPayloads(snapshot: WorksheetSnapshot, fileName: string, maxChars = 14000): ScheduleAnalysisPayload[] {
  const basePayload = {
    analysis_mode: "cronograma",
    file_name: fileName,
    sheet_name: snapshot.sheetName,
    used_range: { rows: snapshot.usedRowCount, columns: snapshot.usedColumnCount },
    merged_cells: snapshot.mergedCells,
    detected_blocks: {
      cronograma_rows: snapshot.cronogramaRows.length,
      histograma_rows: snapshot.histogramaRows.length,
      histogram_blocks: snapshot.histogramBlocks.length,
      total_rows: snapshot.totalsRows.length,
    },
    periods: snapshot.periodColumns.map((p) => p.label),
  };

  const rows = snapshot.cronogramaRows.map((row) => ({
    original_row: row.rowIndex,
    cells: row.nonEmptyCells.map((c) => `${c.address}=${c.value}`),
    text: row.text,
  }));

  if (rows.length === 0) return [];

  const payloads: ScheduleAnalysisPayload[] = [];
  let currentRows: typeof rows = [];
  let currentLength = JSON.stringify(basePayload).length;

  rows.forEach((row) => {
    const rowLength = JSON.stringify(row).length;
    if (currentRows.length > 0 && currentLength + rowLength > maxChars) {
      payloads.push({
        fileName,
        fileContent: JSON.stringify({
          ...basePayload,
          segment_index: payloads.length + 1,
          cronograma_rows: currentRows,
        }),
      });
      currentRows = [];
      currentLength = JSON.stringify(basePayload).length;
    }
    currentRows.push(row);
    currentLength += rowLength;
  });

  if (currentRows.length > 0) {
    payloads.push({
      fileName,
      fileContent: JSON.stringify({
        ...basePayload,
        segment_index: payloads.length + 1,
        cronograma_rows: currentRows,
      }),
    });
  }

  return payloads.map((p, i, all) => ({
    fileName: all.length > 1 ? `${p.fileName} (segmento ${i + 1}/${all.length})` : p.fileName,
    fileContent: JSON.stringify({
      ...JSON.parse(p.fileContent),
      segment_total: all.length,
    }),
  }));
}

/**
 * Extract histogram data from all detected histogram blocks.
 * Each block is processed independently with its own period columns.
 */
export function extractHistogramData(snapshot: WorksheetSnapshot): {
  resources: ParsedHistogramResource[];
  distributions: ParsedHistogramDistribution[];
  totals: ParsedWorksheetTotal[];
  validation: ParsedWorksheetValidation;
} {
  const warnings: string[] = [];
  const missingBlocks: string[] = [];
  const interpretedBlocks: string[] = [];
  const resources: ParsedHistogramResource[] = [];
  const distributions: ParsedHistogramDistribution[] = [];
  const totals: ParsedWorksheetTotal[] = [];
  const histogramCategories: string[] = [];

  if (snapshot.histogramBlocks.length === 0 && snapshot.histogramaRows.length === 0) {
    missingBlocks.push("histograma");
    warnings.push("Nenhum bloco de histograma/distribuição foi identificado na aba selecionada.");
    return {
      resources, distributions, totals,
      validation: {
        total_lines_read: snapshot.rowCount,
        cronograma_lines_read: snapshot.cronogramaRows.length,
        histograma_lines_read: 0,
        merged_headers_detected: snapshot.mergedCells,
        quantity_fields_extracted: 0,
        quantity_fields_unrecognized: 0,
        warnings, missing_blocks: missingBlocks,
        interpreted_blocks: interpretedBlocks,
        periods: [],
        histogram_categories: [],
      },
    };
  }

  interpretedBlocks.push("histograma");
  let quantityFieldsUnrecognized = 0;
  let quantityFieldsExtracted = 0;
  let totalHistogramaLines = 0;

  // Process each histogram block independently
  const blocks = snapshot.histogramBlocks.length > 0
    ? snapshot.histogramBlocks
    : [{ // Fallback: treat all histogram rows as one block
        title: "Histograma",
        category: "outro",
        headerRow: snapshot.histogramHeader,
        periodColumns: snapshot.periodColumns,
        dataRows: snapshot.histogramaRows,
        startRowIndex: snapshot.histogramaRows[0]?.rowIndex || 0,
        endRowIndex: snapshot.histogramaRows[snapshot.histogramaRows.length - 1]?.rowIndex || 0,
      }];

  for (const block of blocks) {
    histogramCategories.push(block.category);
    const periods = block.periodColumns;
    const hasPeriods = periods.length > 0;
    const firstPeriodCol = hasPeriods ? periods[0].index : -1;

    // Detect total/hours columns from the block's header or the row before data
    const hoursColIndices: number[] = [];
    const totalColIndices: number[] = [];
    const peakColIndices: number[] = [];
    const recognizedCols = new Set<number>(periods.map((p) => p.index));

    if (block.headerRow) {
      block.headerRow.values.forEach((v, ci) => {
        const lower = normalizeCellValue(v).toLowerCase();
        if (!lower || (hasPeriods && ci <= periods[periods.length - 1].index)) return;
        if (HOURS_KEYWORDS.test(lower)) { hoursColIndices.push(ci); recognizedCols.add(ci); }
        if (TOTAL_KEYWORDS.test(lower)) { totalColIndices.push(ci); recognizedCols.add(ci); }
        if (PEAK_KEYWORDS.test(lower)) { peakColIndices.push(ci); recognizedCols.add(ci); }
      });
    }

    // Track current sub-category within the block
    let currentSubCategory = block.category;

    for (const row of block.dataRows) {
      totalHistogramaLines++;
      const labelLimit = firstPeriodCol > 0 ? firstPeriodCol : 6;
      const label = pickRowLabel(row, Math.max(labelLimit, 1));
      if (!label) continue;

      // Check if this is a sub-category header (e.g., "MÃO DE OBRA INDIRETA", "MONTAGEM ESTRUTURAS")
      const lowerLabel = label.toLowerCase();
      const isSubCategory =
        /^(m[ãa]o\s*de\s*obra|gest[ãa]o|montagem|el[ée]trica|instrumenta[çc][ãa]o|tubula[çc][ãa]o|andaime|ferramental|ve[íi]culo)/i.test(label) &&
        row.nonEmptyCells.length <= (hasPeriods ? periods.length + 8 : 10);

      if (isSubCategory) {
        // Update sub-category context
        const detected = detectCategoryFromTitle(label);
        if (detected !== "outro") currentSubCategory = detected;

        // Check if this row also has numeric totals (summary rows like "MÃO DE OBRA DIRETA" with values)
        const hasValues = hasPeriods && periods.some((p) => parseNumericValue(row.values[p.index]) !== null);
        const hoursVal = hoursColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);

        if (hasValues || hoursVal !== undefined) {
          // It's a summary/total row
          totals.push({
            label,
            value: hoursVal ?? null,
            type: "subtotal",
            original_row: row.rowIndex,
            source_block: "histograma",
          });
        }
        continue;
      }

      // Check for total/summary rows
      if (TOTAL_KEYWORDS.test(label) || PEAK_KEYWORDS.test(label)) {
        const hoursVal = hoursColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);
        const totalVal = totalColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);
        totals.push({
          label,
          value: hoursVal ?? totalVal ?? null,
          type: TOTAL_KEYWORDS.test(label) ? "total" : "peak",
          original_row: row.rowIndex,
          source_block: "histograma",
        });
        continue;
      }

      // Extract distribution data
      const distribution: ParsedHistogramDistribution[] = hasPeriods
        ? periods
            .map((p) => ({
              resource_name: label,
              period: p.label,
              quantity: parseNumericValue(row.values[p.index]),
              original_row: row.rowIndex,
              original_column: p.index + 1,
            }))
            .filter((e): e is ParsedHistogramDistribution => typeof e.quantity === "number")
        : [];

      const explicitHours = hoursColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);
      const explicitTotal = totalColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);
      const explicitPeak = peakColIndices.map((ci) => parseNumericValue(row.values[ci])).find((v): v is number => v !== null);

      // Count unrecognized numeric fields
      if (firstPeriodCol >= 0) {
        row.nonEmptyCells.forEach((c) => {
          if (c.col >= firstPeriodCol && parseNumericValue(c.value) !== null && !recognizedCols.has(c.col)) {
            quantityFieldsUnrecognized++;
          }
        });
      }

      const hasData = distribution.length > 0 || explicitHours !== undefined || explicitTotal !== undefined;
      if (!hasData) continue;

      quantityFieldsExtracted += distribution.length;

      const distValues = distribution.map((e) => e.quantity);
      const total = explicitTotal ?? (distValues.length > 0 ? distValues.reduce((a, b) => a + b, 0) : null);
      const peak = explicitPeak ?? (distValues.length > 0 ? Math.max(...distValues) : null);
      const average = total !== null && distValues.length > 0
        ? Math.round((total / distValues.length) * 100) / 100
        : null;

      // Determine resource type from name, falling back to block category
      let resourceType = classifyResourceType(label);
      if (block.category === "veiculo") resourceType = "vehicle";
      else if (block.category === "equipamento") resourceType = "equipment";

      resources.push({
        resource_name: label,
        resource_type: resourceType,
        category: currentSubCategory,
        quantity: peak,
        total,
        average,
        hours: explicitHours ?? null,
        unit: explicitHours !== undefined ? "HH" : null,
        phase_name: null,
        period: periods[0]?.label || null,
        notes: null,
        original_row: row.rowIndex,
        distribution,
      });
      distributions.push(...distribution);
    }
  }

  // Dedupe totals
  const seenTotals = new Set<string>();
  const dedupedTotals = totals.filter((t) => {
    const key = `${t.original_row}-${t.label.toLowerCase()}-${t.type}`;
    if (seenTotals.has(key)) return false;
    seenTotals.add(key);
    return true;
  });
  if (dedupedTotals.length > 0) interpretedBlocks.push("totais");

  return {
    resources,
    distributions,
    totals: dedupedTotals,
    validation: {
      total_lines_read: snapshot.rowCount,
      cronograma_lines_read: snapshot.cronogramaRows.length,
      histograma_lines_read: totalHistogramaLines,
      merged_headers_detected: snapshot.mergedCells,
      quantity_fields_extracted: quantityFieldsExtracted,
      quantity_fields_unrecognized: quantityFieldsUnrecognized,
      warnings,
      missing_blocks: missingBlocks,
      interpreted_blocks: interpretedBlocks,
      periods: [...new Set(snapshot.histogramBlocks.flatMap((b) => b.periodColumns.map((p) => p.label)))],
      histogram_categories: histogramCategories,
    },
  };
}
