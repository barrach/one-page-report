import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Layers, Sparkles, CheckCircle2, FileText, Building2, Loader2, ArrowRight, Database, BarChart3, ClipboardList } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  source: string;
  is_default: boolean;
  created_at: string;
};

type TemplateLine = {
  id: string;
  line_code: string;
  line_label: string;
  drg_group: string | null;
  is_percentage: boolean;
  sort_order: number;
  category_code: string | null;
};

type ApplyResult = {
  project_id: string;
  project_name: string;
  lines_created: number;
};

const BudgetTemplateManager = () => {
  const qc = useQueryClient();
  const [startMonth, setStartMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [months, setMonths] = useState<number>(12);
  const [results, setResults] = useState<ApplyResult[] | null>(null);

  // Garante que o template padrão existe ao abrir a tela
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.rpc("ensure_default_budget_template", { _user_id: u.user.id });
        qc.invalidateQueries({ queryKey: ["budget_templates"] });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templatesQuery = useQuery({
    queryKey: ["budget_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_templates")
        .select("id, name, description, source, is_default, created_at")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const defaultTemplate = templatesQuery.data?.find((t) => t.is_default) ?? templatesQuery.data?.[0];

  const linesQuery = useQuery({
    queryKey: ["budget_template_lines", defaultTemplate?.id],
    enabled: !!defaultTemplate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_template_lines")
        .select("id, line_code, line_label, drg_group, is_percentage, sort_order, category_code")
        .eq("template_id", defaultTemplate!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateLine[];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["financial_contracts_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, dept_code, status")
        .not("dept_code", "is", null);
      if (error) throw error;
      return (data ?? []).filter((p) => p.status !== "archived");
    },
  });

  const applyAllMutation = useMutation({
    mutationFn: async () => {
      if (!defaultTemplate) throw new Error("Template não encontrado");
      const startDate = `${startMonth}-01`;
      const { data, error } = await supabase.rpc("apply_budget_template_to_all_contracts", {
        _template_id: defaultTemplate.id,
        _start_month: startDate,
        _months: months,
      });
      if (error) throw error;
      return (data ?? []) as ApplyResult[];
    },
    onSuccess: (data) => {
      setResults(data);
      const total = data.reduce((s, r) => s + (r.lines_created ?? 0), 0);
      toast({
        title: "Template aplicado",
        description: `${data.length} contratos receberam a estrutura — ${total} linhas criadas.`,
      });
      qc.invalidateQueries({ queryKey: ["drg_lines"] });
      qc.invalidateQueries({ queryKey: ["financial_contract_snapshots"] });
    },
    onError: (err: Error) =>
      toast({ title: "Falha ao aplicar template", description: err.message, variant: "destructive" }),
  });

  // Agrupa as linhas do template por grupo DRG para visualização
  const groupedLines = (linesQuery.data ?? []).reduce<Record<string, TemplateLine[]>>((acc, l) => {
    const g = l.drg_group ?? "—";
    (acc[g] ||= []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Card de explicação */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Template de Orçamento — Padrão UNIPAR</CardTitle>
              <CardDescription className="mt-1">
                A planilha <strong>"Comparativo real x orçado — UNIPAR"</strong> é tratada como o{" "}
                <strong>modelo estrutural</strong> de orçamento consolidado. Esta estrutura (linhas DRG,
                agrupamentos, ordem) é replicada para cada contrato cadastrado, mantendo cada um como uma{" "}
                <strong>unidade financeira independente</strong> — UNIPAR, NTS, Vale, Eurochem, Gerdau e demais.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Fluxo de dados visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Fluxo por contrato
          </CardTitle>
          <CardDescription>
            Cada contrato possui sua própria instância: budget previsto, custos reais mensais, DRG e resumo executivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { icon: FileText, label: "Template UNIPAR", desc: "Estrutura padrão", color: "text-primary" },
              { icon: ClipboardList, label: "Budget Contrato", desc: "Previsto replicado", color: "text-blue-500" },
              { icon: Database, label: "Custos Mensais", desc: "Real importado", color: "text-amber-500" },
              { icon: BarChart3, label: "DRG Mensal", desc: "Consolidado", color: "text-purple-500" },
              { icon: CheckCircle2, label: "Resumo Executivo", desc: "Previsto x Real", color: "text-green-500" },
            ].map((step, i, arr) => (
              <div key={step.label} className="relative">
                <div className="rounded-lg border bg-muted/20 p-3 h-full flex flex-col items-start gap-1.5">
                  <step.icon className={`h-4 w-4 ${step.color}`} />
                  <p className="text-xs font-semibold leading-tight">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{step.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 z-10" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estrutura do template */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Estrutura do template
              </CardTitle>
              <CardDescription>
                {defaultTemplate?.name ?? "—"} — {linesQuery.data?.length ?? 0} linhas
              </CardDescription>
            </div>
            {defaultTemplate?.is_default && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Padrão ativo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {linesQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedLines).map(([group, lines]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {group}
                  </p>
                  <div className="rounded-md border bg-muted/20">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Código</TableHead>
                          <TableHead>Linha DRG</TableHead>
                          <TableHead className="w-24 text-right">Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs">{l.line_code}</TableCell>
                            <TableCell className="text-sm">{l.line_label}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {l.is_percentage ? "%" : "R$"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aplicar a todos os contratos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Replicar para todos os contratos
          </CardTitle>
          <CardDescription>
            Cria automaticamente a estrutura DRG mensal (sem valores) para cada contrato ativo. Os valores
            já importados não serão sobrescritos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-month" className="text-xs">
                Mês inicial
              </Label>
              <Input
                id="start-month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="months" className="text-xs">
                Quantidade de meses
              </Label>
              <Input
                id="months"
                type="number"
                min={1}
                max={36}
                value={months}
                onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 12)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contratos detectados</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30">
                <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-sm font-medium">{contractsQuery.data?.length ?? 0}</span>
                <span className="text-xs text-muted-foreground ml-1">ativos</span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => applyAllMutation.mutate()}
            disabled={applyAllMutation.isPending || !defaultTemplate}
            className="gap-2"
          >
            {applyAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Aplicar template a todos os contratos
          </Button>

          {results && results.length > 0 && (
            <div className="rounded-md border bg-muted/20 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right w-32">Linhas criadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.project_id}>
                      <TableCell className="text-sm">{r.project_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{r.lines_created}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetTemplateManager;
