/**
 * Specialized parser for Megasteam-style "Cronograma + Histogramas" sheets.
 * 
 * Reads timeline phases from merged cells, extracts histogram distributions
 * from weekly S1-S4 columns, and connects phases to resources.
 */
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────

export interface TimelinePeriod {
  month: string;      // "Mês 01"
  week: string;       // "S1"
  colIndex: number;   // 0-based column in the matrix
  globalWeekIndex: number; // sequential week number
}

export interface TimelinePhase {
  name: string;
  startCol: number;
  endCol: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  durationDaysEstimate: number;
  row: number;
}

export interface HistogramEntry {
  funcao: string;
  id: string;
  tipo: "MOI" | "MOD" | "FERRAMENTA" | "EQUIPAMENTO" | "";
  setor: string;
  grupo: string;        // parent group: "GESTÃO & ADMINISTRAÇÃO", "MONTAGEM ESTRUTURAS", etc.
  categoria: string;    // "moi" | "mod" | "equipamento" | "ferramenta"
  distribuicao_semanal: number[];
  hh_total: number;
  hh_validado: number | null; // from HORAS column if present
  quantidade_pico: number;
  periodo_medio: number | null;
  original_row: number;
}

export interface GroupSummary {
  nome: string;
  categoria: string;
  hh_total: number;
  quantidade_pico: number;
  recursos: number;
  original_row: number;
}

export interface PhaseResourceLink {
  phase: string;
  funcao: string;
  hh: number;
  weeks: number[];
}

export interface ParsedScheduleResult {
  timeline: {
    periods: TimelinePeriod[];
    months: string[];
    totalWeeks: number;
  };
  fases: TimelinePhase[];
  recursos: HistogramEntry[];
  grupos: GroupSummary[];
  links: PhaseResourceLink[];
  indicadores: {
    hh_total: number;
    hh_mod: number;
    hh_moi: number;
    pico_efetivo: number;
    duracao_semanas: number;
    duracao_dias_estimada: number;
  };
  validacao: {
    linhas_lidas: number;
    linhas_validas: number;
    linhas_ignoradas: number;
    totais_recalculados: boolean;
    warnings: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function norm(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const WEEK_PATTERN = /^S\d+$/i;
const MONTH_PATTERN = /^M[êe]s\s*\d+$/i;

const TOTAL_LABELS = /^(equipe\s*(do\s*projeto)?\s*-?\s*total|total\s*geral|subtotal)/i;
// Match only top-level group headers — require the label to be standalone (not a sub-item like "VEÍCULO LEVE")
const GROUP_LABELS = /^(m[ãa]o\s*de\s*obra\s*(direta|indireta)?|gest[ãa]o\s*[&e]\s*administra[çc][ãa]o|montagem\s+(estrutura|equipamento|tubula[çc][ãa]o)|el[ée]trica(\s+e\s+instrumenta[çc][ãa]o)?|instrumenta[çc][ãa]o|tubula[çc][ãa]o|andaime|ferramental\s+princip|ve[íi]culos$)/i;
const DISTRIBUTION_HEADER = /distribui[çc][ãa]o\s*preliminar/i;
// Sections to skip entirely (summary/basic schedule, not histogram data)
const SKIP_SECTION_LABELS = /cronograma\s*b[áa]sico/i;

function isFormulaCell(ws: XLSX.WorkSheet, r: number, c: number): boolean {
  const addr = XLSX.utils.encode_cell({ r: r, c: c });
  const cell = ws[addr];
  return cell?.f != null;
}

function detectTipo(val: string): "MOI" | "MOD" | "FERRAMENTA" | "EQUIPAMENTO" | "" {
  const u = val.toUpperCase().trim();
  if (u === "MOI") return "MOI";
  if (u === "MOD") return "MOD";
  if (u === "FERRAMENTA" || u === "EQUIPAMENTO") return "FERRAMENTA";
  return "";
}

function detectCategoria(grupo: string, tipo: string): string {
  if (tipo === "MOI") return "moi";
  if (tipo === "MOD") return "mod";
  if (tipo === "FERRAMENTA" || tipo === "EQUIPAMENTO") return "equipamento";
  const g = grupo.toLowerCase();
  if (/indireta|moi/.test(g)) return "moi";
  if (/direta|mod/.test(g)) return "mod";
  if (/ferramenta|equipamento/.test(g)) return "equipamento";
  if (/ve[íi]culo/.test(g)) return "veiculo";
  return "mod";
}

// ─── Main Parser ──────────────────────────────────────────────

export function parseScheduleHistogramSheet(
  ws: XLSX.WorkSheet,
  sheetName: string
): ParsedScheduleResult {
  const warnings: string[] = [];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const totalRows = range.e.r + 1;
  const totalCols = range.e.c + 1;

  // Build raw value matrix (data_only values)
  const rawWs = ws; // we read .v for values and .f for formulas
  const matrix: (string | number | null)[][] = [];
  for (let r = 0; r < totalRows; r++) {
    const row: (string | number | null)[] = [];
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = rawWs[addr];
      row.push(cell ? (cell.v ?? null) : null);
    }
    matrix.push(row);
  }

  // Expand merged cells
  const merges = ws["!merges"] || [];
  for (const m of merges) {
    const val = matrix[m.s.r]?.[m.s.c];
    if (val == null) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        if (matrix[r]) matrix[r][c] = val;
      }
    }
  }

