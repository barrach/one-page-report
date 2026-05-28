/**
 * Universal Parser — detects and classifies blocks in any Excel worksheet
 * Supports: cronograma, histograma, custos, materiais, equipamentos, veículos, resumos, totais
 */
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType =
  | "cronograma"
  | "histograma"
  | "recursos"
  | "fases"
  | "tarefas"
  | "custos"
  | "resumo"
  | "materiais"
  | "mao_de_obra"
  | "equipamentos"
  | "veiculos"
  | "totais"
  | "desconhecido";

export interface DetectedBlock {
  id: string;
  type: BlockType;
  suggestedType: BlockType;
  confidence: number; // 0-100
  title: string;
  startRow: number;
  endRow: number;
  rowCount: number;
  columnCount: number;
  columnsDetected: string[];
  hasNumericData: boolean;
  hasPeriodColumns: boolean;
  hasCurrencyData: boolean;
  sampleRows: string[][];
  confirmed: boolean;
  ignored: boolean;
}

export interface SheetAnalysis {
  sheetName: string;
  totalRows: number;
  totalColumns: number;
  mergedCells: number;
  blocks: DetectedBlock[];
  periodsDetected: string[];
  warnings: string[];
}

export interface ParsedBlockData {
  blockId: string;
  blockType: BlockType;
  headers: string[];
  rows: Record<string, unknown>[];
  totals: { label: string; value: number; type: string }[];
  metadata: Record<string, unknown>;
}

// ─── Detection Patterns ───────────────────────────────────────────────────────

const BLOCK_PATTERNS: Array<{ type: BlockType; patterns: RegExp[]; priority: number }> = [
  {
    type: "cronograma",
    patterns: [
      /cronograma/i, /schedule/i, /gantt/i, /planejamento/i, /timeline/i,
      /linha\s*do\s*tempo/i, /planning/i,
    ],
    priority: 10,
  },
  {
    type: "histograma",
    patterns: [
      /histograma/i, /distribui[çc][ãa]o/i, /quadro\s*de\s*(pessoal|equipe)/i,
      /mobiliza[çc][ãa]o\s*de\s*pessoal/i,
    ],
    priority: 9,
  },
  {
    type: "mao_de_obra",
    patterns: [
      /m[ãa]o\s*de\s*obra/i, /efetivo/i, /pessoal/i,
      /mod\b/i, /moi\b/i, /recursos\s*humanos/i,
    ],
    priority: 8,
  },
  {
    type: "equipamentos",
    patterns: [
      /equipamento/i, /ferramenta/i, /m[áa]quina/i,
      /instrumenta[çc][ãa]o/i,
    ],
    priority: 7,
  },
  {
    type: "veiculos",
    patterns: [
      /ve[íi]culo/i, /transporte/i, /frota/i,
    ],
    priority: 7,
  },
  {
    type: "materiais",
    patterns: [
      /material/i, /insumo/i, /consumível/i, /consumivel/i,
      /lista\s*de\s*material/i,
    ],
    priority: 6,
  },
  {
    type: "custos",
    patterns: [
      /custo/i, /cost/i, /pre[çc]o/i, /pricing/i, /or[çc]amento/i,
      /bdi/i, /imposto/i, /taxa/i, /encargo/i,
      /custo\s*direto/i, /custo\s*indireto/i,
    ],
    priority: 5,
  },
  {
    type: "resumo",
    patterns: [
      /resumo/i, /summary/i, /consolida[çc][ãa]o/i,
    ],
    priority: 4,
  },
  {
    type: "totais",
    patterns: [
      /^total/i, /subtotal/i, /geral/i,
    ],
    priority: 3,
  },
];

const PERIOD_PATTERNS = [
  /^m\d+$/i, /^s\d+$/i, /^semana\s*\d+$/i, /^sem\s*\d+$/i,
  /^m[êe]s\s*\d+$/i, /^week\s*\d+$/i, /^w\d+$/i,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/i,
  /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{2,4})?$/i,
];

const CURRENCY_PATTERNS = [
  /^r\$\s*/i, /^\$\s*/, /brl/i,
  /\d+[.,]\d{2}$/, // values ending in 2 decimal places
];

