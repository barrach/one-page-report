import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ALL_MODULES, ALL_ROLES, ROLE_BADGE, type Module, type UserRole, type UserPermission } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, UserCog } from 'lucide-react';

const emptyDraft = (): UserPermission => ({ id: '', email: '', role: 'cliente', modules: [] });

const ModuleChecks = ({ value, onToggle }: { value: Module[]; onToggle: (m: Module) => void }) => (
  <div className="grid grid-cols-2 gap-2">
    {ALL_MODULES.map(m => (
      <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={value.includes(m.id)} onCheckedChange={() => onToggle(m.id)} />
        {m.label}
      </label>
    ))}
  </div>
);

export default function UserManagement() {
  const [rows, setRows] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserPermission | null>(null);
  const [removing, setRemoving] = useState<UserPermission | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UserPermission>(emptyDraft());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_permissions')
      .select('id, email, role, modules')
      .order('email');
    if (error) { toast.error('Erro ao carregar: ' + error.message); setRows([]); }
    else setRows((data ?? []).map(d => ({
      id: d.id, email: d.email, role: d.role as UserRole, modules: (d.modules ?? []) as Module[],
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEditModule = (m: Module) => setEditing(p => p ? {
    ...p, modules: p.modules.includes(m) ? p.modules.filter(x => x !== m) : [...p.modules, m],
  } : p);
  const toggleDraftModule = (m: Module) => setDraft(p => ({
    ...p, modules: p.modules.includes(m) ? p.modules.filter(x => x !== m) : [...p.modules, m],
  }));

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from('user_permissions')
      .update({ role: editing.role, modules: editing.modules }).eq('id', editing.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Usuário atualizado.');
    setEditing(null); load();
  };

  const handleAdd = async () => {
    const email = draft.email.trim().toLowerCase();
    if (!email) { toast.error('Informe o e-mail.'); return; }
    setAdding(true);
    const { error } = await supabase.from('user_permissions')
      .insert([{ email, role: draft.role, modules: draft.modules }]);
    setAdding(false);
    if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
    // Tenta enviar convite de senha (pode falhar sem service role — apenas avisa)
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      toast.success('Usuário adicionado e convite de senha enviado.');
    } catch {
      toast.success('Usuário adicionado. O usuário deve criar a senha em "Esqueci minha senha".');
    }
    setDraft(emptyDraft()); load();
  };

  const handleRemove = async () => {
    if (!removing) return;
    const { error } = await supabase.from('user_permissions').delete().eq('id', removing.id);
    if (error) { toast.error('Erro ao remover: ' + error.message); return; }
    toast.success('Acesso removido.');
    setRemoving(null); load();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <UserCog className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Configurações — Usuários</h1>
        </div>

        {/* 1. Tabela de usuários */}
        <div className="bg-card border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2.5 px-4 font-medium">E-mail</th>
                    <th className="text-left py-2.5 px-3 font-medium">Role</th>
                    <th className="text-left py-2.5 px-3 font-medium">Módulos</th>
                    <th className="text-right py-2.5 px-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-medium">{r.email}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block text-xs font-semibold capitalize px-2 py-0.5 rounded ${ROLE_BADGE[r.role]}`}>{r.role}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.modules.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                            : r.modules.map(m => (
                              <span key={m} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-foreground">
                                {ALL_MODULES.find(x => x.id === m)?.label ?? m}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...r })}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. Adicionar usuário */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar Usuário</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="usuario@megasteam.com.br" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Módulos com acesso</Label>
            <ModuleChecks value={draft.modules} onToggle={toggleDraftModule} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={adding} className="gap-1.5">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar</>}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Modal de edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input type="email" value={editing.email} readOnly disabled className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v as UserRole })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Módulos com acesso</Label>
                <ModuleChecks value={editing.modules} onToggle={toggleEditModule} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Confirmação de remoção */}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover acesso de <strong>{removing?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
