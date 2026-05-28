import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProgramacaoSemanal, Causa6M } from "@/lib/parseProgramacaoSemanal";
import PpcSemanalTable from "@/components/PpcSemanalTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  data: ProgramacaoSemanal[];
  histogramData?: {
    date: string;
    semana: number;
    previsto: number;
    real: number;
  }[];
}

type TabId = "ppc" | "pareto" | "planos";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAUSA_COLORS: Record<Causa6M, string> = {
  Método: "#3b82f6",
  Máquina: "#f97316",
  Medida: "#eab308",
  "Meio Ambiente": "#22c55e",
  "Mão de Obra": "#ef4444",
  Material: "#8b5cf6",
};

const ALL_CAUSAS: Causa6M[] = [
  "Método",
  "Máquina",
  "Medida",
  "Meio Ambiente",
  "Mão de Obra",
  "Material",
];

// ---------------------------------------------------------------------------
// Tooltip customization
// ---------------------------------------------------------------------------

interface PpcTooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface PpcTooltipProps {
  active?: boolean;
  payload?: PpcTooltipPayload[];
  label?: string;
}

function PpcTooltip({ active, payload, label }: PpcTooltipProps) {
  if (!active || !payload?.length) return null;
  // Find ppcSemana from the data point
  const entry = payload[0] as PpcTooltipPayload & { payload?: { ppcSemana?: number; periodo?: string } };
  const ppcSemana = entry.payload?.ppcSemana;
  const periodo = entry.payload?.periodo;
  return (
    <div className="rounded-lg border bg-card p-2 text-xs shadow-md space-y-1">
      <p className="font-semibold text-foreground">{label}{periodo ? ` · ${periodo}` : ""}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
      {ppcSemana !== undefined && (
        <p className={ppcSemana >= 80 ? "text-green-500" : "text-red-500"}>
          PPC: <strong>{ppcSemana}%</strong>
        </p>
      )}
    </div>
  );
}

interface ParetoTooltipPayload {
  name: string;
  value: number;
  color?: string;
}

interface ParetoTooltipProps {
  active?: boolean;
  payload?: ParetoTooltipPayload[];
  label?: string;
}

