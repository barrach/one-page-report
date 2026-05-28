import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Badge } from "@budget/components/ui/badge";
import { Skeleton } from "@budget/components/ui/skeleton";
import { PieChart, Calculator, Info, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@budget/components/ui/tooltip";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { useContractAdminAllocation, type AdminAllocationRow } from "@budget/hooks/useContractAdminAllocation";
import { formatBRL, formatPct, formatCompactBRL } from "@budget/lib/format";

// ===================================================================
// ContractRateioAdmin
// -------------------------------------------------------------------
// Aba "Rateio Admin" do Hub do Contrato.
// Mostra a participação DESTE contrato no Pool ADM da sede,
// espelhando a aba "Rateio Administrativo" da planilha Megasteam.
// ===================================================================

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const monthLabel = (k: string) => {
  const idx = parseInt(k.slice(5, 7), 10) - 1;
  return `${MONTH_LABELS_PT[idx] ?? "?"}/${k.slice(2, 4)}`;
};

const StatusBadge = ({ status }: { status: AdminAllocationRow["status"] }) => {
  switch (status) {
    case "calculado":
      return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Calculado</Badge>;
    case "estimado":
      return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">Estimado</Badge>;
    case "sem_pool":
      return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-muted text-muted-foreground">Sem pool</Badge>;
    default:
      return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-muted text-muted-foreground">—</Badge>;
  }
};

const ContractRateioAdmin = () => {
  const { contractId, competenceMonth, showAllPeriods } = useFinancialWorkspace();
  const { data, isLoading } = useContractAdminAllocation(contractId);

  const selectedKey = competenceMonth?.slice(0, 7);

  // Linha do mês selecionado (se houver)
  const currentRow = useMemo(() => {
    if (showAllPeriods || !selectedKey || !data) return null;
    return data.rows.find((r) => r.monthKey === selectedKey) ?? null;
  }, [data, selectedKey, showAllPeriods]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contractId) {
    return (
      <Card><CardContent className="pt-6 text-sm text-muted-foreground">
        Selecione um contrato para visualizar o rateio administrativo.
      </CardContent></Card>
    );
  }

  // Cards do topo: usam o mês selecionado se existir; caso contrário totais acumulados
  const cardData = currentRow ?? {
    poolAdm: data?.totals.poolAdm ?? 0,
    myRevenue: data?.totals.myRevenue ?? 0,
    totalRevenue: data?.totals.totalRevenue ?? 0,
    participationPct: data?.totals.participationPct ?? 0,
    absorption: data?.totals.absorption ?? 0,
    status: "calculado" as const,
  };
  const cardScopeLabel = currentRow ? monthLabel(currentRow.monthKey) : "Acumulado";

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* ============ CARDS DE RESUMO ============ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Pool ADM da sede</p>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Soma dos custos lançados no centro de custo
                    <strong> "1.000 - ADMINISTRATIVO"</strong> da sede no mês.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatBRL(cardData.poolAdm)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{cardScopeLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Sua participação</p>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Receita bruta do contrato ÷ soma das receitas brutas
                    de todos os contratos com receita no mês.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold tabular-nums text-blue-700">{formatPct(cardData.participationPct, 2)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatCompactBRL(cardData.myRevenue)} de {formatCompactBRL(cardData.totalRevenue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Sua absorção</p>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Pool ADM × Sua participação. Valor que entra na linha
                    "Absorção Rateio Administrativo" do Acompanhamento Executivo.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{formatBRL(cardData.absorption)}</p>
              <div className="mt-1"><StatusBadge status={cardData.status as AdminAllocationRow["status"]} /></div>
            </CardContent>
          </Card>
        </div>

        {/* ============ TABELA MENSAL ============ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" /> Rateio mensal — visão do contrato
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Mecânica idêntica à aba "Rateio Administrativo" da planilha Megasteam:
                  o pool da sede é distribuído proporcionalmente à <strong>receita bruta</strong> de cada contrato.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                <Calculator className="w-3 h-3 mr-1" /> {data?.rows.length ?? 0} meses
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(!data || data.rows.length === 0) ? (
              <div className="flex items-start gap-2 p-4 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Nenhum dado disponível. Importe lançamentos do centro de custo
                  <strong> "1.000 - ADMINISTRATIVO"</strong> em Custos Mensais e cadastre
                  receita bruta dos contratos no Acompanhamento Executivo (linha 1.01).
                </div>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Competência</TableHead>
                      <TableHead className="text-right">Sua Receita Bruta</TableHead>
                      <TableHead className="text-right">Receita Bruta total</TableHead>
                      <TableHead className="text-right">Participação %</TableHead>
                      <TableHead className="text-right">Pool ADM da sede</TableHead>
                      <TableHead className="text-right">Sua absorção</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => {
                      const highlight = r.monthKey === selectedKey && !showAllPeriods;
                      return (
                        <TableRow key={r.monthKey} className={highlight ? "bg-primary/5" : undefined}>
                          <TableCell className="font-medium text-xs">
                            {monthLabel(r.monthKey)}
                            {highlight && <Badge variant="outline" className="ml-2 h-4 px-1 text-[9px] bg-primary/10 text-primary border-primary/30">atual</Badge>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {r.myRevenue > 0.005 ? formatBRL(r.myRevenue) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {r.totalRevenue > 0.005 ? formatBRL(r.totalRevenue) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-semibold text-blue-700">
                            {r.participationPct > 0 ? formatPct(r.participationPct, 2) : <span className="text-muted-foreground font-normal">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {r.poolAdm > 0.005 ? formatBRL(r.poolAdm) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-semibold text-amber-600">
                            {r.absorption > 0.005 ? formatBRL(r.absorption) : <span className="text-muted-foreground font-normal">—</span>}
                          </TableCell>
                          <TableCell className="text-center"><StatusBadge status={r.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Linha de TOTAL acumulado */}
                    <TableRow className="bg-muted/40 font-bold">
                      <TableCell className="text-xs">TOTAL</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatBRL(data.totals.myRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{formatBRL(data.totals.totalRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-blue-700">{formatPct(data.totals.participationPct, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatBRL(data.totals.poolAdm)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-amber-600">{formatBRL(data.totals.absorption)}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="h-5 px-1.5 text-[10px]">Acum.</Badge></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                <span className="font-semibold text-foreground">Calculado:</span>
                contrato com receita bruta &gt; 0 — recebe absorção proporcional do pool.
              </div>
              <div className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                <span className="font-semibold text-foreground">Estimado:</span>
                contrato sem receita no mês — Acomp. Executivo aplica fallback VL × taxa_adm_pct.
              </div>
              <div className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                <span className="font-semibold text-foreground">Sem pool:</span>
                não há custos lançados em "1.000 - ADMINISTRATIVO" no mês.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default ContractRateioAdmin;
