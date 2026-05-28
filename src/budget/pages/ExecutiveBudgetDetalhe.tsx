import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Lock, History, Save, GitBranch } from "lucide-react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Textarea } from "@budget/components/ui/textarea";
import { Separator } from "@budget/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { useToast } from "@budget/hooks/use-toast";
import {
  useExecutiveBudget,
  useExecutiveBudgetRevisions,
  useUpdateComplementaryNotes,
  useUpdateExecutiveBudgetStatus,
  STATUS_LABELS,
  STATUS_FLOW,
  isLocked,
  type ExecutiveBudgetStatus,
} from "@budget/hooks/useExecutiveBudgets";
import { ExecutiveBudgetPDF } from "@budget/components/executivo/ExecutiveBudgetPDF";
import SimulationsPanel from "@budget/components/executivo/SimulationsPanel";
import SimulationEditor from "@budget/components/executivo/SimulationEditor";
import { pdf } from "@react-pdf/renderer";
import { formatBRL, formatNumber } from "@budget/lib/format";

const statusColor: Record<ExecutiveBudgetStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_aprovacao: "bg-accent/10 text-accent border-accent/30",
  aprovado: "bg-primary/10 text-primary border-primary/30",
  em_execucao: "bg-green-500/10 text-green-500 border-green-500/30",
  concluido: "bg-muted text-muted-foreground",
};

const ExecutiveBudgetDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: doc, isLoading } = useExecutiveBudget(id);
  const { data: revisions = [] } = useExecutiveBudgetRevisions(id);
  const updateNotes = useUpdateComplementaryNotes();
  const updateStatus = useUpdateExecutiveBudgetStatus();

  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (doc) setNotes(doc.complementary_notes || "");
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const snapshot = doc?.snapshot_data;
  const ind = snapshot?.indicators;
  const locked = doc ? isLocked(doc.status) : false;

  const handleSaveNotes = () => {
    if (!doc) return;
    if ((notes || "") === (doc.complementary_notes || "")) {
      toast({ title: "Nada a salvar" });
      return;
    }
    updateNotes.mutate(
      { id: doc.id, previousContent: doc.complementary_notes, newContent: notes },
      { onSuccess: () => toast({ title: "Dados complementares atualizados" }) }
    );
  };

  const handleStatusChange = (next: ExecutiveBudgetStatus) => {
    if (!doc) return;
    updateStatus.mutate(
      { id: doc.id, status: next },
      { onSuccess: () => toast({ title: `Status atualizado para ${STATUS_LABELS[next]}` }) }
    );
  };

  const handleDownloadPDF = async () => {
    if (!doc || !snapshot) return;
    try {
      const blob = await pdf(
        <ExecutiveBudgetPDF
          snapshot={snapshot}
          documentNumber={doc.document_number}
          status={STATUS_LABELS[doc.status]}
          version={doc.version}
          complementaryNotes={notes}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.document_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF gerado com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e?.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }
  if (!doc) {
    return <div className="p-8 text-muted-foreground">Documento não encontrado.</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(`/projeto/${doc.project_id}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao projeto
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <Badge variant="outline" className={statusColor[doc.status]}>
              {STATUS_LABELS[doc.status]}
            </Badge>
            {locked && <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Travado</Badge>}
            {doc.is_simulation && (
              <Badge variant="outline" className="gap-1 bg-accent/10 text-accent border-accent/30">
                <GitBranch className="w-3 h-3" /> Simulação
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {doc.document_number} · v{doc.version} · {snapshot?.project?.client} — {snapshot?.project?.name}
            {doc.is_simulation && snapshot?.simulation_of && (
              <> · vinculada a <strong>{snapshot.simulation_of}</strong></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={doc.status} onValueChange={(v) => handleStatusChange(v as ExecutiveBudgetStatus)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FLOW.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleDownloadPDF} className="gap-2">
            <Download className="w-4 h-4" /> Baixar PDF
          </Button>
        </div>
      </div>

      {/* Resumo executivo */}
      {ind && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Resumo Executivo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Prazo" value={`${ind.durationMonths} meses`} />
            <Kpi label="Pico de efetivo" value={`${ind.peakEffective} pessoas`} sub={`MOI ${ind.peakMOI} · MOD ${ind.peakMOD}`} />
            <Kpi label="HH total" value={formatNumber(ind.totalHH)} sub={`MOD ${formatNumber(ind.totalHHMOD)} · MOI ${formatNumber(ind.totalHHMOI)}`} />
            <Kpi label="HH produtivo" value={formatNumber(ind.productiveHH)} />
            <Kpi label="Custo direto" value={formatBRL(ind.directCost)} />
            <Kpi label="Preço de venda" value={formatBRL(ind.salePrice)} accent="primary" />
            <Kpi label="Margem bruta" value={`${ind.grossMargin.toFixed(1)}%`} accent="green" />
            <Kpi label="R$/HH produtivo" value={formatBRL(ind.pricePerProductiveHH)} />
          </div>
        </Card>
      )}

      {/* HH por especialidade */}
      {snapshot?.hhBySpecialty?.length ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">HH por Especialidade</h2>
          <div className="space-y-1.5">
            {snapshot.hhBySpecialty.map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span>{row.specialty}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-muted-foreground">{formatNumber(row.hh)} HH</span>
                  <span className="font-mono w-12 text-right">{row.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Custos */}
      {snapshot?.costs?.length ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Estrutura de Custos</h2>
          <div className="space-y-1.5">
            {snapshot.costs.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span>{c.category}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{formatBRL(c.value)}</span>
                  <span className="font-mono w-12 text-right text-muted-foreground">{c.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm py-2 mt-2 bg-muted/30 px-2 rounded font-semibold">
              <span>CUSTO TOTAL DIRETO</span>
              <span className="font-mono">{formatBRL(ind?.directCost || 0)}</span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Dados complementares */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">Dados Complementares</h2>
            <p className="text-xs text-muted-foreground">Sempre editável. Cada salvamento gera uma revisão registrada.</p>
          </div>
          <Button size="sm" onClick={handleSaveNotes} disabled={updateNotes.isPending} className="gap-1">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Registre revisões de escopo, ocorrências relevantes, ajustes de prazo ou equipe, e qualquer informação que impacte o orçamento em execução…"
          rows={8}
          className="resize-y"
        />
      </Card>

      {/* Editor de simulação (apenas em documentos do tipo simulação) */}
      {doc.is_simulation && <SimulationEditor simulation={doc} />}

      {/* Painel de simulações (apenas em orçamentos originais) */}
      {!doc.is_simulation && <SimulationsPanel parent={doc} />}

      {/* Histórico de revisões */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Histórico de Revisões</h2>
          <Badge variant="outline">{revisions.length}</Badge>
        </div>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {revisions.map((r) => (
              <div key={r.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{r.author_email || "—"}</span>
                </div>
                <p className="mt-1 text-foreground/80 whitespace-pre-wrap line-clamp-4">{r.new_content || "(vazio)"}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const Kpi = ({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: "primary" | "green" }) => (
  <div className="space-y-0.5">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold ${accent === "primary" ? "text-primary" : accent === "green" ? "text-green-500" : ""}`}>
      {value}
    </div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

export default ExecutiveBudgetDetalhe;
