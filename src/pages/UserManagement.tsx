import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ALL_MODULES, ROLES, type ModuleId, type Role, type UserPermission } from '@/lib/permissions';
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

type Row = UserPermission & { id?: string };

const emptyDraft = (): Row => ({ email: '', role: 'cliente', modules: [] });

export default function UserManagement() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_permissions')
      .select('id, email, role, modules')
      .order('email');
    if (error) {
      toast.error('Erro ao carregar usuários: ' + error.message);
      setRows([]);
    } else {
      setRows((data ?? []).map(d => ({
        id: d.id, email: d.email, role: d.role as Role, modules: (d.modules ?? []) as ModuleId[],
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(emptyDraft()); setIsNew(true); };
  const openEdit = (r: Row) => { setEditing({ ...r }); setIsNew(false); };

  const toggleModule = (m: ModuleId) => {
    setEditing(prev => prev ? {
      ...prev,
      modules: prev.modules.includes(m) ? prev.modules.filter(x => x !== m) : [...prev.modules, m],
    } : prev);
  };

  const handleSave = async () => {
    if (!editing) return;
    const email = editing.email.trim().toLowerCase();
    if (!email) { toast.error('Informe o e-mail.'); return; }
    setSaving(true);
    const payload = { email, role: editing.role, modules: editing.modules };
    const { error } = isNew
      ? await supabase.from('user_permissions').insert([payload])
      : await supabase.from('user_permissions').update(payload).eq('id', editing.id!);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(isNew ? 'Usuário adicionado. Envie o convite de senha pelo Supabase Auth.' : 'Usuário atualizado.');
    setEditing(null);
    load();
  };

  const handleRemove = async () => {
    if (!removing?.id) return;
    const { error } = await supabase.from('user_permissions').delete().eq('id', removing.id);
    if (error) { toast.error('Erro ao remover: ' + error.message); return; }
    toast.success('Usuário removido.');
    setRemoving(null);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <UserCog className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Configurações — Usuários</h1>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar Usuário
          </Button>
        </div>

        {/* Tabela */}
        <div className="bg-card border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">
              Nenhum usuário cadastrado. Aplique a migration ou adicione usuários.
            </p>
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
                    <tr key={r.id ?? r.email} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-medium">{r.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block text-xs font-semibold capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {r.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.modules.length === 0
                            ? <span className="text-xs text-muted-foreground">—</span>
                            : r.modules.map(m => (
                              <span key={m} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-foreground">
                                {ALL_MODULES.find(x => x.id === m)?.label ?? m}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRemoving(r)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar/Adicionar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Adicionar Usuário' : 'Editar Usuário'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input
                  type="email" value={editing.email}
                  disabled={!isNew}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="usuario@megasteam.com.br" className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Role</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v as Role })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Módulos com acesso</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_MODULES.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={editing.modules.includes(m.id)} onCheckedChange={() => toggleModule(m.id)} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              {isNew && (
                <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">
                  O usuário ainda precisa criar a senha via Supabase Auth (envie o convite pelo painel do Supabase).
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? 'Adicionar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação remover */}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o acesso de <strong>{removing?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
