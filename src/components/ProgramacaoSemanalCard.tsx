import { useState, Fragment } from "react";
import { useCurrentProject } from "@/store/projectStore";
import { Link } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
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
import { ppcDaSemana, ultimaSemana } from "@/lib/ppc";
import Causa6MSelect from "@/components/Causa6MSelect";
import { useProjectStore } from "@/store/projectStore";
import { exigeJustificativa, COR_CAUSA as CAUSA_COLORS, CAUSAS_6M as ALL_CAUSAS } from "@/lib/causas6m";

const DIAS_CURTOS = ["2ª", "3ª", "4ª", "5ª", "6ª", "Sáb"] as const;

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

type TabId = "atividades" | "ppc" | "planos";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------



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
  const { info } = useCurrentProject();
  const clientName = info?.cliente?.trim() || "Cliente";

  const [activeTab, setActiveTab] = useState<TabId>("atividades");
  const { selectedProjectId, setAtividadeJustificativa } = useProjectStore();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [responsavelMap, setResponsavelMap] = useState<Map<string, string>>(new Map());

  // Planos de Ação filter state
  const [filterSemana, setFilterSemana] = useState<string>("todas");
  const [filterCausa, setFilterCausa] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // -------------------------------------------------------------------------
  // TAB A — PPC Médio Acumulado (summary badge, table rendered by PpcSemanalTable)
  // -------------------------------------------------------------------------

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
    { id: "atividades", label: "Atividades" },
    { id: "ppc", label: "PPC Semanal" },
    { id: "planos", label: "Planos de Ação" },
  ];

  // PPC da última semana importada — alimenta o indicador e a barra do topo.
  // É binário: conta atividades com baixa dada ÷ atividades programadas.
  const ultima = ultimaSemana(data);
  const resumo = ppcDaSemana(ultima);
  const ppcPct = resumo.pct;
  const ppcColor = ppcPct >= 80 ? "text-success" : "text-destructive";

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Programação Semanal
          </h3>
          <p className="text-xs text-muted-foreground">
            Tarefas programadas × concluídas (PPC)
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className={cn("text-xl font-bold leading-none", ppcColor)}>
              {Math.round(ppcPct)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              PPC · {resumo.concluidas}/{resumo.programadas}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de PPC */}
      <div className="h-2 rounded-full bg-muted overflow-hidden mt-3 mb-4">
        <div
          className={cn("h-full rounded-full transition-all", ppcPct >= 80 ? "bg-success" : "bg-primary")}
          style={{ width: `${Math.min(Math.max(ppcPct, 0), 100)}%` }}
        />
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CalendarCheck className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma semana importada</p>
          <p className="text-xs text-muted-foreground/70 max-w-[300px]">
            Importe a planilha de Programação Semanal em{' '}
            <Link to="/dados" className="underline hover:text-foreground">Dados</Link>.
          </p>
        </div>
      ) : (
      /* min-h-0 + overflow-y-auto: o conteúdo se ajusta ao espaço do card (que
         acompanha a altura da linha do grid) em vez de empurrar o layout. */
      <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Tab buttons */}
      <div className="flex gap-1 border-b shrink-0">
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

      {/* Painel das abas — rola dentro do card quando o conteúdo passa da altura */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* TAB — Atividades da semana, como vieram do template de importação.
          Colunas mapeadas: H (Atividade Detalhada), I (Local), O (P/R),
          Q…V (1 = programado/realizado no dia) e X (Aderência). */}
      {activeTab === "atividades" && ultima && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Semana {ultima.semana} · {ultima.periodo} — 1 = dia programado/realizado, 0 = não.
            A aderência é realizado ÷ previsto; o PPC do card é a média das aderências.
          </p>
          {ultima.atividades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade nesta semana.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-table-header text-table-header-foreground">
                    <th className="px-2 py-1.5 text-left rounded-tl-lg min-w-[180px]">Atividade</th>
                    <th className="px-2 py-1.5 text-left">Local</th>
                    <th className="px-2 py-1.5 text-center w-8">P/R</th>
                    {DIAS_CURTOS.map((d) => (
                      <th key={d} className="px-1 py-1.5 text-center w-7">{d}</th>
                    ))}
                    <th className="px-2 py-1.5 text-center w-20">Aderência</th>
                    <th className="px-2 py-1.5 text-left rounded-tr-lg min-w-[140px]">Causa (6M)</th>
                  </tr>
                </thead>
                <tbody>
                  {ultima.atividades.map((a, i) => {
                    const ader = a.aderencia;
                    const ok = a.executada || (ader ?? 0) >= 0.9;
                    return (
                      <Fragment key={`${a.id}-${i}`}>
                        <tr className={cn(i % 2 ? "bg-muted/20" : "")}>
                          <td rowSpan={2} className="px-2 py-1 align-top border-b border-border font-medium text-foreground">
                            {a.descricao || a.idCronograma || `Atividade ${i + 1}`}
                          </td>
                          <td rowSpan={2} className="px-2 py-1 align-top border-b border-border text-muted-foreground">
                            {a.local || "—"}
                          </td>
                          <td className="px-2 py-0.5 text-center font-bold text-muted-foreground">P</td>
                          {a.dias.prev.map((v, d) => (
                            <td key={d} className="px-1 py-0.5 text-center tabular-nums text-muted-foreground">
                              {v ? 1 : 0}
                            </td>
                          ))}
                          <td rowSpan={2} className="px-2 py-1 text-center align-middle border-b border-border">
                            {ader == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold",
                                  ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                                )}
                              >
                                {Math.round(ader * 100)}%
                              </span>
                            )}
                          </td>
                          {/* Causa 6M — só faz sentido para quem ficou abaixo de 90%,
                              que é a regra do próprio template. */}
                          <td rowSpan={2} className="px-2 py-1 align-middle border-b border-border">
                            {exigeJustificativa(a) ? (
                              <Causa6MSelect
                                compacto
                                causas={a.causas6M}
                                justificativa={a.planoAcao}
                                onChange={(patch) =>
                                  selectedProjectId &&
                                  setAtividadeJustificativa(selectedProjectId, ultima.semana, i, patch)
                                }
                              />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        <tr className={cn(i % 2 ? "bg-muted/20" : "", "border-b border-border")}>
                          <td className="px-2 py-0.5 text-center font-bold text-foreground">R</td>
                          {a.dias.real.map((v, d) => (
                            <td
                              key={d}
                              className={cn(
                                "px-1 py-0.5 text-center tabular-nums font-semibold",
                                v ? "text-success" : "text-muted-foreground"
                              )}
                            >
                              {v ? 1 : 0}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* TAB A — PPC Semanal (tabela) */}
      {activeTab === "ppc" && (
        <PpcSemanalTable data={data} showPeriodo />
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
                    <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">
                      Responsável
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
                        <td className="py-2 pr-3">
                          <Select
                            value={responsavelMap.get(row.key) ?? "Megasteam"}
                            onValueChange={(val) =>
                              setResponsavelMap((prev) => {
                                const next = new Map(prev);
                                next.set(row.key, val);
                                return next;
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-32 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Megasteam">Megasteam</SelectItem>
                              <SelectItem value={clientName}>{clientName}</SelectItem>
                              <SelectItem value="Ambos">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
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
      </div>
      )}
    </div>
  );
}
