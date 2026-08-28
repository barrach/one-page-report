import React, { useState, useEffect, useCallback } from 'react';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';
import { useProjectStore } from '@/store/projectStore';
import AppSidebar from '@/components/AppSidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/context/AuthContext';


interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  assignments: string[];
}

/** Resposta das ações que criam ou renovam acesso. */
interface RespostaAcesso {
  senha?: string;
  emailEnviado?: boolean;
  emailErro?: string | null;
}

/**
 * A mensagem que a função realmente devolveu.
 *
 * O supabase-js só diz "Edge Function returned a non-2xx status code" e joga a
 * resposta inteira em `error.context` — então o motivo ("Unknown action",
 * "Usuário não encontrado", o erro do Supabase Auth) ficava invisível, e todo
 * problema diferente aparecia com o mesmo texto na tela.
 */
const detalharErro = async (erro: unknown): Promise<string> => {
  const generica = erro instanceof Error ? erro.message : 'Erro na função de administração';
  const contexto = (erro as { context?: Response })?.context;
  if (!contexto || typeof contexto.text !== 'function') return generica;

  try {
    const corpo = await contexto.text();
    if (!corpo) return generica;
    try {
      const json = JSON.parse(corpo) as { error?: string };
      return json.error || corpo.slice(0, 300);
    } catch {
      return corpo.slice(0, 300);
    }
  } catch {
    // Corpo já consumido ou ilegível — a genérica ainda é melhor que nada.
    return generica;
  }
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  planejador: 'Planejador',
  gestor: 'Gestor',
  visualizador: 'Visualizador',
  cliente: 'Cliente',
};

const Admin = () => {
  const { projects } = useProjectStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('visualizador');
  const [creating, setCreating] = useState(false);
  // Só aparece quando o e-mail não saiu — é a saída de emergência, não a rotina.
  const [senhaNaTela, setSenhaNaTela] = useState<{ senha: string; motivo: string } | null>(null);

  const callAdmin = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await oprDataClient.auth.getSession();
    const res = await oprDataClient.functions.invoke('admin-users', {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.error) throw new Error(await detalharErro(res.error));
    return res.data;
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await callAdmin({ action: 'list-users' });
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error('Erro ao carregar usuários: ' + err.message);
    }
    setLoadingUsers(false);
  }, [callAdmin]);

  const loadedRef = React.useRef(false);
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadUsers();
    }
  }, [loadUsers]);

  /**
   * Conta o que aconteceu com o e-mail.
   *
   * Quando o envio falha, a senha aparece na tela: sem isso o administrador
   * fica com um usuário criado e nenhuma forma de dizer a senha a ele.
   */
  const avisarEnvio = (r: RespostaAcesso, quandoDeuCerto: string) => {
    if (r?.emailEnviado) { toast.success(quandoDeuCerto); return; }
    setSenhaNaTela({ senha: r?.senha ?? '', motivo: r?.emailErro ?? 'Motivo não informado' });
    toast.warning('Usuário pronto, mas o e-mail não saiu — a senha está na tela.');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await callAdmin({ action: 'create-user', email: newEmail, password: newPassword, display_name: newName, role: newRole });
      avisarEnvio(r, `Usuário criado. E-mail de boas-vindas enviado para ${newEmail}.`);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('visualizador');
      loadUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setCreating(false);
  };

  /**
   * Reenviar acesso — o que existe no lugar de "ver a senha atual".
   *
   * Ninguém consegue ler a senha em uso, nem o administrador: o Supabase guarda
   * o hash. Quem esqueceu recebe uma NOVA senha provisória por e-mail, e a
   * anterior deixa de valer nesse instante — por isso a confirmação.
   */
  const handleReenviar = async (u: UserRow) => {
    if (!confirm(
      `Gerar uma senha nova para ${u.email} e enviar por e-mail?\n\n`
      + 'A senha atual deixa de funcionar imediatamente.',
    )) return;
    try {
      const r = await callAdmin({ action: 'resend-welcome', user_id: u.user_id });
      avisarEnvio(r, `Acesso reenviado para ${u.email}.`);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await callAdmin({ action: 'update-role', user_id: userId, role: newRole });
      toast.success('Perfil atualizado');
      loadUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleToggleProject = async (userId: string, projectId: string, assigned: boolean) => {
    try {
      await callAdmin({
        action: assigned ? 'unassign-project' : 'assign-project',
        user_id: userId,
        project_id: projectId,
      });
      loadUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await callAdmin({ action: 'delete-user', user_id: userId });
      toast.success('Usuário excluído');
      loadUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 min-w-0">
      {/* Nav */}
      <div className="bg-card border-b border-border px-3 sm:px-5 py-2.5 flex items-center justify-between sticky top-0 z-50">
        <span className="text-xs font-bold text-muted-foreground tracking-[0.2em] uppercase">Admin</span>
      </div>

      <div className="p-3 sm:p-4 space-y-6">
        {/* Create user */}
        <div className="bg-card rounded-xl p-6 border card-shadow">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" /> Criar Usuário
          </h2>
          {/* autoComplete="off" no form não basta: o Chrome preenche campos de e-mail e
              senha do gerenciador de qualquer forma. O que ele respeita é `new-password`
              e nomes de campo que não pareçam de login. */}
          <form
            onSubmit={handleCreate}
            autoComplete="off"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3"
          >
            <Input
              name="novo-usuario-nome"
              autoComplete="off"
              placeholder="Nome"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              type="email"
              name="novo-usuario-email"
              autoComplete="off"
              placeholder="E-mail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            {/* Deixar em branco é o caminho recomendado: a função gera uma
                provisória forte e ela nunca passa pelas mãos de ninguém aqui. */}
            <Input
              type="password"
              name="novo-usuario-senha"
              autoComplete="new-password"
              placeholder="Senha (vazio = gerar)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={creating} className="gap-1">
              <Plus className="h-4 w-4" /> {creating ? 'Criando...' : 'Criar'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-3">
            Ao criar, o usuário recebe um e-mail de boas-vindas com o endereço do app, o login
            e a senha provisória, e o app pede a troca no primeiro acesso.
          </p>

          {/* Saída de emergência: o e-mail não saiu e o administrador precisa
              passar a senha por outro canal. Some ao ser fechada — deixar senha
              parada na tela de quem está numa reunião não ajuda ninguém. */}
          {senhaNaTela && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">O e-mail não foi enviado.</p>
                  <p className="text-xs text-muted-foreground break-words">{senhaNaTela.motivo}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Senha provisória — passe por um canal seguro:</p>
                  <code className="text-base font-bold tracking-wider break-all">{senhaNaTela.senha}</code>
                </div>
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setSenhaNaTela(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Users list */}
        <div className="bg-card rounded-xl p-6 border card-shadow">
          <h2 className="text-lg font-bold text-foreground mb-4">Usuários</h2>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((u) => (
                <div key={u.user_id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-semibold text-foreground">{u.display_name || u.email}</span>
                      <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={u.roles[0] || 'visualizador'} onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}>
                        <SelectTrigger className="w-[150px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleReenviar(u)}
                        title="Gera uma senha provisória nova e reenvia o e-mail de acesso"
                      >
                        <Mail className="h-3.5 w-3.5" /> Reenviar acesso
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDelete(u.user_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {/* Project assignments */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Projetos atribuídos:</p>
                    <div className="flex flex-wrap gap-2">
                      {projects.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={u.assignments.includes(p.id)}
                            onCheckedChange={() => handleToggleProject(u.user_id, p.id, u.assignments.includes(p.id))}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Admin;
