import { useState } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import { Users, Trash2, CheckCircle, Ban, AlertTriangle, Tag, Sliders, Building2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@budget/hooks/use-toast";
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
import DrgMappingManager from "@budget/components/configuracoes/DrgMappingManager";
import GlobalFinancialSettings from "@budget/components/configuracoes/GlobalFinancialSettings";
import CompanySettingsPanel from "@budget/components/configuracoes/CompanySettingsPanel";
import CpuTemplatesPanel from "@budget/components/configuracoes/CpuTemplatesPanel";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  status: string;
  role: string;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "active" | "blocked";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-500" },
  active: { label: "Ativo", color: "bg-green-500/10 text-green-500" },
  blocked: { label: "Bloqueado", color: "bg-destructive/10 text-destructive" },
};

const Configuracoes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { status?: string; role?: string } }) => {
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users-count"] });
      const action = variables.updates.status === "active" ? "aprovado" :
                     variables.updates.status === "blocked" ? "bloqueado" : "atualizado";
      toast({ title: `Usuário ${action}` });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users-count"] });
      toast({ title: "Usuário removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const pendingCount = profiles.filter((p) => p.status === "pending").length;
  const activeCount = profiles.filter((p) => p.status === "active").length;
  const blockedCount = profiles.filter((p) => p.status === "blocked").length;

  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filteredProfiles = statusFilter === "all"
    ? sortedProfiles
    : sortedProfiles.filter((p) => p.status === statusFilter);

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: profiles.length },
    { key: "pending", label: "Pendentes", count: pendingCount },
    { key: "active", label: "Ativos", count: activeCount },
    { key: "blocked", label: "Bloqueados", count: blockedCount },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Usuários, mapeamentos DRG e parâmetros do sistema</p>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="drg-mapping" className="gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Categorias DRG / Mapeamento de Custos
          </TabsTrigger>
          <TabsTrigger value="global-financial" className="gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            Parâmetros Globais de Controladoria
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Dados da Empresa
          </TabsTrigger>
          <TabsTrigger value="cpu-templates" className="gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Templates CPU
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
        {pendingCount > 0 && (
          <Card className="p-4 bg-yellow-500/5 border-yellow-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Você tem {pendingCount} usuário{pendingCount > 1 ? "s" : ""} aguardando aprovação
              </p>
              <p className="text-xs text-muted-foreground">
                Aprove para liberar o acesso ao sistema
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
              onClick={() => setStatusFilter("pending")}
            >
              Ver pendentes
            </Button>
          </Card>
        )}

        <div className="flex gap-1.5">
          {filterButtons.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "secondary" : "ghost"}
              className="h-8 text-xs gap-1.5"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
              <span className="text-[10px] opacity-60">({f.count})</span>
            </Button>
          ))}
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cadastro</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td>
                  </tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado</td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => {
                    const sc = statusConfig[p.status] || statusConfig.pending;
                    const isPending = p.status === "pending";
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                          isPending ? "bg-yellow-500/[0.03]" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{p.full_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.email || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.company_name || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={p.role} onValueChange={(v) => updateProfile.mutate({ id: p.id, updates: { role: v } })}>
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="user">Usuário</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
                                  onClick={() => updateProfile.mutate({ id: p.id, updates: { status: "active" } })}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => updateProfile.mutate({ id: p.id, updates: { status: "blocked" } })}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  Rejeitar
                                </Button>
                              </>
                            )}
                            {p.status === "active" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                onClick={() => updateProfile.mutate({ id: p.id, updates: { status: "blocked" } })}
                                title="Bloquear"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            {p.status === "blocked" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                onClick={() => updateProfile.mutate({ id: p.id, updates: { status: "active" } })}
                                title="Desbloquear"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O perfil de {p.full_name || "este usuário"} será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteProfile.mutate(p.id)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </TabsContent>

        <TabsContent value="drg-mapping">
          <DrgMappingManager />
        </TabsContent>

        <TabsContent value="global-financial">
          <GlobalFinancialSettings />
        </TabsContent>

        <TabsContent value="empresa">
          <CompanySettingsPanel />
        </TabsContent>

        <TabsContent value="cpu-templates">
          <CpuTemplatesPanel />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Configuracoes;
