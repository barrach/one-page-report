import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { isFinanciallyAvailableContract } from "@budget/hooks/useFinancialContracts";
import type { CompetenceSource } from "@budget/hooks/useContractCompetences";

// ===================================================================
// Cadastro mestre de contratos (camada superior do Financeiro)
// Usa `projects` (is_cost_center=true preferencialmente) e cruza com
// snapshots, drg_lines, files, planned, payroll, fixed_assets para
// derivar status de "completude" do contrato.
// ===================================================================

export interface ContractMaster {
  id: string;
  project_name: string;
  client: string | null;
  dept_code: string | null;
  dept_group: string | null;
  status: string | null;
  is_cost_center: boolean;
  is_company_entity: boolean;
  contract_type: string | null;
  notes: string | null;
  updated_at: string;
  // Vínculos (booleanos derivados)
  has_baseline: boolean;
  has_drg: boolean;
  has_real: boolean;
  has_producao: boolean;
  has_pessoal: boolean;
  has_imobilizado: boolean;
  has_files: boolean;
  files_count: number;
  // Competência (calculada por contrato com hierarquia: real → acomp → drg → planned → snapshot)
  last_competence: string | null;
  last_competence_source: CompetenceSource;
}

export const useContractsMaster = () => {
  return useQuery({
    queryKey: ["contracts-master"],
    queryFn: async (): Promise<ContractMaster[]> => {
      const [
        projectsRes,
        baselinesRes,
        drgRes,
        entriesRes,
        revenuesRes,
        plannedRes,
        payrollRes,
        assetsRes,
        filesRes,
      ] = await Promise.all([
        // Defesa em SQL: orçamentos em rascunho/novo NUNCA aparecem em Contratos.
        // O cadastro mestre só lista projetos que já foram promovidos a contrato real.
        supabase
          .from("projects")
          .select("id, project_name, client, dept_code, dept_group, status, is_cost_center, is_company_entity, contract_type, notes, updated_at")
          .not("status", "in", "(draft,new,rascunho)")
          .order("is_cost_center", { ascending: false })
          .order("dept_code", { nullsFirst: false })
          .order("project_name"),
        supabase.from("financial_baselines").select("project_id").eq("status", "active"),
        supabase.from("financial_drg_lines").select("project_id, competence_month"),
        supabase
          .from("financial_entries")
          .select("contract_project_id, competence_date, competence")
          .eq("is_excluded", false)
          .eq("is_duplicate", false),
        supabase.from("contract_revenues").select("project_id, competence_month"),
        supabase.from("financial_planned_entries").select("project_id, competence_month"),
        supabase.from("payroll_entries").select("contract_project_id"),
        supabase.from("fixed_assets").select("contract_project_id"),
        supabase.from("financial_contract_files").select("project_id"),
      ]);

      const projects = (projectsRes.data ?? []).filter((p) =>
        isFinanciallyAvailableContract(p, { includeInactive: true }),
      );

      const setOf = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T) =>
        new Set((rows ?? []).map((r) => String(r[key] ?? "")).filter(Boolean));
      const countMap = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T) => {
        const m = new Map<string, number>();
        (rows ?? []).forEach((r) => {
          const k = String(r[key] ?? "");
          if (!k) return;
          m.set(k, (m.get(k) ?? 0) + 1);
        });
        return m;
      };

      // Calcula a última competência por projeto INDEPENDENTEMENTE para cada fonte.
      const monthIso = (v: string | null | undefined): string | null => {
        if (!v) return null;
        const s = String(v).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(0, 7)}-01`;
        if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
        return null;
      };
      const lastByKey = (
        rows: Array<Record<string, unknown>> | null,
        idKey: string,
        ...dateKeys: string[]
      ) => {
        const m = new Map<string, string>();
        (rows ?? []).forEach((r) => {
          const id = r[idKey] as string | null;
          if (!id) return;
          let iso: string | null = null;
          for (const k of dateKeys) {
            iso = monthIso(r[k] as string | null | undefined);
            if (iso) break;
          }
          if (!iso) return;
          const cur = m.get(id);
          if (!cur || iso > cur) m.set(id, iso);
        });
        return m;
      };

      const baselineSet = setOf(baselinesRes.data, "project_id");
      const drgSet = setOf(drgRes.data, "project_id");
      const realSet = setOf(entriesRes.data, "contract_project_id");
      const prodSet = setOf(revenuesRes.data, "project_id");
      const pessoalSet = setOf(payrollRes.data, "contract_project_id");
      const assetsSet = setOf(assetsRes.data, "contract_project_id");
      const filesCount = countMap(filesRes.data, "project_id");

      const lastReal = lastByKey(entriesRes.data as never, "contract_project_id", "competence_date", "competence");
      const lastAcomp = lastByKey(revenuesRes.data as never, "project_id", "competence_month");
      const lastDrg = lastByKey(drgRes.data as never, "project_id", "competence_month");
      const lastPlanned = lastByKey(plannedRes.data as never, "project_id", "competence_month");

      return projects.map<ContractMaster>((p) => {
        const fc = filesCount.get(p.id) ?? 0;
        // Hierarquia INDIVIDUAL por contrato: real → acomp → drg → planned
        let lastCompetence: string | null = null;
        let source: CompetenceSource = null;
        const real = lastReal.get(p.id) ?? null;
        const acomp = lastAcomp.get(p.id) ?? null;
        const drg = lastDrg.get(p.id) ?? null;
        const planned = lastPlanned.get(p.id) ?? null;
        if (real) { lastCompetence = real; source = "real"; }
        else if (acomp) { lastCompetence = acomp; source = "acomp"; }
        else if (drg) { lastCompetence = drg; source = "drg"; }
        else if (planned) { lastCompetence = planned; source = "planned"; }

        return {
          ...p,
          has_baseline: baselineSet.has(p.id),
          has_drg: drgSet.has(p.id),
          has_real: realSet.has(p.id),
          has_producao: prodSet.has(p.id),
          has_pessoal: pessoalSet.has(p.id),
          has_imobilizado: assetsSet.has(p.id),
          has_files: fc > 0,
          files_count: fc,
          last_competence: lastCompetence,
          last_competence_source: source,
        };
      });
    },
  });
};

// Status derivado para badge visual
export type DerivedStatus = "draft" | "active" | "partial" | "complete" | "inactive";

export const deriveContractStatus = (c: ContractMaster): DerivedStatus => {
  if ((c.status ?? "").toLowerCase() === "inactive") return "inactive";
  const links = [c.has_baseline, c.has_drg, c.has_real, c.has_producao, c.has_pessoal];
  const filled = links.filter(Boolean).length;
  if (filled === 0) return (c.status === "draft" ? "draft" : "active");
  if (filled >= 4) return "complete";
  if (filled >= 1) return "partial";
  return "active";
};

export const STATUS_META: Record<DerivedStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  partial: { label: "Parcial", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  complete: { label: "Completo", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  inactive: { label: "Inativo", className: "bg-destructive/15 text-destructive" },
};
