import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Badge } from "@budget/components/ui/badge";
import { LayoutGrid, Building2 } from "lucide-react";
import { useDrgMonthly } from "@budget/hooks/useFinancialModules";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";

const FinanceiroDrgMensal = () => {
  const { contractId } = useFinancialWorkspace();
  const { months, rows, revenueByMonth, totalRevenue, totalCost, result, isLoading } = useDrgMonthly(
    contractId ?? undefined,
  );

  if (isLoading) return <Skeleton className="h-64" />;

  if (!contractId) {
    return (
      <Card className="border-dashed border-primary/40 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Selecione um contrato na barra de contexto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            A DRG mensal opera por contrato. Use o seletor de contrato no topo da página
            para escolher qual contrato analisar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const monthTotal = (m: string) => rows.reduce((s, r) => s + (r.byMonth[m] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Badge variant="outline" className="gap-1">
          <Building2 className="w-3 h-3" /> DRG isolada por contrato
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Receita total ({months.length} meses)</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{formatBRL(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Custo total</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(totalCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Resultado consolidado</p>
          <p className={`text-2xl font-bold tabular-nums ${result >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatBRL(result)}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> DRG mensal — todos os centros de custo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Visão consolidada mês a mês: receita, custos por categoria e resultado. Espelho mensal geral da operação.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-30">Categoria</TableHead>
                  <TableHead>Classe</TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-right whitespace-nowrap">{m}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    Importe lançamentos e cadastre receita por contrato para visualizar o DRG mensal.
                  </TableCell></TableRow>
                ) : (
                  <>
                    {/* Receita */}
                    <TableRow className="bg-emerald-500/5">
                      <TableCell className="sticky left-0 bg-emerald-500/5 font-bold">RECEITA LÍQUIDA</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">RECEITA</Badge></TableCell>
                      {months.map((m) => (
                        <TableCell key={m} className="text-right tabular-nums text-emerald-600 font-medium">
                          {formatBRL(revenueByMonth[m] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums font-bold text-emerald-600">{formatBRL(totalRevenue)}</TableCell>
                    </TableRow>

                    {/* Custos */}
                    {rows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="sticky left-0 bg-background font-medium">{r.label}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs uppercase">{r.costClass}</Badge></TableCell>
                        {months.map((m) => (
                          <TableCell key={m} className="text-right tabular-nums">
                            {r.byMonth[m] ? formatBRL(r.byMonth[m]) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums font-medium">{formatBRL(r.total)}</TableCell>
                      </TableRow>
                    ))}

                    {/* Total custo por mês */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="sticky left-0 bg-muted/50">TOTAL CUSTO</TableCell>
                      <TableCell></TableCell>
                      {months.map((m) => (
                        <TableCell key={m} className="text-right tabular-nums">{formatBRL(monthTotal(m))}</TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">{formatBRL(totalCost)}</TableCell>
                    </TableRow>

                    {/* Resultado */}
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell className="sticky left-0 bg-primary/5">RESULTADO</TableCell>
                      <TableCell></TableCell>
                      {months.map((m) => {
                        const v = (revenueByMonth[m] ?? 0) - monthTotal(m);
                        return (
                          <TableCell key={m} className={`text-right tabular-nums ${v >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {formatBRL(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-right tabular-nums ${result >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatBRL(result)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroDrgMensal;