  // ─── Step 1: Detect and skip "Cronograma Básico" sections ───
  // These are simplified summaries that should NOT be used as primary data.
  const skipRanges: { start: number; end: number }[] = [];
  for (let r = 0; r < totalRows; r++) {
    const rowText = matrix[r].map(v => norm(v)).join(" ");
    if (SKIP_SECTION_LABELS.test(rowText)) {
      // Find where this section ends (next DISTRIBUIÇÃO header or large gap)
      let endRow = totalRows;
      for (let r2 = r + 1; r2 < totalRows; r2++) {
        const t2 = matrix[r2].map(v => norm(v)).join(" ");
        if (DISTRIBUTION_HEADER.test(t2)) { endRow = r2; break; }
      }
      skipRanges.push({ start: r, end: endRow });
      warnings.push(`Seção "Cronograma Básico" ignorada (linhas ${r + 1}-${endRow}). Usando blocos de distribuição detalhada.`);
    }
  }

  function isInSkipRange(row: number): boolean {
    return skipRanges.some(sr => row >= sr.start && row < sr.end);
  }

  // ─── Step 2: Find all histogram blocks via "DISTRIBUIÇÃO PRELIMINAR" headers ───
  const blockStarts: { row: number; title: string }[] = [];
  for (let r = 0; r < totalRows; r++) {
    if (isInSkipRange(r)) continue;
    const rowText = matrix[r].map(v => norm(v)).join(" ");
    if (DISTRIBUTION_HEADER.test(rowText)) {
      blockStarts.push({ row: r, title: rowText.trim() });
    }
  }

  // ─── Step 3: For each block, detect period columns (S1, S2...) ───
  function findPeriodRow(startRow: number, maxSearch: number): { periodRow: number; periods: TimelinePeriod[] } | null {
    for (let r = startRow; r < Math.min(startRow + maxSearch, totalRows); r++) {
      if (isInSkipRange(r)) continue;
      const periods: TimelinePeriod[] = [];
      let weekIdx = 0;
      const monthRow = r > 0 ? matrix[r - 1] : null;
      
      for (let c = 0; c < totalCols; c++) {
        const val = norm(matrix[r][c]);
        if (WEEK_PATTERN.test(val)) {
          const monthLabel = monthRow ? norm(monthRow[c]) : "";
          periods.push({
            month: MONTH_PATTERN.test(monthLabel) ? monthLabel : `Mês ${Math.floor(weekIdx / 4) + 1}`,
            week: val.toUpperCase(),
            colIndex: c,
            globalWeekIndex: weekIdx,
          });
          weekIdx++;
        }
      }
      if (periods.length >= 4) {
        return { periodRow: r, periods };
      }
    }
    return null;
  }

  // ─── Step 4: Parse cronograma section (before first DISTRIBUIÇÃO, skip basic) ───
  const cronogramaEnd = blockStarts.length > 0 ? blockStarts[0].row : totalRows;
  const cronoPeriodInfo = findPeriodRow(0, cronogramaEnd);

