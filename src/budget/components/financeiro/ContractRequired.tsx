import { FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { useFinancialContracts, type FinancialContract } from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { Skeleton } from "@budget/components/ui/skeleton";
import { useMemo } from "react";

const ContractRequired = () => {
  const { setContractId } = useFinancialWorkspace();
  const { data: contracts, isLoading } = useFinancialContracts({ onlyActive: true });

  const grouped = useMemo(() => {
    const map: Record<string, FinancialContract[]> = {};
    (contracts ?? []).forEach((c) => {
      const key = c.dept_group ?? "Outros";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [contracts]);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold">Selecione um contrato</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Para visualizar dados de Planejado, Produção, Pessoal, Real Mensal e DRG, escolha um contrato no seletor
          acima ou na lista lateral.
        </p>

        {(contracts ?? []).length > 0 && (
          <div className="mt-6 max-w-2xl mx-auto text-left space-y-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {group}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.slice(0, 6).map((c) => (
                    <Button
                      key={c.id}
                      variant="outline"
                      size="sm"
                      className="justify-between h-auto py-2 px-3 text-left"
                      onClick={() => setContractId(c.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{c.project_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {c.dept_code ?? "—"} · {c.client ?? "—"}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 ml-2 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractRequired;