const LABOR_KEYWORDS = [
  "soldador", "caldeireiro", "montador", "encarregado", "supervisor", "engenheiro",
  "ajudante", "eletricista", "instrumentista", "pintor", "isolador", "técnico",
  "almoxarife", "operador", "mecânico", "inspetor", "auxiliar", "mestre",
  "pedreiro", "carpinteiro", "coordenador", "assistente", "tubista",
];

const EQUIP_KEYWORDS = [
  "guindaste", "munck", "plataforma", "andaime", "gerador", "compressor",
  "máquina", "solda", "escavadeira", "empilhadeira", "betoneira", "vibrador",
  "bomba", "transformador", "container", "talha", "tifor", "maçarico",
  "esmerilhadeira", "furadeira", "parafusadeira", "torquímetro",
];

const VEHICLE_KEYWORDS = [
  "caminhão", "pickup", "pick-up", "van", "ônibus", "carreta", "veículo",
  "automóvel", "utilitário",
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function normCell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

function isPeriod(v: string): boolean {
  return PERIOD_PATTERNS.some(p => p.test(v.trim()));
}

function isCurrency(v: string): boolean {
  return CURRENCY_PATTERNS.some(p => p.test(v.trim()));
}

function isNumeric(v: string): boolean {
  if (!v.trim()) return false;
  const clean = v.replace(/[R$\s.,]/g, "").replace(/[()]/g, "");
  return /^-?\d+$/.test(clean);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Main Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze a worksheet and detect all blocks with their types.
 * This is the main entry point for the universal parser.
 */
export function analyzeWorksheet(ws: XLSX.WorkSheet, sheetName: string): SheetAnalysis {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const totalRows = range.e.r - range.s.r + 1;
  const totalCols = range.e.c - range.s.c + 1;
  const merges = ws["!merges"] || [];

  // Build matrix
  const matrix: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(normCell(cell?.w ?? cell?.v ?? ""));
    }
    matrix.push(row);
  }

  // Apply merged cells
  merges.forEach(merge => {
    const val = matrix[merge.s.r - range.s.r]?.[merge.s.c - range.s.c] || "";
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const ri = r - range.s.r;
        const ci = c - range.s.c;
        if (matrix[ri] && !matrix[ri][ci]) matrix[ri][ci] = val;
      }
    }
  });

  // Find non-empty rows with their indices
  const nonEmptyRows: Array<{ rowIdx: number; values: string[]; text: string }> = [];
  matrix.forEach((row, idx) => {
    const nonEmpty = row.filter(v => v.trim());
    if (nonEmpty.length > 0) {
      nonEmptyRows.push({
        rowIdx: range.s.r + idx + 1,
        values: row,
        text: row.filter(v => v.trim()).join(" | "),
      });
    }
  });

  // Detect period columns across all rows
  const allPeriods = new Set<string>();
  nonEmptyRows.forEach(row => {
    row.values.forEach(v => {
      if (isPeriod(v)) allPeriods.add(v.trim());
    });
  });

  // Detect block boundaries — a block starts at:
  // 1. Title rows (merged cells, uppercase, keywords)
  // 2. Empty row gaps
  // 3. Major structural changes (columns shifting)
  const blocks = detectBlockBoundaries(nonEmptyRows, matrix, range, allPeriods);
  const warnings: string[] = [];

  if (blocks.length === 0) {
    warnings.push("Nenhum bloco estrutural foi identificado automaticamente.");
  }

  // Check for unclassified blocks
  const unknown = blocks.filter(b => b.type === "desconhecido");
  if (unknown.length > 0) {
    warnings.push(`${unknown.length} bloco(s) não foram classificados automaticamente. Revise a sugestão.`);
  }

  return {
    sheetName,
    totalRows,
    totalColumns: totalCols,
    mergedCells: merges.length,
    blocks,
    periodsDetected: Array.from(allPeriods),
    warnings,
  };
}

