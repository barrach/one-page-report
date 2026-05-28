import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { useDrgLines } from "@budget/hooks/useDrgLines";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";
import { Grid3x3 } from "lucide-react";

/**
 * Matriz consolidada: linhas = contas DRG, colunas = centros de custo (projetos),
 * para o mês selecionado na barra de contexto global.
 */
const FinanceiroDrgTodosCC = () => {
  const { data: lines, isLoading } = useDrgLines();
  const { competenceYm } = useFinancialWorkspace();
  const month = competenceYm; // YYYY-MM

  const filtered = useMemo(() => {
    return (lines ?? []).filter((l) => String(l.competence_month).slice(0, 7) === month);
  }, [lines, month]);

  // contas únicas (linhas) e CCs únicos (colunas)
  const { lineCodes, ccs, matrix } = useMemo(() => {
    const lineMap = new Map<string, { label: string; sort: number }>();
    const ccMap = new Map<string, string>(); // project_id -> name
    const mat = new Map<string, Map<string, number>>(); // line_code -> (project_id -> value)
    for (const l of filtered) {
      lineMap.set(l.line_code, { label: l.line_label, sort: l.sort_order });
      ccMap.set(l.project_id, l.projects?.project_name ?? "—");
      const inner = mat.get(l.line_code) ?? new Map<string, number>();
      const cur = inner.get(l.project_id) ?? 0;
      // soma valor analítico (financeiro+transf+ajuste = total) ou actual_value se vier do resumo
      const v = Number(l.valor_financeiro || 0) + Number(l.valor_transf_gerencial || 0) + Number(l.valor_ajuste_contabil || 0);
      inner.set(l.project_id, cur + (v || Number(l.actual_value || 0)));
      mat.set(l.line_code, inner);
    }
    const lc = Array.from(lineMap.entries()).sort((a, b) => a[1].sort - b[1].sort);
    const cc = Array.from(ccMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    return { lineCodes: lc, ccs: cc, matrix: mat };
  }, [filtered]);

  if (isLoading) return <Skeleton className="h-64" />;

  if ((lines?.length ?? 0) === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Grid3x3 className="w-12 h-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Importe a planilha Megasteam (DRG-Analítico) para gerar a matriz de centros de custo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-primary" />
            DRG — Todos os centros de custo · {month}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Matriz consolidada: contas (linhas) × centros de custo (colunas). Use a barra de
            contexto acima para alterar a competência.
          </p>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-30 min-w-[240px]">Conta</TableHead>
              {ccs.map(([id, name]) => (
                <TableHead key={id} className="text-right whitespace-nowrap text-xs">{name}</TableHead>
              ))}
              <TableHead className="text-right whitespace-nowrap font-bold">TOTAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineCodes.map(([code, meta]) => {
              const inner = matrix.get(code) ?? new Map<string, number>();
              const total = Array.from(inner.values()).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={code}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs">{meta.label}</TableCell>
                  {ccs.map(([id]) => {
                    const v = inner.get(id) ?? 0;
                    return (
                      <TableCell key={id} className="text-right tabular-nums text-xs">
                        {v === 0 ? <span className="text-muted-foreground">—</span> : formatBRL(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums text-xs font-semibold">{formatBRL(total)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default FinanceiroDrgTodosCC;
