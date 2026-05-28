import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Badge } from "@budget/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { TrendingUp, TrendingDown, Building2, Briefcase } from "lucide-react";
import { useFinancialContracts } from "@budget/hooks/useFinancialContracts";
import { useScopedSelection } from "@budget/hooks/useScopedSelection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { formatBRL, formatPct } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";

interface SnapshotRow {
  project_id: string;
  competence_month: string;
  planned_value: number | string;
  actual_value: number | string;
  variance_value: number | string;
  margin_percent: number | string;
}

const useAllSnapshots = () => {
  return useQuery({
    queryKey: ["all-contract-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_contract_snapshots")
        .select("project_id, competence_month, planned_value, actual_value, variance_value, margin_percent")
        .order("competence_month", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as SnapshotRow[];
    },
  });
};

const FinanceiroConsolidacao = () => {
  const { data: contracts, isLoading: lc } = useFinancialContracts({
    onlyActive: false,
    includeCompanyEntities: true,
  });
  const { data: snapshots, isLoading: ls } = useAllSnapshots();
  const scoped = useScopedSelection();
  const scopedIdSet = useMemo(() => new Set(scoped.projectIds), [scoped.projectIds]);

  // Lista de contratos respeitando o escopo:
  //  - Contrato → só o contrato selecionado
  //  - Empresa consolidada → todos
  //  - Empresa específica (Megasteam/Administrativo) → só aquela entidade
  const visibleContracts = useMemo(() => {
    if (!contracts) return [];
    if (scoped.scope === "contract" || !scoped.isConsolidatedCompany) {
      return contracts.filter((c) => scopedIdSet.has(c.id));
    }
    return contracts;
  }, [contracts, scoped.scope, scoped.isConsolidatedCompany, scopedIdSet]);

  const aggregated = useMemo(() => {
    if (!visibleContracts || !snapshots) return [];
    const allowed = new Set(visibleContracts.map((c) => c.id));
    const byProject = new Map<string, { planned: number; actual: number; variance: number; months: number }>();
    snapshots.forEach((s) => {
      if (!allowed.has(s.project_id)) return;
      const acc = byProject.get(s.project_id) ?? { planned: 0, actual: 0, variance: 0, months: 0 };
      acc.planned += Number(s.planned_value || 0);
      acc.actual += Number(s.actual_value || 0);
      acc.variance += Number(s.variance_value || 0);
      acc.months += 1;
      byProject.set(s.project_id, acc);
    });
    return visibleContracts
      .map((c) => {
        const agg = byProject.get(c.id);
        return {
          id: c.id,
          name: c.project_name,
          client: c.client,
          dept_code: c.dept_code,
          group: c.dept_group ?? "Outros",
          isCompanyEntity: c.is_company_entity,
          planned: agg?.planned ?? 0,
          actual: agg?.actual ?? 0,
          variance: agg?.variance ?? 0,
          marginPct: agg && agg.actual > 0 ? ((agg.actual - agg.planned) / agg.actual) * 100 : 0,
        };
      })
      .sort((a, b) => b.actual - a.actual);
  }, [visibleContracts, snapshots]);

  const totals = useMemo(() => {
    return aggregated.reduce(
      (acc, r) => ({
        planned: acc.planned + r.planned,
        actual: acc.actual + r.actual,
        variance: acc.variance + r.variance,
      }),
      { planned: 0, actual: 0, variance: 0 },
    );
  }, [aggregated]);

  if (lc || ls) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const scopeLabel =
    scoped.scope === "contract"
      ? `Contrato · ${scoped.objectLabel}`
      : scoped.isConsolidatedCompany
        ? "Empresa · Consolidado geral"
        : `Empresa · ${scoped.objectLabel}`;

  const ScopeIcon = scoped.scope === "contract" ? Briefcase : Building2;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Consolidação</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <ScopeIcon className="h-3 w-3" />
            {scopeLabel}
          </p>
        </div>
        {scoped.scope === "contract" && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[11px]">
            Recorte de 1 contrato
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Previsto {scoped.isConsolidatedCompany ? "Consolidado" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totals.planned)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {aggregated.length} {aggregated.length === 1 ? "contrato" : "contratos"} no escopo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Realizado {scoped.isConsolidatedCompany ? "Consolidado" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totals.actual)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {scoped.isConsolidatedCompany ? "Soma de todos os contratos" : "Recorte do escopo atual"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Desvio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold flex items-center gap-2",
                totals.variance > 0 ? "text-destructive" : "text-success",
              )}
            >
              {totals.variance > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatBRL(Math.abs(totals.variance))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.variance > 0 ? "Acima do planejado" : "Abaixo do planejado"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {scoped.scope === "contract"
              ? "Detalhe do contrato selecionado"
              : scoped.isConsolidatedCompany
                ? "Contratos ordenados por realizado"
                : `Recorte: ${scoped.objectLabel}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Cód.</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.dept_code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.isCompanyEntity ? (
                          <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Briefcase className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{r.name}</p>
                          {r.client && <p className="text-xs text-muted-foreground">{r.client}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          r.isCompanyEntity && "bg-blue-500/10 text-blue-700 border-blue-500/20",
                        )}
                      >
                        {r.isCompanyEntity ? "Empresa" : r.group}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatBRL(r.planned)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatBRL(r.actual)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm",
                        r.variance > 0 ? "text-destructive" : r.variance < 0 ? "text-success" : "",
                      )}
                    >
                      {formatBRL(r.variance)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatPct(r.marginPct / 100)}</TableCell>
                  </TableRow>
                ))}
                {aggregated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      {scoped.isEmpty
                        ? "Selecione um objeto no cabeçalho para ver dados."
                        : "Nenhum snapshot consolidado ainda para este escopo."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroConsolidacao;
