import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import {
  ArrowLeft, Building2, Loader2, Save,
  LayoutDashboard, FileText, CalendarClock, DollarSign, Tag, Share2, ClipboardCheck,
} from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";
import { useToast } from "@budget/hooks/use-toast";
import ProjectDashboardTab from "@budget/components/projeto/ProjectDashboardTab";
import ProjectEscopoTab from "@budget/components/projeto/ProjectEscopoTab";
import ProjectCronogramaTab from "@budget/components/projeto/ProjectCronogramaTab";
import ProjectCustosTab from "@budget/components/projeto/ProjectCustosTab";
import ProjectPrecoTab from "@budget/components/projeto/ProjectPrecoTab";
import ShareProjectDialog from "@budget/components/projeto/ShareProjectDialog";
import ProjectChecklistTab from "@budget/components/projeto/ProjectChecklistTab";
import CollaboratorsList from "@budget/components/projeto/CollaboratorsList";

const ProjetoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showShare, setShowShare] = useState(false);

  const isOwner = project?.user_id === user?.id;

  const loadProject = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProject(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadProject(); }, [id]);

  if (loading) return <AppLayout><div className="py-12 text-center text-muted-foreground">Carregando...</div></AppLayout>;
  if (!project) return <AppLayout><div className="py-12 text-center text-muted-foreground">Orçamento não encontrado</div></AppLayout>;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projetos">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{project.project_name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{project.client}</span>
              {project.proposal && <Badge variant="outline" className="text-[10px]">{project.proposal}</Badge>}
              {project.version && <Badge variant="secondary" className="text-[10px]">v{project.version}</Badge>}
              <Badge className={`text-[10px] ${project.status === "active" ? "bg-primary/10 text-primary" : project.status === "archived" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                {project.status === "active" ? "Ativo" : project.status === "archived" ? "Arquivado" : "Rascunho"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Collaborators */}
        <div className="ml-11 sm:ml-0">
          <CollaboratorsList projectId={project.id} isOwner={isOwner} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/30 border border-border mb-6 overflow-x-auto flex-nowrap">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs whitespace-nowrap">
            <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="escopo" className="gap-1.5 text-xs whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Escopo & Análise</span><span className="sm:hidden">Escopo</span>
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="gap-1.5 text-xs whitespace-nowrap">
            <CalendarClock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cronograma & Equipe</span><span className="sm:hidden">Crono</span>
          </TabsTrigger>
          <TabsTrigger value="custos" className="gap-1.5 text-xs whitespace-nowrap">
            <DollarSign className="w-3.5 h-3.5" /> Custos
          </TabsTrigger>
          <TabsTrigger value="preco" className="gap-1.5 text-xs whitespace-nowrap">
            <Tag className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Preço Final</span><span className="sm:hidden">Preço</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 text-xs whitespace-nowrap">
            <ClipboardCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Checklist</span><span className="sm:hidden">✓</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ProjectDashboardTab projectId={project.id} project={project} onTabChange={setActiveTab} />
        </TabsContent>
        <TabsContent value="escopo">
          <ProjectEscopoTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="cronograma">
          <ProjectCronogramaTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="custos">
          <ProjectCustosTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="preco">
          <ProjectPrecoTab projectId={project.id} project={project} />
        </TabsContent>
        <TabsContent value="checklist">
          <ProjectChecklistTab projectId={project.id} project={project} onTabChange={setActiveTab} />
        </TabsContent>
      </Tabs>

      <ShareProjectDialog open={showShare} onOpenChange={setShowShare} projectId={project.id} />
    </AppLayout>
  );
};

export default ProjetoDetalhe;
