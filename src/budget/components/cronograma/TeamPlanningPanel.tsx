import { useMemo, useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Switch } from "@budget/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@budget/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Plus, Trash2, Users, Hammer, Briefcase, AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { useJobRoles, type JobRole } from "@budget/hooks/useJobRoles";
import { useWorkforceRows, useWorkforceMutations, type WorkforceRow } from "@budget/hooks/useScheduleEngine";
import { useProjectParameters, calcularEncargosPonderados, buildDefaultParameters } from "@budget/hooks/useProjectParameters";
import { useProductionFactors } from "@budget/hooks/useProductionFactors";
import {
  computeTeamTotals,
  computePayroll,
  DEFAULT_PAYROLL_PARAMS,
  type PayrollParams,
  type TeamLineInput,
} from "@budget/lib/payrollEngine";
import { formatBRL, formatNumber } from "@budget/lib/format";

interface Props {
  projectId: string;
  scenarioId: string;
  /** HH MOD calculado no módulo Escopo (para validar planejamento). */
  expectedMODHH?: number;
}

export default function TeamPlanningPanel({ projectId, scenarioId, expectedMODHH = 0 }: Props) {
  const { data: roles = [] } = useJobRoles();
  const { data: rows = [] } = useWorkforceRows(scenarioId);
  const { data: paramsRaw } = useProjectParameters(projectId);
  const { data: prodFactors = [] } = useProductionFactors();
  const { upsertRow, deleteRow } = useWorkforceMutations(scenarioId);

  const params = useMemo(() => paramsRaw ?? buildDefaultParameters(), [paramsRaw]);

  // ── Parâmetros da folha derivados dos parâmetros do projeto
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

  // ── Filtro: linhas estruturadas (job_role_id != null) vs antigas
  const structuredRows = rows.filter((r) => (r as any).job_role_id);

  const linesByClass = (cls: string) =>
    structuredRows.filter((r) => (r as any).classification === cls);

  const totals = useMemo(() => {
    const inputs: TeamLineInput[] = structuredRows.map((r) => toLineInput(r, roles, params.horas_trabalhadas_mes));
    return computeTeamTotals(inputs, payrollParams);
  }, [structuredRows, roles, payrollParams, params.horas_trabalhadas_mes]);

  const hhDelta = expectedMODHH > 0 ? ((totals.hh_mod - expectedMODHH) / expectedMODHH) * 100 : 0;
  const hhDivergent = expectedMODHH > 0 && Math.abs(hhDelta) > 5;

  // ── Picos: simulamos meses do projeto (usa duração do contrato, fallback 12)
  const picoMOD = useMemo(() => Math.max(...structuredRows.filter(r => (r as any).classification === "MOD").map(r => Number((r as any).people_count) || 0), 0), [structuredRows]);
  const picoMOI = useMemo(() => structuredRows.filter(r => (r as any).classification !== "MOD").reduce((a, r) => a + (Number((r as any).people_count) || 0), 0), [structuredRows]);

  const handleAddRole = (role: JobRole, classification: "MOD" | "MOI_CLT" | "MOI_PJ") => {
    upsertRow.mutate({
      label: role.role_name,
      row_type: "function",
      resource_type: classification === "MOD" ? "MOD" : "MOI",
      job_role_id: role.id,
      classification,
      people_count: 1,
      period_months: 6,
      hours_per_month: params.horas_trabalhadas_mes,
      base_salary_override: null,
      pericul_enabled: role.pericul_default,
      insalub_enabled: role.insalub_default,
      sort_order: structuredRows.length + 1,
      weekly_values: [],
      sector: role.specialty_code,
    } as any);
  };

  return (
    <Card className="p-5 bg-card border-border space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Planejamento de Equipe</h3>
          <p className="text-xs text-muted-foreground">
            Qtde × período × horas/mês → HH planejado · custo de folha calculado automaticamente
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={Hammer}
          label="HH MOD"
          value={formatNumber(totals.hh_mod) + " HH"}
          sub={hhDivergent ? `${hhDelta > 0 ? "+" : ""}${hhDelta.toFixed(1)}% vs escopo` : expectedMODHH > 0 ? `vs ${formatNumber(expectedMODHH)} HH escopo ✓` : ""}
          subTone={hhDivergent ? "warn" : "ok"}
          highlight
        />
        <Kpi icon={Briefcase} label="HH MOI" value={formatNumber(totals.hh_moi) + " HH"} />
        <Kpi icon={Users} label="Pico MOD / MOI" value={`${picoMOD} / ${picoMOI}`} sub="pessoas no auge" />
        <Kpi
          icon={Calculator}
          label="Custo Folha Total"
          value={formatBRL(totals.custo_total)}
          sub={`MOD ${formatBRL(totals.custo_mod)} · MOI ${formatBRL(totals.custo_moi)}`}
          highlight
        />
      </div>

      {/* ── Aviso de divergência HH ── */}
      {hhDivergent && (
        <div className="flex items-center gap-2 p-3 rounded border border-yellow-500/30 bg-yellow-500/5 text-xs">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span>
            HH planejado da equipe MOD difere <strong>{Math.abs(hhDelta).toFixed(1)}%</strong> do HH calculado no escopo
            ({formatNumber(totals.hh_mod)} HH vs {formatNumber(expectedMODHH)} HH). Tolerância: 5%.
          </span>
        </div>
      )}
      {expectedMODHH > 0 && !hhDivergent && totals.hh_mod > 0 && (
        <div className="flex items-center gap-2 p-2 rounded border border-emerald-500/20 bg-emerald-500/5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>HH planejado consistente com o HH calculado no escopo (Δ {hhDelta.toFixed(1)}%).</span>
        </div>
      )}

      {/* ── Encargos efetivos info ── */}
      <div className="text-[11px] text-muted-foreground border border-dashed border-border rounded p-2">
        Encargos médios aplicados: <strong className="text-foreground font-mono">CPRB {payrollParams.cprb_medio_pct.toFixed(2)}%</strong> + INSS {payrollParams.inss_medio_pct.toFixed(2)}% + FGTS 8% + Férias/13º 19,4% + Outros {payrollParams.outros_encargos_pct}% = <strong className="text-primary font-mono">{(payrollParams.cprb_medio_pct + payrollParams.inss_medio_pct + 8 + 19.44 + payrollParams.outros_encargos_pct).toFixed(2)}%</strong> · ajuste em ⚙ Parâmetros do Projeto
      </div>

      {/* ── Tabs MOD / MOI CLT / MOI PJ ── */}
      <Tabs defaultValue="mod">
        <TabsList>
          <TabsTrigger value="mod" className="text-xs">
            <Hammer className="w-3.5 h-3.5 mr-1" /> Equipe MOD ({linesByClass("MOD").length})
          </TabsTrigger>
          <TabsTrigger value="clt" className="text-xs">
            <Briefcase className="w-3.5 h-3.5 mr-1" /> MOI CLT ({linesByClass("MOI_CLT").length})
          </TabsTrigger>
          <TabsTrigger value="pj" className="text-xs">
            <Briefcase className="w-3.5 h-3.5 mr-1" /> MOI PJ ({linesByClass("MOI_PJ").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mod" className="mt-3">
          <TeamSection
            classification="MOD"
            roles={roles.filter((r) => r.classification === "MOD")}
            rows={linesByClass("MOD")}
            payrollParams={payrollParams}
            defaultHoursPerMonth={params.horas_trabalhadas_mes}
            prodFactors={prodFactors}
            onAddRole={(role) => handleAddRole(role, "MOD")}
            onUpdate={(id, patch) => upsertRow.mutate({ id, ...patch } as any)}
            onDelete={(id) => deleteRow.mutate(id)}
          />
        </TabsContent>
        <TabsContent value="clt" className="mt-3">
          <TeamSection
            classification="MOI_CLT"
            roles={roles.filter((r) => r.classification === "MOI_CLT")}
            rows={linesByClass("MOI_CLT")}
            payrollParams={payrollParams}
            defaultHoursPerMonth={params.horas_trabalhadas_mes}
            prodFactors={prodFactors}
            onAddRole={(role) => handleAddRole(role, "MOI_CLT")}
            onUpdate={(id, patch) => upsertRow.mutate({ id, ...patch } as any)}
            onDelete={(id) => deleteRow.mutate(id)}
          />
        </TabsContent>
        <TabsContent value="pj" className="mt-3">
          <TeamSection
            classification="MOI_PJ"
            roles={roles.filter((r) => r.classification === "MOI_PJ")}
            rows={linesByClass("MOI_PJ")}
            payrollParams={payrollParams}
            defaultHoursPerMonth={params.horas_trabalhadas_mes}
            prodFactors={prodFactors}
            onAddRole={(role) => handleAddRole(role, "MOI_PJ")}
            onUpdate={(id, patch) => upsertRow.mutate({ id, ...patch } as any)}
            onDelete={(id) => deleteRow.mutate(id)}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
function toLineInput(row: WorkforceRow, roles: JobRole[], defaultHpm: number): TeamLineInput {
  const r = row as any;
  const role = roles.find((x) => x.id === r.job_role_id);
  return {
    classification: (r.classification || "MOD") as any,
    people_count: Number(r.people_count) || 0,
    period_months: Number(r.period_months) || 0,
    hours_per_month: Number(r.hours_per_month) || defaultHpm,
    base_salary: Number(r.base_salary_override ?? role?.base_salary ?? 0),
    pericul_enabled: !!r.pericul_enabled,
    insalub_enabled: !!r.insalub_enabled,
  };
}

// ─────────────────────────────────────────────────────────────────────
interface SectionProps {
  classification: "MOD" | "MOI_CLT" | "MOI_PJ";
  roles: JobRole[];
  rows: WorkforceRow[];
  payrollParams: PayrollParams;
  defaultHoursPerMonth: number;
  prodFactors: { specialty_code: string; specialty_label: string }[];
  onAddRole: (role: JobRole) => void;
  onUpdate: (id: string, patch: Partial<any>) => void;
  onDelete: (id: string) => void;
}

function TeamSection({
  classification,
  roles,
  rows,
  payrollParams,
  defaultHoursPerMonth,
  prodFactors,
  onAddRole,
  onUpdate,
  onDelete,
}: SectionProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const handleAdd = () => {
    const role = roles.find((r) => r.id === selectedRoleId);
    if (role) {
      onAddRole(role);
      setSelectedRoleId("");
    }
  };

  // Group MOD by specialty
  const grouped = useMemo(() => {
    if (classification !== "MOD") return [{ key: "all", label: "", rows }];
    const map = new Map<string, { key: string; label: string; rows: WorkforceRow[] }>();
    for (const r of rows) {
      const role = roles.find((x) => x.id === (r as any).job_role_id);
      const key = role?.specialty_code || "outros";
      const label = prodFactors.find((p) => p.specialty_code === key)?.specialty_label || key;
      if (!map.has(key)) map.set(key, { key, label, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [classification, rows, roles, prodFactors]);

  const isPJ = classification === "MOI_PJ";

  return (
    <div className="space-y-3">
      {/* Add row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Adicionar cargo</label>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione um cargo do catálogo..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {r.role_name} — <span className="font-mono text-muted-foreground">{formatBRL(r.base_salary)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={!selectedRoleId} size="sm" className="gap-1">
          <Plus className="w-3 h-3" /> Adicionar
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded">
          Nenhum cargo adicionado a esta equipe.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.key} className="border border-border rounded-md overflow-hidden">
              {group.label && (
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border text-[10px] font-medium uppercase tracking-wider text-foreground">
                  {group.label}
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead className="w-16 text-center">Qtde</TableHead>
                    <TableHead className="w-20 text-center">Período (m)</TableHead>
                    <TableHead className="w-20 text-center">h/mês</TableHead>
                    <TableHead className="w-24 text-right">HH total</TableHead>
                    <TableHead className="w-28 text-right">{isPJ ? "Valor PJ/mês" : "Salário base"}</TableHead>
                    {!isPJ && <TableHead className="w-12 text-center" title="Periculosidade">Per</TableHead>}
                    {!isPJ && <TableHead className="w-12 text-center" title="Insalubridade">Ins</TableHead>}
                    <TableHead className="w-32 text-right">Custo total</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((r) => (
                    <TeamRowItem
                      key={r.id}
                      row={r}
                      roles={roles}
                      payrollParams={payrollParams}
                      defaultHpm={defaultHoursPerMonth}
                      isPJ={isPJ}
                      onUpdate={(patch) => onUpdate(r.id, patch)}
                      onDelete={() => onDelete(r.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function TeamRowItem({
  row,
  roles,
  payrollParams,
  defaultHpm,
  isPJ,
  onUpdate,
  onDelete,
}: {
  row: WorkforceRow;
  roles: JobRole[];
  payrollParams: PayrollParams;
  defaultHpm: number;
  isPJ: boolean;
  onUpdate: (patch: Partial<any>) => void;
  onDelete: () => void;
}) {
  const r = row as any;
  const role = roles.find((x) => x.id === r.job_role_id);
  const baseSalary = Number(r.base_salary_override ?? role?.base_salary ?? 0);
  const people = Number(r.people_count) || 0;
  const months = Number(r.period_months) || 0;
  const hpm = Number(r.hours_per_month) || defaultHpm;
  const hhTotal = people * months * hpm;

  const payroll = computePayroll(toLineInput(row, roles, defaultHpm), payrollParams);

  return (
    <TableRow>
      <TableCell className="text-foreground">{role?.role_name || row.label}</TableCell>
      <TableCell>
        <Input
          type="number"
          value={people}
          onChange={(e) => onUpdate({ people_count: +e.target.value })}
          className="h-7 text-center text-xs"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.5"
          value={months}
          onChange={(e) => onUpdate({ period_months: +e.target.value })}
          className="h-7 text-center text-xs"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={hpm}
          onChange={(e) => onUpdate({ hours_per_month: +e.target.value })}
          className="h-7 text-center text-xs"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-primary">{formatNumber(hhTotal)}</TableCell>
      <TableCell>
        <Input
          type="number"
          value={baseSalary}
          onChange={(e) => onUpdate({ base_salary_override: +e.target.value })}
          className="h-7 text-right text-xs font-mono"
        />
      </TableCell>
      {!isPJ && (
        <TableCell className="text-center">
          <Switch
            checked={!!r.pericul_enabled}
            onCheckedChange={(v) => onUpdate({ pericul_enabled: v, insalub_enabled: v ? false : r.insalub_enabled })}
            className="scale-75"
          />
        </TableCell>
      )}
      {!isPJ && (
        <TableCell className="text-center">
          <Switch
            checked={!!r.insalub_enabled}
            onCheckedChange={(v) => onUpdate({ insalub_enabled: v, pericul_enabled: v ? false : r.pericul_enabled })}
            className="scale-75"
          />
        </TableCell>
      )}
      <TableCell className="text-right font-mono font-semibold text-foreground">
        {formatBRL(payroll.custo_total)}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────
function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  subTone,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  subTone?: "ok" | "warn";
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="font-mono text-base font-bold text-foreground">{value}</div>
      {sub && (
        <div
          className={`text-[10px] mt-0.5 ${
            subTone === "warn" ? "text-yellow-500" : subTone === "ok" ? "text-emerald-500" : "text-muted-foreground"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
