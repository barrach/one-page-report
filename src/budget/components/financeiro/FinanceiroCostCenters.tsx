import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Building2, Sparkles, RefreshCw } from "lucide-react";
import { useCostCenters, useSeedCostCenters, useSyncCostCenters } from "@budget/hooks/useFinancial";

const FinanceiroCostCenters = () => {
  const { data: centers, isLoading } = useCostCenters();
  const seed = useSeedCostCenters();
  const sync = useSyncCostCenters();

  const adm = (centers ?? []).filter((c) => c.dept_group === "ADMINISTRATIVO");
  const op = (centers ?? []).filter((c) => c.dept_group === "OPERACIONAL");
  const activeCount = (centers ?? []).filter((c) => c.status === "active").length;
  const inactiveCount = (centers ?? []).filter((c) => c.status === "inactive").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Centros de Custo Megasteam
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Estrutura oficial da planilha "Departamentos" do DRG Megasteam — {activeCount} ativos · {inactiveCount} inativos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {(!centers || centers.length === 0) && (
              <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
                <Sparkles className="w-4 h-4 mr-2" />
                Carregar estrutura inicial
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
              Sincronizar com Megasteam
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !centers || centers.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhum centro de custo configurado. Clique em "Carregar estrutura inicial" para popular automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">{adm.length}</Badge>
                  Administrativos (Despesa)
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Código</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-24 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adm.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.dept_code}</TableCell>
                          <TableCell className="font-medium">{c.project_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.client}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">{op.length}</Badge>
                  Operacionais (Custo / Contratos)
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Código</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-24 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {op.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.dept_code}</TableCell>
                          <TableCell className="font-medium">{c.project_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.client}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroCostCenters;
