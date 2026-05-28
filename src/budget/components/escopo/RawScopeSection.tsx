import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Textarea } from "@budget/components/ui/textarea";
import { Badge } from "@budget/components/ui/badge";
import {
  Save, FileText, AlertTriangle, CheckCircle, Pencil, Sparkles, Loader2,
  Upload, X, File, FileCheck, Eye, RefreshCw
} from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import ScopeAnalysisPanel from "./ScopeAnalysisPanel";

interface Props {
  projectId: string;
  initialData: {
    scope_description?: string | null;
    premises?: string | null;
    exclusions?: string | null;
    notes?: string | null;
  };
  projectMeta?: {
    project_name?: string;
    client?: string;
    location?: string | null;
    contract_type?: string | null;
  };
  scopeItems?: { title: string; category: string }[];
}

type PdfStatus = "idle" | "uploading" | "extracting" | "extracted" | "partial" | "error";

export default function RawScopeSection({ projectId, initialData, projectMeta, scopeItems }: Props) {
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState(initialData.scope_description || "");
  const [premises, setPremises] = useState(initialData.premises || "");
  const [exclusions, setExclusions] = useState(initialData.exclusions || "");
  const [notes, setNotes] = useState(initialData.notes || "");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // PDF state
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfStoragePath, setPdfStoragePath] = useState<string | null>(null);
  const [pdfExtractedText, setPdfExtractedText] = useState<string>("");
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfExtractionMethod, setPdfExtractionMethod] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setScope(initialData.scope_description || "");
    setPremises(initialData.premises || "");
    setExclusions(initialData.exclusions || "");
    setNotes(initialData.notes || "");
  }, [initialData]);

  // Check for existing PDF on mount
  useEffect(() => {
    const checkExistingPdf = async () => {
      try {
        const { data } = await supabase.storage
          .from("scope-pdfs")
          .list(projectId, { limit: 1, sortBy: { column: "created_at", order: "desc" } });
        if (data && data.length > 0) {
          const file = data[0];
          const storagePath = `${projectId}/${file.name}`;
          setPdfFileName(file.name);
          setPdfStoragePath(storagePath);
          // Extract text from existing PDF
          await extractTextFromPdf(storagePath);
        }
      } catch (err) {
        console.error("Error checking existing PDF:", err);
      }
    };
    if (projectId) checkExistingPdf();
  }, [projectId]);

  const extractTextFromPdf = async (storagePath: string) => {
    setPdfStatus("extracting");
    setPdfError(null);
    try {
      const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
        body: { storagePath },
      });

      if (error) {
        throw new Error(error.message || "Erro de comunicação com o servidor");
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      setPdfExtractedText(data.text || "");
      setPdfExtractionMethod(data.method || "native");

      if (data.quality === "partial") {
        setPdfStatus("partial");
        toast.warning(`Extração parcial: ${data.wordCount || 0} palavras. Complementação manual recomendada.`);
      } else {
        setPdfStatus("extracted");
        toast.success(`Texto extraído (${data.method === "ocr" ? "OCR" : "nativo"}): ${data.wordCount || 0} palavras`);
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      const errorMsg = err.message || "Erro ao extrair texto do PDF";
      setPdfError(errorMsg);
      setPdfStatus("error");
      toast.error(errorMsg);
    }
  };

  // Fetch latest analysis
  const { data: latestAnalysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ["scope_analysis", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scope_analyses")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch library context
  const { data: libraryContext } = useQuery({
    queryKey: ["library_context_for_ai"],
    queryFn: async () => {
      const [{ data: libItems }, { data: comps }, { data: historicalItems }] = await Promise.all([
        supabase
          .from("technical_library_items")
          .select("kind,discipline,group_name,item_type,operation,material,unit,index_label,index_value,source_label,source_sheet_name,notes")
          .eq("is_active", true)
          .limit(250),
        supabase.from("compositions").select("name,discipline,base_unit,description").eq("is_active", true).limit(120),
        supabase
          .from("scope_items")
          .select("title,description,category,quantity,unit,notes")
          .order("created_at", { ascending: false })
          .limit(120),
      ]);
      const disciplines = [...new Set((libItems || []).map(i => i.discipline).filter(Boolean))];
      return {
        disciplines,
        libraryItems: libItems || [],
        compositions: comps || [],
        historicalScopeItems: historicalItems || [],
      };
    },
  });

  const hasContent = scope || premises || exclusions || notes || pdfExtractedText || pdfFileName;
  const canAnalyze = !!(scope || premises || exclusions || notes || pdfExtractedText);

  const handleFileUpload = async (file: File) => {
    // Validations
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      toast.error("Tipo de arquivo inválido. Apenas PDF é permitido.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB)");
      return;
    }
    if (file.size < 100) {
      toast.error("Arquivo PDF parece estar corrompido ou vazio");
      return;
    }

    setPdfStatus("uploading");
    setPdfFileName(file.name);
    setPdfError(null);

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/${sanitizedName}`;

    // Remove old file if exists
    if (pdfStoragePath) {
      await supabase.storage.from("scope-pdfs").remove([pdfStoragePath]);
    }

    try {
      const { error: uploadError } = await supabase.storage
        .from("scope-pdfs")
        .upload(storagePath, file, { upsert: true, contentType: "application/pdf" });

      if (uploadError) {
        throw new Error(uploadError.message || "Falha ao enviar o PDF");
      }

      setPdfStoragePath(storagePath);
      toast.success("PDF enviado! Extraindo texto...");

      // Extract text
      await extractTextFromPdf(storagePath);
    } catch (err: any) {
      console.error("Upload error:", err);
      const errorMsg = err.message || "Falha ao enviar o PDF";
      setPdfError(errorMsg);
      setPdfStatus("error");
      toast.error(errorMsg);
    }
  };

  const handleRetryExtraction = async () => {
    if (!pdfStoragePath) return;
    await extractTextFromPdf(pdfStoragePath);
  };

  const handleRemovePdf = async () => {
    if (pdfStoragePath) {
      await supabase.storage.from("scope-pdfs").remove([pdfStoragePath]);
    }
    setPdfFileName(null);
    setPdfStoragePath(null);
    setPdfExtractedText("");
    setPdfStatus("idle");
    setPdfError(null);
    setPdfExtractionMethod(null);
    toast.info("PDF removido");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [projectId, pdfStoragePath]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        scope_description: scope || null,
        premises: premises || null,
        exclusions: exclusions || null,
        notes: notes || null,
      })
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar escopo bruto");
    } else {
      toast.success("Escopo bruto salvo");
      setEditing(false);
    }
  };

  const handleAnalyze = async () => {
    let extractedText = pdfExtractedText;

    // If PDF exists but text wasn't extracted yet, try re-extraction
    if (pdfStoragePath && !extractedText) {
      try {
        setPdfStatus("extracting");
        const { data: extractData, error } = await supabase.functions.invoke("extract-pdf-text", {
          body: { storagePath: pdfStoragePath },
        });
        if (!error && !extractData?.error) {
          extractedText = extractData.text || "";
          setPdfExtractedText(extractedText);
          setPdfStatus(extractData.quality === "partial" ? "partial" : "extracted");
        }
      } catch (err) {
        console.error("Re-extraction before analysis:", err);
      }
    }

    if (!scope && !premises && !exclusions && !notes && !extractedText) {
      toast.error("Anexe um PDF ou descreva o escopo para liberar a análise");
      return;
    }

    setAnalyzing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const fullScopeText = [extractedText, scope].filter(Boolean).join("\n\n---\n\n");

      const projectContext = {
        projectName: projectMeta?.project_name || "",
        client: projectMeta?.client || "",
        location: projectMeta?.location || "",
        contractType: projectMeta?.contract_type || "",
        scopeDescription: fullScopeText,
        premises,
        exclusions,
        notes,
        existingScopeItems: scopeItems || [],
        libraryDisciplines: libraryContext?.disciplines || [],
        libraryItems: libraryContext?.libraryItems || [],
        compositions: libraryContext?.compositions || [],
        historicalScopeItems: libraryContext?.historicalScopeItems || [],
        pdfFileName: pdfFileName || null,
      };

      const { data, error } = await supabase.functions.invoke("analyze-scope", {
        body: { projectContext },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: existingAnalyses } = await supabase
        .from("scope_analyses")
        .select("version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = (existingAnalyses?.[0]?.version || 0) + 1;

      await supabase.from("scope_analyses").insert({
        project_id: projectId,
        analyzed_by: userId!,
        scope_snapshot: fullScopeText,
        project_context: projectContext as any,
        analysis_data: data.analysis,
        version: nextVersion,
      });

      await refetchAnalysis();
      setShowAnalysis(true);
      toast.success("Análise do escopo concluída!");
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast.error(err.message || "Erro ao analisar escopo");
    } finally {
      setAnalyzing(false);
    }
  };

  const analysisData = latestAnalysis?.analysis_data as any;

  const PdfStatusBadge = () => {
    switch (pdfStatus) {
      case "uploading":
        return <Badge variant="outline" className="text-[10px]"><Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Enviando...</Badge>;
      case "extracting":
        return <Badge variant="outline" className="text-[10px] border-primary/40 text-primary"><Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Extraindo texto...</Badge>;
      case "extracted":
        return (
          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">
            <FileCheck className="w-2.5 h-2.5 mr-0.5" /> Texto extraído
            {pdfExtractionMethod === "ocr" && " (OCR)"}
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Extração parcial
          </Badge>
        );
      case "error":
        return <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Erro na extração</Badge>;
      default:
        return null;
    }
  };

  const PdfUploadArea = ({ compact = false }: { compact?: boolean }) => {
    if (pdfFileName) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border">
            <File className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{pdfFileName}</p>
              <PdfStatusBadge />
            </div>
            {pdfExtractedText && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                setScope(prev => prev ? prev + "\n\n--- TEXTO DO PDF ---\n\n" + pdfExtractedText : pdfExtractedText);
                toast.info("Texto do PDF copiado para o campo de escopo");
              }}>
                <Eye className="w-3 h-3 mr-1" /> Ver texto
              </Button>
            )}
            {(pdfStatus === "error" || pdfStatus === "partial") && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleRetryExtraction}>
                <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={handleRemovePdf}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          {pdfStatus === "error" && pdfError && (
            <p className="text-[11px] text-destructive bg-destructive/10 px-3 py-1.5 rounded-md">{pdfError}</p>
          )}
          {pdfStatus === "partial" && (
            <p className="text-[11px] text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-md">
              O texto foi extraído parcialmente. Você pode complementar manualmente ou tentar novamente.
            </p>
          )}
        </div>
      );
    }

    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-${compact ? "3" : "5"} text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />
        <Upload className={`w-${compact ? "4" : "6"} h-${compact ? "4" : "6"} mx-auto text-muted-foreground mb-1.5`} />
        <p className="text-xs text-muted-foreground">
          <span className="text-primary font-medium">Upload do Escopo (PDF)</span>
          {!compact && <><br />ou arraste e solte aqui</>}
        </p>
        {!compact && <p className="text-[10px] text-muted-foreground/60 mt-1">Apenas PDF · Máx 20MB</p>}
      </div>
    );
  };

  const AnalyzeButton = ({ label = "Analisar com IA" }: { label?: string }) => (
    <Button
      variant="default"
      size="sm"
      onClick={handleAnalyze}
      disabled={analyzing || !canAnalyze}
      className="bg-primary hover:bg-primary/90"
      title={!canAnalyze ? "Anexe um PDF ou preencha o escopo para liberar a análise" : undefined}
    >
      {analyzing ? (
        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analisando...</>
      ) : (
        <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {label}</>
      )}
    </Button>
  );

  // Empty state
  if (!editing && !hasContent) {
    return (
      <Card className="p-4 sm:p-5 bg-card border-border border-dashed">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Escopo Bruto do Cliente</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anexe o PDF do escopo ou preencha manualmente
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <AnalyzeButton />
            <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Preencher
            </Button>
          </div>
        </div>
        <PdfUploadArea />
      </Card>
    );
  }

  // View mode
  if (!editing) {
    return (
      <div className="space-y-3">
        <Card className="p-4 sm:p-5 bg-card border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Escopo Bruto do Cliente</h3>
              <Badge variant="outline" className="text-[10px]">
                <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Preenchido
              </Badge>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <AnalyzeButton label="Analisar Escopo com IA" />
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
            </div>
          </div>

          {/* PDF section */}
          <div className="mb-4">
            <PdfUploadArea compact />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scope && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Descrição do Escopo</p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md max-h-48 overflow-y-auto">{scope}</p>
              </div>
            )}
            {premises && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Premissas</p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">{premises}</p>
              </div>
            )}
            {exclusions && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-accent" /> Exclusões
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-accent/5 p-3 rounded-md border border-accent/20">{exclusions}</p>
              </div>
            )}
            {notes && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Observações</p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-md">{notes}</p>
              </div>
            )}
          </div>

          {pdfExtractedText && (
            <div className="mt-4">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                {showRawText ? "Ocultar texto bruto do PDF" : "Ver texto bruto do PDF"}
              </button>
              {showRawText && (
                <p className="text-xs text-foreground whitespace-pre-wrap bg-primary/5 p-3 rounded-md border border-primary/20 max-h-48 overflow-y-auto mt-1">{pdfExtractedText}</p>
              )}
            </div>
          )}

          {latestAnalysis && !showAnalysis && (
            <div className="mt-4 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowAnalysis(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ver Última Análise (v{latestAnalysis.version})
              </Button>
            </div>
          )}
        </Card>

        {showAnalysis && analysisData && (
          <ScopeAnalysisPanel
            analysis={analysisData}
            createdAt={latestAnalysis?.created_at}
            onClose={() => setShowAnalysis(false)}
          />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <Card className="p-5 bg-card border-primary/30">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Escopo Bruto do Cliente</h3>
      </div>

      {/* PDF Upload */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1 block">Anexo do Escopo (PDF)</label>
        <PdfUploadArea />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">
            Descrição do Escopo {!pdfFileName && "*"}
            {pdfFileName && <span className="text-muted-foreground/60"> (complementar)</span>}
          </label>
          <Textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder={pdfFileName ? "Complemente o escopo do PDF se necessário..." : "Descreva a demanda principal do cliente..."}
            className="mt-1 min-h-[100px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Premissas</label>
          <Textarea
            value={premises}
            onChange={(e) => setPremises(e.target.value)}
            placeholder="Condições assumidas para o orçamento..."
            className="mt-1 min-h-[100px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-accent" /> Exclusões
          </label>
          <Textarea
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
            placeholder="O que NÃO está incluído neste escopo..."
            className="mt-1 min-h-[80px]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Observações Iniciais</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionais..."
            className="mt-1 min-h-[80px]"
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Escopo Bruto"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={async () => { await handleSave(); handleAnalyze(); }}
          disabled={saving || analyzing || !canAnalyze}
          className="bg-primary hover:bg-primary/90"
        >
          {analyzing ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analisando...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Salvar e Analisar com IA</>
          )}
        </Button>
      </div>
    </Card>
  );
}
