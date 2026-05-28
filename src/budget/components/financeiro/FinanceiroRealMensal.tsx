import { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Input } from "@budget/components/ui/input";
import { Switch } from "@budget/components/ui/switch";
import { Label } from "@budget/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import {
  useFinancialImports,
  useFinancialEntries,
  useFinancialCategories,
  useProjectsList,
} from "@budget/hooks/useFinancial";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { formatBRL } from "@budget/lib/format";
import { Upload, FileSpreadsheet, Search, Filter, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Replace, Trash2 } from "lucide-react";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Progress } from "@budget/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@budget/components/ui/alert-dialog";
import EntryReviewRow, { type EntryRow } from "./EntryReviewRow";
import { cn } from "@budget/lib/utils";

type ImportRecord = {
  id: string;
  file_name: string;
  competence_month: string | null;
  imported_rows: number;
  duplicate_rows: number;
  excluded_rows: number;
  total_value: number | string;
  status: string;
};

type Phase = "idle" | "reading" | "identifying" | "linking" | "categorizing" | "saving" | "finalizing" | "done";
const PHASE_STEPS: { key: Phase; label: string; pct: number }[] = [
  { key: "reading",      label: "Lendo arquivo",         pct: 10 },
  { key: "identifying",  label: "Identificando linhas",  pct: 25 },
  { key: "linking",      label: "Vinculando contratos",  pct: 50 },
  { key: "categorizing", label: "Categorizando",         pct: 70 },
  { key: "saving",       label: "Salvando",              pct: 90 },
  { key: "finalizing",   label: "Finalizando",           pct: 100 },
];

type StatusFilter = "all" | "needs_review" | "duplicate" | "excluded" | "installment" | "ok" | "no_contract" | "no_category";

const monthOptions = (() => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value: v, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }
  return opts;
})();