function detectBlockBoundaries(
  rows: Array<{ rowIdx: number; values: string[]; text: string }>,
  matrix: string[][],
  range: XLSX.Range,
  allPeriods: Set<string>,
): DetectedBlock[] {
  if (rows.length === 0) return [];

  const blocks: DetectedBlock[] = [];
  let currentBlockStart = 0;
  let lastNonEmptyIdx = -1;

  // Strategy: scan for title rows (potential block headers)
  const titleIndices: number[] = [];

  rows.forEach((row, idx) => {
    const text = row.text;
    const isTitle = isTitleRow(row.values, text);
    if (isTitle) titleIndices.push(idx);
  });

  // If no title rows found, treat everything as one block
  if (titleIndices.length === 0) {
    const block = buildBlock(rows, 0, rows.length - 1, matrix, range, allPeriods);
    blocks.push(block);
    return blocks;
  }

  // Build blocks from title boundaries
  for (let i = 0; i < titleIndices.length; i++) {
    const startIdx = titleIndices[i];
    const endIdx = i + 1 < titleIndices.length ? titleIndices[i + 1] - 1 : rows.length - 1;

    // Skip very small "blocks" (just a title with no data)
    if (endIdx - startIdx < 1) continue;

    const block = buildBlock(rows, startIdx, endIdx, matrix, range, allPeriods);
    blocks.push(block);
  }

  // If there are rows before the first title, add them as a block
  if (titleIndices[0] > 0) {
    const preBlock = buildBlock(rows, 0, titleIndices[0] - 1, matrix, range, allPeriods);
    if (preBlock.rowCount > 1) {
      blocks.unshift(preBlock);
    }
  }

  return blocks;
}

function isTitleRow(values: string[], text: string): boolean {
  const nonEmpty = values.filter(v => v.trim());

  // Few non-empty cells (1-3) and text looks like a title
  if (nonEmpty.length <= 3 && nonEmpty.length > 0) {
    const main = nonEmpty[0];
    // All uppercase with more than 3 chars
    if (main.length > 3 && main === main.toUpperCase() && /[A-ZÀ-Ú]/.test(main)) return true;
    // Matches a known pattern
    if (BLOCK_PATTERNS.some(bp => bp.patterns.some(p => p.test(main)))) return true;
  }

  // Check for distribution/histogram titles
  if (/distribui[çc][ãa]o|histograma|quadro\s*de/i.test(text)) return true;
  if (/m[ãa]o\s*de\s*obra/i.test(text) && nonEmpty.length <= 5) return true;

  return false;
}

function buildBlock(
  rows: Array<{ rowIdx: number; values: string[]; text: string }>,
  startIdx: number,
  endIdx: number,
  matrix: string[][],
  range: XLSX.Range,
  allPeriods: Set<string>,
): DetectedBlock {
  const blockRows = rows.slice(startIdx, endIdx + 1);
  const titleRow = blockRows[0];
  const title = titleRow.values.filter(v => v.trim()).slice(0, 3).join(" ").trim() || `Bloco linha ${titleRow.rowIdx}`;

  // Analyze content
  let numericCount = 0;
  let currencyCount = 0;
  let periodCount = 0;
  const usedCols = new Set<number>();

  blockRows.forEach(row => {
    row.values.forEach((v, ci) => {
      if (!v.trim()) return;
      usedCols.add(ci);
      if (isNumeric(v)) numericCount++;
      if (isCurrency(v)) currencyCount++;
      if (isPeriod(v)) periodCount++;
    });
  });

  const columnCount = usedCols.size;
  const hasNumericData = numericCount > 2;
  const hasCurrencyData = currencyCount > 2;
  const hasPeriodColumns = periodCount > 3;

  // Classify block type
  const { type, confidence } = classifyBlock(title, blockRows, hasNumericData, hasCurrencyData, hasPeriodColumns);

  // Get sample rows (first 3 data rows after title)
  const sampleRows = blockRows.slice(1, 4).map(r =>
    r.values.filter(v => v.trim()).slice(0, 8)
  );

  // Detect column names from first data row or title row
  const columnsDetected = detectColumnNames(blockRows);

  return {
    id: generateId(),
    type,
    suggestedType: type,
    confidence,
    title,
    startRow: titleRow.rowIdx,
    endRow: blockRows[blockRows.length - 1].rowIdx,
    rowCount: blockRows.length,
    columnCount,
    columnsDetected,
    hasNumericData,
    hasPeriodColumns,
    hasCurrencyData,
    sampleRows,
    confirmed: confidence >= 80,
    ignored: false,
  };
}

