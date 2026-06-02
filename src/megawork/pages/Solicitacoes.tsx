import { useEffect, useState, useCallback } from 'react';
import { megaworkClient, makeEphemeralClient } from '@megawork/lib/supabase';
import type { OpsSolicitacao, OpsObra, OpsRole } from '@megawork/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Check, X, Inbox } from 'lucide-react';

const randomPwd = () => Math.random().toString(36).slice(2) + 'Aa1!';

export default function Solicitacoes() {
  const [rows, setRows] = useState<OpsSolicitacao[]>([]);
  const [obras, setObras] = useState<OpsObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<OpsSolicitacao | null>(null);
  const [obraId, setObraId] = useState<string>('');
  const [role, setRole] = useState<OpsRole>('Encarregado');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sol }, { data: ob }] = await Promise.all([
      megaworkClient.from('ops_solicitacoes').select('*').eq('status', 'pendente').order('created_at', { ascending: false }),
      megaworkClient.from('ops_obras').select('*').order('nome'),
    ]);
    setRows((sol ?? []) as OpsSolicitacao[]);
    setObras((ob ?? []) as OpsObra[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openApprove = (s: OpsSolicitacao) => {
    setApproving(s);
    setRole((s.role_desejado as OpsRole) ?? 'Encarregado');
    setObraId('');
  };

  const confirmApprove = async () => {
    if (!approving) return;
    setBusy(true);
    // 1. cria usuário no Supabase Auth (client efêmero, não afeta a sessão do admin)
    const eph = makeEphemeralClient();
    const tempPwd = randomPwd();
    const { error: signErr } = await eph.auth.signUp({ email: approving.email, password: tempPwd });
    // 23505 / "already registered" → usuário já existe, segue mesmo assim
    if (signErr && !/already|registered|exists/i.test(signErr.message)) {
      setBusy(false);
      toast.error('Erro ao criar conta: ' + signErr.message);
      return;
    }
    // 2. insere/atualiza em ops_users
    const { error: upErr } = await megaworkClient.from('ops_users').upsert([{
      email: approving.email, nome: approving.nome, role,
      obra_id: obraId || null,
    }], { onConflict: 'email' });
    if (upErr) { setBusy(false); toast.error('Erro ao salvar usuário: ' + upErr.message); return; }
    // 3. marca solicitação como aprovada
    await megaworkClient.from('ops_solicitacoes').update({ status: 'aprovado' }).eq('id', approving.id);
    // 4. envia e-mail para o usuário definir a senha
    try { await eph.auth.resetPasswordForEmail(approving.email, { redirectTo: `${window.location.origin}/megawork/login` }); } catch { /* ignore */ }
    setBusy(false);
    toast.success('Solicitação aprovada. Enviado e-mail para o usuário definir a senha.');
    setApproving(null);
    load();
  };

  const reject = async (s: OpsSolicitacao) => {
    const { error } = await megaworkClient.from('ops_solicitacoes').update({ status: 'rejeitado' }).eq('id', s.id);
    if (error) { toast.error('Erro ao rejeitar: ' + error.message); return; }
    toast.success('Solicitação rejeitada.');
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Inbox className="h-5 w-5 text-primary" /> Solicitações</h1>
        <p className="text-sm text-muted-foreground">Pedidos de acesso pendentes</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-16 text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2.5 px-4 font-medium">Nome</th>
                  <th className="text-left py-2.5 px-3 font-medium">E-mail</th>
                  <th className="text-left py-2.5 px-3 font-medium">Telefone</th>
                  <th className="text-left py-2.5 px-3 font-medium">Obra interesse</th>
                  <th className="text-left py-2.5 px-3 font-medium">Perfil</th>
                  <th className="text-right py-2.5 px-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-medium">{s.nome}</td>
                    <td className="py-2.5 px-3">{s.email}</td>
                    <td className="py-2.5 px-3">{s.telefone || '—'}</td>
                    <td className="py-2.5 px-3">{s.obra_interesse || '—'}</td>
                    <td className="py-2.5 px-3">{s.role_desejado}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => openApprove(s)}>
                          <Check className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 h-8 text-destructive" onClick={() => reject(s)}>
                          <X className="h-3.5 w-3.5" /> Rejeitar
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

      {/* Modal aprovar */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Aprovar acesso</DialogTitle></DialogHeader>
          {approving && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{approving.nome}</strong> · {approving.email}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Perfil (role)</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OpsRole)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Encarregado">Encarregado</SelectItem>
                    <SelectItem value="Engenheiro">Engenheiro</SelectItem>
                    <SelectItem value="Gestor">Gestor</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Obra vinculada</Label>
                <Select value={obraId || undefined} onValueChange={setObraId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sem obra (todas)" /></SelectTrigger>
                  <SelectContent>
                    {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">
                Ao aprovar, a conta é criada no Auth e um e-mail é enviado para o usuário definir a senha.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancelar</Button>
            <Button onClick={confirmApprove} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aprovar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
