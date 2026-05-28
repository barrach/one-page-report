import { useMemo } from "react";
import { useJobRoles } from "./useJobRoles";
import { useWorkforceRows } from "./useScheduleEngine";
import { useProjectParameters, buildDefaultParameters, calcularEncargosPonderados } from "./useProjectParameters";
import {
  computeTeamTotals,
  DEFAULT_PAYROLL_PARAMS,
  type PayrollParams,
  type TeamLineInput,
} from "@budget/lib/payrollEngine";

/**
 * Hook compartilhado: calcula os totais da folha + headcount/homem-mês
 * a partir das linhas estruturadas de equipe (schedule_workforce com job_role_id).
 */
export function useTeamPayrollTotals(projectId: string | undefined, scenarioId: string | undefined) {
  const { data: roles = [] } = useJobRoles();
  const { data: rows = [] } = useWorkforceRows(scenarioId);
  const { data: paramsRaw } = useProjectParameters(projectId);

  const params = useMemo(() => paramsRaw ?? buildDefaultParameters(), [paramsRaw]);

  const payrollParams: PayrollParams = useMemo(() => {
    const enc = calcularEncargosPonderados(
      params.contrato_inicio,
      params.contrato_fim,
      params.encargos_por_ano,
    );
    return {
      ...DEFAULT_PAYROLL_PARAMS,
      cprb_medio_pct: enc?.cprbMedio ?? DEFAULT_PAYROLL_PARAMS.cprb_medio_pct,
      inss_medio_pct: enc?.inssMedio ?? DEFAULT_PAYROLL_PARAMS.inss_medio_pct,
      insalubridade_pct: params.insalubridade_pct,
      periculosidade_pct: params.periculosidade_pct,
      salario_minimo_regional: params.salario_minimo_regional,
      cesta_basica_mensal: params.cesta_basica_mensal,
      premio_assiduidade_mensal: params.premio_assiduidade_mensal,
      convenio_medico_mensal: params.convenio_medico_mensal,
      folga_campo_diaria: params.folga_campo_diaria,
      folga_campo_dias_mes: 4,
      plr_salarios_ano: params.plr_salarios_ano,
    };
  }, [params]);

  const structuredRows = (rows as any[]).filter((r) => r.job_role_id);

  const totals = useMemo(() => {
    const inputs: TeamLineInput[] = structuredRows.map((r) => {
      const role = roles.find((x) => x.id === r.job_role_id);
      return {
        classification: (r.classification || "MOD") as any,
        people_count: Number(r.people_count) || 0,
        period_months: Number(r.period_months) || 0,
        hours_per_month: Number(r.hours_per_month) || params.horas_trabalhadas_mes,
        base_salary: Number(r.base_salary_override ?? role?.base_salary ?? 0),
        pericul_enabled: !!r.pericul_enabled,
        insalub_enabled: !!r.insalub_enabled,
      };
    });
    return computeTeamTotals(inputs, payrollParams);
  }, [structuredRows, roles, payrollParams, params.horas_trabalhadas_mes]);

  return { totals, payrollParams, structuredRows, params };
}
