// ============================================================
// Medição (BM) — apuração mensal do realizado por linha DRG
// ============================================================
// Conceito:
//   - Cada contrato tem N linhas DRG (planned_value vem do Budget)
//   - A Medição preenche o actual_value de cada linha p/ a competência
//   - Comparação Previsto x Realizado é AUTOMÁTICA (mesma linha DRG)
//   - Faróis indicam status do desvio
//   - Importação consolidada inicial via planilha; depois, edição inline
// Tabela: financial_drg_lines (project_id, competence_month, line_code, ...)
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  FileSpreadsheet,
  Loader2,
  PencilLine,
  Save,
  Sigma,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";

import { supabase } from "@budget/integrations/supabase/client";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { toast } from "@budget/hooks/use-toast";
import { formatBRL, formatPct } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";

import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Skeleton } from "@budget/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@budget/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@budget/components/ui/dialog";
import MegasteamDrgUploader from "./MegasteamDrgUploader";

// ===== Tipos =====
interface DrgLine {
  id: string;
  project_id: string;
  competence_month: string;
  line_code: string;
  line_label: string;
  is_percentage: boolean;
  sort_order: number;
  planned_value: number;
  actual_value: number;
  notes: string | null;
  source: string;
}

// ===== Faróis =====
type LightTone = "neutral" | "green" | "yellow" | "red";

const LIGHT_THRESHOLDS = {
  green: 5, // até ±5% = ok
  yellow: 15, // até ±15% = atenção
} as const;

const computeLight = (planned: number, actual: number): LightTone => {
  if (planned === 0 && actual === 0) return "neutral";
  if (planned === 0) return actual === 0 ? "neutral" : "yellow";
  const variation = Math.abs(((actual - planned) / planned) * 100);
  if (variation <= LIGHT_THRESHOLDS.green) return "green";
  if (variation <= LIGHT_THRESHOLDS.yellow) return "yellow";
  return "red";
};

const LIGHT_STYLES: Record<LightTone, { dot: string; bg: string; text: string; label: string }> = {
  neutral: {
    dot: "text-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    label: "—",
  },
  green: {
    dot: "text-emerald-600",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    label: "OK",
  },
  yellow: {
    dot: "text-amber-600",
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    label: "Atenção",
  },
  red: {
    dot: "text-red-600",
    bg: "bg-red-500/10",
    text: "text-red-700",
    label: "Crítico",
  },
};

// ===== Helpers =====
const monthLabelFromIso = (iso: string) => {
  try {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    const lbl = format(d, "MMMM 'de' yyyy", { locale: ptBR });
    return lbl.charAt(0).toUpperCase() + lbl.slice(1);
  } catch {
    return iso.slice(0, 7);
  }
};

