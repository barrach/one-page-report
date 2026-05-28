import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";

// ===================================================================
// useContractCompetences
// -------------------------------------------------------------------
// Calcula a ÚLTIMA COMPETÊNCIA INDIVIDUAL de cada contrato seguindo a
// hierarquia de prioridade definida pelo negócio:
//
//   1. Último mês com lançamento REAL (financial_entries)
//   2. Último mês do Acompanhamento Executivo (contract_revenues)
//   3. Último mês do DRG (financial_drg_lines)
//   4. Último mês do Planejado/Baseline (financial_planned_entries)
//   5. Último mês de snapshot consolidado (financial_contract_snapshots)
//
// Cada projeto recebe SUA própria competência. Nunca compartilhar
// "última competência global" entre contratos.
// ===================================================================

export type CompetenceSource =
  | "real"
  | "acomp"
  | "drg"
  | "planned"
  | "snapshot"
  | null;

export interface ContractCompetence {
  /** ISO date string YYYY-MM-DD da última competência válida */
  lastCompetence: string | null;
  /** De qual fonte veio a última competência (para auditoria) */
  source: CompetenceSource;
  /** Última competência por fonte (debug / UI avançada) */
  bySource: {
    real: string | null;
    acomp: string | null;
    drg: string | null;
    planned: string | null;
    snapshot: string | null;
  };
}

const monthKeyToIso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  // Aceita "YYYY-MM" ou "YYYY-MM-DD"; normaliza para YYYY-MM-01
  const s = String(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(0, 7)}-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return null;
};

const pickMax = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

export const useContractCompetences = () => {
  return useQuery({
    queryKey: ["contract-competences"],
    queryFn: async (): Promise<Record<string, ContractCompetence>> => {
      const [entriesRes, revenuesRes, drgRes, plannedRes, snapshotsRes] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("contract_project_id, competence_date, competence")
          .eq("is_excluded", false)
          .eq("is_duplicate", false)
          .not("contract_project_id", "is", null),
        supabase
          .from("contract_revenues")
          .select("project_id, competence_month"),
        supabase
          .from("financial_drg_lines")
          .select("project_id, competence_month"),
        supabase
          .from("financial_planned_entries")
          .select("project_id, competence_month"),
        supabase
          .from("financial_contract_snapshots")
          .select("project_id, competence_month"),
      ]);

      const result: Record<string, ContractCompetence> = {};
      const ensure = (id: string): ContractCompetence => {
        if (!result[id]) {
          result[id] = {
            lastCompetence: null,
            source: null,
            bySource: { real: null, acomp: null, drg: null, planned: null, snapshot: null },
          };
        }
        return result[id];
      };

      // 1) REAL — financial_entries
      (entriesRes.data ?? []).forEach((row) => {
        const id = row.contract_project_id as string | null;
        if (!id) return;
        const iso = monthKeyToIso(row.competence_date) ?? monthKeyToIso(row.competence);
        if (!iso) return;
        const c = ensure(id);
        c.bySource.real = pickMax(c.bySource.real, iso);
      });

      // 2) ACOMP — contract_revenues
      (revenuesRes.data ?? []).forEach((row) => {
        const id = row.project_id as string | null;
        if (!id) return;
        const iso = monthKeyToIso(row.competence_month);
        if (!iso) return;
        const c = ensure(id);
        c.bySource.acomp = pickMax(c.bySource.acomp, iso);
      });

      // 3) DRG — financial_drg_lines
      (drgRes.data ?? []).forEach((row) => {
        const id = row.project_id as string | null;
        if (!id) return;
        const iso = monthKeyToIso(row.competence_month);
        if (!iso) return;
        const c = ensure(id);
        c.bySource.drg = pickMax(c.bySource.drg, iso);
      });

      // 4) PLANNED — financial_planned_entries
      (plannedRes.data ?? []).forEach((row) => {
        const id = row.project_id as string | null;
        if (!id) return;
        const iso = monthKeyToIso(row.competence_month);
        if (!iso) return;
        const c = ensure(id);
        c.bySource.planned = pickMax(c.bySource.planned, iso);
      });

      // 5) SNAPSHOT — financial_contract_snapshots
      (snapshotsRes.data ?? []).forEach((row) => {
        const id = row.project_id as string | null;
        if (!id) return;
        const iso = monthKeyToIso(row.competence_month);
        if (!iso) return;
        const c = ensure(id);
        c.bySource.snapshot = pickMax(c.bySource.snapshot, iso);
      });

      // Aplica hierarquia de prioridade
      Object.values(result).forEach((c) => {
        if (c.bySource.real) {
          c.lastCompetence = c.bySource.real;
          c.source = "real";
        } else if (c.bySource.acomp) {
          c.lastCompetence = c.bySource.acomp;
          c.source = "acomp";
        } else if (c.bySource.drg) {
          c.lastCompetence = c.bySource.drg;
          c.source = "drg";
        } else if (c.bySource.planned) {
          c.lastCompetence = c.bySource.planned;
          c.source = "planned";
        } else if (c.bySource.snapshot) {
          c.lastCompetence = c.bySource.snapshot;
          c.source = "snapshot";
        }
      });

      return result;
    },
    staleTime: 60 * 1000,
  });
};

// Helper de formatação consistente em todo o app: "Jan/26"
export const formatCompetenceShort = (iso: string | null | undefined): string => {
  if (!iso) return "Sem competência";
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return "Sem competência";
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthIdx = parseInt(m[2], 10) - 1;
  const yy = m[1].slice(2);
  if (monthIdx < 0 || monthIdx > 11) return "Sem competência";
  return `${months[monthIdx]}/${yy}`;
};

export const COMPETENCE_SOURCE_LABEL: Record<NonNullable<CompetenceSource>, string> = {
  real: "Real",
  acomp: "Acomp. Executivo",
  drg: "DRG",
  planned: "Planejado",
  snapshot: "Snapshot",
};
