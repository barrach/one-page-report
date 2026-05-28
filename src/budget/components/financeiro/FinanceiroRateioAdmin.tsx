import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Calculator } from "lucide-react";
import { useAdminAllocation } from "@budget/hooks/useFinancialModules";
import { formatBRL, formatPct } from "@budget/lib/format";

const FinanceiroRateioAdmin = () => {
  const { distribution, totalToAllocate, totalRevenue, unallocatedCount, isLoading } = useAdminAllocation();

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Total a ratear</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(totalToAllocate)}</p>
          <p className="text-xs text-muted-foreground mt-1">{unallocatedCount} lançamentos sem contrato</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Receita base</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{formatBRL(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Critério</p>
          <p className="text-sm font-medium">Proporcional à receita realizada</p>
          <p className="text-xs text-muted-foreground mt-1">Maior receita → maior absorção</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Distribuição administrativa por contrato
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Custos sem contrato (administrativos, parcelamentos centralizados) são distribuídos proporcionalmente à receita realizada de cada contrato.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">% Participação</TableHead>
                  <TableHead className="text-right">Custo Direto</TableHead>
                  <TableHead className="text-right">Rateio Admin</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribution.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Cadastre receita por contrato para que o rateio seja calculado.
                  </TableCell></TableRow>
                ) : distribution.map((d) => (
                  <TableRow key={d.projectId}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(d.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatPct(d.sharePct, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(d.directCost)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{formatBRL(d.adminAllocated)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatBRL(d.totalCost)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${d.margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatBRL(d.margin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroRateioAdmin;
