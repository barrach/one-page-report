import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/projectStore';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, FileText, Database, Shield } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'gestor' | 'visualizador' | 'cliente';

interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  assignments: string[];
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  visualizador: 'Visualizador',
  cliente: 'Cliente',
};

const Admin = () => {
  const { projects } = useProjectStore();
  const { projects } = useProjectStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('visualizador');
  const [creating, setCreating] = useState(false);

  const callAdmin = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke('admin-users', {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.error) throw new Error(res.error.message);
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
    if (user && role === 'admin' && !loadedRef.current) {
      loadedRef.current = true;
      loadUsers();
    }
  }, [user, role, loadUsers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await callAdmin({ action: 'create-user', email: newEmail, password: newPassword, display_name: newName, role: newRole });
      toast.success('Usuário criado com sucesso!');
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('visualizador');
      loadUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setCreating(false);
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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="gradient-primary px-3 sm:px-5 py-2.5 flex items-center justify-between sticky top-0 z-50 card-shadow-elevated">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-primary-foreground/60 rounded-full" />
            <h1 className="text-sm font-bold text-primary-foreground tracking-[0.15em] uppercase">MEGASTEAM</h1>
          </div>
          <nav className="flex gap-1">
            <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
              <FileText className="h-3.5 w-3.5" /> Relatório
            </Link>
            <Link to="/dados" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
              <Database className="h-3.5 w-3.5" /> Dados
            </Link>
            <Link to="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/20 text-primary-foreground">
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          </nav>
        </div>
        <Button size="sm" variant="secondary" className="gap-1.5 h-8 text-xs" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" /> Sair
        </Button>
      </div>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        {/* Create user */}
        <div className="bg-card rounded-xl p-6 border card-shadow">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" /> Criar Usuário
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <Input type="email" placeholder="E-mail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
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
                      {u.user_id !== user?.id && (
                        <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDelete(u.user_id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
  );
};

export default Admin;
