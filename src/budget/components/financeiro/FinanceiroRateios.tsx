import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import { Badge } from "@budget/components/ui/badge";
import { useFinancialEntries, useContractRevenues } from "@budget/hooks/useFinancial";
import { useApportionments } from "@budget/hooks/useApportionments";
import { formatBRL, formatPct } from "@budget/lib/format";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Calculator, FileSpreadsheet } from "lucide-react";

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Tabela pivot: linhas=projeto, colunas=meses, valores=apportioned_value */
const ApportionmentMatrix = ({ ruleName, title, description }: { ruleName: string; title: string; description: string }) => {
  const { data: rows, isLoading } = useApportionments(ruleName);

  const { projects, months, matrix, totals } = useMemo(() => {
    const projMap = new Map<string, string>();
    const monthSet = new Set<string>();
    const mat = new Map<string, Map<string, number>>();
    for (const r of rows ?? []) {
      const month = String(r.competence_month).slice(0, 7);
      monthSet.add(month);
      const name = r.projects?.project_name ?? r.notes ?? "—";
      projMap.set(r.target_project_id, name);
      const inner = mat.get(r.target_project_id) ?? new Map<string, number>();
      inner.set(month, (inner.get(month) ?? 0) + Number(r.apportioned_value || 0));
      mat.set(r.target_project_id, inner);
    }
    const ms = Array.from(monthSet).sort();
    const ps = Array.from(projMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    const totalsByMonth = new Map<string, number>();
    let grand = 0;
    for (const [, inner] of mat) {
      for (const [m, v] of inner) {
        totalsByMonth.set(m, (totalsByMonth.get(m) ?? 0) + v);
        grand += v;
      }
    }
    return { projects: ps, months: ms, matrix: mat, totals: { byMonth: totalsByMonth, grand } };
  }, [rows]);

  if (isLoading) return <Skeleton className="h-48" />;
  if ((rows?.length ?? 0) === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" /> {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum rateio importado ainda. Envie a planilha Megasteam para popular esta visão.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" /> {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant="outline">
            {projects.length} CCs · {months.length} meses · Total {formatBRL(totals.grand)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[260px]">Centro de custo</TableHead>
              {months.map((m) => {
                const idx = parseInt(m.slice(5, 7), 10) - 1;
                return <TableHead key={m} className="text-right whitespace-nowrap text-xs">{MONTH_LABELS_PT[idx]}/{m.slice(2, 4)}</TableHead>;
              })}
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map(([id, name]) => {
              const inner = matrix.get(id) ?? new Map<string, number>();
              const total = Array.from(inner.values()).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs">{name}</TableCell>
                  {months.map((m) => {
                    const v = inner.get(m) ?? 0;
                    return (
                      <TableCell key={m} className="text-right tabular-nums text-xs">
                        {v === 0 ? <span className="text-muted-foreground">—</span> : formatBRL(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums text-xs font-semibold">{formatBRL(total)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-bold">
              <TableCell className="sticky left-0 bg-muted/40 z-10">TOTAL</TableCell>
              {months.map((m) => (
                <TableCell key={m} className="text-right tabular-nums text-xs">{formatBRL(totals.byMonth.get(m) ?? 0)}</TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{formatBRL(totals.grand)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const FinanceiroRateios = () => {
  const { data: entries, isLoading } = useFinancialEntries();
  const { data: revenues } = useContractRevenues();

  const rateioByProject = useMemo(() => {
    const totals = new Map<string, { name: string; revenue: number; cost: number }>();
    (revenues ?? []).forEach((r) => {
      const p = (r as { projects?: { project_name?: string } }).projects;
      const key = r.project_id;
      const cur = totals.get(key) ?? { name: p?.project_name ?? "—", revenue: 0, cost: 0 };
      cur.revenue += Number(r.revenue_actual || 0);
      totals.set(key, cur);
    });
    (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate && e.contract_project_id).forEach((e) => {
      const p = (e as { projects?: { project_name?: string } }).projects;
      const key = e.contract_project_id!;
      const cur = totals.get(key) ?? { name: p?.project_name ?? "—", revenue: 0, cost: 0 };
      cur.cost += Number(e.cost_value || 0);
      totals.set(key, cur);
    });
    const totalRevenue = Array.from(totals.values()).reduce((s, t) => s + t.revenue, 0);
    return Array.from(totals.entries())
      .map(([id, t]) => ({ id, ...t, sharePct: totalRevenue > 0 ? (t.revenue / totalRevenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [entries, revenues]);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="admin" className="w-full">
        <TabsList>
          <TabsTrigger value="admin">Rateio Administrativo</TabsTrigger>
          <TabsTrigger value="pis">Rateio PIS-COFINS</TabsTrigger>
          <TabsTrigger value="participacao">Participação na receita</TabsTrigger>
        </TabsList>

        <TabsContent value="admin" className="mt-4">
          <ApportionmentMatrix
            ruleName="Rateio Administrativo (planilha)"
            title="Rateio Administrativo por mês e centro de custo"
            description="Distribuição mensal do overhead administrativo importada da aba 'Rateio Administrativo' do workbook Megasteam."
          />
        </TabsContent>

        <TabsContent value="pis" className="mt-4">
          <ApportionmentMatrix
            ruleName="Rateio PIS-COFINS (planilha)"
            title="Rateio Crédito de PIS-COFINS"
            description="Distribuição mensal do crédito de PIS-COFINS importada da aba 'Rateio PIS-COFINS'."
          />
        </TabsContent>

        <TabsContent value="participacao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por contrato (base para rateio proporcional)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Participação de cada contrato na receita total — base para recalcular rateios proporcionalmente à produção.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Receita Real</TableHead>
                      <TableHead className="text-right">Custo Real Vinculado</TableHead>
                      <TableHead className="text-right">% Participação</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateioByProject.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        Cadastre receita por contrato e importe lançamentos para visualizar o rateio.
                      </TableCell></TableRow>
                    ) : rateioByProject.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(r.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(r.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(r.sharePct, 1)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${r.revenue - r.cost >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {formatBRL(r.revenue - r.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroRateios;
