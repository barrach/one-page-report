// Dashboard Executivo Financeiro — espelho da planilha "Resumo do Resultado"
// Consolida visão geral da empresa + drill-down por contrato + saldos pendentes,
// somando os contratos on-the-fly a partir de financial_drg_lines.
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Badge } from "@budget/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { useDrgLines } from "@budget/hooks/useDrgLines";
import { useContractRevenues } from "@budget/hooks/useContractRevenues";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL, formatPct } from "@budget/lib/format";
import { TrendingUp, TrendingDown, Minus, Wallet, Receipt, AlertCircle, Target } from "lucide-react";
import { cn } from "@budget/lib/utils";

const ABSOLUTE_LINES = [
  "RECEITA_BRUTA",
  "IMPOSTOS",
  "RECEITA_LIQUIDA",
  "CUSTO_OPERACIONAL",
  "MARGEM_BRUTA",
  "TAXA_ADM",
  "CUSTO_TOTAL",
  "RESULTADO_LIQUIDO",
  "RESULTADO_LIQUIDO_CSLL_IR",
] as const;

const LINE_LABELS: Record<string, string> = {
  RECEITA_BRUTA: "Receita Bruta",
  IMPOSTOS: "Impostos s/ Receita",
  RECEITA_LIQUIDA: "Receita Líquida",
  CUSTO_OPERACIONAL: "Custo Operacional",
  MARGEM_BRUTA: "Margem Bruta",
  TAXA_ADM: "Taxa Administrativa",
  CUSTO_TOTAL: "Custo Total",
  RESULTADO_LIQUIDO: "Resultado Líquido",
  RESULTADO_LIQUIDO_CSLL_IR: "Resultado Líquido + CSLL/IR",
};

type Totals = Record<string, { planned: number; actual: number }>;

const emptyTotals = (): Totals =>
  Object.fromEntries(ABSOLUTE_LINES.map((c) => [c, { planned: 0, actual: 0 }]));

const diffTone = (planned: number, actual: number) => {
  if (planned === 0 && actual === 0) return "text-muted-foreground";
  const diff = actual - planned;
  if (Math.abs(diff) < Math.abs(planned) * 0.001) return "text-muted-foreground";
  // Receitas (positivos): real maior é bom. Custos (negativos): real menos negativo é bom.
  if (planned >= 0) return diff >= 0 ? "text-emerald-600" : "text-destructive";
  return diff >= 0 ? "text-emerald-600" : "text-destructive";
};

const trendIcon = (planned: number, actual: number) => {
  const diff = actual - planned;
  if (Math.abs(diff) < Math.abs(planned) * 0.001 || (planned === 0 && actual === 0)) {
    return <Minus className="w-3 h-3" />;
  }
  return diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
};

