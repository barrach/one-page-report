import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { useDrgLines } from "@budget/hooks/useDrgLines";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useScopedSelection } from "@budget/hooks/useScopedSelection";
import { formatBRL, formatPct } from "@budget/lib/format";
import { TrendingUp, TrendingDown, Minus, FileSpreadsheet, AlertTriangle, Download, Sparkles } from "lucide-react";
import { cn } from "@budget/lib/utils";
import {
  exportResumoResultadoXlsx,
  formatCompetenceLabel,
  type ResumoContract,
  type ResumoLine,
} from "@budget/lib/exportResumoResultado";
import { toast } from "@budget/hooks/use-toast";

type ContractRow = {
  projectId: string;
  projectName: string;
  deptCode?: string | null;
  byLine: Map<string, { planned: number; actual: number; isPct: boolean; label: string; sort: number }>;
};

const fmt = (v: number, pct: boolean) => (pct ? formatPct(v * 100, 2) : formatBRL(v));

const diffTone = (planned: number, actual: number) => {
  if (planned === 0 && actual === 0) return "text-muted-foreground";
  const diff = actual - planned;
  if (Math.abs(diff) < Math.abs(planned) * 0.001) return "text-muted-foreground";
  if (planned >= 0) return diff >= 0 ? "text-emerald-600" : "text-destructive";
  return diff <= 0 ? "text-emerald-600" : "text-destructive";
};