const parseNumber = (v: string): number => {
  const cleaned = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

// Sub-totais (heurística por prefixo do code) — útil mas não obrigatório
const isSubtotalCode = (code: string) =>
  /^(TV|TI|VL|PE|MOI|MOD|TS|TM|CG|TC|CT|MC|MO|RES|EBITDA|EBT|TOTAL)/i.test(code);

// ============================================================
// Componente
// ============================================================
const ContractMeasurement = () => {
  const { contractId, competenceMonth, competenceYm } = useFinancialWorkspace();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [uploaderOpen, setUploaderOpen] = useState(false);

  // ---- Carrega TODAS as linhas DRG do contrato (para calcular histórico)
  const { data: allLines = [], isLoading } = useQuery({
    queryKey: ["measurement-drg-lines", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<DrgLine[]> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("financial_drg_lines")
        .select(
          "id, project_id, competence_month, line_code, line_label, is_percentage, sort_order, planned_value, actual_value, notes, source",
        )
        .eq("project_id", contractId)
        .order("competence_month", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DrgLine[];
    },
  });

  // ---- Linhas da competência ativa
  const lines = useMemo(() => {
    return allLines.filter(
      (l) => String(l.competence_month).slice(0, 7) === competenceYm,
    );
  }, [allLines, competenceYm]);

  // ---- Reset estado de edição ao trocar mês/contrato
  useEffect(() => {
    setEditing({});
    setSaving({});
  }, [contractId, competenceYm]);

  // ---- Mutation: salvar realizado de UMA linha
  const saveLine = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase
        .from("financial_drg_lines")
        .update({ actual_value: value, source: "manual" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-drg-lines", contractId] });
      qc.invalidateQueries({ queryKey: ["financial-drg-lines"] });
      qc.invalidateQueries({ queryKey: ["financial-dashboard"] });
    },
    onError: (e: Error) =>
      toast({
        title: "Erro ao salvar",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleSaveOne = async (line: DrgLine) => {
    const raw = editing[line.id];
    if (raw === undefined) return;
    const value = parseNumber(raw);
    setSaving((s) => ({ ...s, [line.id]: true }));
    try {
      await saveLine.mutateAsync({ id: line.id, value });
      setEditing((e) => {
        const next = { ...e };
        delete next[line.id];
        return next;
      });
      toast({
        title: "Linha atualizada",
        description: `${line.line_code} — ${formatBRL(value)}`,
      });
    } finally {
      setSaving((s) => ({ ...s, [line.id]: false }));
    }
  };

  // ---- Totais agregados (ignora subtotais para evitar dupla contagem)
  const totals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    let countDirty = 0;
    for (const l of lines) {
      if (isSubtotalCode(l.line_code)) continue;
      planned += Number(l.planned_value || 0);
      actual += Number(l.actual_value || 0);
      if (Number(l.actual_value || 0) !== 0) countDirty += 1;
    }
    const variance = actual - planned;
    const variancePct = planned !== 0 ? (variance / Math.abs(planned)) * 100 : 0;
    return {
      planned,
      actual,
      variance,
      variancePct,
      countTotal: lines.length,
      countDirty,
    };
  }, [lines]);

  const overallLight = useMemo(
    () => computeLight(totals.planned, totals.actual),
    [totals.planned, totals.actual],
  );

  // ====== Render ======
  if (!contractId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Selecione um contrato para acompanhar a medição.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============= Cabeçalho da aba ============= */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Medição (BM) · {monthLabelFromIso(competenceMonth)}
          </h2>
          <p className="text-xs text-muted-foreground">
            Lance o realizado de cada linha DRG. O previsto vem do Budget e os faróis indicam o desvio.
          </p>
        </div>

        <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Upload className="h-3.5 w-3.5" />
              Importar medição consolidada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Importar medição consolidada
              </DialogTitle>
              <DialogDescription>
                Use o workbook DRG completo (mesmo modelo do Megasteam). As abas DRG por centro
                de custo são lidas e o realizado de cada linha é atualizado por competência.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              <MegasteamDrgUploader />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ============= KPIs ============= */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <KpiCard
          icon={Sigma}
          label="Previsto"
          value={formatBRL(totals.planned)}
          tone="blue"
        />
        <KpiCard
          icon={Sigma}
          label="Realizado"
          value={formatBRL(totals.actual)}
          tone="indigo"
        />
        <KpiCard
          icon={totals.variance >= 0 ? TrendingUp : TrendingDown}
          label="Desvio"
          value={`${totals.variance >= 0 ? "+" : ""}${formatBRL(totals.variance)}`}
          tone={totals.variance >= 0 ? "emerald" : "red"}
        />
        <KpiCard
          icon={totals.variancePct >= 0 ? TrendingUp : TrendingDown}
          label="Variação %"
          value={`${totals.variancePct >= 0 ? "+" : ""}${formatPct(totals.variancePct, 1)}`}
          tone={totals.variancePct >= 0 ? "emerald" : "red"}
        />
        <KpiCard
          icon={PencilLine}
          label="Linhas"
          value={`${totals.countDirty}/${totals.countTotal}`}
          sub="preenchidas"
          tone="slate"
        />
        <KpiCard
          icon={CircleDot}
          label="Status geral"
          value={LIGHT_STYLES[overallLight].label}
          tone={
            overallLight === "green"
              ? "emerald"
              : overallLight === "yellow"
              ? "amber"
              : overallLight === "red"
              ? "red"
              : "slate"
          }
        />
      </section>

      {/* ============= Tabela ============= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold">
              Detalhamento por linha DRG
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-emerald-600" /> ≤ {LIGHT_THRESHOLDS.green}%
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-amber-600" /> ≤ {LIGHT_THRESHOLDS.yellow}%
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-red-600" /> &gt; {LIGHT_THRESHOLDS.yellow}%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : lines.length === 0 ? (
            <div className="py-12 text-center space-y-2 px-4">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Nenhuma linha DRG encontrada para esta competência.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Importe o Budget do contrato (aba <strong>Budget</strong>) ou use o botão acima para
                importar a medição consolidada inicial.
              </p>
            </div>
          ) : (
            <MeasurementTable
              lines={lines}
              editing={editing}
              setEditing={setEditing}
              saving={saving}
              onSave={handleSaveOne}
            />
          )}
        </CardContent>
      </Card>

      {/* ============= Histórico de competências (rodapé) ============= */}
      {allLines.length > 0 && (
        <CompetenceHistory allLines={allLines} currentYm={competenceYm} />
      )}
    </div>
  );
};

// ============================================================
// Tabela de medição
// ============================================================
interface MeasurementTableProps {
  lines: DrgLine[];
  editing: Record<string, string>;
  setEditing: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: Record<string, boolean>;
  onSave: (line: DrgLine) => void;
}

const MeasurementTable = ({
  lines,
  editing,
  setEditing,
  saving,
  onSave,
}: MeasurementTableProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b sticky top-0 z-10">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 w-8 text-center">●</th>
              <th className="px-2 py-2 w-20">Código</th>
              <th className="px-2 py-2">Linha DRG</th>
              <th className="px-2 py-2 w-32 text-right">Previsto</th>
              <th className="px-2 py-2 w-36 text-right">Realizado</th>
              <th className="px-2 py-2 w-28 text-right">Diferença</th>
              <th className="px-2 py-2 w-20 text-right">Var %</th>
              <th className="px-2 py-2 w-16 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const isSubtotal = isSubtotalCode(line.line_code);
              const planned = Number(line.planned_value || 0);
              const editValue = editing[line.id];
              const currentActual =
                editValue !== undefined ? parseNumber(editValue) : Number(line.actual_value || 0);
              const diff = currentActual - planned;
              const diffPct = planned !== 0 ? (diff / Math.abs(planned)) * 100 : 0;
              const light = computeLight(planned, currentActual);
              const isDirty = editValue !== undefined && parseNumber(editValue) !== Number(line.actual_value || 0);
              const isSaving = !!saving[line.id];

              return (
                <tr
                  key={line.id}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    isSubtotal
                      ? "bg-muted/30 font-semibold"
                      : "hover:bg-muted/20",
                    isDirty && "bg-amber-50/40 dark:bg-amber-950/10",
                  )}
                >
                  <td className="px-2 py-1.5 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CircleDot
                          className={cn("h-3 w-3 inline-block", LIGHT_STYLES[light].dot)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs">
                          {LIGHT_STYLES[light].label}
                          {planned !== 0 && (
                            <> · {Math.abs(diffPct).toFixed(1)}% de desvio</>
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {line.line_code}
                  </td>
                  <td className="px-2 py-1.5 truncate max-w-[260px]" title={line.line_label}>
                    {line.line_label}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {planned !== 0 ? formatBRL(planned) : "—"}
                  </td>
                  <td className="px-1.5 py-1 text-right">
                    <Input
                      value={
                        editValue !== undefined
                          ? editValue
                          : line.actual_value
                          ? Number(line.actual_value).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : ""
                      }
                      onChange={(e) =>
                        setEditing((s) => ({ ...s, [line.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                          onSave(line);
                        }
                        if (e.key === "Escape") {
                          setEditing((s) => {
                            const n = { ...s };
                            delete n[line.id];
                            return n;
                          });
                        }
                      }}
                      placeholder="0,00"
                      className={cn(
                        "h-7 text-right tabular-nums text-xs px-1.5",
                        isDirty && "border-amber-500/60",
                      )}
                      inputMode="decimal"
                    />
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right tabular-nums",
                      diff > 0 && "text-emerald-700",
                      diff < 0 && "text-red-700",
                    )}
                  >
                    {diff !== 0 ? `${diff > 0 ? "+" : ""}${formatBRL(diff)}` : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right tabular-nums text-[11px]",
                      diffPct > 0 && "text-emerald-700",
                      diffPct < 0 && "text-red-700",
                    )}
                  >
                    {planned !== 0 ? `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {isDirty ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-emerald-700 hover:bg-emerald-500/15"
                          onClick={() => onSave(line)}
                          disabled={isSaving}
                          aria-label="Salvar"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={() =>
                            setEditing((s) => {
                              const n = { ...s };
                              delete n[line.id];
                              return n;
                            })
                          }
                          aria-label="Cancelar"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : line.actual_value ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 inline-block opacity-60" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
};

// ============================================================
// Histórico de competências
// ============================================================
const CompetenceHistory = ({
  allLines,
  currentYm,
}: {
  allLines: DrgLine[];
  currentYm: string;
}) => {
  const months = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number; count: number }>();
    for (const l of allLines) {
      if (isSubtotalCode(l.line_code)) continue;
      const ym = String(l.competence_month).slice(0, 7);
      const acc = map.get(ym) ?? { planned: 0, actual: 0, count: 0 };
      acc.planned += Number(l.planned_value || 0);
      acc.actual += Number(l.actual_value || 0);
      acc.count += 1;
      map.set(ym, acc);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12);
  }, [allLines]);

  if (months.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Histórico de competências</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2 text-right">Previsto</th>
                <th className="px-3 py-2 text-right">Realizado</th>
                <th className="px-3 py-2 text-right">Desvio</th>
                <th className="px-3 py-2 text-right">Var %</th>
                <th className="px-3 py-2 text-center w-20">Farol</th>
              </tr>
            </thead>
            <tbody>
              {months.map(([ym, t]) => {
                const variance = t.actual - t.planned;
                const variancePct = t.planned !== 0 ? (variance / Math.abs(t.planned)) * 100 : 0;
                const light = computeLight(t.planned, t.actual);
                const isCurrent = ym === currentYm;
                const label = (() => {
                  try {
                    return format(new Date(`${ym}-01T00:00:00`), "MMM/yyyy", { locale: ptBR });
                  } catch {
                    return ym;
                  }
                })();
                return (
                  <tr
                    key={ym}
                    className={cn(
                      "border-b last:border-b-0",
                      isCurrent && "bg-primary/5 font-medium",
                    )}
                  >
                    <td className="px-3 py-2 capitalize">{label}{isCurrent && <Badge variant="outline" className="ml-2 h-4 px-1 text-[9px]">atual</Badge>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(t.planned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(t.actual)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        variance > 0 && "text-emerald-700",
                        variance < 0 && "text-red-700",
                      )}
                    >
                      {variance >= 0 ? "+" : ""}{formatBRL(variance)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums text-[11px]",
                        variancePct > 0 && "text-emerald-700",
                        variancePct < 0 && "text-red-700",
                      )}
                    >
                      {variancePct >= 0 ? "+" : ""}{variancePct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                          LIGHT_STYLES[light].bg,
                          LIGHT_STYLES[light].text,
                        )}
                      >
                        <CircleDot className="h-2.5 w-2.5" />
                        {LIGHT_STYLES[light].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// Card de KPI
// ============================================================
const TONE_CLASSES: Record<string, string> = {
  blue: "border-l-blue-500/60 bg-blue-500/[0.04]",
  indigo: "border-l-indigo-500/60 bg-indigo-500/[0.04]",
  emerald: "border-l-emerald-500/60 bg-emerald-500/[0.04]",
  amber: "border-l-amber-500/60 bg-amber-500/[0.04]",
  red: "border-l-red-500/60 bg-red-500/[0.04]",
  slate: "border-l-slate-500/60 bg-slate-500/[0.04]",
};

const ICON_CLASSES: Record<string, string> = {
  blue: "text-blue-600",
  indigo: "text-indigo-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  slate: "text-slate-600",
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TONE_CLASSES;
}) => (
  <Card className={cn("border-l-4", TONE_CLASSES[tone])}>
    <CardContent className="py-3 px-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3", ICON_CLASSES[tone])} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent>
  </Card>
);

export default ContractMeasurement;