const KpiCard = ({
  title, planned, actual, icon, isCost = false,
}: { title: string; planned: number; actual: number; icon: React.ReactNode; isCost?: boolean }) => {
  const diff = actual - planned;
  const variation = planned !== 0 ? (diff / Math.abs(planned)) * 100 : 0;
  const tone = diffTone(planned, actual);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold tabular-nums truncate" title={formatBRL(actual)}>
              {formatBRL(actual)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Prev: {formatBRL(planned)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
        </div>
        <div className={cn("mt-3 flex items-center gap-1 text-xs font-medium", tone)}>
          {trendIcon(planned, actual)}
          <span>{formatBRL(diff)}</span>
          <span className="text-muted-foreground">({formatPct(variation, 1)})</span>
        </div>
      </CardContent>
    </Card>
  );
};

const FinancialExecutiveDashboard = () => {
  const { data: lines, isLoading } = useDrgLines();
  const { data: revenues } = useContractRevenues();
  const { view, contractId, competenceYm } = useFinancialWorkspace();
  const monthFilter = competenceYm;
  const contractFilter = view === "contract" && contractId ? contractId : "all";

  // Linhas filtradas pelo mês/contrato (sempre por mês único definido na barra global)
  const filteredLines = useMemo(() => {
    return (lines ?? []).filter((l) => {
      if (String(l.competence_month).slice(0, 7) !== monthFilter) return false;
      if (contractFilter !== "all" && l.project_id !== contractFilter) return false;
      return true;
    });
  }, [lines, monthFilter, contractFilter]);

  // Consolidado da empresa
  const consolidated = useMemo<Totals>(() => {
    const t = emptyTotals();
    for (const l of filteredLines) {
      if (l.is_percentage) continue;
      const code = l.line_code;
      if (!(code in t)) continue;
      t[code].planned += Number(l.planned_value);
      t[code].actual += Number(l.actual_value);
    }
    return t;
  }, [filteredLines]);

  // Por contrato (para tabela de comparação)
  const byContract = useMemo(() => {
    const map = new Map<string, { name: string; totals: Totals }>();
    for (const l of filteredLines) {
      if (l.is_percentage) continue;
      const code = l.line_code;
      if (!ABSOLUTE_LINES.includes(code as typeof ABSOLUTE_LINES[number])) continue;
      let cur = map.get(l.project_id);
      if (!cur) {
        cur = { name: l.projects?.project_name ?? "—", totals: emptyTotals() };
        map.set(l.project_id, cur);
      }
      cur.totals[code].planned += Number(l.planned_value);
      cur.totals[code].actual += Number(l.actual_value);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ projectId: id, ...v }))
      .sort((a, b) => Math.abs(b.totals.RECEITA_LIQUIDA.actual) - Math.abs(a.totals.RECEITA_LIQUIDA.actual));
  }, [filteredLines]);

  // Margens calculadas (só pra exibição — não somam % da planilha)
  const calcMargins = (t: Totals) => {
    const rl = t.RECEITA_LIQUIDA;
    const ml = t.RESULTADO_LIQUIDO;
    const mlCsll = t.RESULTADO_LIQUIDO_CSLL_IR;
    return {
      margemBruta: rl.actual !== 0 ? (t.MARGEM_BRUTA.actual / rl.actual) * 100 : 0,
      margemLiq: rl.actual !== 0 ? (ml.actual / rl.actual) * 100 : 0,
      margemLiqCsll: rl.actual !== 0 ? (mlCsll.actual / rl.actual) * 100 : 0,
      margemBrutaPrev: rl.planned !== 0 ? (t.MARGEM_BRUTA.planned / rl.planned) * 100 : 0,
    };
  };
  const margins = calcMargins(consolidated);

  // Saldos pendentes (filtrados pela barra global)
  const saldos = useMemo(() => {
    let filtered = (revenues ?? []).filter((r) => r.pending_balance !== 0);
    filtered = filtered.filter((r) => String(r.competence_month).slice(0, 7) === monthFilter);
    if (contractFilter !== "all") {
      filtered = filtered.filter((r) => r.project_id === contractFilter);
    }
    return filtered;
  }, [revenues, monthFilter, contractFilter]);

  const totalSaldo = saldos.reduce((acc, s) => acc + Number(s.pending_balance), 0);

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const hasData = (lines?.length ?? 0) > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-6">
      {/* Filtros aplicados pela barra de contexto global */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">Competência: {monthFilter}</Badge>
        {contractFilter !== "all" && (
          <Badge variant="outline" className="text-xs gap-1">
            <Receipt className="w-3 h-3" /> Contrato filtrado
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto gap-1">
          {byContract.length} contrato{byContract.length !== 1 && "s"}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Receita Líquida"
          planned={consolidated.RECEITA_LIQUIDA.planned}
          actual={consolidated.RECEITA_LIQUIDA.actual}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KpiCard
          title="Custo Total"
          planned={consolidated.CUSTO_TOTAL.planned}
          actual={consolidated.CUSTO_TOTAL.actual}
          icon={<Wallet className="w-4 h-4" />}
          isCost
        />
        <KpiCard
          title="Resultado Líquido"
          planned={consolidated.RESULTADO_LIQUIDO.planned}
          actual={consolidated.RESULTADO_LIQUIDO.actual}
          icon={<Target className="w-4 h-4" />}
        />
        <KpiCard
          title="Resultado + CSLL/IR"
          planned={consolidated.RESULTADO_LIQUIDO_CSLL_IR.planned}
          actual={consolidated.RESULTADO_LIQUIDO_CSLL_IR.actual}
          icon={<Target className="w-4 h-4" />}
        />
      </div>

      {/* Margens calculadas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Margens Consolidadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem Bruta</p>
              <p className="text-2xl font-bold tabular-nums">{formatPct(margins.margemBruta, 1)}</p>
              <p className="text-xs text-muted-foreground">Prev: {formatPct(margins.margemBrutaPrev, 1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem Líquida</p>
              <p className="text-2xl font-bold tabular-nums">{formatPct(margins.margemLiq, 1)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem Líq + CSLL/IR</p>
              <p className="text-2xl font-bold tabular-nums">{formatPct(margins.margemLiqCsll, 1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="saldos" className="gap-1">
            Saldos pendentes
            {saldos.length > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{saldos.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contratos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativo Previsto x Realizado por contrato</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px] sticky left-0 bg-background">Contrato</TableHead>
                    <TableHead className="text-right">Receita Líq. Prev.</TableHead>
                    <TableHead className="text-right">Receita Líq. Real</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-right">Result. Líq.</TableHead>
                    <TableHead className="text-right">Margem Líq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byContract.map((c) => {
                    const rl = c.totals.RECEITA_LIQUIDA;
                    const ct = c.totals.CUSTO_TOTAL;
                    const rs = c.totals.RESULTADO_LIQUIDO;
                    const margem = rl.actual !== 0 ? (rs.actual / rl.actual) * 100 : 0;
                    return (
                      <TableRow key={c.projectId}>
                        <TableCell className="font-medium sticky left-0 bg-background">{c.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(rl.planned)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(rl.actual)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", diffTone(ct.planned, ct.actual))}>
                          {formatBRL(ct.actual)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", diffTone(rs.planned, rs.actual))}>
                          {formatBRL(rs.actual)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(margem, 1)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {byContract.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Nenhum contrato com dados no período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Saldos pendentes por contrato</span>
                <span className="text-sm font-normal tabular-nums text-destructive">
                  Total: {formatBRL(totalSaldo)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Contrato</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Saldo Pendente</TableHead>
                    <TableHead className="min-w-[280px]">Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saldos.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.projects?.project_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{String(s.competence_month).slice(0, 7)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", Number(s.pending_balance) < 0 ? "text-destructive" : "text-emerald-600")}>
                        {formatBRL(Number(s.pending_balance))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.observation || <span className="opacity-50">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {saldos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        Nenhum saldo pendente no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialExecutiveDashboard;
