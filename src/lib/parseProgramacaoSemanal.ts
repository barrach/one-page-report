import * as XLSX from "xlsx";

/**
 * Parser do "Template - Programação Semanal" (layout oficial).
 *
 * Aba "Programação Semanal":
 *   - linha 2  → título
 *   - linha 4  → Obra | <texto> | Período | <semana> | Atualização | <data>
 *   - linhas 6..9 → cabeçalho da tabela (Item, ID Cronograma, OS atividade, Semana,
 *     Atividade Detalhada, Local, Empresa, Responsável, Encarregado, Quantidade
 *     Prevista, Und., (P)rev./(R)eal, os 6 dias da semana, Total Sem., Aderência,
 *     Comentários) e o bloco de análise (PPC Frente da Obra, OK? (S/N),
 *     Descrição da Causa, Observações)
 *   - linhas 11+ → as atividades, em PARES: a linha "P" (previsto) e a "R" (realizado).
 *     Os campos descritivos são mesclados no par, então só existem na linha "P".
 *
 * A aba "Calendário" mapeia número da semana → datas de início/fim e traz o contrato.
 *
 * As posições são descobertas pelos rótulos e pelos próprios dados (nunca fixas),
 * para o parser não quebrar quando alguém insere uma coluna no meio.
 */

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
  /** 1 = programado/realizado no dia, 0 = não. Seis posições (2ª … sábado). */
  dias: { prev: number[]; real: number[] };
  /**
   * Aderência da atividade (0–1) = realizado ÷ previsto, a mesma conta da coluna
   * "Aderência" do template (`IFERROR(W12/W11;"")`).
   */
  aderencia?: number;
  /** Segue o "OK? (S/N)" do template, que corta em 90% de aderência. */
  executada: boolean;
  observacao: string;
  causas6M: Causa6M[];
  planoAcao: string;
  /** Coluna "Descrição da Causa" (lista codificada, ex. "13 - Solicitação de modificações"). */
  descricaoCausa?: string;
  // ─── Colunas extra do template oficial ───
  idCronograma?: string;
  os?: string;
  local?: string;
  empresa?: string;
  responsavel?: string;
  encarregado?: string;
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
  /** Datas dos 6 dias da semana (ISO), na ordem das colunas Q…V. */
  dias?: string[];
  ppc: {
    prev: number[];          // daily planned units [seg..sab]
    real: number[];          // daily executed units
    aderencia: number[];     // daily adherence (real/prev, 0-1 or raw)
    totalPrevisto: number;   // sum of daily PREV
    totalRealizado: number;  // sum of daily REAL
    /**
     * PPC da semana (0–100) = MÉDIA das aderências das atividades, igual à
     * célula "Aderência" mesclada em X7:X8 do template (`AVERAGE(X11:X54)`).
     * Não é a razão dos totais: uma atividade pesa igual à outra.
     */
    ppcSemana: number;
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

/** Número da célula, ou undefined quando vazia/fórmula sem valor. */
function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Rótulo normalizado: sem acento, minúsculo, espaços colapsados. */
const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && v > 1000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const ddmm = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

type Grid = unknown[][];

const gridOf = (ws: XLSX.WorkSheet): Grid =>
  XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: true });

interface HeaderInfo { row: number; colOf: Record<string, number> }

/**
 * Linha de cabeçalho = a que tem "Item" e "Atividade Detalhada".
 *
 * Os rótulos NÃO ficam todos nessa linha: no template o cabeçalho ocupa uma faixa
 * (linhas 6 a 9), com "Total Sem." e o bloco de análise ("OK? (S/N)", "Descrição da
 * Causa") mais abaixo. Por isso o mapa de colunas é montado varrendo a faixa toda.
 */
const HEADER_BAND = 4;

function findHeaderRow(grid: Grid): HeaderInfo | null {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const cells = (grid[r] || []).map(norm);
    if (!cells.some((h) => h === 'item')) continue;
    if (!cells.some((h) => h.includes('atividade detalhada'))) continue;

    const colOf: Record<string, number> = {};
    for (let k = r; k < Math.min(grid.length, r + HEADER_BAND); k++) {
      (grid[k] || []).map(norm).forEach((h, c) => {
        if (h && colOf[h] === undefined) colOf[h] = c;
      });
    }
    return { row: r, colOf };
  }
  return null;
}