function ParetoTooltip({ active, payload, label }: ParetoTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-2 text-xs shadow-md space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? "#6b7280" }}>
          {p.name}: <strong>{p.value}{p.name === "Acumulado %" ? "%" : ""}</strong>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProgramacaoSemanalCard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("ppc");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Planos de Ação filter state
  const [filterSemana, setFilterSemana] = useState<string>("todas");
  const [filterCausa, setFilterCausa] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // -------------------------------------------------------------------------
  // TAB A — PPC Médio Acumulado (summary badge, table rendered by PpcSemanalTable)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // TAB B — Pareto 6M data
  // -------------------------------------------------------------------------

  const causaCount = {} as Record<Causa6M, number>;
  for (const semana of data) {
    for (const at of semana.atividades) {
      if (!at.executada && at.causas6M.length > 0) {
        for (const c of at.causas6M) {
          causaCount[c] = (causaCount[c] || 0) + 1;
        }
      }
    }
  }

  const sorted = Object.entries(causaCount).sort(
    (a, b) => b[1] - a[1]
  ) as [Causa6M, number][];
  const total6M = sorted.reduce((s, [, v]) => s + v, 0);
  let acum = 0;
  const paretoData = sorted.map(([causa, count]) => {
    acum += count;
    return {
      causa,
      count,
      pct: Math.round((acum / total6M) * 100),
    };
  });

  // -------------------------------------------------------------------------
  // TAB C — Planos de Ação data
  // -------------------------------------------------------------------------

  interface PlanoRow {
    key: string;
    semana: number;
    periodo: string;
    atividade: string;
    causas: Causa6M[];
    planoAcao: string;
  }

  const planoRows: PlanoRow[] = [];
  for (const semana of data) {
    for (const at of semana.atividades) {
      if (!at.executada && at.causas6M.length > 0) {
        const key = `${semana.semana}-${at.id}-${at.descricao}`;
        planoRows.push({
          key,
          semana: semana.semana,
          periodo: semana.periodo,
          atividade: at.descricao,
          causas: at.causas6M,
          planoAcao: at.planoAcao,
        });
      }
    }
  }

  const semanaOptions = Array.from(new Set(planoRows.map((r) => r.semana))).sort(
    (a, b) => a - b
  );

  const filteredPlanos = planoRows.filter((r) => {
    if (filterSemana !== "todas" && String(r.semana) !== filterSemana)
      return false;
    if (
      filterCausa !== "todas" &&
      !r.causas.includes(filterCausa as Causa6M)
    )
      return false;
    const isResolved = resolvedIds.has(r.key);
    if (filterStatus === "Aberto" && isResolved) return false;
    if (filterStatus === "Resolvido" && !isResolved) return false;
    return true;
  });

  function toggleResolved(key: string) {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const tabs: { id: TabId; label: string }[] = [
    { id: "ppc", label: "PPC Semanal" },
    { id: "pareto", label: "Pareto 6M" },
    { id: "planos", label: "Planos de Ação" },
  ];

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-base">Programação Semanal</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {data.length} semana{data.length !== 1 ? "s" : ""} importada
          {data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-t transition-colors",
              activeTab === t.id
                ? "border border-b-0 border-border bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB A — PPC Semanal (tabela) */}
      {activeTab === "ppc" && (
        <PpcSemanalTable data={data} showPeriodo />
      )}

      {/* TAB B — Pareto 6M */}
      {activeTab === "pareto" && (
        <div className="space-y-3">
          {paretoData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma causa 6M registrada ainda.
            </p>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={paretoData}
                  margin={{ top: 16, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="causa"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip content={<ParetoTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    name="Ocorrências"
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  >
                    {paretoData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          CAUSA_COLORS[entry.causa as Causa6M] ?? "#6b7280"
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pct"
                    name="Acumulado %"
                    stroke="#6b7280"
                    strokeWidth={2}
                    dot={{ fill: "#6b7280", r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Causa legend */}
          {paretoData.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {ALL_CAUSAS.map((c) => (
                <span key={c} className="flex items-center gap-1 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: CAUSA_COLORS[c] }}
                  />
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB C — Planos de Ação */}
      {activeTab === "planos" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterSemana} onValueChange={setFilterSemana}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as semanas</SelectItem>
                {semanaOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Semana {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCausa} onValueChange={setFilterCausa}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Causa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as causas</SelectItem>
                {ALL_CAUSAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {planoRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum plano de ação registrado ainda.
            </p>
          ) : filteredPlanos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum resultado com os filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">
                      Semana
                    </th>
                    <th className="text-left py-2 pr-3 font-medium">
                      Atividade
                    </th>
                    <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">
                      Causa(s) 6M
                    </th>
                    <th className="text-left py-2 pr-3 font-medium">
                      Plano de Ação
                    </th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlanos.map((row) => {
                    const resolved = resolvedIds.has(row.key);
                    return (
                      <tr
                        key={row.key}
                        className={cn(
                          "border-b last:border-0 transition-colors",
                          resolved ? "opacity-60" : ""
                        )}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="font-medium">Sem. {row.semana}</span>
                          {row.periodo && (
                            <span className="block text-muted-foreground leading-tight">
                              {row.periodo}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 max-w-[180px]">
                          <span
                            className={cn(
                              resolved ? "line-through text-muted-foreground" : ""
                            )}
                          >
                            {row.atividade || "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {row.causas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.causas.map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                                  style={{
                                    backgroundColor: CAUSA_COLORS[c] ?? "#6b7280",
                                  }}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 max-w-[200px] text-muted-foreground">
                          {row.planoAcao || "—"}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => toggleResolved(row.key)}
                            className="focus:outline-none"
                            aria-label={
                              resolved
                                ? "Marcar como aberto"
                                : "Marcar como resolvido"
                            }
                          >
                            <Badge
                              variant={resolved ? "secondary" : "destructive"}
                              className="cursor-pointer select-none text-[10px] whitespace-nowrap"
                            >
                              {resolved ? "Resolvido" : "Aberto"}
                            </Badge>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
