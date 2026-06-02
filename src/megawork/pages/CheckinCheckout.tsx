import { useEffect, useState, useCallback, useMemo } from 'react';
import { megaworkClient } from '@megawork/lib/supabase';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import type { OpsObra, OpsCheckin, OpsUser, CheckinTipo } from '@megawork/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, LogIn, LogOut, Clock, User, CheckCircle2, CircleDashed } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

const TIPO_LABEL: Record<CheckinTipo, string> = { checkin: 'Check-in', checkout: 'Check-out' };

interface Draft {
  obra_id: string;
  turno: number;
  tipo: CheckinTipo;
  horario: string;
  encarregado_email: string;
  encarregado_nome: string;
  atividades: string;
  observacoes: string;
}

export default function CheckinCheckout() {
  const { obraIds } = useMegaWorkAuth();
  const [obras, setObras] = useState<OpsObra[]>([]);
  const [obraId, setObraId] = useState<string>('');
  const [data, setData] = useState<string>(todayISO());
  const [checkins, setCheckins] = useState<OpsCheckin[]>([]);
  const [encarregados, setEncarregados] = useState<OpsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const obra = useMemo(() => obras.find(o => o.id === obraId) ?? null, [obras, obraId]);

  // Carrega obras (ativas)
  useEffect(() => {
    (async () => {
      const { data: rows } = await megaworkClient.from('ops_obras').select('*').eq('status', 'ativa').order('nome');
      let list = (rows ?? []) as OpsObra[];
      if (obraIds !== null) list = list.filter(o => obraIds.includes(o.id)); // acesso por obra
      setObras(list);
      if (list.length && !obraId) setObraId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraIds]);

  // Encarregados da obra selecionada
  useEffect(() => {
    (async () => {
      if (!obraId) { setEncarregados([]); return; }
      const { data: rows } = await megaworkClient
        .from('ops_users').select('id, email, nome, role, obra_id')
        .eq('role', 'Encarregado').eq('obra_id', obraId);
      setEncarregados((rows ?? []) as OpsUser[]);
    })();
  }, [obraId]);

  const loadCheckins = useCallback(async () => {
    if (!obraId || !data) { setCheckins([]); return; }
    const { data: rows } = await megaworkClient
      .from('ops_checkins').select('*')
      .eq('obra_id', obraId).eq('data', data);
    setCheckins((rows ?? []) as OpsCheckin[]);
  }, [obraId, data]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  const findRecord = (turno: number, tipo: CheckinTipo) =>
    checkins.find(c => c.turno === turno && c.tipo === tipo) ?? null;

  const openRegister = (turno: number, tipo: CheckinTipo) => {
    const existing = findRecord(turno, tipo);
    setDraft({
      obra_id: obraId, turno, tipo,
      horario: existing?.horario || nowHHMM(),
      encarregado_email: existing?.encarregado_email || '',
      encarregado_nome: existing?.encarregado_nome || '',
      atividades: existing?.atividades || '',
      observacoes: existing?.observacoes || '',
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const payload = {
      obra_id: draft.obra_id, data, turno: draft.turno, tipo: draft.tipo,
      horario: draft.horario, encarregado_email: draft.encarregado_email,
      encarregado_nome: draft.encarregado_nome, atividades: draft.atividades,
      observacoes: draft.observacoes,
    };
    // upsert pelo unique (obra_id, data, turno, tipo)
    const { error } = await megaworkClient
      .from('ops_checkins')
      .upsert([payload], { onConflict: 'obra_id,data,turno,tipo' });
    setSaving(false);
    if (error) { toast.error('Erro ao registrar: ' + error.message); return; }
    toast.success(`${TIPO_LABEL[draft.tipo]} do Turno ${draft.turno} registrado.`);
    setDraft(null);
    loadCheckins();
  };

  const turnos = obra ? Array.from({ length: Math.max(1, obra.num_turnos || 1) }, (_, i) => i + 1) : [];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Check-in / Check-out</h1>
        <p className="text-sm text-muted-foreground">Reuniões diárias de alinhamento (LPS — Last Planner System)</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs font-semibold">Obra</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
            <SelectContent>
              {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-48">
          <Label className="text-xs font-semibold">Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9" />
        </div>
      </div>

      {!obra ? (
        <p className="text-center py-16 text-sm text-muted-foreground">Nenhuma obra ativa disponível.</p>
      ) : (
        <div className="space-y-5">
          {turnos.map(turno => (
            <div key={turno}>
              <h2 className="text-sm font-bold text-foreground mb-2">Turno {turno}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['checkin', 'checkout'] as CheckinTipo[]).map(tipo => {
                  const rec = findRecord(turno, tipo);
                  const done = !!rec;
                  const Icon = tipo === 'checkin' ? LogIn : LogOut;
                  return (
                    <div key={tipo} className="bg-card border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tipo === 'checkin' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Turno {turno} — {TIPO_LABEL[tipo]}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {tipo === 'checkin' ? 'Alinhamento de metas' : 'Aderência ao plano'}
                            </p>
                          </div>
                        </div>
                        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {done ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                          {done ? 'Realizado' : 'Pendente'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                        <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {rec?.horario || '—'}</p>
                        <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {rec?.encarregado_nome || 'Sem responsável'}</p>
                      </div>

                      {rec?.observacoes && (
                        <p className="text-xs text-foreground bg-muted/50 rounded p-2 mb-3 whitespace-pre-line">{rec.observacoes}</p>
                      )}

                      <Button size="sm" variant={done ? 'outline' : 'default'} className="w-full" onClick={() => openRegister(turno, tipo)}>
                        {done ? 'Editar registro' : 'Registrar'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de registro */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft ? `Registrar ${TIPO_LABEL[draft.tipo]} — Turno ${draft.turno}` : ''}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Obra</Label>
                  <Input value={obra?.nome ?? ''} disabled className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipo / Turno</Label>
                  <Input value={`${TIPO_LABEL[draft.tipo]} · T${draft.turno}`} disabled className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Horário</Label>
                  <Input type="time" value={draft.horario} onChange={(e) => setDraft({ ...draft, horario: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Encarregado</Label>
                  <Select
                    value={draft.encarregado_email || undefined}
                    onValueChange={(v) => {
                      const u = encarregados.find(e => e.email === v);
                      setDraft({ ...draft, encarregado_email: v, encarregado_nome: u?.nome || v });
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {encarregados.length === 0
                        ? <SelectItem value="__none" disabled>Nenhum encarregado na obra</SelectItem>
                        : encarregados.map(e => <SelectItem key={e.id || e.email} value={e.email}>{e.nome || e.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Atividades alinhadas</Label>
                <Textarea rows={3} value={draft.atividades} onChange={(e) => setDraft({ ...draft, atividades: e.target.value })}
                  placeholder="Metas e atividades do turno..." className="text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observações</Label>
                <Textarea rows={2} value={draft.observacoes} onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
                  placeholder="Pauta / observações..." className="text-sm resize-none" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