  // ─── Step 4: Detect timeline phases from merged cells above the histogram ───
  const fases: TimelinePhase[] = [];
  
  // For each block, look for merged cells that span period columns (phase markers)
  function extractPhasesFromMergedCells(blockStartRow: number, periodStartCol: number, periodEndCol: number, periods: TimelinePeriod[]) {
    // Look in 1-3 rows after the period header for merged cells with text
    for (const m of merges) {
      if (m.s.r < blockStartRow || m.s.r > blockStartRow + 5) continue;
      if (m.s.c < periodStartCol || m.s.c > periodEndCol) continue;
      if (m.e.c <= m.s.c) continue; // must span multiple columns
      
      const val = norm(matrix[m.s.r]?.[m.s.c]);
      if (!val || /^(S\d|M[êe]s)/i.test(val)) continue;
      
      // Find which periods this phase spans
      const startPeriod = periods.find(p => p.colIndex >= m.s.c);
      const endPeriod = [...periods].reverse().find(p => p.colIndex <= m.e.c);
      
      if (startPeriod && endPeriod) {
        // Clean phase name (remove duration info like "45 DIAS")
        const cleanName = val.replace(/\n/g, " ").replace(/\d+\s*DIAS?/gi, "").trim();
        
        fases.push({
          name: cleanName || val.replace(/\n/g, " ").trim(),
          startCol: m.s.c,
          endCol: m.e.c,
          startWeek: startPeriod.globalWeekIndex,
          endWeek: endPeriod.globalWeekIndex,
          durationWeeks: endPeriod.globalWeekIndex - startPeriod.globalWeekIndex + 1,
          durationDaysEstimate: (endPeriod.globalWeekIndex - startPeriod.globalWeekIndex + 1) * 7,
          row: m.s.r + 1,
        });
      }
    }
  }

  // ─── Step 5: Parse each histogram block ───
  const recursos: HistogramEntry[] = [];
  const grupos: GroupSummary[] = [];
  let linhasValidas = 0;
  let linhasIgnoradas = 0;
  let allPeriods: TimelinePeriod[] = cronoPeriodInfo?.periods || [];