const FinanceiroRealMensal = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [reprocessing, setReprocessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedImport, setSelectedImport] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [competenceOverride, setCompetenceOverride] = useState<string>("auto");
  const [replaceExistingMonth, setReplaceExistingMonth] = useState<boolean>(true);
  const [importToDelete, setImportToDelete] = useState<ImportRecord | null>(null);
  const [deletingImport, setDeletingImport] = useState(false);

  const { data: imports, isLoading: li } = useFinancialImports();
  const { data: entries, isLoading: le } = useFinancialEntries({ importId: selectedImport });
  const { data: categories = [] } = useFinancialCategories();
  const { data: projects = [] } = useProjectsList();
  const qc = useQueryClient();

  const handleDeleteImport = useCallback(async () => {
    if (!importToDelete || deletingImport) return;
    setDeletingImport(true);
    try {
      const { data, error } = await supabase.rpc("delete_financial_import", {
        _import_id: importToDelete.id,
      });
      if (error) throw error;
      const result = data as { deleted_entries?: number } | null;
      toast({
        title: "Importação removida com sucesso.",
        description: result?.deleted_entries
          ? `${result.deleted_entries} lançamento(s) e dados vinculados foram apagados.`
          : undefined,
      });
      // Limpa a seleção se a importação excluída estava aberta
      if (selectedImport === importToDelete.id) {
        setSelectedImport(undefined);
      }
      // Reprocessa todos os dashboards/indicadores derivados sem refresh manual
      qc.invalidateQueries({ queryKey: ["financial-imports"] });
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      qc.invalidateQueries({ queryKey: ["financial-allocations"] });
      qc.invalidateQueries({ queryKey: ["financial-baselines"] });
      qc.invalidateQueries({ queryKey: ["contract-revenues"] });
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
      qc.invalidateQueries({ queryKey: ["payroll-entries"] });
      qc.invalidateQueries({ queryKey: ["financial-drg-lines"] });
      qc.invalidateQueries({ queryKey: ["drg-lines"] });
      qc.invalidateQueries({ queryKey: ["financial-contract-snapshots"] });
      qc.invalidateQueries({ queryKey: ["financial-contract-files"] });
      qc.invalidateQueries({ queryKey: ["financial-apportionments"] });
      setImportToDelete(null);
    } catch (e) {
      toast({
        title: "Erro ao remover importação.",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeletingImport(false);
    }
  }, [importToDelete, deletingImport, selectedImport, qc]);

  const handleReprocess = useCallback(async () => {
    setReprocessing(true);
    try {
      const { data, error } = await supabase.rpc("reprocess_financial_entries");
      if (error) throw error;
      const r = (data as any[])?.[0];
      toast({
        title: "Reprocessamento concluído",
        description: r
          ? `${r.admin_unlinked} desvinculados de Admin · ${r.by_keyword_linked} ligados por palavra-chave · ${r.reconciled_categorized} categorizados · ${r.reconciled_linked} religados por DRG`
          : "Concluído",
      });
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      qc.invalidateQueries({ queryKey: ["financial-imports"] });
    } catch (e) {
      toast({ title: "Erro no reprocessamento", description: (e as Error).message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  }, [qc]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: "Formato inválido", description: "Envie um arquivo .xlsx, .xls ou .csv", variant: "destructive" });
      return;
    }
    setUploading(true);
    setPhase("reading");
    // Avança as fases visualmente enquanto a edge function processa em uma única chamada.
    // Cadência alinhada ao tempo médio observado (planilhas até ~5k linhas).
    const phaseTimers: number[] = [];
    const schedule = (p: Phase, delayMs: number) => {
      phaseTimers.push(window.setTimeout(() => setPhase(p), delayMs));
    };
    schedule("identifying", 600);
    schedule("linking", 1800);
    schedule("categorizing", 3500);
    schedule("saving", 5500);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("budget-imports").upload(path, file);
      if (upErr) throw upErr;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("file_name", file.name);
      fd.append("storage_path", path);
      // Distribuição 100% automática: o sistema lê a coluna "Descrição do C. de Custos"
      // e vincula cada linha ao contrato correto (DRG XXXX.XXX, palavra-chave do cliente,
      // regras aprendidas). Sem fallback automático para Administrativo.
      if (competenceOverride !== "auto") fd.append("competence_month", competenceOverride);
      // Substituição por competência: re-importar o mesmo mês apaga os dados
      // anteriores daquele período e salva apenas a nova versão.
      fd.append("replace_existing_month", replaceExistingMonth ? "true" : "false");

      const { data, error } = await supabase.functions.invoke("import-financial-entries", { body: fd });
      if (error) throw error;

      phaseTimers.forEach(clearTimeout);
      setPhase("finalizing");

      const created = data.auto_created_contracts ?? 0;
      const linked = data.linked_to_projects ?? 0;
      const unlinked = data.unlinked ?? 0;
      const replaced = data.replaced_rows ?? 0;
      toast({
        title: "Importação concluída",
        description: [
          `${data.imported} válidos`,
          `${linked} vinculados`,
          created > 0 ? `${created} contratos criados` : null,
          unlinked > 0 ? `${unlinked} para revisão` : null,
          `${data.duplicates} duplicados`,
          replaced > 0 ? `${replaced} substituídos da competência anterior` : null,
        ].filter(Boolean).join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["financial-imports"] });
      qc.invalidateQueries({ queryKey: ["financial-entries"] });
      qc.invalidateQueries({ queryKey: ["financial-contract-files"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts"] });
      qc.invalidateQueries({ queryKey: ["financial-contracts-health-portal"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setSelectedImport(data.import_id);
      setPhase("done");
    } catch (e) {
      phaseTimers.forEach(clearTimeout);
      setPhase("idle");
      toast({ title: "Erro na importação", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      // Limpa o estado "done" depois de um momento para esconder a barra
      window.setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 2500);
    }
  }, [qc, competenceOverride, replaceExistingMonth]);


  const filtered = useMemo(() => {
    if (!entries) return [] as EntryRow[];
    const q = search.toLowerCase().trim();
    return (entries as unknown as EntryRow[]).filter((e) => {
      if (q) {
        const haystack = `${e.supplier ?? ""} ${e.cost_center_description ?? ""} ${e.managerial_code ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "none" && e.category_id) return false;
        if (categoryFilter !== "none" && e.category_id !== categoryFilter) return false;
      }
      if (projectFilter !== "all") {
        if (projectFilter === "none" && e.contract_project_id) return false;
        if (projectFilter !== "none" && e.contract_project_id !== projectFilter) return false;
      }
      switch (statusFilter) {
        case "needs_review": return e.review_status === "needs_review";
        case "duplicate":    return e.is_duplicate;
        case "excluded":     return e.is_excluded;
        case "installment":  return !!e.installment_group;
        case "no_contract":  return !e.contract_project_id && !e.is_excluded;
        case "no_category":  return !e.category_id && !e.is_excluded;
        case "ok":           return !e.is_duplicate && !e.is_excluded && e.review_status !== "needs_review";
        default:             return true;
      }
    });
  }, [entries, search, statusFilter, categoryFilter, projectFilter]);

  const counters = useMemo(() => {
    const list = (entries ?? []) as unknown as EntryRow[];
    const valid = list.filter((e) => !e.is_excluded);
    const linked = valid.filter((e) => e.contract_project_id).length;
    const categorized = valid.filter((e) => e.category_id).length;
    return {
      total: list.length,
      review: list.filter((e) => e.review_status === "needs_review").length,
      dup: list.filter((e) => e.is_duplicate).length,
      excl: list.filter((e) => e.is_excluded).length,
      inst: list.filter((e) => e.installment_group).length,
      no_contract: valid.filter((e) => !e.contract_project_id).length,
      no_category: valid.filter((e) => !e.category_id).length,
      coverage_contract: valid.length ? Math.round((linked / valid.length) * 1000) / 10 : 0,
      coverage_category: valid.length ? Math.round((categorized / valid.length) * 1000) / 10 : 0,
    };
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Cobertura + Reprocessar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {counters.coverage_contract >= 95 ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Cobertura de contrato</div>
                <div className="text-lg font-semibold">{counters.coverage_contract}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {counters.coverage_category >= 80 ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              )}
              <div>
                <div className="text-xs text-muted-foreground">Categorização DRG</div>
                <div className="text-lg font-semibold">{counters.coverage_category}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Sem contrato</div>
                <div className="text-lg font-semibold">{counters.no_contract}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Sem categoria</div>
                <div className="text-lg font-semibold">{counters.no_category}</div>
              </div>
            </div>
            <div className="ml-auto">
              <Button onClick={handleReprocess} disabled={reprocessing} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={cn("w-4 h-4", reprocessing && "animate-spin")} />
                {reprocessing ? "Reprocessando..." : "Reprocessar dados existentes"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            <strong>Reprocessar</strong> remove vínculos automáticos indevidos com Administrativo, religa por código DRG e palavra-chave, e reaplica categorização DRG.
          </p>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar planilha mensal de custos (CUSTOS_MES)</CardTitle>
          <p className="text-xs text-muted-foreground">
            <strong>Ponto de entrada principal do Financeiro.</strong> Carregue uma única planilha mensal (ex: <code className="text-[10px] bg-muted px-1 rounded">CUSTOS_MES_03.26</code>) — o sistema lê a coluna <strong>Descrição do C. de Custos</strong> e distribui cada despesa: <em>(1)</em> código DRG <code className="text-[10px] bg-muted px-1 rounded">XXXX.XXX</code> → contrato direto; <em>(2)</em> texto sem código (ex: "PARADA EUROCHEM") → match por nome do cliente; <em>(3)</em> texto explícito "ADMINISTRATIVO" → contrato Admin; <em>(4)</em> caso contrário → <strong>fila de revisão manual</strong> (nunca fallback automático para Admin).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competência (opcional)</label>
              <Select value={competenceOverride} onValueChange={setCompetenceOverride}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detectar automaticamente</SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Detecção automática pela coluna "Compet" e pelo nome do arquivo (ex: "MES_03.26" → mar/26)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Substituição por competência</label>
              <div className="flex items-center gap-3 h-9 px-3 rounded-md border bg-muted/20">
                <Replace className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label htmlFor="replace-month" className="text-xs flex-1 cursor-pointer leading-tight">
                  Substituir dados existentes do mesmo mês
                </Label>
                <Switch
                  id="replace-month"
                  checked={replaceExistingMonth}
                  onCheckedChange={setReplaceExistingMonth}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {replaceExistingMonth
                  ? "Reimportar a mesma competência apaga os lançamentos anteriores daquele mês."
                  : "⚠ Reimportar pode acumular lançamentos. Use apenas para complementar dados."}
              </p>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
              uploading && "pointer-events-none"
            )}
          >
            <Upload className={cn("w-8 h-8 mx-auto mb-2", dragOver ? "text-primary" : "text-muted-foreground", uploading && "opacity-50")} />
            <p className={cn("text-sm font-medium", uploading && "opacity-50")}>
              {uploading
                ? "Processando planilha..."
                : "Arraste sua planilha aqui ou clique para escolher"}
            </p>
            <p className={cn("text-xs text-muted-foreground mt-1", uploading && "opacity-50")}>.xlsx, .xls ou .csv · até 20MB · distribuição automática por DRG</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* Progresso por fase — visível durante todo o processamento */}
          {(uploading || phase === "done") && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {phase === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
                <span className="text-sm font-medium">
                  {phase === "done"
                    ? "Importação concluída"
                    : (PHASE_STEPS.find((s) => s.key === phase)?.label ?? "Iniciando…")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {(PHASE_STEPS.find((s) => s.key === phase)?.pct ?? 0)}%
                </span>
              </div>
              <Progress value={PHASE_STEPS.find((s) => s.key === phase)?.pct ?? 0} className="h-1.5" />
              <ol className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
                {PHASE_STEPS.map((step) => {
                  const currentIdx = PHASE_STEPS.findIndex((s) => s.key === phase);
                  const stepIdx = PHASE_STEPS.findIndex((s) => s.key === step.key);
                  const isDone = phase === "done" || stepIdx < currentIdx;
                  const isActive = stepIdx === currentIdx && phase !== "done";
                  return (
                    <li
                      key={step.key}
                      className={cn(
                        "flex items-center gap-1.5 transition-colors",
                        isDone ? "text-foreground" : isActive ? "text-primary font-medium" : "text-muted-foreground/60"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-current shrink-0" />
                      )}
                      <span>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {li ? <Skeleton className="h-32" /> : (!imports || imports.length === 0) ? null : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Histórico</p>
              {imports.map((imp) => (
                <div
                  key={imp.id}
                  className={cn(
                    "group w-full flex flex-wrap items-center gap-3 p-3 rounded-md border transition",
                    selectedImport === imp.id ? "bg-muted border-primary" : "hover:bg-muted/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedImport(imp.id === selectedImport ? undefined : imp.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{imp.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {imp.competence_month && new Date(imp.competence_month).toLocaleDateString("pt-BR")} · {imp.imported_rows} válidos · {formatBRL(Number(imp.total_value))}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {imp.duplicate_rows > 0 && <Badge variant="outline" className="text-xs">{imp.duplicate_rows} dup</Badge>}
                    {imp.excluded_rows > 0 && <Badge variant="outline" className="text-xs">{imp.excluded_rows} exc</Badge>}
                    <Badge variant={imp.status === "ready" ? "default" : "secondary"} className="text-xs">{imp.status}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImportToDelete(imp as ImportRecord);
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition"
                      aria-label="Excluir importação"
                      title="Excluir importação"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog
        open={!!importToDelete}
        onOpenChange={(open) => {
          if (!open && !deletingImport) setImportToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ATENÇÃO
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Você está removendo esta importação permanentemente.</p>
                {importToDelete && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground truncate">{importToDelete.file_name}</p>
                    <p className="text-muted-foreground">
                      {importToDelete.competence_month && new Date(importToDelete.competence_month).toLocaleDateString("pt-BR")} · {importToDelete.imported_rows} válidos · {formatBRL(Number(importToDelete.total_value))}
                    </p>
                  </div>
                )}
                <p>
                  Todos os lançamentos, vínculos, classificações DRG e dados financeiros originados desta importação serão apagados definitivamente.
                </p>
                <p className="font-medium text-destructive">Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingImport}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteImport();
              }}
              disabled={deletingImport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingImport ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir definitivamente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Counters + Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter("all")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Todos · {counters.total}
              </button>
              <button onClick={() => setStatusFilter("needs_review")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "needs_review" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Revisar · {counters.review}
              </button>
              <button onClick={() => setStatusFilter("installment")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "installment" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Parcelados · {counters.inst}
              </button>
              <button onClick={() => setStatusFilter("duplicate")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "duplicate" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Duplicados · {counters.dup}
              </button>
              <button onClick={() => setStatusFilter("excluded")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "excluded" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Excluídos · {counters.excl}
              </button>
              <button onClick={() => setStatusFilter("ok")} className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition", statusFilter === "ok" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                Válidos
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Buscar fornecedor, código, descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-7 text-xs"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                <SelectItem value="none" className="text-xs">Sem categoria</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[210px] h-7 text-xs"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os contratos</SelectItem>
                <SelectItem value="none" className="text-xs">Não vinculados</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.dept_code ? `${p.dept_code} · ` : ""}{p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {le ? <Skeleton className="h-64" /> : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {entries?.length ? "Nenhum lançamento corresponde aos filtros." : "Sem lançamentos. Importe uma planilha acima."}
            </p>
          ) : (
            <div
              className="rounded-md border overflow-auto max-h-[70vh] overscroll-contain w-full"
              // Single overflow container — needed for sticky header to work AND for horizontal scroll on narrow screens.
            >
              <table
                className={
                  // MegaBudget ULTRA-compact — fixed layout so column widths are
                  // distributed proportionally and the table always fills 100%
                  // of the available width without horizontal scroll on desktop.
                  "w-full table-fixed caption-bottom text-[10px] " +
                  // Display rows: truncate long text, never break layout
                  "[&_tr:not([data-editing=true])_td]:overflow-hidden " +
                  "[&_tr:not([data-editing=true])_td]:text-ellipsis " +
                  "[&_tr:not([data-editing=true])_td]:whitespace-nowrap " +
                  // Editing rows: let inputs/selects fill cell width without clipping
                  "[&_tr[data-editing=true]_td]:!overflow-visible " +
                  "[&_tr[data-editing=true]_td]:!whitespace-normal " +
                  "[&_tr[data-editing=true]_td]:!min-w-0 " +
                  "[&_tr[data-editing=true]_td_input]:w-full [&_tr[data-editing=true]_td_input]:min-w-0 " +
                  "[&_tr[data-editing=true]_td_[role=combobox]]:w-full [&_tr[data-editing=true]_td_[role=combobox]]:min-w-0"
                }
              >
                {/* Distribuição proporcional — prioridade: Fornecedor, C.Custo, Categoria, Valor */}
                <colgroup>
                  <col style={{ width: "56px" }} />   {/* Status   */}
                  <col style={{ width: "62px" }} />   {/* Emissão  */}
                  <col style={{ width: "auto" }} />   {/* Fornecedor — flex */}
                  <col style={{ width: "62px" }} />   {/* Código   */}
                  <col style={{ width: "auto" }} />   {/* C.Custo  — flex */}
                  <col style={{ width: "auto" }} />   {/* Cat. DRG — flex */}
                  <col style={{ width: "110px" }} />  {/* Contrato */}
                  <col style={{ width: "92px" }} />   {/* Valor    */}
                  <col style={{ width: "54px" }} />   {/* Comp.    */}
                  <col style={{ width: "60px" }} />   {/* Ações    */}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80 shadow-sm [&_tr]:border-b">
                  <tr className="border-b transition-colors">
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Emissão</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Fornecedor</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Código</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">C. custo</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Cat. DRG</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Contrato</th>
                    <th className="h-8 px-1 py-1 text-right align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Valor</th>
                    <th className="h-8 px-1 py-1 text-left align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Comp.</th>
                    <th className="h-8 px-1 py-1 text-right align-middle font-medium text-muted-foreground text-[9px] uppercase tracking-wide whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filtered.slice(0, 500).map((e) => (
                    <EntryReviewRow key={e.id} entry={e} categories={categories} projects={projects} />
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <p className="p-3 text-xs text-muted-foreground text-center border-t">
                  Mostrando 500 de {filtered.length} lançamentos. Refine os filtros para ver mais.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroRealMensal;
