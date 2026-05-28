import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Progress } from "@budget/components/ui/progress";
import { Skeleton } from "@budget/components/ui/skeleton";
import { ScrollArea } from "@budget/components/ui/scroll-area";
import {
  Activity, AlertCircle, CheckCircle2, Database, Link2, RefreshCcw,
  Sparkles, Tag, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@budget/lib/format";
import { formatCompetenceShort } from "@budget/hooks/useContractCompetences";

interface HealthRow {
  user_id: string;
  total_entries: number;
  linked_to_contract: number;
  orphan_entries: number;
  categorized: number;
  excluded: number;
  duplicated: number;
  total_cost_value: number;
  active_contracts: number;
  drg_lines: number;
  snapshots: number;
  planned_entries: number;
}

interface ContractHealthRow {
  user_id: string;
  project_id: string;
  dept_code: string;
  project_name: string;
  client: string | null;
  status: string | null;
  entry_count: number;
  cost_total: number;
  drg_count: number;
  snapshot_count: number;
  last_competence_month: string | null;
}

const FinancialHealthPanel = () => {
  const qc = useQueryClient();

  const { data: health, isLoading } = useQuery<HealthRow | null>({
    queryKey: ["financial-health-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_health_summary" as never)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as HealthRow | null;
    },
  });

  const { data: contracts } = useQuery<ContractHealthRow[]>({
    queryKey: ["financial-health-by-contract"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_health_by_contract" as never)
        .select("*")
        .order("entry_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractHealthRow[];
    },
  });

  const reconcile = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("reconcile_financial_entries", {});
      if (error) throw error;
      return data as Array<{
        linked_to_contract: number;
        categorized: number;
        marked_excluded: number;
        total_entries: number;
      }>;
    },
    onSuccess: (data) => {
      const r = data?.[0];
      toast.success(
        `Reconciliação concluída`,
        {
          description: r
            ? `${r.linked_to_contract} vínculos · ${r.categorized} categorizados · ${r.marked_excluded} excluídos`
            : undefined,
        },
      );
      qc.invalidateQueries({ queryKey: ["financial-health-summary"] });
      qc.invalidateQueries({ queryKey: ["financial-health-by-contract"] });
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
    },
    onError: (e: Error) => toast.error("Erro na reconciliação", { description: e.message }),
  });

  const recalc = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("recalc_all_contract_snapshots", {});
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`${count} snapshots recalculados`);
      qc.invalidateQueries({ queryKey: ["financial-health-summary"] });
      qc.invalidateQueries({ queryKey: ["financial-health-by-contract"] });
      qc.invalidateQueries({ queryKey: ["contract-snapshots"] });
    },
    onError: (e: Error) => toast.error("Erro no recálculo", { description: e.message }),
  });

  const linkPct = useMemo(() => {
    if (!health || health.total_entries === 0) return 0;
    return (health.linked_to_contract / health.total_entries) * 100;
  }, [health]);

  const catPct = useMemo(() => {
    if (!health || health.total_entries === 0) return 0;
    return (health.categorized / health.total_entries) * 100;
  }, [health]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!health || health.total_entries === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum lançamento financeiro importado ainda. Vá em <strong>Entrada Mensal → Real Mensal</strong> para começar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Saúde da base financeira
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conexão entre lançamentos importados, contratos cadastrados e categorias do DRG
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => reconcile.mutate()}
            disabled={reconcile.isPending}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {reconcile.isPending ? "Reconciliando…" : "Reconciliar vínculos"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalc.mutate()}
            disabled={recalc.isPending}
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
            {recalc.isPending ? "Recalculando…" : "Recalcular dashboard"}
          </Button>
        </div>
      </div>

      {/* KPIs de integridade */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <HealthCard
          icon={Database}
          label="Lançamentos"
          value={health.total_entries.toLocaleString("pt-BR")}
          sub={formatBRL(health.total_cost_value)}
          tone="neutral"
        />
        <HealthCard
          icon={Link2}
          label="Vinculados a contrato"
          value={`${linkPct.toFixed(1)}%`}
          sub={`${health.linked_to_contract} de ${health.total_entries}`}
          tone={linkPct >= 95 ? "ok" : linkPct >= 80 ? "warn" : "bad"}
        />
        <HealthCard
          icon={Tag}
          label="Categorizados"
          value={`${catPct.toFixed(1)}%`}
          sub={`${health.categorized} de ${health.total_entries}`}
          tone={catPct >= 90 ? "ok" : catPct >= 60 ? "warn" : "bad"}
        />
        <HealthCard
          icon={Wallet}
          label="Contratos ativos"
          value={String(health.active_contracts)}
          sub={`${health.snapshots} snapshots · ${health.drg_lines} linhas DRG`}
          tone="neutral"
        />
      </div>

      {/* Barras de progresso */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <ProgressRow
            label="Cobertura de vínculo a contrato"
            current={health.linked_to_contract}
            total={health.total_entries}
            tone={linkPct >= 95 ? "ok" : linkPct >= 80 ? "warn" : "bad"}
          />
          <ProgressRow
            label="Cobertura de categorização DRG"
            current={health.categorized}
            total={health.total_entries}
            tone={catPct >= 90 ? "ok" : catPct >= 60 ? "warn" : "bad"}
          />
          {health.orphan_entries > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  {health.orphan_entries} {health.orphan_entries === 1 ? "lançamento sem contrato" : "lançamentos sem contrato"}
                </p>
                <p className="text-muted-foreground">
                  Use <strong>Reconciliar vínculos</strong> para associá-los automaticamente pelo código de centro de custo.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela: distribuição por contrato */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Distribuição por contrato</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ScrollArea className="h-72">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Contrato</th>
                  <th className="px-2 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium text-right">Lançamentos</th>
                  <th className="px-2 py-2 font-medium text-right">Custo</th>
                  <th className="px-2 py-2 font-medium text-right">DRG</th>
                  <th className="px-4 py-2 font-medium text-right">Última comp.</th>
                </tr>
              </thead>
              <tbody>
                {(contracts ?? [])
                  .filter((c) => c.entry_count > 0 || c.drg_count > 0)
                  .map((c) => (
                    <tr key={c.project_id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium truncate max-w-[200px]">
                        {c.project_name}
                        {c.client && (
                          <span className="block text-muted-foreground text-[10px]">{c.client}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">{c.dept_code}</td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={
                            c.status === "active"
                              ? "border-emerald-500/30 text-emerald-700 bg-emerald-500/10"
                              : "border-muted-foreground/30 text-muted-foreground"
                          }
                        >
                          {c.status === "active" ? "Ativo" : c.status ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.entry_count.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatBRL(c.cost_total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.drg_count}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                        {formatCompetenceShort(c.last_competence_month)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const HealthCard = ({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) => {
  const tones = {
    ok: "border-primary/30 bg-primary/5",
    warn: "border-amber-500/30 bg-amber-500/5",
    bad: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-card",
  };
  return (
    <Card className={tones[tone]}>
      <CardContent className="pt-4 pb-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
};

const ProgressRow = ({
  label,
  current,
  total,
  tone,
}: {
  label: string;
  current: number;
  total: number;
  tone: "ok" | "warn" | "bad";
}) => {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const Icon = tone === "ok" ? CheckCircle2 : AlertCircle;
  const colorClass = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-destructive";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {current.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} · {pct.toFixed(1)}%
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
};

export default FinancialHealthPanel;