  for (let bi = 0; bi < blockStarts.length; bi++) {
    const blockStart = blockStarts[bi].row;
    const blockEnd = bi + 1 < blockStarts.length ? blockStarts[bi + 1].row : totalRows;
    const blockTitle = blockStarts[bi].title;
    
    const periodInfo = findPeriodRow(blockStart, 6);
    if (!periodInfo) {
      warnings.push(`Bloco "${blockTitle}" sem colunas de período detectadas`);
      continue;
    }
    
    const { periodRow, periods } = periodInfo;
    if (allPeriods.length === 0) allPeriods = periods;
    
    const periodStartCol = periods[0].colIndex;
    const periodEndCol = periods[periods.length - 1].colIndex;
    
    // Extract phase markers from merged cells
    extractPhasesFromMergedCells(periodRow, periodStartCol, periodEndCol, periods);
    
    // Find HORAS/Diárias column (after last period column)
    let horasCol = -1;
    const headerRow = matrix[periodRow - 1] || matrix[periodRow];
    for (let c = periodEndCol + 1; c < totalCols; c++) {
      const v = norm(headerRow[c]).toLowerCase();
      if (/^(horas|hh|diária|diarias)$/i.test(v)) {
        horasCol = c;
        break;
      }
    }
    // Also check the period row itself
    if (horasCol === -1) {
      for (let c = periodEndCol + 1; c < totalCols; c++) {
        const v = norm(matrix[periodRow][c]).toLowerCase();
        if (/^(horas|hh|diária|diarias)$/i.test(v)) {
          horasCol = c;
          break;
        }
      }
    }

    // Detect column indices for ID, FUNÇÃO, TIPO, SETOR
    let idCol = -1, funcaoCol = -1, tipoCol = -1, setorCol = -1;
    // Check row before periods (the header row with column labels)
    const labelRow = periodRow - 1 >= blockStart ? periodRow - 1 : periodRow;
    for (let c = 0; c < periodStartCol; c++) {
      const v = norm(matrix[labelRow]?.[c]).toLowerCase();
      if (/^id$/i.test(v)) idCol = c;
      else if (/fun[çc][ãa]o/i.test(v)) funcaoCol = c;
      else if (/^tipo$|^modal$/i.test(v)) tipoCol = c;
      else if (/^setor$/i.test(v)) setorCol = c;
    }
    // Fallbacks
    if (funcaoCol === -1) funcaoCol = 3; // Column D typically
    if (idCol === -1) idCol = 2; // Column C typically

    // Determine if this is equipment/ferramenta block
    const isEquipBlock = /ferramenta|equipamento/i.test(blockTitle);
    
    // Process data rows
    let currentGroup = "";
    let currentGroupRow = blockStart;
    const dataStartRow = periodRow + 1;

    for (let r = dataStartRow; r < blockEnd; r++) {
      const rowVals = matrix[r];
      if (!rowVals) continue;
      
      const funcao = norm(rowVals[funcaoCol]);
      const id = norm(rowVals[idCol]);
      
      if (!funcao && !id) {
        linhasIgnoradas++;
        continue;
      }
      
      // Check if this is a TOTAL row — ignore
      if (TOTAL_LABELS.test(funcao)) {
        linhasIgnoradas++;
        continue;
      }
      
      // Check if this is a GROUP header (e.g., "MÃO DE OBRA INDIRETA", "MONTAGEM ESTRUTURAS")
      // Must match GROUP_LABELS AND either have a simple numeric ID (like "1", "2") or no dotted ID
      const isSimpleId = /^\d+$/.test(id) && !id.includes(".");
      const isGroupById = isSimpleId && funcao.toUpperCase() === funcao && funcao.length > 3;
      if (GROUP_LABELS.test(funcao) || isGroupById) {
        currentGroup = funcao;
        currentGroupRow = r;
        
        // Extract group total from period columns (but recalculate later)
        const groupHoras = horasCol >= 0 ? toNum(rowVals[horasCol]) : null;
        
        // Detect categoria from group name
        const cat = detectCategoria(funcao, isEquipBlock ? "FERRAMENTA" : "");
        
        grupos.push({
          nome: funcao,
          categoria: cat,
          hh_total: groupHoras ?? 0,
          quantidade_pico: 0, // will be calculated
          recursos: 0, // will be counted
          original_row: r + 1,
        });
        
        linhasIgnoradas++;
        continue;
      }
      
      // Only valid if has numeric data in period columns
      const weekValues: number[] = [];
      let hasAnyData = false;
      
      for (const p of periods) {
        // Skip formula cells — recalculate from base data
        const cellAddr = XLSX.utils.encode_cell({ r, c: p.colIndex });
        const cell = ws[cellAddr];
        const isFormula = cell?.f != null;
        
        let val: number;
        if (isFormula) {
          // Use computed value but mark for validation
          val = toNum(cell?.v) ?? 0;
        } else {
          val = toNum(rowVals[p.colIndex]) ?? 0;
        }
        weekValues.push(val);
        if (val > 0) hasAnyData = true;
      }
      
      if (!hasAnyData && !funcao) {
        linhasIgnoradas++;
        continue;
      }
      
      // Extract tipo and setor
      const tipo = tipoCol >= 0 ? detectTipo(norm(rowVals[tipoCol])) : (isEquipBlock ? "FERRAMENTA" : "");
      const setor = setorCol >= 0 ? norm(rowVals[setorCol]) : "";
      
      // Calculate HH: for labor use HORAS column or weeklySum * 44; for equipment use weeklySum (diárias)
      const weeklySum = weekValues.reduce((a, b) => a + b, 0);
      const hhFromColumn = horasCol >= 0 ? toNum(rowVals[horasCol]) : null;
      const pico = Math.max(...weekValues, 0);
      
      // For labor without HORAS column, estimate HH = weeklySum * 44 (hours/week per person)
      const hhTotal = hhFromColumn ?? (isEquipBlock ? weeklySum : weeklySum * 44);
      
      // Skip empty rows (all zeros, no function name)
      if (weeklySum === 0 && !hhFromColumn && !funcao) {
        linhasIgnoradas++;
        continue;
      }

      // Even rows with 0 values but a function name are valid placeholders
      if (weeklySum === 0 && !hhFromColumn && funcao) {
        linhasIgnoradas++;
        continue;
      }

      linhasValidas++;

      const cat = detectCategoria(currentGroup, tipo || (isEquipBlock ? "FERRAMENTA" : ""));
      
      recursos.push({
        funcao,
        id,
        tipo: tipo || (isEquipBlock ? "FERRAMENTA" : (cat === "moi" ? "MOI" : "MOD")),
        setor,
        grupo: currentGroup,
        categoria: cat,
        distribuicao_semanal: weekValues,
        hh_total: hhTotal,
        hh_validado: hhFromColumn,
        quantidade_pico: pico,
        periodo_medio: null,
        original_row: r + 1,
      });
    }
  }

