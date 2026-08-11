import * as XLSX from 'xlsx';
import type { ScheduleRow, SCurvePoint } from '@/store/projectStore';

/**
 * Parser do "Template - Cronograma" (exportação do MS Project).
 *
 * Layout esperado, idêntico nas três abas:
 *   - linha 2  → cabeçalho: as 15 colunas fixas (B..P) e, a partir de Q, as datas semanais
 *   - linha 3  → totais do projeto: é dela que sai a série da Curva S
 *   - linha 4+ → as tarefas
 *
 * As três abas trazem trabalho ACUMULADO (não %). O percentual sai da divisão
 * pelo total da linha de base (último valor da aba "TRABALHO DE LINHA DE BASE"),
 * de modo que as três séries compartilham o mesmo denominador e ficam comparáveis.
 *
 *   TRABALHO DE LINHA DE BASE → Linha base %  (previsto)
 *   TRABALHO REAL             → Real acum. %  (real)
 *   TRABALHO TENDÊNCIA        → Tendência %   (tendencia)
 *
 * O Replanejado NÃO vem do arquivo: o usuário adiciona a linha e preenche à mão.
 */

/** As 15 colunas fixas do template, na ordem. */
export const CRONOGRAMA_COLUNAS = [
  'Nível da estrutura de tópicos',
  'Status',
  'Crítica',
  'Nome da Tarefa',
  '% LB Prevista',
  '% Real',
  'Duração real',
  'Duração restante',
  'Início LB',
  'Início Real',
  'Previsão de Início',
  'Término LB',
  'Término Real',
  'Previsão de Término',
  'Custo',
] as const;

export interface CronogramaExtract {
  /** Tarefas (linha 4 em diante). */
  rows: ScheduleRow[];
  /** Curva S derivada da linha 3 das três abas. */
  sCurve: SCurvePoint[];
  /** Índice, em `sCurve`, do último avanço real — a data de status. */
  statusDateIndex: number;
  /** Total da linha de base usado como 100%. */
  totalLinhaBase: number;
  /** Quais abas foram reconhecidas. */
  abas: { base?: string; real?: string; tendencia?: string };
}

type Grid = unknown[][];

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const gridOf = (ws: XLSX.WorkSheet): Grid =>
  XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: true });

/** Localiza a linha de cabeçalho (a que contém "Nome da Tarefa") e o mapa coluna→campo. */
const findHeader = (grid: Grid): { headerRow: number; colOf: Record<string, number> } | null => {
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    const cells = (grid[r] || []).map(norm);
    if (!cells.some((h) => h === 'nome da tarefa')) continue;
    const colOf: Record<string, number> = {};
    cells.forEach((h, c) => {
      if (h && colOf[h] === undefined) colOf[h] = c;
    });
    return { headerRow: r, colOf };
  }
  return null;
};

/** Reconhece um arquivo no formato do "Template - Cronograma". */
export const isCronogramaTemplate = (wb: XLSX.WorkBook): boolean =>
  wb.SheetNames.some((n) => {
    const h = findHeader(gridOf(wb.Sheets[n]));
    if (!h) return false;
    return h.colOf['% lb prevista'] !== undefined && h.colOf['custo'] !== undefined;
  });

