import * as XLSX from "xlsx";

export type Causa6M =
  | "Método"
  | "Máquina"
  | "Medida"
  | "Meio Ambiente"
  | "Mão de Obra"
  | "Material";

export interface AtividadeProgSemanal {
  id: string;
  area: string;
  descricao: string;
  efetivo: number;
  quantidade: { prev: number; real: number };
  unidade: string;
  dias: { prev: number[]; real: number[] };
  executada: boolean;
  observacao: string;
  causas6M: Causa6M[];
  planoAcao: string;
}

export type SemanaDoMes = 'S1' | 'S2' | 'S3' | 'S4';

export interface ProgramacaoSemanal {
  semana: number;
  semanaDoMes: SemanaDoMes; // S1..S4 within the calendar month
  mes: string;              // e.g. "dez/23" derived from periodo
  periodo: string;
  contrato: string;
  referencia: string;
  responsavel: string;
  equipe: string;
  engenheiro: string;
  atividades: AtividadeProgSemanal[];
  ppc: {
    prev: number[];          // daily planned units [seg..sab]
    real: number[];          // daily executed units
    aderencia: number[];     // daily adherence (real/prev, 0-1 or raw)
    totalPrevisto: number;   // sum of daily PREV
    totalRealizado: number;  // sum of daily REAL
    ppcSemana: number;       // totalRealizado/totalPrevisto * 100
    /** @deprecated use ppcSemana */
    totalAdherencia: number;
  };
  importadoEm: string; // ISO date
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

/** "18/12 a 22/12" → 'S3'; uses first day-of-month in the string */
export function identificarSemanaDoMes(periodo: string): SemanaDoMes {
  const m = periodo.match(/(\d+)/);
  if (!m) return 'S1';
  const dia = parseInt(m[1], 10);
  if (dia <= 7) return 'S1';
  if (dia <= 14) return 'S2';
  if (dia <= 21) return 'S3';
  return 'S4';
}

/** "18/12 a 22/12" + year → "dez/23" */
function extrairMes(periodo: string, year?: number): string {
  const m = periodo.match(/\d+\/(\d+)/);
  if (!m) return '';
  const month = parseInt(m[1], 10);
  const mon = MONTHS_PT[(month - 1) % 12] ?? String(month);
  if (year) return `${mon}/${String(year).slice(-2)}`;
  return mon;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function sixDays(row: unknown[], startCol: number): number[] {
  const result: number[] = [];
  for (let c = startCol; c < startCol + 6; c++) {
    result.push(toNum(row[c]));
  }
  return result;
}

// ---------------------------------------------------------------------------
// detect
// ---------------------------------------------------------------------------

export function isProgramacaoSemanal(workbook: XLSX.WorkBook): boolean {
  const sheetName = workbook.SheetNames.find(
    (n) => n.includes("MODELO 03") || n.includes("ENCARREGADO")
  );
  if (!sheetName) return false;
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });
  const firstCell = rows[0]?.[0];
  return (
    typeof firstCell === "string" &&
    firstCell.toUpperCase().includes("PROGRAMAÇÃO")
  );
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

export function parseProgramacaoSemanal(
  workbook: XLSX.WorkBook
): ProgramacaoSemanal | null {
  const sheetName = workbook.SheetNames.find(
    (n) => n.includes("MODELO 03") || n.includes("ENCARREGADO")
  );
  if (!sheetName) return null;

  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });

  if (!rows || rows.length < 7) return null;

  // --- Row 0: semana number ---
  const semanaRaw = toStr(rows[0]?.[0]);
  const semanaMatch = semanaRaw.match(/(\d+)/);
  const semana = semanaMatch ? parseInt(semanaMatch[1], 10) : 0;

  // --- Rows 1-3: header fields ---
  // Row 1: col2="CONTRATO:", col3=value; col13="RESPONSÁVEL:", col14=value
  // Row 2: col2="REFERÊNCIA:", col3=value; col13="EQUIPE:", col14=value
  // Row 3: col2="PERÍODO:", col3=value; col13="ENGENHEIRO/SUP:", col14=value

  const row1 = rows[1] ?? [];
  const row2 = rows[2] ?? [];
  const row3 = rows[3] ?? [];

  const contrato = toStr(row1[3]);
  const responsavel = toStr(row1[14]);
  const referencia = toStr(row2[3]);
  const equipe = toStr(row2[14]);
  const periodo = toStr(row3[3]);
  const engenheiro = toStr(row3[14]);

  // --- Data rows (6+) ---
  const atividades: AtividadeProgSemanal[] = [];
  let currentArea = "";

  const ppc = {
    prev: [0, 0, 0, 0, 0, 0],
    real: [0, 0, 0, 0, 0, 0],
    aderencia: [0, 0, 0, 0, 0, 0],
    totalPrevisto: 0,
    totalRealizado: 0,
    ppcSemana: 0,
    totalAdherencia: 0,
  };

  let i = 6;
  while (i < rows.length) {
    const row = rows[i] as unknown[];

    // PPC block detection — triggered by col[0] containing "PPC"
    // Structure: all markers (PREV / REAL / ADER %) live at col 12 (same column)
    const col0str = toStr(row[0]);
    if (col0str.toUpperCase().includes("PPC")) {
      // Row i: col[12] === "PREV" → daily prev values at cols 13-18
      if (toStr(row[12]).toUpperCase() === "PREV") {
        ppc.prev = sixDays(row, 13);
      }
      // Row i+1: col[12] === "REAL" → daily real values; col[19] = total adherence (0-1)
      if (i + 1 < rows.length) {
        const rowReal = rows[i + 1] as unknown[];
        if (toStr(rowReal[12]).toUpperCase() === "REAL") {
          ppc.real = sixDays(rowReal, 13);
          ppc.totalAdherencia = toNum(rowReal[19]); // e.g. 0.86
        }
      }
      // Row i+2: col[12] contains "ADER" → daily adherence values
      if (i + 2 < rows.length) {
        const rowAder = rows[i + 2] as unknown[];
        if (toStr(rowAder[12]).toUpperCase().includes("ADER")) {
          ppc.aderencia = sixDays(rowAder, 13);
        }
      }

      // Compute totals
      // prev/real arrays are in % units (e.g. [10,10,10,10,10,0])
      ppc.totalPrevisto = ppc.prev.reduce((s, v) => s + v, 0);
      ppc.totalRealizado = ppc.real.reduce((s, v) => s + v, 0);
      // ppcSemana = ratio realizado/previsto * 100; fallback to totalAdherencia*100
      ppc.ppcSemana =
        ppc.totalPrevisto > 0
          ? Math.round((ppc.totalRealizado / ppc.totalPrevisto) * 1000) / 10
          : Math.round(ppc.totalAdherencia * 1000) / 10;

      i += 3;
      continue;
    }

    // Area header: col1 starts with "ÁREA:"
    const col1str = toStr(row[1]);
    if (col1str.toUpperCase().startsWith("ÁREA:")) {
      currentArea = col1str.replace(/^ÁREA:\s*/i, "").trim();
      i++;
      continue;
    }

    // PREV row
    if (toStr(row[7]).toUpperCase() === "PREV") {
      const id = toStr(row[0]);
      const descricao = toStr(row[1]);
      const efetivo = toNum(row[2]);
      const qtdPrev = toNum(row[8]);
      const unidade = toStr(row[9]);
      const observacao = toStr(row[19]);
      const daysPrev = sixDays(row, 13);

      // REAL row immediately after
      let qtdReal = 0;
      let daysReal = [0, 0, 0, 0, 0, 0];
      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1] as unknown[];
        if (toStr(nextRow[7]).toUpperCase() === "REAL") {
          qtdReal = toNum(nextRow[8]);
          daysReal = sixDays(nextRow, 13);
          i++; // consume the REAL row
        }
      }

      const executada =
        qtdPrev === 0 && qtdReal === 0 ? true : qtdReal >= qtdPrev;

      atividades.push({
        id,
        area: currentArea,
        descricao,
        efetivo,
        quantidade: { prev: qtdPrev, real: qtdReal },
        unidade,
        dias: { prev: daysPrev, real: daysReal },
        executada,
        observacao,
        causas6M: [],
        planoAcao: "",
      });

      i++;
      continue;
    }

    i++;
  }

  // Derive semanaDoMes and mes from periodo + first activity date
  const semanaDoMes = identificarSemanaDoMes(periodo);
  let year: number | undefined;
  for (const at of atividades) {
    // inicio format is "2023-12-18" (ISO)
    const m = String(at.observacao || '').match(/(\d{4})/);
    if (m) { year = parseInt(m[1], 10); break; }
  }
  // Fallback: try to find year from row[11] of any PREV row (inicio date column)
  if (!year) {
    for (let r = 6; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      if (toStr(row[7]).toUpperCase() === 'PREV') {
        const raw = toStr(row[11]);
        const ym = raw.match(/(\d{4})/);
        if (ym) { year = parseInt(ym[1], 10); break; }
      }
    }
  }
  const mes = extrairMes(periodo, year);

  return {
    semana,
    semanaDoMes,
    mes,
    periodo,
    contrato,
    referencia,
    responsavel,
    equipe,
    engenheiro,
    atividades,
    ppc,
    importadoEm: new Date().toISOString(),
  };
}
