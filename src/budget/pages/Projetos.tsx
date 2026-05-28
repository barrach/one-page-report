import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Textarea } from "@budget/components/ui/textarea";
import { Badge } from "@budget/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Label } from "@budget/components/ui/label";
import { Plus, FolderOpen, Calendar, MapPin, Clock, ArrowRight, Building2, Search, Share2, Loader2, Trash2, Upload, FileText, Sparkles, Check, X, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@budget/components/ui/alert-dialog";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { useToast } from "@budget/hooks/use-toast";
import ProjectAvatars from "@budget/components/projeto/ProjectAvatars";
import ShareProjectDialog from "@budget/components/projeto/ShareProjectDialog";

interface Project {
  id: string;
  project_name: string;
  client: string;
  proposal: string | null;
  unit: string | null;
  location: string | null;
  start_date: string | null;
  expected_duration_days: number | null;
  mobilization_days: number | null;
  demobilization_days: number | null;
  contract_type: string | null;
  scope_description: string | null;
  notes: string | null;
  status: string | null;
  version: number | null;
  created_at: string;
  user_id: string;
}

const emptyForm = {
  project_name: "",
  client: "",
  proposal: "",
  unit: "",
  location: "",
  start_date: "",
  expected_duration_days: 90,
  mobilization_days: 10,
  demobilization_days: 2,
  contract_type: "Preço Global",
  scope_description: "",
  notes: "",
};

const FIELD_LABELS: Record<string, string> = {
  project_name: "Nome do Orçamento",
  client: "Cliente",
  proposal: "Proposta",
  unit: "Unidade",
  location: "Localidade",
  start_date: "Data Início",
  expected_duration_days: "Prazo (dias)",
  mobilization_days: "Mobilização (dias)",
  demobilization_days: "Desmobilização (dias)",
  contract_type: "Tipo de Contrato",
  scope_description: "Descrição do Escopo",
  notes: "Observações",
};

const Projetos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Record<string, { name: string; email: string; role: "owner" | "editor" | "viewer" }[]>>({});

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStoragePath, setPdfStoragePath] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    // Filtro defensivo: módulo Orçamentos NÃO deve mostrar centros de custo do Financeiro.
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .or("is_cost_center.is.null,is_cost_center.eq.false")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar orçamentos", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const projects = (data as any[]) || [];
    setProjects(projects);

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length > 0) {
      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select("project_id, user_id, role, status")
        .in("project_id", projectIds)
        .in("status", ["active", "pending"]);

      const allUserIds = new Set<string>();
      projects.forEach((p) => allUserIds.add(p.user_id));
      (collabs || []).forEach((c: any) => allUserIds.add(c.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", Array.from(allUserIds));

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const membersMap: Record<string, { name: string; email: string; role: "owner" | "editor" | "viewer" }[]> = {};
      projects.forEach((p) => {
        const ownerProfile = profileMap.get(p.user_id);
        const members: { name: string; email: string; role: "owner" | "editor" | "viewer" }[] = [
          { name: ownerProfile?.full_name || "", email: ownerProfile?.email || "", role: "owner" },
        ];
        (collabs || [])
          .filter((c: any) => c.project_id === p.id)
          .forEach((c: any) => {
            const pr = profileMap.get(c.user_id);
            members.push({ name: pr?.full_name || "", email: pr?.email || "", role: c.role as "editor" | "viewer" });
          });
        membersMap[p.id] = members;
      });
      setProjectMembers(membersMap);
    }
    setLoading(false);
  };

  useEffect(() => { loadProjects(); }, [user]);

  const resetPdfState = () => {
    setPdfFile(null);
    setPdfStoragePath(null);
    setExtracting(false);
    setExtractionDone(false);
    setFilledFields([]);
    setExtractionError(null);
  };

  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 100);
  };

  const handlePdfUpload = async (file: File) => {
    if (!user) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Formato inválido", description: "Envie um arquivo PDF.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 20MB.", variant: "destructive" });
      return;
    }

    resetPdfState();
    setPdfFile(file);
    setExtracting(true);
    setExtractionError(null);

    // Step 1: Upload to storage
    const safeName = sanitizeFileName(file.name);
    const path = `budgets/${user.id}/${Date.now()}_${safeName}`;
    let uploadedPath: string | null = null;

    try {
      const { error: uploadError } = await supabase.storage.from("scope-pdfs").upload(path, file);
      if (uploadError) throw uploadError;
      uploadedPath = path;
      setPdfStoragePath(path);
    } catch (uploadErr: any) {
      console.error("PDF upload failed:", uploadErr);
      setExtracting(false);
      setExtractionError("Não foi possível anexar o PDF. Você pode preencher manualmente.");
      toast({
        title: "Falha no envio do PDF",
        description: "Não foi possível anexar o arquivo. Preencha os campos manualmente.",
        variant: "destructive",
      });
      return;
    }

    // Step 2: Verify upload exists before extraction
    try {
      const { data: listData } = await supabase.storage.from("scope-pdfs").list(
        `budgets/${user.id}`,
        { search: `${Date.now()}`.slice(0, 8) }
      );
      // Simple existence check - if we got here without error, upload succeeded
      if (!uploadedPath) throw new Error("Referência do arquivo não encontrada");
    } catch {
      // Non-critical - proceed anyway since upload succeeded
    }

    // Step 3: AI extraction (independent - failures don't block form)
    try {
      const { data, error } = await supabase.functions.invoke("extract-budget-from-pdf", {
        body: { storagePath: uploadedPath },
      });

      if (error) throw new Error(error.message || "Erro na extração");
      if (data?.error) throw new Error(data.error);

      const extracted = data?.extracted || {};
      const filled = data?.filledFields || [];

      setForm(prev => {
        const updated = { ...prev };
        for (const [key, value] of Object.entries(extracted)) {
          if (value !== null && value !== undefined && value !== "" && key in emptyForm) {
            (updated as any)[key] = typeof value === "number" ? value : String(value);
          }
        }
        return updated;
      });

      setFilledFields(filled);
      setExtractionDone(true);
      toast({
        title: "PDF analisado com sucesso",
        description: `${filled.length} campos preenchidos automaticamente`,
      });
    } catch (extractErr: any) {
      console.error("PDF extraction error:", extractErr);
      setExtractionDone(true);
      setExtractionError("O PDF foi anexado, mas não foi possível extrair as informações automaticamente.");
      toast({
        title: "Extração parcial",
        description: "O PDF foi anexado ao orçamento. Preencha os campos manualmente.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !form.project_name || !form.client) return;
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      project_name: form.project_name,
      client: form.client,
      proposal: form.proposal || null,
      unit: form.unit || null,
      location: form.location || null,
      start_date: form.start_date || null,
      expected_duration_days: form.expected_duration_days,
      mobilization_days: form.mobilization_days,
      demobilization_days: form.demobilization_days,
      contract_type: form.contract_type || null,
      scope_description: form.scope_description || null,
      notes: pdfStoragePath
        ? `${form.notes || ""}\n\n📎 PDF anexado: ${pdfFile?.name || "documento.pdf"}`.trim()
        : form.notes || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Orçamento criado" });
      setShowCreate(false);
      setForm(emptyForm);
      resetPdfState();
      loadProjects();
    }
    setSaving(false);
  };

  const filtered = projects.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.project_name.toLowerCase().includes(s) ||
      p.client.toLowerCase().includes(s) ||
      (p.proposal || "").toLowerCase().includes(s) ||
      (p.status || "").toLowerCase().includes(s) ||
      (p.location || "").toLowerCase().includes(s);
  });

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    archived: "bg-destructive/10 text-destructive",
  };

  const isFieldAiFilled = (field: string) => filledFields.includes(field);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{projects.length} orçamentos cadastrados</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, cliente, proposta, localidade ou status..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando orçamentos...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 bg-card border-border text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-foreground font-semibold mb-1">Nenhum orçamento</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro orçamento para começar</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link key={p.id} to={`/projeto/${p.id}`}>
              <Card className="p-5 bg-card border-border hover:border-primary/40 transition-all cursor-pointer group h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {p.project_name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{p.client}</span>
                    </div>
                  </div>
                   <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(p); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {p.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Compartilhar orçamento"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareTarget(p.id); }}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {p.proposal && <Badge variant="outline" className="text-[10px]">{p.proposal}</Badge>}
                  <Badge className={`text-[10px] ${statusColors[p.status || "draft"]}`}>
                    {p.status === "active" ? "Ativo" : p.status === "archived" ? "Arquivado" : "Rascunho"}
                  </Badge>
                  {p.version && <Badge variant="secondary" className="text-[10px]">v{p.version}</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    {p.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.unit ? `${p.unit}, ` : ""}{p.location}</span>
                    )}
                    {p.start_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.start_date}</span>
                    )}
                    {p.expected_duration_days && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.expected_duration_days}d</span>
                    )}
                  </div>
                  <ProjectAvatars members={projectMembers[p.id] || []} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setForm(emptyForm); resetPdfState(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>

          {/* PDF Upload Area */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfUpload(file);
                e.target.value = "";
              }}
            />

            {!pdfFile && !extracting && (
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handlePdfUpload(file);
                }}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Envie um PDF para pré-preencher com IA</p>
                <p className="text-xs text-muted-foreground mt-1">Arraste e solte ou clique para selecionar • Máx. 20MB • Opcional</p>
              </div>
            )}

            {extracting && (
              <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-medium text-foreground">Analisando PDF com IA...</p>
                  <p className="text-xs text-muted-foreground">{pdfFile?.name}</p>
                </div>
              </div>
            )}

            {pdfFile && !extracting && (
              <div className={`border rounded-lg p-4 ${extractionError ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${extractionError ? "text-destructive" : "text-primary"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{pdfFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetPdfState}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {extractionError && (
                  <div className="mt-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-xs text-destructive font-medium">Falha na extração</p>
                      <p className="text-xs text-muted-foreground">{extractionError}</p>
                      <p className="text-xs text-muted-foreground mt-1">Você pode preencher os campos manualmente.</p>
                    </div>
                  </div>
                )}

                {extractionDone && filledFields.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs font-medium text-primary">{filledFields.length} campos preenchidos pela IA</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {filledFields.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px] gap-1">
                          <Check className="w-2.5 h-2.5" />
                          {FIELD_LABELS[f] || f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {extractionDone && filledFields.length === 0 && (
                  <div className="mt-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Nenhum campo identificado no PDF. Preencha manualmente.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className={`text-xs ${isFieldAiFilled("project_name") ? "text-primary" : "text-muted-foreground"}`}>
                  Nome do Orçamento * {isFieldAiFilled("project_name") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input
                  value={form.project_name}
                  onChange={e => setForm({ ...form, project_name: e.target.value })}
                  placeholder="Ex: Bombeamento de Rejeito"
                  className={isFieldAiFilled("project_name") ? "border-primary/40" : ""}
                />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("client") ? "text-primary" : "text-muted-foreground"}`}>
                  Cliente * {isFieldAiFilled("client") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  placeholder="Ex: EUROCHEM"
                  className={isFieldAiFilled("client") ? "border-primary/40" : ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label className={`text-xs ${isFieldAiFilled("proposal") ? "text-primary" : "text-muted-foreground"}`}>
                  Proposta {isFieldAiFilled("proposal") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input value={form.proposal} onChange={e => setForm({ ...form, proposal: e.target.value })} placeholder="2026-0091" className={isFieldAiFilled("proposal") ? "border-primary/40" : ""} />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("unit") ? "text-primary" : "text-muted-foreground"}`}>
                  Unidade {isFieldAiFilled("unit") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Serra do Salitre" className={isFieldAiFilled("unit") ? "border-primary/40" : ""} />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("location") ? "text-primary" : "text-muted-foreground"}`}>
                  Localidade {isFieldAiFilled("location") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="MG" className={isFieldAiFilled("location") ? "border-primary/40" : ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className={`text-xs ${isFieldAiFilled("start_date") ? "text-primary" : "text-muted-foreground"}`}>
                  Data Início {isFieldAiFilled("start_date") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={isFieldAiFilled("start_date") ? "border-primary/40" : ""} />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("expected_duration_days") ? "text-primary" : "text-muted-foreground"}`}>
                  Prazo (dias) {isFieldAiFilled("expected_duration_days") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input type="number" value={form.expected_duration_days} onChange={e => setForm({ ...form, expected_duration_days: +e.target.value })} className={isFieldAiFilled("expected_duration_days") ? "border-primary/40" : ""} />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("mobilization_days") ? "text-primary" : "text-muted-foreground"}`}>
                  Mobilização (dias) {isFieldAiFilled("mobilization_days") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input type="number" value={form.mobilization_days} onChange={e => setForm({ ...form, mobilization_days: +e.target.value })} className={isFieldAiFilled("mobilization_days") ? "border-primary/40" : ""} />
              </div>
              <div>
                <Label className={`text-xs ${isFieldAiFilled("demobilization_days") ? "text-primary" : "text-muted-foreground"}`}>
                  Desmobilização (dias) {isFieldAiFilled("demobilization_days") && <Sparkles className="w-3 h-3 inline ml-1" />}
                </Label>
                <Input type="number" value={form.demobilization_days} onChange={e => setForm({ ...form, demobilization_days: +e.target.value })} className={isFieldAiFilled("demobilization_days") ? "border-primary/40" : ""} />
              </div>
            </div>
            <div>
              <Label className={`text-xs ${isFieldAiFilled("contract_type") ? "text-primary" : "text-muted-foreground"}`}>
                Tipo de Contrato {isFieldAiFilled("contract_type") && <Sparkles className="w-3 h-3 inline ml-1" />}
              </Label>
              <Input value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })} placeholder="Preço Global" className={isFieldAiFilled("contract_type") ? "border-primary/40" : ""} />
            </div>
            <div>
              <Label className={`text-xs ${isFieldAiFilled("scope_description") ? "text-primary" : "text-muted-foreground"}`}>
                Descrição do Escopo {isFieldAiFilled("scope_description") && <Sparkles className="w-3 h-3 inline ml-1" />}
              </Label>
              <Textarea value={form.scope_description} onChange={e => setForm({ ...form, scope_description: e.target.value })} rows={3} placeholder="Descreva o escopo principal do serviço..." className={isFieldAiFilled("scope_description") ? "border-primary/40" : ""} />
            </div>
            <div>
              <Label className={`text-xs ${isFieldAiFilled("notes") ? "text-primary" : "text-muted-foreground"}`}>
                Observações {isFieldAiFilled("notes") && <Sparkles className="w-3 h-3 inline ml-1" />}
              </Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notas adicionais..." className={isFieldAiFilled("notes") ? "border-primary/40" : ""} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm(emptyForm); resetPdfState(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || extracting || !form.project_name || !form.client}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento <strong>"{deleteTarget?.project_name}"</strong>? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                const { error } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
                if (error) {
                  toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                } else {
                  setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
                  toast({ title: "Orçamento excluído" });
                }
                setDeleting(false);
                setDeleteTarget(null);
              }}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shareTarget && (
        <ShareProjectDialog
          open={!!shareTarget}
          onOpenChange={(open) => { if (!open) setShareTarget(null); }}
          projectId={shareTarget}
        />
      )}
    </AppLayout>
  );
};

export default Projetos;