const numOf = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace('.', '').replace(',', '.'));
  return isFinite(n) ? n : null;
};

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

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Semana ISO — usada para rotular o eixo como "26-SEM21". */
export const weekLabel = (d: Date): string => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${String(t.getUTCFullYear()).slice(-2)}-SEM${String(week).padStart(2, '0')}`;
};

interface SeriePonto { date: Date; value: number }

/**
 * Série acumulada da linha 3: começa na primeira coluna de data que tenha valor
 * (no template, T3) e segue até a última coluna preenchida.
 */
const serieDaLinha3 = (grid: Grid, headerRow: number, colOf: Record<string, number>): SeriePonto[] => {
  const first = (colOf['custo'] ?? -1) + 1;
  if (first <= 0) return [];
  const dateRow = grid[headerRow] || [];
  const dataRow = grid[headerRow + 1] || [];
  const width = Math.max(dateRow.length, dataRow.length);

  const out: SeriePonto[] = [];
  let started = false;
  for (let c = first; c < width; c++) {
    const d = toDate(dateRow[c]);
    if (!d) continue;
    const v = numOf(dataRow[c]);
    if (v == null) {
      if (!started) continue; // ainda não chegou na primeira data com valor
      continue; // buraco no meio: ignora o ponto, não encerra a série
    }
    started = true;
    out.push({ date: d, value: v });
  }
  return out;
};

/** Corta a série no último avanço: depois disso o MS Project só repete o valor. */
const cortarNoUltimoAvanco = (serie: SeriePonto[]): SeriePonto[] => {
  let last = -1;
  for (let i = 0; i < serie.length; i++) {
    if (i === 0 || serie[i].value > serie[i - 1].value) last = i;
  }
  return last < 0 ? [] : serie.slice(0, last + 1);
};

const classificarAba = (nome: string): 'base' | 'tendencia' | 'real' | null => {
  const n = norm(nome);
  if (n.includes('linha de base') || n.includes('linha base')) return 'base';
  if (n.includes('tendencia')) return 'tendencia';
  if (n.includes('real')) return 'real';
  return null;
};

const fmtNivelDuracao = (v: unknown): string => (v == null ? '' : String(v).trim());

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** "Qua 20/05/26" — mesmo formato já usado pelas tabelas de cronograma. */
const fmtData = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s || /^(na|nd|n\/?d)$/i.test(s)) return 'ND';
  const d = toDate(v);
  if (!d || d.getFullYear() < 1990) return s === 'ND' ? 'ND' : s;
  return `${DAYS_PT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

/** Percentual do template: 0,3414 → 34,14. Valores > 1 já vêm em pontos percentuais. */
const pct = (v: unknown): number => {
  const n = numOf(v);
  if (n == null) return 0;
  return n > 0 && n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100;
};

/** Tarefas do cronograma (linha 4 em diante). */
const tarefas = (grid: Grid, headerRow: number, colOf: Record<string, number>): ScheduleRow[] => {
  const col = (label: string) => colOf[norm(label)];
  const cTarefa = col('Nome da Tarefa');
  if (cTarefa === undefined) return [];

  const at = (row: unknown[], label: string) => {
    const c = col(label);
    return c === undefined ? null : row[c] ?? null;
  };

  const out: ScheduleRow[] = [];
  const counters: number[] = [];

  // headerRow+1 é a linha de totais do projeto — as tarefas começam na seguinte.
  for (let r = headerRow + 2; r < grid.length; r++) {
    const row = (grid[r] || []) as unknown[];
    const nome = row[cTarefa];
    if (nome == null || String(nome).trim() === '') continue;

    const nivelRaw = numOf(at(row, 'Nível da estrutura de tópicos'));
    const outlineLevel = nivelRaw != null && nivelRaw > 0 ? nivelRaw : 1;

    if (counters.length < outlineLevel) {
      while (counters.length < outlineLevel) counters.push(0);
    } else {
      counters.length = outlineLevel;
    }
    counters[outlineLevel - 1] = (counters[outlineLevel - 1] || 0) + 1;

    const previsto = pct(at(row, '% LB Prevista'));
    const real = pct(at(row, '% Real'));

    out.push({
      id: String(r - headerRow - 1),
      tarefa: String(nome).trim(),
      previsto,
      trabalhoConcluido: real,
      desvio: Math.round((real - previsto) * 100) / 100,
      status: at(row, 'Status') == null ? '' : String(at(row, 'Status')).trim(),
      critica: /^s/i.test(String(at(row, 'Crítica') ?? '')),
      duracaoReal: fmtNivelDuracao(at(row, 'Duração real')),
      duracaoRestante: fmtNivelDuracao(at(row, 'Duração restante')),
      inicioBase: fmtData(at(row, 'Início LB')),
      inicioReal: fmtData(at(row, 'Início Real')),
      previsaoInicio: fmtData(at(row, 'Previsão de Início')),
      terminoBase: fmtData(at(row, 'Término LB')),
      terminoReal: fmtData(at(row, 'Término Real')),
      previsaoTermino: fmtData(at(row, 'Previsão de Término')),
      custo: numOf(at(row, 'Custo')) ?? 0,
      // Campos legados, mantidos para as telas que já existiam: a data "corrente"
      // do cronograma é a previsão.
      inicio: fmtData(at(row, 'Previsão de Início')),
      termino: fmtData(at(row, 'Previsão de Término')),
      outlineLevel,
      outlineNumber: counters.slice(0, outlineLevel).join('.'),
      criticalPath: /^s/i.test(String(at(row, 'Crítica') ?? '')),
      bold: outlineLevel <= 2,
      summary: false,
      milestone: false,
    });
  }
  return out;
};

export const parseCronogramaWorkbook = (wb: XLSX.WorkBook): CronogramaExtract => {
  const abas: CronogramaExtract['abas'] = {};
  const series: Partial<Record<'base' | 'real' | 'tendencia', SeriePonto[]>> = {};
  let rows: ScheduleRow[] = [];

  for (const name of wb.SheetNames) {
    const grid = gridOf(wb.Sheets[name]);
    const h = findHeader(grid);
    if (!h) continue;
    const tipo = classificarAba(name);
    if (!tipo) continue;

    abas[tipo] = name;
    series[tipo] = serieDaLinha3(grid, h.headerRow, h.colOf);

    // As tarefas saem da aba de linha de base (ou da primeira reconhecida).
    if (tipo === 'base' || rows.length === 0) {
      const t = tarefas(grid, h.headerRow, h.colOf);
      if (tipo === 'base' || t.length > rows.length) rows = t;
    }
  }

  const base = series.base ?? [];
  const tendencia = series.tendencia ?? [];
  const real = cortarNoUltimoAvanco(series.real ?? []);

  if (!base.length) throw new Error('Aba "TRABALHO DE LINHA DE BASE" não encontrada ou linha 3 vazia');

  const totalLinhaBase = base[base.length - 1].value;
  if (!(totalLinhaBase > 0)) throw new Error('Total da linha de base é zero — não é possível calcular o percentual');

  const toPct = (v: number) => Math.round((v / totalLinhaBase) * 10000) / 100;

  // União das datas das três séries, em ordem.
  const porData = new Map<string, { d: Date; previsto: number; real: number; tendencia: number }>();
  const put = (serie: SeriePonto[], key: 'previsto' | 'real' | 'tendencia') => {
    for (const p of serie) {
      const k = isoDay(p.date);
      const cur = porData.get(k) ?? { d: p.date, previsto: 0, real: 0, tendencia: 0 };
      cur[key] = toPct(p.value);
      porData.set(k, cur);
    }
  };
  put(base, 'previsto');
  put(tendencia, 'tendencia');
  put(real, 'real');

  const sCurve: SCurvePoint[] = [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      date: weekLabel(v.d),
      previsto: v.previsto,
      real: v.real,
      tendencia: v.tendencia,
    }));

  let statusDateIndex = -1;
  sCurve.forEach((p, i) => { if (p.real > 0) statusDateIndex = i; });
  if (statusDateIndex < 0) statusDateIndex = Math.max(0, sCurve.length - 1);

  return { rows, sCurve, statusDateIndex, totalLinhaBase, abas };
};

export const parseCronogramaFile = async (file: File): Promise<CronogramaExtract> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  if (!isCronogramaTemplate(wb)) throw new Error('Arquivo não segue o "Template - Cronograma"');
  return parseCronogramaWorkbook(wb);
};