/** A aba de programação: pelo nome ou, na falta dele, pelo cabeçalho da tabela. */
const findSheet = (wb: XLSX.WorkBook): string | null => {
  const byName = wb.SheetNames.find((n) => norm(n).includes('programacao semanal'));
  if (byName) return byName;
  for (const n of wb.SheetNames) {
    if (findHeaderRow(gridOf(wb.Sheets[n]))) return n;
  }
  return null;
};

/** Colunas dos 6 dias: a linha do cabeçalho (ou logo abaixo) com 4+ datas. */
function findDayCols(grid: Grid, headerRow: number): { cols: number[]; dates: Date[] } {
  for (let r = headerRow; r < Math.min(grid.length, headerRow + 5); r++) {
    const row = grid[r] || [];
    const found: { c: number; d: Date }[] = [];
    for (let c = 0; c < row.length; c++) {
      const d = toDate(row[c]);
      if (d && d.getFullYear() > 1990) found.push({ c, d });
    }
    if (found.length >= 4) {
      const slice = found.slice(0, 6);
      return { cols: slice.map((f) => f.c), dates: slice.map((f) => f.d) };
    }
  }
  return { cols: [], dates: [] };
}

/**
 * Coluna do marcador (P)rev./(R)eal: aquela em que uma linha tem "P" e a
 * seguinte tem "R". Vem dos dados, não do rótulo — que é mesclado e tem
 * quebra de linha.
 */