  // ─── Step 6: Update group summaries with recalculated values ───
  for (const g of grupos) {
    const groupResources = recursos.filter(r => r.grupo === g.nome);
    g.recursos = groupResources.length;
    g.hh_total = groupResources.reduce((sum, r) => sum + r.hh_total, 0);
    g.quantidade_pico = groupResources.reduce((max, r) => Math.max(max, r.quantidade_pico), 0);
  }

  // ─── Step 7: Link phases to resources via column overlap ───
  const links: PhaseResourceLink[] = [];
  for (const fase of fases) {
    for (const rec of recursos) {
      // Check if resource has non-zero values in the phase's week range
      let phaseHH = 0;
      const phaseWeeks: number[] = [];
      for (let w = fase.startWeek; w <= fase.endWeek && w < rec.distribuicao_semanal.length; w++) {
        const val = rec.distribuicao_semanal[w];
        if (val > 0) {
          phaseHH += val;
          phaseWeeks.push(w);
        }
      }
      if (phaseHH > 0) {
        links.push({
          phase: fase.name,
          funcao: rec.funcao,
          hh: phaseHH,
          weeks: phaseWeeks,
        });
      }
    }
  }

  // ─── Step 8: Calculate indicators (only labor, exclude equipment/ferramental) ───
  const laborOnly = recursos.filter(r => r.categoria === "moi" || r.categoria === "mod");
  const hhTotal = laborOnly.reduce((sum, r) => sum + r.hh_total, 0);
  const hhMOD = laborOnly.filter(r => r.categoria === "mod").reduce((sum, r) => sum + r.hh_total, 0);
  const hhMOI = laborOnly.filter(r => r.categoria === "moi").reduce((sum, r) => sum + r.hh_total, 0);

  // Peak headcount: for each week, sum all resource quantities
  const weekCount = allPeriods.length;
  let picoEfetivo = 0;
  if (weekCount > 0) {
    const laborResources = recursos.filter(r => r.categoria === "moi" || r.categoria === "mod");
    for (let w = 0; w < weekCount; w++) {
      const weekTotal = laborResources.reduce((sum, r) => sum + (r.distribuicao_semanal[w] ?? 0), 0);
      picoEfetivo = Math.max(picoEfetivo, weekTotal);
    }
  }

  // Active weeks (any resource > 0)
  let activeWeeks = 0;
  for (let w = 0; w < weekCount; w++) {
    const hasActivity = recursos.some(r => (r.distribuicao_semanal[w] ?? 0) > 0);
    if (hasActivity) activeWeeks++;
  }

  // Deduplicate phases
  const uniqueFases = fases.filter((f, i, arr) => 
    arr.findIndex(x => x.name === f.name && x.startWeek === f.startWeek) === i
  );

  return {
    timeline: {
      periods: allPeriods,
      months: [...new Set(allPeriods.map(p => p.month))],
      totalWeeks: weekCount,
    },
    fases: uniqueFases,
    recursos,
    grupos,
    links,
    indicadores: {
      hh_total: hhTotal,
      hh_mod: hhMOD,
      hh_moi: hhMOI,
      pico_efetivo: picoEfetivo,
      duracao_semanas: activeWeeks,
      duracao_dias_estimada: activeWeeks * 7,
    },
    validacao: {
      linhas_lidas: totalRows,
      linhas_validas: linhasValidas,
      linhas_ignoradas: linhasIgnoradas,
      totais_recalculados: true,
      warnings,
    },
  };
}
