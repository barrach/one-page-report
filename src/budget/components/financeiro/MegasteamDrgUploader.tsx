import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "@budget/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import ContractSelector from "@budget/components/financeiro/ContractSelector";
import { useRegisterContractFile } from "@budget/hooks/useFinancialContracts";

interface Summary {
  categorias_criadas: number;
  departamentos_criados: number;
  producao_meses: number;
  pessoal_meses: number;
  imobilizado_itens: number;
  base_dados_inseridos: number;
  base_dados_duplicados: number;
  drg_linhas: number;
  drg_abas_centros: number;
  resumo_linhas: number;
  resumo_project_id: string | null;
  rateio_admin_linhas: number;
  rateio_pis_linhas: number;
  parametros: Record<string, number>;
  etapa_f?: {
    contratos_com_financeiro?: number;
    headcount_mar_26?: number;
    validation?: Array<{ mes: string; metrica: string; somado: number; oficial: number; diff: number; ok: boolean }>;
  };
}

const MegasteamDrgUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contractId, setContractId] = useState<string>("");
  const [progress, setProgress] = useState<{ stage: string; message: string; percent: number } | null>(null);
  const qc = useQueryClient();
  const registerFile = useRegisterContractFile();

  // Aguarda o job assíncrono terminar (polling do drg_import_jobs).
  // Aceita TODOS os status terminais que o backend pode emitir.
  const TERMINAL_OK = new Set(["success", "completed", "partial"]);
  const TERMINAL_FAIL = new Set(["failed", "error", "cancelled"]);

  const emptySummary = (): Summary => ({
    categorias_criadas: 0,
    departamentos_criados: 0,
    producao_meses: 0,
    pessoal_meses: 0,
    imobilizado_itens: 0,
    base_dados_inseridos: 0,
    base_dados_duplicados: 0,
    drg_linhas: 0,
    drg_abas_centros: 0,
    resumo_linhas: 0,
    resumo_project_id: null,
    rateio_admin_linhas: 0,
    rateio_pis_linhas: 0,
    parametros: {},
  });

  const waitForJob = async (jobId: string): Promise<Summary> => {
    const start = Date.now();
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
    const STALE_MS = 4 * 60 * 1000; // se o backend parar de atualizar, não deixa a tela infinita

    let lastProgress = -1;
    let lastMessage = "";
    let lastChangeAt = Date.now();

    while (Date.now() - start < TIMEOUT_MS) {
      const { data: job, error } = await supabase
        .from("drg_import_jobs")
        .select("status, stage, stage_message, progress, summary, error_message, updated_at")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (job) {
        const pct = Number(job.progress ?? 0);
        const msg = job.stage_message ?? "Processando...";
        // detecta mudança de progresso ou de mensagem (heartbeat conta)
        if (pct !== lastProgress || msg !== lastMessage) {
          lastProgress = pct;
          lastMessage = msg;
          lastChangeAt = Date.now();
        }
        setProgress({
          stage: job.stage ?? "processing",
          message: msg,
          percent: pct,
        });
        const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : Date.now();
        if (!TERMINAL_OK.has(job.status) && !TERMINAL_FAIL.has(job.status) && Date.now() - updatedAt > STALE_MS) {
          try {
            await supabase.rpc("mark_stale_drg_import_jobs", { stale_after_minutes: 4 });
          } catch { /* ignore */ }
          throw new Error("A importação parou de responder no backend. O job foi encerrado para evitar processamento infinito; tente importar novamente.");
        }
        if (TERMINAL_OK.has(job.status)) {
          const raw = (job.summary ?? {}) as Partial<Summary>;
          const merged = { ...emptySummary(), ...raw } as Summary;
          const importedAnything =
            (merged.pessoal_meses ?? 0) +
            (merged.base_dados_inseridos ?? 0) +
            (merged.drg_linhas ?? 0) +
            (merged.resumo_linhas ?? 0) +
            (merged.rateio_admin_linhas ?? 0) +
            (merged.rateio_pis_linhas ?? 0) > 0;
          if (job.status === "partial" && !importedAnything) {
            throw new Error(job.error_message || "A importação terminou sem gravar dados. O arquivo será reprocessado após a correção.");
          }
          return merged;
        }
        if (TERMINAL_FAIL.has(job.status)) {
          throw new Error(job.error_message || "Falha no processamento da planilha.");
        }
        // Não aborta por ausência temporária de progresso: algumas abas grandes podem
        // ficar mais de 90s sem alterar percentual, mas o job ainda pode finalizar.
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Tempo limite excedido aguardando o processamento.");
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setSummary(null);
    setProgress({ stage: "queued", message: "Enviando arquivo...", percent: 5 });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      // Limpa jobs órfãos antes de começar (best-effort)
      try {
        await supabase.rpc("mark_stale_drg_import_jobs", { stale_after_minutes: 5 });
      } catch { /* ignore */ }

      const form = new FormData();
      form.append("file", file);
      if (contractId) form.append("project_id", contractId);

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/import-megasteam-drg`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Falha na importação");

      // Backend agora processa em background e devolve job_id;
      // resposta legada com summary inline ainda é suportada.
      let finalSummary: Summary;
      if (data.async && data.job_id) {
        finalSummary = await waitForJob(data.job_id);
      } else if (data.summary) {
        finalSummary = { ...emptySummary(), ...(data.summary as Partial<Summary>) };
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }

      setSummary(finalSummary);
      const anchorId = contractId || finalSummary.resumo_project_id || "";
      if (anchorId) {
        await registerFile.mutateAsync({
          project_id: anchorId,
          file_kind: "drg",
          file_name: file.name,
          row_count: finalSummary.drg_linhas ?? 0,
          metadata: {
            drg_abas_centros: finalSummary.drg_abas_centros,
            base_dados_inseridos: finalSummary.base_dados_inseridos,
          },
        }).catch(() => undefined);
      }
      qc.invalidateQueries();
      const etapaF = finalSummary.etapa_f;
      toast({
        title: "Workbook DRG importado",
        description: etapaF
          ? `${etapaF.contratos_com_financeiro ?? 0} contratos · Receita Mar/26 validada · Headcount Mar/26: ${etapaF.headcount_mar_26 ?? finalSummary.pessoal_meses ?? 0}`
          : `${finalSummary.pessoal_meses ?? 0} headcounts · ${finalSummary.base_dados_inseridos ?? 0} lançamentos · ${finalSummary.drg_linhas ?? 0} linhas DRG`,
      });
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Importar workbook DRG completo (Resultado / Departamentos / Base Dados)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
          <p className="font-medium text-foreground">Base oficial do resultado gerencial mensal</p>
          <p className="text-muted-foreground">
            Lê todas as abas: <strong>Categorias</strong>, <strong>Departamentos</strong>,{" "}
            <strong>Cadastro</strong>, <strong>Produção</strong>, <strong>Pessoal</strong>,{" "}
            <strong>Imobilizado</strong>, <strong>Base Dados</strong>, <strong>DRG-Analítico</strong>,{" "}
            <strong>DRG-RESUMO</strong>, <strong>DRG-Todos C.C por mês</strong>,{" "}
            <strong>Rateio Administrativo</strong>, <strong>Rateio PIS-COFINS</strong> e cada aba{" "}
            <strong>DRG-XXXX.XXX</strong> (1 contrato por aba).
          </p>
          <p className="text-muted-foreground">
            Os contratos são criados/atualizados automaticamente pelo código do centro de custo (B4 de cada aba).
            Não é necessário selecionar contrato âncora.
          </p>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            (Opcional) Vincular este upload a um contrato âncora
          </summary>
          <div className="mt-2">
            <ContractSelector
              value={contractId}
              onChange={setContractId}
              label="Contrato âncora (opcional — apenas para referência do arquivo)"
            />
          </div>
        </details>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 flex items-center gap-3 rounded-md border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary/60 transition-colors">
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={handleUpload} disabled={!file || loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? "Processando..." : "Importar"}
          </Button>
        </div>

        {progress && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{progress.message}</span>
              <Badge variant="secondary">{Math.round(progress.percent)}%</Badge>
            </div>
            <div className="h-2 rounded bg-background overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }} />
            </div>
          </div>
        )}

        {summary && (
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Importação concluída
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Categorias novas" value={summary.categorias_criadas} />
              <Stat label="Centros de custo novos" value={summary.departamentos_criados} />
              <Stat label="Produção (meses)" value={summary.producao_meses} />
              <Stat label="Pessoal (meses)" value={summary.pessoal_meses} />
              <Stat label="Imobilizado" value={summary.imobilizado_itens} />
              <Stat label="Lançamentos inseridos" value={summary.base_dados_inseridos} />
              <Stat label="Duplicados ignorados" value={summary.base_dados_duplicados} muted />
              <Stat label="DRG linhas (CC)" value={summary.drg_linhas} />
              <Stat label="DRG-Resumo linhas" value={summary.resumo_linhas} />
              <Stat label="Rateio Admin linhas" value={summary.rateio_admin_linhas} />
              <Stat label="Rateio PIS-COFINS" value={summary.rateio_pis_linhas} />
              <Stat label="Abas DRG por CC" value={summary.drg_abas_centros} />
            </div>
            {summary.drg_abas_centros > 0 && (
              <p className="text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1">{summary.drg_abas_centros}</Badge>
                abas DRG por centro de custo processadas.
              </p>
            )}
            {summary.etapa_f && (
              <div className="rounded-md border border-border bg-background p-3 text-xs space-y-2">
                <div className="font-medium text-foreground">Validação DRG-RESUMO</div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <Stat label="Contratos reais" value={summary.etapa_f.contratos_com_financeiro ?? 0} />
                  <Stat label="Meses processados" value={3} />
                  <Stat label="Headcount Mar/26" value={summary.etapa_f.headcount_mar_26 ?? summary.pessoal_meses} />
                </div>
                {(summary.etapa_f.validation ?? [])
                  .filter((v) => v.metrica === "Receita" || v.metrica === "Lucro Líquido (LL2)")
                  .map((v) => (
                    <div key={`${v.mes}-${v.metrica}`} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                      <span>{v.mes} · {v.metrica}</span>
                      <span className={v.ok ? "text-primary" : "text-destructive"}>
                        {formatCurrency(v.somado)} / {formatCurrency(v.oficial)} {v.ok ? "✓" : `dif. ${formatCurrency(v.diff)}`}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {Object.keys(summary.parametros).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Parâmetros do Cadastro lidos ({Object.keys(summary.parametros).length})
                </summary>
                <div className="mt-2 grid sm:grid-cols-2 gap-1 font-mono">
                  {Object.entries(summary.parametros).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 px-2 py-0.5 rounded bg-background">
                      <span className="truncate">{k}</span>
                      <span className="text-primary">{(v * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, muted }: { label: string; value: number; muted?: boolean }) => (
  <div className={`px-2 py-1.5 rounded bg-background border border-border ${muted ? "opacity-60" : ""}`}>
    <div className="text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold">{value.toLocaleString("pt-BR")}</div>
  </div>
);

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default MegasteamDrgUploader;
