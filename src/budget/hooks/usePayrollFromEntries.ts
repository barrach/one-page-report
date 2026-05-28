import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useMemo } from "react";

const CODES = {
  gross: ["4101"],
  charges: ["4102", "4109", "3201"],
  benefits: ["4112", "4113", "4114", "4111"],
} as const;
const ALL_CODES = [...CODES.gross, ...CODES.charges, ...CODES.benefits];

export type PayrollMonthRow = {
  competence_month: string; // YYYY-MM
  gross: number;
  charges: number;
  fgts: number;
  inss: number;
  benefits: number;
  total: number;
  breakdown: Record<string, number>;
};

/**
 * Builds payroll view directly from financial_entries (CUSTOS_MES).
 * Filters: contract_project_id == projectId AND cost_center_description contains the dept_code of this project.
 * This excludes admin payroll lines ("1.000 - ADMINISTRATIVO") from sede.
 */
export const usePayrollFromEntries = (projectId?: string) => {
  return useQuery({
    queryKey: ["payroll-from-entries", projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return { rows: [], deptCode: null as string | null };

      const { data: project } = await supabase
        .from("projects")
        .select("dept_code")
        .eq("id", projectId)
        .maybeSingle();
      const deptCode = project?.dept_code ?? null;

      const { data, error } = await supabase
        .from("financial_entries")
        .select("competence_date, managerial_code, cost_value, cost_center_description, contract_project_id")
        .eq("contract_project_id", projectId)
        .in("managerial_code", ALL_CODES)
        .eq("is_excluded", false)
        .eq("is_duplicate", false);
      if (error) throw error;

      // Filter: keep only entries whose cost_center_description contains this contract's dept_code
      // (exclude admin/sede lines like "1.000 - ADMINISTRATIVO")
      const filtered = (data ?? []).filter((e) => {
        if (!deptCode) return true;
        const desc = String(e.cost_center_description ?? "");
        return desc.includes(deptCode);
      });

      // Group by month
      const map = new Map<string, PayrollMonthRow>();
      for (const e of filtered) {
        if (!e.competence_date) continue;
        const month = String(e.competence_date).slice(0, 7);
        const code = String(e.managerial_code ?? "");
        const value = Number(e.cost_value || 0);
        const cur = map.get(month) ?? {
          competence_month: month,
          gross: 0, charges: 0, fgts: 0, inss: 0, benefits: 0, total: 0,
          breakdown: {},
        };
        cur.breakdown[code] = (cur.breakdown[code] ?? 0) + value;
        if (CODES.gross.includes(code as never)) cur.gross += value;
        else if (code === "4109") { cur.fgts += value; cur.charges += value; }
        else if (code === "3201") { cur.inss += value; cur.charges += value; }
        else if (code === "4102") cur.charges += value;
        else if (CODES.benefits.includes(code as never)) cur.benefits += value;
        cur.total = cur.gross + cur.charges + cur.benefits;
        map.set(month, cur);
      }

      const rows = Array.from(map.values()).sort((a, b) =>
        b.competence_month.localeCompare(a.competence_month)
      );
      return { rows, deptCode };
    },
  });
};

export const usePayrollHeadcount = (projectId?: string) => {
  return useQuery({
    queryKey: ["payroll-headcount", projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("competence_month, headcount, notes")
        .eq("contract_project_id", projectId!)
        .order("competence_month", { ascending: false });
      if (error) throw error;
      const byMonth: Record<string, { headcount: number; notes?: string | null }> = {};
      for (const r of data ?? []) {
        const m = String(r.competence_month).slice(0, 7);
        const cur = byMonth[m] ?? { headcount: 0 };
        cur.headcount = Math.max(cur.headcount, Number(r.headcount || 0));
        cur.notes = r.notes ?? cur.notes;
        byMonth[m] = cur;
      }
      return byMonth;
    },
  });
};

export const useManualPayrollByMonth = (projectId?: string) => {
  return useQuery({
    queryKey: ["payroll-manual", projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("competence_month, gross_payroll, charges, benefits")
        .eq("contract_project_id", projectId!);
      if (error) throw error;
      const byMonth: Record<string, { gross: number; charges: number; benefits: number }> = {};
      for (const r of data ?? []) {
        const m = String(r.competence_month).slice(0, 7);
        const cur = byMonth[m] ?? { gross: 0, charges: 0, benefits: 0 };
        cur.gross += Number(r.gross_payroll || 0);
        cur.charges += Number(r.charges || 0);
        cur.benefits += Number(r.benefits || 0);
        byMonth[m] = cur;
      }
      return byMonth;
    },
  });
};
