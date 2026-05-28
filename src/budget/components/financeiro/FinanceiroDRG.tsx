import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { useFinancialEntries } from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";
import { Skeleton } from "@budget/components/ui/skeleton";

const FinanceiroDRG = () => {
  const { contractId } = useFinancialWorkspace();
  const { data: entries, isLoading } = useFinancialEntries({ projectId: contractId ?? undefined });

  const drg = useMemo(() => {
    const map = new Map<string, { categoryName: string; costClass: string; total: number; count: number; byMonth: Record<string, number> }>();
    (entries ?? []).filter((e) => !e.is_excluded && !e.is_duplicate).forEach((e) => {
      const cat = (e as { financial_categories?: { name?: string; code?: string; cost_class?: string } }).financial_categories;
      const key = cat?.code ?? "uncategorized";
      const cur = map.get(key) ?? {
        categoryName: cat?.name ?? "Sem categoria",
        costClass: cat?.cost_class ?? "—",
        total: 0, count: 0, byMonth: {},
      };
      const value = Number(e.cost_value || 0);
      cur.total += value;
      cur.count += 1;
      const m = e.competence ?? (e.competence_date ? String(e.competence_date).slice(0, 7) : "—");
      cur.byMonth[m] = (cur.byMonth[m] ?? 0) + value;
      map.set(key, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [entries]);

  const total = drg.reduce((s, [, v]) => s + v.total, 0);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRG — Demonstrativo de Resultado Gerencial</CardTitle>
          <p className="text-xs text-muted-foreground">
            Consolidação dos custos reais por categoria, classe e período.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drg.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Importe lançamentos para visualizar o DRG.
                  </TableCell></TableRow>
                ) : drg.map(([key, v]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{v.categoryName}</TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">{v.costClass}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{v.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(v.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{total > 0 ? ((v.total / total) * 100).toFixed(1) : "0"}%</TableCell>
                  </TableRow>
                ))}
                {drg.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(total)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
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

export default FinanceiroDRG;
