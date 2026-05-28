/**
 * Motor puro de cálculo de HH para o módulo Escopo & Análise.
 *
 * Fórmula:
 *   HH_base       = quantidade × índice_produtividade (RIP)
 *   HH_ajustado   = HH_base × fator_ajuste_local (composto)
 *   HH_total      = HH_ajustado / fator_produção
 *
 * Modos de entrada:
 *   - quantitativo: calcula via índice RIP (padrão)
 *   - hh_direto:    usuário informa HH total; aplicamos só o fator_produção
 */

// ── Tabelas de fatores de ajuste local ────────────────────────────────────
export const ALTURA_OPTIONS = [
  { code: "0_6", label: "0–6 m", factor: 1.0 },
  { code: "6_12", label: "6–12 m", factor: 1.1 },
  { code: "12_20", label: "12–20 m", factor: 1.2 },
  { code: "20_plus", label: "> 20 m", factor: 1.35 },
] as const;

export const CONFINAMENTO_OPTIONS = [
  { code: "sem", label: "Sem restrição", factor: 1.0 },
  { code: "parcial", label: "Parcial", factor: 1.15 },
  { code: "total", label: "Confinamento total", factor: 1.3 },
] as const;

export const TURNO_OPTIONS = [
  { code: "diurno", label: "Diurno", factor: 1.0 },
  { code: "noturno", label: "Noturno", factor: 1.3 },
  { code: "revezamento", label: "Revezamento", factor: 1.45 },
] as const;

export const ACESSO_OPTIONS = [
  { code: "facil", label: "Fácil", factor: 1.0 },
  { code: "moderado", label: "Moderado", factor: 1.1 },
  { code: "dificil", label: "Difícil", factor: 1.25 },
] as const;

export type LocalAdjustment = {
  altura?: string;
  confinamento?: string;
  turno?: string;
  acesso?: string;
};

export const DEFAULT_LOCAL_ADJUSTMENT: Required<LocalAdjustment> = {
  altura: "0_6",
  confinamento: "sem",
  turno: "diurno",
  acesso: "facil",
};

function lookupFactor<T extends { code: string; factor: number }>(
  options: readonly T[],
  code: string | undefined,
): { factor: number; label: string } {
  const match = options.find((o) => o.code === code) || options[0];
  return { factor: match.factor, label: (match as any).label };
}

export interface ResolvedAdjustment {
  factor: number;
  parts: { key: string; label: string; factor: number }[];
}

export function resolveLocalAdjustment(adj: LocalAdjustment | null | undefined): ResolvedAdjustment {
  const a = { ...DEFAULT_LOCAL_ADJUSTMENT, ...(adj || {}) };
  const altura = lookupFactor(ALTURA_OPTIONS, a.altura);
  const confinamento = lookupFactor(CONFINAMENTO_OPTIONS, a.confinamento);
  const turno = lookupFactor(TURNO_OPTIONS, a.turno);
  const acesso = lookupFactor(ACESSO_OPTIONS, a.acesso);
  const factor = altura.factor * confinamento.factor * turno.factor * acesso.factor;
  const parts = [
    { key: "altura", label: altura.label, factor: altura.factor },
    { key: "confinamento", label: confinamento.label, factor: confinamento.factor },
    { key: "turno", label: turno.label, factor: turno.factor },
    { key: "acesso", label: acesso.label, factor: acesso.factor },
  ].filter((p) => p.factor !== 1.0);
  return { factor, parts };
}

// ── Cálculo principal por linha ───────────────────────────────────────────
export interface HHCalcInput {
  quantity: number;
  productivity_index: number | null;
  /** Fator de ajuste local (0..n). Se ausente, usa 1. */
  local_adjustment_factor: number;
  /** Fator de produção (0..1). Ex: 0,60 */
  production_factor: number;
}

export interface HHCalcResult {
  baseHH: number;
  adjustedHH: number;
  totalHH: number; // HH ajustado / fator_produção (HH "vendido")
  combinedAdjFactor: number;
  productionFactor: number;
}

export function computeHHForItem(input: HHCalcInput): HHCalcResult {
  const baseHH = (Number(input.quantity) || 0) * (Number(input.productivity_index) || 0);
  const adjustedHH = baseHH * (input.local_adjustment_factor || 1);
  const pf = input.production_factor > 0 ? input.production_factor : 1;
  const totalHH = adjustedHH / pf;
  return {
    baseHH,
    adjustedHH,
    totalHH,
    combinedAdjFactor: input.local_adjustment_factor || 1,
    productionFactor: pf,
  };
}

/** Modo HH direto: aplica apenas fator de produção sobre o HH informado. */
export function computeHHDirect(directHH: number, productionFactor: number): HHCalcResult {
  const pf = productionFactor > 0 ? productionFactor : 1;
  const adjusted = Number(directHH) || 0;
  return {
    baseHH: adjusted,
    adjustedHH: adjusted,
    totalHH: adjusted / pf,
    combinedAdjFactor: 1,
    productionFactor: pf,
  };
}

// ── Consolidação por especialidade ────────────────────────────────────────
export interface SpecialtySummary {
  specialty_code: string;
  specialty_label: string;
  totalHH: number;
  pct: number;
  itemCount: number;
}

export function summarizeBySpecialty(
  rows: Array<{ specialty_code: string; specialty_label: string; totalHH: number }>,
): SpecialtySummary[] {
  const map = new Map<string, SpecialtySummary>();
  let grand = 0;
  for (const r of rows) {
    grand += r.totalHH;
    const prev = map.get(r.specialty_code);
    if (prev) {
      prev.totalHH += r.totalHH;
      prev.itemCount += 1;
    } else {
      map.set(r.specialty_code, {
        specialty_code: r.specialty_code,
        specialty_label: r.specialty_label,
        totalHH: r.totalHH,
        pct: 0,
        itemCount: 1,
      });
    }
  }
  const list = Array.from(map.values());
  for (const s of list) s.pct = grand > 0 ? (s.totalHH / grand) * 100 : 0;
  return list.sort((a, b) => b.totalHH - a.totalHH);
}

/** Estima MOD/MOI: padrão 85% MOD / 15% MOI; supervisão e CQ contam como MOI. */
export function splitMODMOI(specialties: SpecialtySummary[]): { totalHH: number; modHH: number; moiHH: number } {
  let modHH = 0;
  let moiHH = 0;
  for (const s of specialties) {
    if (s.specialty_code === "supervisao" || s.specialty_code === "controle_qualidade") {
      moiHH += s.totalHH;
    } else {
      modHH += s.totalHH * 0.85;
      moiHH += s.totalHH * 0.15;
    }
  }
  return { totalHH: modHH + moiHH, modHH, moiHH };
}