const FinanceiroResumoExecutivo = () => {
  const { data: lines, isLoading } = useDrgLines();
  const { view, competenceYm } = useFinancialWorkspace();
  const scoped = useScopedSelection();
  const monthFilter = competenceYm;
  const isContractView = view === "contract";
  const scopedIdSet = useMemo(() => new Set(scoped.projectIds), [scoped.projectIds]);

  const filtered = useMemo(() => {
    return (lines ?? []).filter((l) => {
      if (String(l.competence_month).slice(0, 7) !== monthFilter) return false;
      // Empresa consolidada vê tudo; senão filtra pelos project_ids do escopo
      if (!scoped.isConsolidatedCompany && !scopedIdSet.has(l.project_id)) return false;
      return true;
    });
  }, [lines, monthFilter, scoped.isConsolidatedCompany, scopedIdSet]);

  const contracts = useMemo<ContractRow[]>(() => {
    const map = new Map<string, ContractRow>();
    for (const l of filtered) {
      let cur = map.get(l.project_id);
      if (!cur) {
        cur = {
          projectId: l.project_id,
          projectName: l.projects?.project_name ?? "—",
          deptCode: (l.projects as { dept_code?: string | null } | undefined)?.dept_code ?? null,
          byLine: new Map(),
        };
        map.set(l.project_id, cur);
      }
      const ex = cur.byLine.get(l.line_code) ?? { planned: 0, actual: 0, isPct: l.is_percentage, label: l.line_label, sort: l.sort_order };
      if (l.is_percentage) {
        ex.planned = Number(l.planned_value);
        ex.actual = Number(l.actual_value);
      } else {
        ex.planned += Number(l.planned_value);
        ex.actual += Number(l.actual_value);
      }
      cur.byLine.set(l.line_code, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [filtered]);

  const allLineCodes = useMemo(() => {
    const m = new Map<string, { label: string; sort: number; isPct: boolean }>();
    for (const c of contracts) for (const [code, v] of c.byLine) m.set(code, { label: v.label, sort: v.sort, isPct: v.isPct });
    return Array.from(m.entries()).sort((a, b) => a[1].sort - b[1].sort);
  }, [contracts]);

  const consolidated = useMemo(() => {
    const acc = new Map<string, { planned: number; actual: number; isPct: boolean; label: string }>();
    for (const c of contracts) {
      for (const [code, v] of c.byLine) {
        const cur = acc.get(code) ?? { planned: 0, actual: 0, isPct: v.isPct, label: v.label };
        if (!v.isPct) {
          cur.planned += v.planned;
          cur.actual += v.actual;
        }
        acc.set(code, cur);
      }
    }
    return acc;
  }, [contracts]);

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
    );
  }

  const hasData = (lines?.length ?? 0) > 0;
  const hasMonthData = filtered.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-medium">Visão derivada — gerada pelo sistema</p>
            <p className="text-xs text-muted-foreground">
              O Resumo Executivo é calculado automaticamente a partir do Budget/baseline,
              do Real Mensal (CUSTOS_MES), do DRG mensal e das receitas. Nenhum upload é necessário.
              Importe os custos do mês em <span className="font-medium">Entrada Mensal → Custos Mensais</span>
              para começar a ver os números.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const exportLines = (
    src: Map<string, { planned: number; actual: number; isPct: boolean; label: string }>,
  ): ResumoLine[] =>
    allLineCodes.map(([code, meta]) => {
      const v = src.get(code);
      return {
        code,
        label: meta.label,
        isPct: meta.isPct,
        planned: v?.planned ?? 0,
        actual: v?.actual ?? 0,
        sort: meta.sort,
      };
    });

  const handleExport = () => {
    try {
      const competenceLabel = formatCompetenceLabel(monthFilter);
      const consolidatedLines: ResumoLine[] = exportLines(consolidated);
      const contractsOut: ResumoContract[] = contracts.map((c) => ({
        projectId: c.projectId,
        projectName: c.projectName,
        deptCode: c.deptCode,
        lines: exportLines(c.byLine),
      }));
      exportResumoResultadoXlsx({
        competenceLabel,
        generatedAt: new Date(),
        consolidated: consolidatedLines,
        contracts: contractsOut,
      });
      toast({
        title: "Resumo do Resultado gerado",
        description: `Planilha de ${competenceLabel} criada a partir dos dados do sistema.`,
      });
    } catch (e) {
      toast({
        title: "Erro ao gerar planilha",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {/* Title */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Resumo executivo · {isContractView ? "Contrato" : "Empresa"}
          </h1>
          <p className="text-xs text-muted-foreground">
            DRG Previsto x Realizado · {contracts.length} contrato{contracts.length !== 1 && "s"} no período
          </p>
          <p className="text-[11px] text-muted-foreground/80 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Visão gerada automaticamente — sem upload
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasMonthData && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
              <AlertTriangle className="w-3 h-3" /> Sem DRG no mês selecionado
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={!hasMonthData}
            title="Gera o workbook 'Resumo do Resultado' a partir dos dados do sistema"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLSX
          </Button>
        </div>
      </header>

      {!hasMonthData ? (
        <Card>
          <CardContent className="py-12 text-sm text-center text-muted-foreground">
            Nenhuma linha DRG encontrada para essa competência.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quadro consolidado da empresa (apenas em visão Empresa) */}
          {!isContractView && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consolidado da empresa</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Linha DRG</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead className="text-right">Var %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLineCodes.filter(([, v]) => !v.isPct).map(([code, meta]) => {
                      const v = consolidated.get(code);
                      const planned = v?.planned ?? 0;
                      const actual = v?.actual ?? 0;
                      const diff = actual - planned;
                      const variation = planned !== 0 ? (diff / Math.abs(planned)) * 100 : 0;
                      return (
                        <TableRow key={code}>
                          <TableCell className="font-medium">{meta.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(planned)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(actual)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", diffTone(planned, actual))}>
                            {formatBRL(diff)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", diffTone(planned, actual))}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {formatPct(variation, 1)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tabelas por contrato */}
          {contracts.map((c) => (
            <Card key={c.projectId}>
              <CardHeader>
                <CardTitle className="text-base">{c.projectName}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Linha DRG</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLineCodes.map(([code, meta]) => {
                      const v = c.byLine.get(code);
                      const planned = v?.planned ?? 0;
                      const actual = v?.actual ?? 0;
                      const diff = actual - planned;
                      return (
                        <TableRow key={code}>
                          <TableCell className="font-medium">{meta.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(planned, meta.isPct)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(actual, meta.isPct)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", diffTone(planned, actual))}>
                            {meta.isPct ? formatPct((actual - planned) * 100, 2) : formatBRL(diff)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default FinanceiroResumoExecutivo;