function findMarkerCol(grid: Grid, startRow: number): number {
  const counts = new Map<number, number>();
  for (let r = startRow; r < grid.length - 1; r++) {
    const row = grid[r] || [];
    const next = grid[r + 1] || [];
    for (let c = 0; c < row.length; c++) {
      if (norm(row[c]) === 'p' && norm(next[c]) === 'r') {
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
  }
  let best = -1;
  let bestN = 0;
  for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
  return best;
}

/** Primeiro valor à direita de um rótulo, na mesma linha. */
function valorAoLadoDe(grid: Grid, label: string, limitRow = 8): unknown {
  const target = norm(label);
  for (let r = 0; r < Math.min(grid.length, limitRow); r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (norm(row[c]) === target) {
        for (let k = c + 1; k < row.length; k++) {
          if (row[k] !== null && row[k] !== '') return row[k];
        }
      }
    }
  }
  return null;
}

/** Aba "Calendário": semana → datas, e o número do contrato. */
function lerCalendario(wb: XLSX.WorkBook): {
  semanas: Map<number, { inicio: Date; fim: Date }>;
  contrato: string;
} {
  const semanas = new Map<number, { inicio: Date; fim: Date }>();
  let contrato = '';
  const name = wb.SheetNames.find((n) => norm(n).includes('calendario'));
  if (!name) return { semanas, contrato };

  const grid = gridOf(wb.Sheets[name]);
  const c = valorAoLadoDe(grid, 'contrato:', 5);
  if (c != null) contrato = toStr(c);

  for (const row of grid) {
    if (!row) continue;
    // Procura o trio INÍCIO | FIM | SEMANA, que pode estar deslocado.
    for (let i = 0; i < row.length - 2; i++) {
      const ini = toDate(row[i]);
      const fim = toDate(row[i + 1]);
      const sem = row[i + 2];
      if (ini && fim && typeof sem === 'number' && sem > 0 && Number.isInteger(sem)) {
        if (!semanas.has(sem)) semanas.set(sem, { inicio: ini, fim });
        break;
      }
    }
  }
  return { semanas, contrato };
}

// ---------------------------------------------------------------------------
// detect
// ---------------------------------------------------------------------------

export function isProgramacaoSemanal(workbook: XLSX.WorkBook): boolean {
  const sheetName = findSheet(workbook);
  if (!sheetName) return false;
  const grid = gridOf(workbook.Sheets[sheetName]);
  const header = findHeaderRow(grid);
  if (!header) return false;
  // Os pares P/R são o que confirma que é a planilha de programação.
  return findMarkerCol(grid, header.row) >= 0;
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

export function parseProgramacaoSemanal(
  workbook: XLSX.WorkBook
): ProgramacaoSemanal | null {
  const sheetName = findSheet(workbook);
  if (!sheetName) return null;

  const grid = gridOf(workbook.Sheets[sheetName]);
  const header = findHeaderRow(grid);
  if (!header) return null;

  const { row: hr, colOf } = header;
  const exato = (label: string) => colOf[norm(label)];
  const contendo = (needle: string) =>
    Object.entries(colOf).find(([k]) => k.includes(needle))?.[1];

  const markerCol = findMarkerCol(grid, hr);
  if (markerCol < 0) return null;

  const { cols: dayCols, dates: dayDates } = findDayCols(grid, hr);
  const qtyCol = markerCol + 1;

  const cItem = exato('item');
  const cIdCron = exato('id cronograma');
  const cOs = exato('os atividade');
  const cDesc = contendo('atividade detalhada');
  const cLocal = exato('local');
  const cEmpresa = exato('empresa');
  const cResp = exato('responsavel');
  const cEncarregado = exato('encarregado');
  const cQtdPrev = contendo('quantidade prevista');
  const cUnd = exato('und.') ?? exato('und') ?? exato('unidade');
  const cTotal = contendo('total sem');
  const cComent = contendo('comentario');
  const cOk = contendo('ok?');
  const cCausa = contendo('descricao da causa');
  const cAderencia = exato('aderencia');

  const at = (row: unknown[], c: number | undefined) =>
    c === undefined || c < 0 ? null : row[c] ?? null;

  const dias = (row: unknown[]) =>
    dayCols.length === 6 ? dayCols.map((c) => toNum(row[c])) : [0, 0, 0, 0, 0, 0];

  // ── Cabeçalho do documento ──
  const obra = toStr(valorAoLadoDe(grid, 'obra', hr));
  const periodoRaw = valorAoLadoDe(grid, 'periodo', hr);
  const { semanas: calendario, contrato: contratoCalendario } = lerCalendario(workbook);

  // "Período" pode vir como número da semana (ex.: 23) ou como texto "20/02 a 25/02".
  let semana = 0;
  let periodo = '';
  const periodoNum = typeof periodoRaw === 'number' ? periodoRaw : NaN;
  if (Number.isFinite(periodoNum) && periodoNum > 0) {
    semana = Math.round(periodoNum);
    const cal = calendario.get(semana);
    if (cal) periodo = `${ddmm(cal.inicio)} a ${ddmm(cal.fim)}`;
  } else {
    periodo = toStr(periodoRaw);
    const m = periodo.match(/^\s*(\d+)\s*$/);
    if (m) semana = parseInt(m[1], 10);
  }

  // As datas dos 6 dias são a fonte mais confiável do período.
  if (dayDates.length) {
    periodo = `${ddmm(dayDates[0])} a ${ddmm(dayDates[dayDates.length - 1])}`;
    if (!semana) {
      for (const [n, { inicio, fim }] of calendario) {
        if (dayDates[0] >= inicio && dayDates[0] <= fim) { semana = n; break; }
      }
    }
  }

  // ── Atividades (pares P/R) ──
  const atividades: AtividadeProgSemanal[] = [];
  for (let r = hr + 1; r < grid.length; r++) {
    const row = (grid[r] || []) as unknown[];
    if (norm(row[markerCol]) !== 'p') continue;

    const next = (grid[r + 1] || []) as unknown[];
    const temReal = norm(next[markerCol]) === 'r';

    const item = toStr(at(row, cItem));
    const idCron = toStr(at(row, cIdCron));
    const descricao = toStr(at(row, cDesc));
    if (!item && !idCron && !descricao) continue;

    const diasPrev = dias(row);
    const diasReal = temReal ? dias(next) : [0, 0, 0, 0, 0, 0];

    // Quantidade: coluna ao lado do marcador; se vazia, cai no "Total Sem." e,
    // por último, na "Quantidade Prevista".
    const qtdPrev = toNum(at(row, qtyCol)) || toNum(at(row, cTotal)) || toNum(at(row, cQtdPrev));
    const qtdReal = temReal ? (toNum(at(next, qtyCol)) || toNum(at(next, cTotal))) : 0;

    // Aderência = realizado ÷ previsto sobre os dias 1/0 — a conta da coluna X.
    // É calculada aqui, e não lida da planilha, porque a célula guarda fórmula e o
    // valor em cache pode vir vazio.
    const somaPrev = diasPrev.reduce((acc, v) => acc + v, 0);
    const somaReal = diasReal.reduce((acc, v) => acc + v, 0);
    const aderenciaCalc = somaPrev > 0 ? somaReal / somaPrev : undefined;
    const aderenciaCelula = numOrUndef(at(row, cAderencia)) ?? numOrUndef(temReal ? at(next, cAderencia) : null);
    const aderencia = aderenciaCalc ?? aderenciaCelula;

    // "OK? (S/N)" manda quando preenchido; senão o corte é o do template: 90%.
    const okRaw = norm(at(row, cOk)) || (temReal ? norm(at(next, cOk)) : '');
    const executada = okRaw.startsWith('s')
      ? true
      : okRaw.startsWith('n')
        ? false
        : aderencia != null
          ? aderencia >= 0.9
          : somaPrev === 0 && somaReal === 0;

    atividades.push({
      id: idCron || item || String(atividades.length + 1),
      area: toStr(at(row, cLocal)),
      descricao,
      efetivo: 0,
      quantidade: { prev: qtdPrev, real: qtdReal },
      unidade: toStr(at(row, cUnd)),
      dias: { prev: diasPrev, real: diasReal },
      aderencia,
      executada,
      observacao: toStr(at(row, cComent)),
      causas6M: [],
      planoAcao: "",
      descricaoCausa: toStr(at(row, cCausa)) || undefined,
      idCronograma: idCron || undefined,
      os: toStr(at(row, cOs)) || undefined,
      local: toStr(at(row, cLocal)) || undefined,
      empresa: toStr(at(row, cEmpresa)) || undefined,
      responsavel: toStr(at(row, cResp)) || undefined,
      encarregado: toStr(at(row, cEncarregado)) || undefined,
    });

    if (temReal) r++; // consome a linha "R"
  }

  // ── PPC: somatório diário das atividades ──
  const prev = [0, 0, 0, 0, 0, 0];
  const real = [0, 0, 0, 0, 0, 0];
  for (const a of atividades) {
    for (let d = 0; d < 6; d++) {
      prev[d] += a.dias.prev[d] || 0;
      real[d] += a.dias.real[d] || 0;
    }
  }
  const aderencia = prev.map((p, d) => (p > 0 ? Math.round((real[d] / p) * 100) / 100 : 0));
  const totalPrevisto = prev.reduce((s, v) => s + v, 0);
  const totalRealizado = real.reduce((s, v) => s + v, 0);

  // PPC = média das aderências das atividades programadas (X7 = AVERAGE(X11:X54)).
  const comAderencia = atividades
    .map((a) => a.aderencia)
    .filter((v): v is number => v != null);
  const ppcSemana = comAderencia.length
    ? Math.round((comAderencia.reduce((s, v) => s + v, 0) / comAderencia.length) * 1000) / 10
    : 0;

  const ano = dayDates.length ? dayDates[0].getFullYear() : undefined;

  return {
    semana,
    semanaDoMes: identificarSemanaDoMes(periodo),
    mes: extrairMes(periodo, ano),
    periodo,
    contrato: contratoCalendario,
    referencia: obra,
    responsavel: '',
    equipe: '',
    engenheiro: '',
    atividades,
    dias: dayDates.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`),
    ppc: {
      prev,
      real,
      aderencia,
      totalPrevisto,
      totalRealizado,
      ppcSemana,
      totalAdherencia: Math.round(ppcSemana) / 100,
    },
    importadoEm: new Date().toISOString(),
  };
}
