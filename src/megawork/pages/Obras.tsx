import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { megaworkClient } from '@megawork/lib/supabase';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import type { OpsObra } from '@megawork/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Loader2, Building2, Search } from 'lucide-react';

const empty = (): OpsObra => ({
  id: '', nome: '', cliente: '', contrato: '',
  data_inicio: '', data_termino: '', status: 'ativa', gestor_responsavel: '', num_turnos: 1,
});

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('pt-BR');
};

export default function Obras() {
  const navigate = useNavigate();
  const { role, obraIds } = useMegaWorkAuth();
  const canManage = role === 'Admin' || role === 'Gestor';

  const [rows, setRows] = useState<OpsObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OpsObra | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [removing, setRemoving] = useState<OpsObra | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativa' | 'encerrada'>('todas');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await megaworkClient
      .from('ops_obras')
      .select('*')
      .order('nome');
    if (error) { toast.error('Erro ao carregar obras: ' + error.message); setRows([]); }
    else setRows((data ?? []) as OpsObra[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ativasCount = useMemo(() => rows.filter(o => o.status === 'ativa').length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(o => {
      if (obraIds !== null && !obraIds.includes(o.id)) return false; // acesso por obra
      if (statusFilter !== 'todas' && o.status !== statusFilter) return false;
      if (q && !(`${o.nome} ${o.cliente}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, statusFilter, search, obraIds]);

  const save = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) { toast.error('Informe o nome da obra.'); return; }
    if (!editing.cliente.trim()) { toast.error('Informe o cliente.'); return; }
    setSaving(true);
    const payload = {
      nome: editing.nome, cliente: editing.cliente, contrato: editing.contrato,
      data_inicio: editing.data_inicio || null, data_termino: editing.data_termino || null,
      status: editing.status, gestor_responsavel: editing.gestor_responsavel,
      num_turnos: editing.num_turnos || 1,
    };
    const { error } = isNew
      ? await megaworkClient.from('ops_obras').insert([payload])
      : await megaworkClient.from('ops_obras').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(isNew ? 'Obra criada.' : 'Obra atualizada.');
    setEditing(null); load();
  };

  const remove = async () => {
    if (!removing) return;
    const { error } = await megaworkClient.from('ops_obras').delete().eq('id', removing.id);
    if (error) { toast.error('Erro ao remover: ' + error.message); return; }
    toast.success('Obra removida.');
    setRemoving(null); load();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Obras
          </h1>
          <p className="text-sm text-muted-foreground">
            {ativasCount} {ativasCount === 1 ? 'obra ativa' : 'obras ativas'} · {rows.length} no total
          </p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => { setEditing(empty()); setIsNew(true); }}>
            <Plus className="h-4 w-4" /> Nova Obra
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou cliente..." className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="encerrada">Encerradas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm text-muted-foreground">
            {rows.length === 0 ? 'Nenhuma obra cadastrada.' : 'Nenhuma obra com os filtros aplicados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2.5 px-4 font-medium">Obra</th>
                  <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
                  <th className="text-left py-2.5 px-3 font-medium">Contrato</th>
                  <th className="text-left py-2.5 px-3 font-medium">Início</th>
                  <th className="text-left py-2.5 px-3 font-medium">Término</th>
                  <th className="text-left py-2.5 px-3 font-medium">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium">Gestor</th>
                  {canManage && <th className="text-right py-2.5 px-4 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => navigate(`/megawork/obras/${o.id}`)}
                  >
                    <td className="py-2.5 px-4 font-medium text-foreground">{o.nome}</td>
                    <td className="py-2.5 px-3">{o.cliente || '—'}</td>
                    <td className="py-2.5 px-3">{o.contrato || '—'}</td>
                    <td className="py-2.5 px-3">{fmtDate(o.data_inicio)}</td>
                    <td className="py-2.5 px-3">{fmtDate(o.data_termino)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${o.status === 'ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{o.gestor_responsavel || '—'}</td>
                    {canManage && (
                      <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing({ ...o }); setIsNew(false); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRemoving(o)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{isNew ? 'Nova Obra' : 'Editar Obra'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Nome da obra *</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cliente *</Label>
                <Input value={editing.cliente} onChange={(e) => setEditing({ ...editing, cliente: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Número do contrato</Label>
                <Input value={editing.contrato} onChange={(e) => setEditing({ ...editing, contrato: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data de início</Label>
                <Input type="date" value={editing.data_inicio ?? ''} onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Término previsto</Label>
                <Input type="date" value={editing.data_termino ?? ''} onChange={(e) => setEditing({ ...editing, data_termino: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as OpsObra['status'] })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Gestor responsável</Label>
                <Input value={editing.gestor_responsavel} onChange={(e) => setEditing({ ...editing, gestor_responsavel: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Número de turnos</Label>
                <Select value={String(editing.num_turnos || 1)} onValueChange={(v) => setEditing({ ...editing, num_turnos: parseInt(v, 10) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 turno</SelectItem>
                    <SelectItem value="2">2 turnos</SelectItem>
                    <SelectItem value="3">3 turnos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isNew ? 'Criar' : 'Salvar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação remover */}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover obra?</AlertDialogTitle>
            <AlertDialogDescription>Remover <strong>{removing?.nome}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
