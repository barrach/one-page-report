import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Button } from "@budget/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@budget/components/ui/alert-dialog";
import { useBaselines } from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";
import { Skeleton } from "@budget/components/ui/skeleton";
import { CheckCircle2, Archive, Lock, FileText, Building2, Trash2, Loader2 } from "lucide-react";
import { cn } from "@budget/lib/utils";
import UniparBaselineUploader from "./UniparBaselineUploader";
import PlannedSpreadsheet from "./PlannedSpreadsheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useState } from "react";

type BaselineRow = {
  id: string;
  project_id: string;
  version: number;
  name: string;
  status: string;
  approved_at: string;
  total_revenue: number | string;
  total_direct_cost: number | string;
  total_indirect_cost: number | string;
  total_taxes: number | string;
  total_profit: number | string;
  expected_start_date: string | null;
  expected_duration_days: number | null;
  projects?: { project_name?: string; client?: string } | null;
};

const FinanceiroPlanejado = () => {
  const { contractId, competenceMonth } = useFinancialWorkspace();
  const contractFilter = contractId ?? "";
  const { data, isLoading } = useBaselines();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteBaseline = useMutation({
    mutationFn: async (baselineId: string) => {
      setDeletingId(baselineId);
      const { data: baseline, error: baselineErr } = await supabase
        .from("financial_baselines")
        .select("id, project_id, status")
        .eq("id", baselineId)
        .single();
      if (baselineErr) throw baselineErr;

      const { error: plannedErr } = await supabase
        .from("financial_planned_entries")
        .delete()
        .eq("baseline_id", baselineId);
      if (plannedErr) throw plannedErr;

      const { error: drgErr } = await supabase
        .from("financial_drg_lines")
        .delete()
        .eq("baseline_id", baselineId);
      if (drgErr) throw drgErr;

      const { error: revErr } = await supabase
        .from("financial_revenue_items")
        .delete()
        .eq("baseline_id", baselineId);
      if (revErr) throw revErr;

      const { error } = await supabase
        .from("financial_baselines")
        .delete()
        .eq("id", baselineId);
      if (error) throw error;

      if (baseline.status === "active") {
        const { data: latestRemaining, error: latestErr } = await supabase
          .from("financial_baselines")
          .select("id")
          .eq("project_id", baseline.project_id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestErr) throw latestErr;

        if (latestRemaining?.id) {
          const { error: activateErr } = await supabase
            .from("financial_baselines")
            .update({ status: "active" })
            .eq("id", latestRemaining.id);
          if (activateErr) throw activateErr;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Baseline excluída", description: "Todos os registros vinculados foram removidos." });
      queryClient.invalidateQueries({ queryKey: ["financial-baselines"] });
      queryClient.invalidateQueries({ queryKey: ["financial-planned-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-drg-lines"] });
      queryClient.invalidateQueries({ queryKey: ["contract-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["planned-spreadsheet"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message ?? String(err), variant: "destructive" });
    },
    onSettled: () => setDeletingId(null),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  const baselines = (data ?? []) as unknown as BaselineRow[];
  const filteredBaselines = contractFilter
    ? baselines.filter((b) => b.project_id === contractFilter)
    : baselines;

  const grouped = filteredBaselines.reduce<Record<string, BaselineRow[]>>((acc, b) => {
    (acc[b.project_id] ||= []).push(b);
    return acc;
  }, {});

  if (baselines.length === 0) {
    return (
      <div className="space-y-6">
        <UniparBaselineUploader />
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">Nenhum budget financeiro ainda</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Importe uma planilha modelo UNIPAR acima ou aprove uma proposta em "Propostas" para gerar
              automaticamente um budget congelado do contrato.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Editable baseline spreadsheet — only when a contract is selected */}
      {contractId && (
        <PlannedSpreadsheet projectId={contractId} focusCompetenceMonth={competenceMonth} />
      )}

      <UniparBaselineUploader />
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Building2 className="w-3 h-3" />
              {Object.keys(grouped).length} contrato{Object.keys(grouped).length !== 1 && "s"}
              {contractFilter && " (filtrado pela barra de contexto)"}
            </Badge>
          </div>
        </CardContent>
      </Card>
      {Object.entries(grouped).map(([projectId, list]) => {
        const sorted = [...list].sort((a, b) => b.version - a.version);
        const active = sorted.find((b) => b.status === "active") ?? sorted[0];
        const proj = active.projects;

        const revenue = Number(active.total_revenue) || 0;
        const direct = Number(active.total_direct_cost) || 0;
        const indirect = Number(active.total_indirect_cost) || 0;
        const taxes = Number(active.total_taxes) || 0;
        const profit = Number(active.total_profit) || 0;
        const totalCost = direct + indirect;
        const grossMargin = revenue - totalCost;
        const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
        const netMarginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

        const drgRows = [
          { label: "Receita Líquida Prevista", value: revenue, kind: "revenue" as const },
          { label: "(−) Custo Direto", value: -direct, kind: "cost" as const },
          { label: "(−) Custo Indireto / Rateios", value: -indirect, kind: "cost" as const },
          { label: "= Margem Bruta", value: grossMargin, kind: "subtotal" as const, pct: grossMarginPct },
          { label: "(−) Impostos Previstos", value: -taxes, kind: "cost" as const },
          { label: "= Resultado Previsto", value: profit, kind: "total" as const, pct: netMarginPct },
        ];

        return (
          <div key={projectId} className="space-y-4">
            {/* Header do contrato */}
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <CardTitle className="text-base">{proj?.project_name ?? "Contrato"}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">{proj?.client ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">v{active.version}</Badge>
                    {active.status === "active" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20">
                        <Lock className="w-3 h-3 mr-1" />Budget Ativo (Travado)
                      </Badge>
                    ) : (
                      <Badge variant="secondary"><Archive className="w-3 h-3 mr-1" />{active.status}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Aprovada em {new Date(active.approved_at).toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="rounded-md border bg-background overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[55%]">Demonstrativo Previsto</TableHead>
                        <TableHead className="text-right">Valor (R$)</TableHead>
                        <TableHead className="text-right w-[120px]">% Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drgRows.map((row) => {
                        const pct = revenue > 0 ? (Math.abs(row.value) / revenue) * 100 : 0;
                        const displayPct = "pct" in row && row.pct !== undefined ? row.pct : pct;
                        return (
                          <TableRow
                            key={row.label}
                            className={cn(
                              row.kind === "subtotal" && "bg-muted/30 font-medium",
                              row.kind === "total" && "bg-primary/5 font-semibold border-t-2"
                            )}
                          >
                            <TableCell>{row.label}</TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                row.value < 0 && "text-destructive",
                                row.kind === "total" && row.value > 0 && "text-emerald-600",
                                row.kind === "total" && row.value < 0 && "text-destructive"
                              )}
                            >
                              {formatBRL(Math.abs(row.value))}
                              {row.value < 0 && row.kind === "cost" && ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                              {displayPct.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {(active.expected_start_date || active.expected_duration_days) && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {active.expected_start_date && (
                      <span>Início previsto: <strong className="text-foreground">{new Date(active.expected_start_date).toLocaleDateString("pt-BR")}</strong></span>
                    )}
                    {active.expected_duration_days && (
                      <span>Duração: <strong className="text-foreground">{active.expected_duration_days} dias</strong></span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de versões */}
            {sorted.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Histórico de versões ({sorted.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Versão</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Resultado</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aprovada</TableHead>
                          <TableHead className="w-[60px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((b) => {
                          const r = Number(b.total_revenue) || 0;
                          const c = (Number(b.total_direct_cost) || 0) + (Number(b.total_indirect_cost) || 0);
                          const p = Number(b.total_profit) || 0;
                          const isDeleting = deletingId === b.id;
                          return (
                            <TableRow key={b.id} className={b.status === "active" ? "bg-emerald-500/5" : ""}>
                              <TableCell className="font-mono">v{b.version}</TableCell>
                              <TableCell className="font-medium text-xs">{b.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatBRL(r)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatBRL(c)}</TableCell>
                              <TableCell className={cn("text-right tabular-nums font-medium", p >= 0 ? "text-emerald-600" : "text-destructive")}>
                                {formatBRL(p)}
                              </TableCell>
                              <TableCell>
                                {b.status === "active" ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />Ativa
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    <Archive className="w-3 h-3 mr-1" />Superseded
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(b.approved_at).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={isDeleting}
                                      aria-label={`Excluir baseline v${b.version}`}
                                    >
                                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir budget v{b.version}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação é <strong>irreversível</strong>. Serão removidos todos os registros vinculados a esta versão do budget:
                                        lançamentos planejados, linhas de DRG e itens de receita importados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteBaseline.mutate(b.id)}
                                      >
                                        Excluir tudo
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FinanceiroPlanejado;
