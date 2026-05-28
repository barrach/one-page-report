// Gera a planilha "Resumo do Resultado" como visão derivada do sistema.
// NÃO é importação — é uma exportação calculada a partir dos dados já existentes
// (Budget/baseline + Real Mensal + DRG mensal + receitas) reproduzindo o formato
// do workbook gerencial usado pela Megasteam.
import * as XLSX from "xlsx";
import { formatBRL } from "@budget/lib/format";

export interface ResumoLine {
  code: string;
  label: string;
  isPct: boolean;
  planned: number;
  actual: number;
  sort: number;
}

export interface ResumoContract {
  projectId: string;
  projectName: string;
  deptCode?: string | null;
  lines: ResumoLine[];
}

export interface ResumoExportInput {
  competenceLabel: string; // ex: "Fev-26"
  generatedAt: Date;
  consolidated: ResumoLine[]; // soma de todos os contratos (somente linhas não-percentuais)
  contracts: ResumoContract[];
}

const SHEET_TITLE_HEADER = "MESES";
const SHEET_TITLE_DESC = "DESCRIÇÃO PG (PLANO GERENCIAL)";

/** Constrói a matriz (AOA) de uma aba seguindo o formato do workbook original. */
const buildSheetAoA = (
  title: string,
  competenceLabel: string,
  lines: ResumoLine[],
  withVariance = true,
): (string | number | null)[][] => {
  const rows: (string | number | null)[][] = [];
  rows.push([title]);
  rows.push([]);
  rows.push([SHEET_TITLE_HEADER, competenceLabel]);
  rows.push(
    withVariance
      ? [SHEET_TITLE_DESC, "PREVISTO", "REALIZADO", "DIFERENÇA"]
      : [SHEET_TITLE_DESC, "PREVISTO", "REALIZADO"],
  );
  for (const l of lines) {
    const planned = l.isPct ? l.planned : Number(l.planned ?? 0);
    const actual = l.isPct ? l.actual : Number(l.actual ?? 0);
    const diff = l.isPct ? actual - planned : actual - planned;
    rows.push(
      withVariance
        ? [l.label, planned, actual, diff]
        : [l.label, planned, actual],
    );
  }
  return rows;
};

const sanitizeSheetName = (name: string): string => {
  // Excel: máx 31 chars, sem :\/?*[]
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Aba";
};

export const exportResumoResultadoXlsx = (input: ResumoExportInput): void => {
  const wb = XLSX.utils.book_new();

  // Aba 1 — GERAL OH Real (consolidado)
  const consolidatedAoA = buildSheetAoA(
    "TODOS OS CC",
    input.competenceLabel,
    input.consolidated,
    true,
  );
  const wsConsolidated = XLSX.utils.aoa_to_sheet(consolidatedAoA);
  wsConsolidated["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsConsolidated, "GERAL OH Real");

  // Uma aba por contrato
  const used = new Set<string>(["GERAL OH Real"]);
  for (const c of input.contracts) {
    const baseName = sanitizeSheetName(c.projectName);
    let name = baseName;
    let i = 2;
    while (used.has(name)) {
      const suffix = ` (${i++})`;
      name = sanitizeSheetName(baseName.slice(0, 31 - suffix.length) + suffix);
    }
    used.add(name);

    const titleRow = c.deptCode
      ? `${c.deptCode} - ${c.projectName}`
      : c.projectName;
    const aoa = buildSheetAoA(titleRow, input.competenceLabel, c.lines, true);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // Aba final — metadados (rastreabilidade da geração automática)
  const meta = [
    ["Resumo do Resultado — Visão derivada"],
    [],
    ["Gerado em", input.generatedAt.toLocaleString("pt-BR")],
    ["Competência", input.competenceLabel],
    ["Contratos", input.contracts.length],
    [],
    ["Esta planilha é gerada automaticamente pelo MegaBudget."],
    ["Fontes: Budget/Baseline · Real Mensal (CUSTOS_MES) · DRG mensal · Receitas"],
    ["Não importar este arquivo de volta no sistema."],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Sobre");

  const safeLabel = input.competenceLabel.replace(/[^\w-]+/g, "_");
  XLSX.writeFile(wb, `Resumo_do_Resultado_${safeLabel}.xlsx`);
};

// Helper para formatar a competência YYYY-MM em "Mmm-YY" (ex: "Fev-26")
export const formatCompetenceLabel = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${cap}-${String(y).slice(-2)}`;
};

// Apenas para evitar warning de import não usado em tree-shaking
export { formatBRL };
