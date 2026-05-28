// ============================================================
// Mapeamento Depto numérico → dept_code (planilha Megasteam)
// ============================================================
// Fonte: aba "Departamentos" do workbook Megasteam.
// Usado pelo importador da aba Imobilizado para traduzir
// o "Depto." numérico (3, 51, 88, 102…) no dept_code padrão
// (5040.107, 5010.100…) e localizar o contract_project_id.
// ============================================================

export const DEPTO_TO_DEPT_CODE: Record<number, string> = {
  1: "ADM",                // Administrativo (1.000)
  2: "POOL_COM",           // Comercial (2.000)
  3: "POOL_GES",           // Gestão Op. (3.000)
  74: "5000",              // Operação/Produção
  // 5010 — Válvulas
  50: "5010", 51: "5010.100", 52: "5010.101", 53: "5010.102",
  81: "5010.103", 82: "5010.104", 54: "5010.200",
  // 5020 — Inspeção
  55: "5020", 56: "5020.100", 57: "5020.101", 76: "5020.103", 86: "5020.107",
  // 5030 — Calibração
  59: "5030", 61: "5030.101", 62: "5030.102", 64: "5030.104",
  79: "5030.106", 89: "5030.109",
  // 5040 — Comissionamento
  65: "5040", 83: "5040.100", 88: "5040.101", 91: "5040.102", 93: "5040.103",
  69: "5040.104", 95: "5040.105", 96: "5040.106",
  97: "5040.107", 98: "5040.108", 99: "5040.109", 100: "5040.110", 101: "5040.111",
  // 5050
  66: "5050",
  // 5060 — Manutenção
  67: "5060", 68: "5060.100", 85: "5060.100.1",
  90: "5060.102", 92: "5060.103", 94: "5060.104",
  // 5070 — Parada
  70: "5070", 71: "5070.100", 84: "5070.1", 102: "5070.101",
  // 5080 — Montagem
  72: "5080", 87: "5080.101",
};

/** Retorna o dept_code planilha (ex: "5040.107") a partir do depto numérico (ex: 97). */
export function deptoToDeptCode(depto: number | null | undefined): string | null {
  if (depto == null) return null;
  return DEPTO_TO_DEPT_CODE[depto] ?? null;
}

/** True para deptos 1/2/3/74 (administrativo/comercial/gestão/operação geral). */
export function isHeadquartersDepto(depto: number | null | undefined): boolean {
  if (depto == null) return true;
  return depto === 1 || depto === 2 || depto === 3 || depto === 74;
}