function classifyBlock(
  title: string,
  rows: Array<{ values: string[]; text: string }>,
  hasNumeric: boolean,
  hasCurrency: boolean,
  hasPeriods: boolean,
): { type: BlockType; confidence: number } {
  let bestMatch: BlockType = "desconhecido";
  let bestScore = 0;

  // Score by title match
  for (const bp of BLOCK_PATTERNS) {
    for (const pattern of bp.patterns) {
      if (pattern.test(title)) {
        const score = 60 + bp.priority;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = bp.type;
        }
      }
    }
  }

  // Score by content analysis
  const allText = rows.map(r => r.text).join(" ").toLowerCase();

  // Check for labor keywords in content
  const laborHits = LABOR_KEYWORDS.filter(k => allText.includes(k)).length;
  if (laborHits >= 3 && hasPeriods) {
    const score = 50 + laborHits * 3;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = "histograma";
    }
  }
  if (laborHits >= 3 && !hasPeriods) {
    const score = 45 + laborHits * 2;
    if (score > bestScore || bestMatch === "desconhecido") {
      bestScore = Math.max(score, bestScore);
      bestMatch = bestMatch === "desconhecido" ? "mao_de_obra" : bestMatch;
    }
  }

  // Check for equipment
  const equipHits = EQUIP_KEYWORDS.filter(k => allText.includes(k)).length;
  if (equipHits >= 2 && bestMatch === "desconhecido") {
    bestScore = 40 + equipHits * 3;
    bestMatch = "equipamentos";
  }

  // Check for vehicles
  const vehicleHits = VEHICLE_KEYWORDS.filter(k => allText.includes(k.toLowerCase())).length;
  if (vehicleHits >= 2 && bestMatch === "desconhecido") {
    bestScore = 40 + vehicleHits * 3;
    bestMatch = "veiculos";
  }

  // Currency → custos
  if (hasCurrency && bestMatch === "desconhecido") {
    bestScore = 45;
    bestMatch = "custos";
  }

  // Periods without labor → cronograma
  if (hasPeriods && laborHits < 2 && bestMatch === "desconhecido") {
    bestScore = 40;
    bestMatch = "cronograma";
  }

  // If still unknown but has numeric data
  if (bestMatch === "desconhecido" && hasNumeric) {
    bestScore = 20;
    bestMatch = "desconhecido";
  }

  return {
    type: bestMatch,
    confidence: Math.min(bestScore, 100),
  };
}

function detectColumnNames(rows: Array<{ values: string[] }>): string[] {
  if (rows.length < 2) return [];

  // Try the first two rows as potential headers
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    const row = rows[i].values;
    const nonEmpty = row.filter(v => v.trim());
    const allText = nonEmpty.every(v => !isNumeric(v) || isPeriod(v));
    if (allText && nonEmpty.length >= 2) {
      return nonEmpty.slice(0, 12);
    }
  }

  return [];
}

// ─── Block Type Labels ────────────────────────────────────────────────────────

export const BLOCK_TYPE_OPTIONS: Array<{ value: BlockType; label: string; icon: string }> = [
  { value: "cronograma", label: "Cronograma", icon: "📅" },
  { value: "histograma", label: "Histograma", icon: "📊" },
  { value: "fases", label: "Fases", icon: "🔲" },
  { value: "tarefas", label: "Tarefas", icon: "✅" },
  { value: "recursos", label: "Recursos", icon: "👥" },
  { value: "mao_de_obra", label: "Mão de Obra", icon: "👷" },
  { value: "equipamentos", label: "Equipamentos", icon: "🔧" },
  { value: "veiculos", label: "Veículos", icon: "🚚" },
  { value: "materiais", label: "Materiais", icon: "📦" },
  { value: "custos", label: "Custos", icon: "💰" },
  { value: "resumo", label: "Resumo", icon: "📋" },
  { value: "totais", label: "Totais", icon: "➕" },
  { value: "desconhecido", label: "Não identificado", icon: "❓" },
];

export function getBlockTypeLabel(type: BlockType): string {
  return BLOCK_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
}

export function getBlockTypeIcon(type: BlockType): string {
  return BLOCK_TYPE_OPTIONS.find(o => o.value === type)?.icon || "❓";
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-500";
  if (confidence >= 50) return "text-yellow-500";
  return "text-red-500";
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return "Alta";
  if (confidence >= 50) return "Média";
  if (confidence >= 30) return "Baixa";
  return "Muito baixa";
}
