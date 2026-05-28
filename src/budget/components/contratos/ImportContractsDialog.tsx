import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Progress } from "@budget/components/ui/progress";

import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  FileDown,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";

interface SheetReport {
  sheet: string;
  kind: string;
  status: "ok" | "skipped" | "error";
  rows_imported?: number;
  message?: string;
  details?: string;
}

interface Summary {
  categorias_criadas: number;
  departamentos_criados: number;
  drg_linhas: number;
  drg_abas_centros: number;
  drg_abas_importadas?: number;
  drg_abas_ignoradas?: number;
  base_dados_inseridos: number;
  base_dados_duplicados: number;
  blocks_ok?: number;
  blocks_with_errors?: number;
  blocks_skipped?: number;
  validation_warnings?: string[];
}

interface JobRow {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  stage: string;
  stage_message: string | null;
  progress: number;
  current_sheet: string | null;
  total_sheets: number;
  processed_sheets: number;
  summary: Summary | null;
  reports: SheetReport[] | null;
  error_code: string | null;
  error_message: string | null;
  error_details: any;
}

const STAGE_LABEL: Record<string, string> = {
  queued: "Na fila...",
  reading: "Identificando abas...",
  validating: "Validando abas...",
  importing: "Importando dados...",
  finalizing: "Finalizando...",
  done: "Concluído",
};

const ImportContractsDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [etaText, setEtaText] = useState<string>("");
  const pollRef = useRef<number | null>(null);
  const lastChangeRef = useRef<number>(Date.now());
  const lastSignatureRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const qc = useQueryClient();

  const reset = () => {
    setFile(null);
    setJob(null);
    setShowDetails(false);
    setUploading(false);
    setStalled(false);
    setEtaText("");
    startTimeRef.current = 0;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const formatEta = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s restantes`;
    const minutes = seconds / 60;
    if (minutes < 1.5) return `~1 minuto restante`;
    if (minutes < 10) return `~${minutes.toFixed(1).replace(".0", "")} min restantes`;
    return `~${Math.round(minutes)} min restantes`;
  };

  const validateClientSide = (f: File): string | null => {
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return `Arquivo inválido (${f.name}). Use formato .xlsx exportado da planilha DRG.`;
    }
    if (f.size > 60 * 1024 * 1024) {
      return `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). Tamanho máximo: 60 MB.`;
    }
    if (f.size === 0) return "Arquivo vazio. Selecione uma planilha válida.";
    return null;
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    lastChangeRef.current = Date.now();
    lastSignatureRef.current = "";
    startTimeRef.current = Date.now();
    setStalled(false);
    setEtaText("");
    const tick = async () => {
      const { data, error } = await supabase
        .from("drg_import_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) {
        console.warn("poll job error", error);
        return;
      }
      if (!data) return;
      const row = data as unknown as JobRow;
      const signature = `${row.progress}|${row.stage}|${row.stage_message}|${row.current_sheet}|${row.processed_sheets}`;
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        lastChangeRef.current = Date.now();
        setStalled(false);
      } else if (Date.now() - lastChangeRef.current > 15000 && (row.status === "pending" || row.status === "processing")) {
        setStalled(true);
      }

      // Calcula ETA: tempo decorrido / progresso × restante
      if (
        (row.status === "pending" || row.status === "processing") &&
        row.progress > 5 &&
        row.progress < 99
      ) {
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
        // após 4s para ter sinal estável
        if (elapsedSec > 4) {
          const remaining = (elapsedSec * (100 - row.progress)) / row.progress;
          setEtaText(formatEta(remaining));
        }
      } else {
        setEtaText("");
      }

      setJob(row);
      const sm = (row.summary ?? {}) as Partial<Summary>;
      if (row.status === "completed" || row.status === "failed" || row.status === "partial") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setStalled(false);
        setEtaText("");
        qc.invalidateQueries();
        if (row.status === "completed") {
          toast({
            title: "Importação concluída",
            description: `${sm.departamentos_criados ?? 0} novos contratos · ${sm.drg_abas_importadas ?? 0} abas DRG`,
          });
        } else if (row.status === "partial") {
          toast({
            title: "Importação parcial",
            description: `${sm.blocks_ok ?? 0} OK · ${sm.blocks_with_errors ?? 0} com erro`,
          });
        } else {
          toast({
            title: "Falha na importação",
            description: data.error_message ?? "Erro desconhecido",
            variant: "destructive",
          });
        }
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 1500);
  };

  const handleUpload = async () => {
    if (!file) return;
    const clientErr = validateClientSide(file);
    if (clientErr) {
      toast({ title: "Arquivo inválido", description: clientErr, variant: "destructive" });
      return;
    }

    setUploading(true);
    setJob(null);
    setShowDetails(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const form = new FormData();
      form.append("file", file);

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/import-megasteam-drg`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });

      let data: any;
      try { data = await res.json(); } catch {
        throw new Error(`Resposta inválida do servidor (HTTP ${res.status}).`);
      }

      if (!res.ok || !data.success || !data.job_id) {
        const msg = data?.error ?? `Erro HTTP ${res.status}`;
        setJob({
          id: "local",
          status: "failed",
          stage: "done",
          stage_message: msg,
          progress: 100,
          current_sheet: null,
          total_sheets: 0,
          processed_sheets: 0,
          summary: null,
          reports: null,
          error_code: data?.error_code ?? "validation",
          error_message: msg,
          error_details: data?.details ? { stack: data.details } : null,
        });
        toast({ title: "Falha ao iniciar", description: msg, variant: "destructive" });
        return;
      }

      // Job criado: começa polling
      setJob({
        id: data.job_id,
        status: "pending",
        stage: "queued",
        stage_message: "Job criado, aguardando início do processamento...",
        progress: 5,
        current_sheet: null,
        total_sheets: 0,
        processed_sheets: 0,
        summary: null,
        reports: null,
        error_code: null,
        error_message: null,
        error_details: null,
      });
      startPolling(data.job_id);
    } catch (e) {
      const msg = (e as Error).message || "Erro desconhecido";
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const reports = job?.reports ?? [];
  const errorReports = reports.filter((r) => r.status === "error");
  const skippedReports = reports.filter((r) => r.status === "skipped");
  const okReports = reports.filter((r) => r.status === "ok");
  const summary = job?.summary;
  const isRunning = uploading || (job && (job.status === "pending" || job.status === "processing"));
  const isFinished = job && (job.status === "completed" || job.status === "partial");
  const isFailed = job?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" /> Importar Contratos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar contratos via planilha DRG
          </DialogTitle>
          <DialogDescription>
            Envie o workbook DRG; o processamento acontece em segundo plano com acompanhamento ao vivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain pr-3 -mr-3">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada aba <strong>DRG-XXXX</strong> da planilha será interpretada como um contrato.
              Tamanho máximo: <strong>60 MB</strong>. Formato: <strong>.xlsx</strong>.
              Arquivos grandes são processados de forma assíncrona — você pode fechar este diálogo e voltar depois.
            </p>

            <label className="flex items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 cursor-pointer hover:border-primary/60 transition-colors">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {file ? file.name : "Selecionar arquivo .xlsx (até 60 MB)"}
                </div>
                {file && (
                  <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={!!isRunning}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setJob(null);
                  setShowDetails(false);
                }}
              />
            </label>

            <Button onClick={handleUpload} disabled={!file || !!isRunning} className="w-full gap-2">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isRunning ? "Processando em segundo plano..." : "Importar contratos"}
            </Button>

            {/* Progresso em tempo real */}
            {job && (job.status === "pending" || job.status === "processing") && (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">
                    {STAGE_LABEL[job.stage] ?? job.stage}
                    {job.current_sheet ? ` · ${job.current_sheet}` : ""}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{Math.round(job.progress)}%</span>
                </div>
                <Progress value={job.progress} className="h-1.5" />
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{job.stage_message ?? ""}</span>
                  {etaText && (
                    <span className="shrink-0 font-medium text-primary tabular-nums">{etaText}</span>
                  )}
                </div>
                {job.total_sheets > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {job.processed_sheets}/{job.total_sheets} abas processadas
                  </p>
                )}
              </div>
            )}

            {/* Falha */}
            {isFailed && job && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="w-4 h-4" />
                  Falha na importação
                  {job.error_code && (
                    <Badge variant="outline" className="text-[10px] uppercase">{job.error_code}</Badge>
                  )}
                </div>
                <p className="text-sm text-foreground">{job.error_message}</p>
                {job.error_details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver detalhes técnicos
                    </summary>
                    <pre className="mt-2 p-2 rounded bg-background border border-border whitespace-pre-wrap break-words text-[10px]">
                      {typeof job.error_details === "string"
                        ? job.error_details
                        : JSON.stringify(job.error_details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Sucesso / parcial */}
            {isFinished && summary && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {job?.status === "partial" ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Importação concluída com observações
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Importação concluída
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Blocos OK" value={summary.blocks_ok ?? okReports.length} highlight />
                  <Stat label="Com erro" value={summary.blocks_with_errors ?? errorReports.length} muted={!errorReports.length} />
                  <Stat label="Ignorados" value={summary.blocks_skipped ?? skippedReports.length} muted />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Contratos criados" value={summary.departamentos_criados} highlight />
                  <Stat label="Categorias novas" value={summary.categorias_criadas} />
                  <Stat label="Abas DRG importadas" value={summary.drg_abas_importadas ?? summary.drg_abas_centros} highlight />
                  <Stat label="Abas DRG ignoradas" value={summary.drg_abas_ignoradas ?? 0} muted />
                  <Stat label="Linhas DRG inseridas" value={summary.drg_linhas} />
                  <Stat label="Lançamentos importados" value={summary.base_dados_inseridos} />
                </div>

                {summary.base_dados_duplicados > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-1">Dedup</Badge>
                    {summary.base_dados_duplicados.toLocaleString("pt-BR")} lançamento(s) duplicados foram ignorados automaticamente.
                  </p>
                )}

                {errorReports.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {errorReports.length} bloco(s) com erro
                    </div>
                    <ul className="text-xs space-y-1 pl-4 list-disc text-foreground">
                      {errorReports.map((r) => (
                        <li key={r.sheet}>
                          <span className="font-medium">{r.sheet}:</span>{" "}
                          <span className="text-muted-foreground">{r.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {skippedReports.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-warning">
                      {skippedReports.length} bloco(s) ignorados
                    </div>
                    <ul className="text-xs space-y-1 pl-4 list-disc text-muted-foreground">
                      {skippedReports.map((r) => (
                        <li key={r.sheet}>
                          <span className="font-medium text-foreground">{r.sheet}:</span> {r.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {reports.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={() => setShowDetails((v) => !v)}
                  >
                    <span>Ver detalhes do relatório ({reports.length})</span>
                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                )}

                {showDetails && (
                  <div className="space-y-1 max-h-64 overflow-y-auto rounded border border-border bg-background p-2">
                    {reports.map((r, idx) => (
                      <div
                        key={`${r.sheet}-${idx}`}
                        className="flex items-start gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50"
                      >
                        {r.status === "ok" && <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
                        {r.status === "error" && <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />}
                        {r.status === "skipped" && <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{r.sheet}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{r.kind}</Badge>
                            {typeof r.rows_imported === "number" && (
                              <span className="text-muted-foreground">
                                {r.rows_imported.toLocaleString("pt-BR")} linha(s)
                              </span>
                            )}
                          </div>
                          {r.message && (
                            <div className="text-muted-foreground mt-0.5">{r.message}</div>
                          )}
                          {r.details && (
                            <pre className="mt-1 p-1.5 rounded bg-muted/50 text-[10px] whitespace-pre-wrap break-words">
                              {r.details}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({
  label,
  value,
  muted,
  highlight,
}: { label: string; value: number; muted?: boolean; highlight?: boolean }) => (
  <div
    className={`px-2 py-1.5 rounded border bg-background ${
      muted ? "opacity-60" : highlight ? "border-primary/40" : "border-border"
    }`}
  >
    <div className="text-muted-foreground">{label}</div>
    <div className={`text-sm font-semibold ${highlight ? "text-primary" : ""}`}>
      {value.toLocaleString("pt-BR")}
    </div>
  </div>
);

export default ImportContractsDialog;
