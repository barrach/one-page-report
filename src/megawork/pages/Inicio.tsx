import { useEffect, useState } from 'react';
import { megaworkClient } from '@megawork/lib/megaworkClient';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, MapPin, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

export default function Inicio() {
  const { opsUser } = useMegaWorkAuth();
  const [obraNome, setObraNome] = useState<string>('—');
  const [checkedIn, setCheckedIn] = useState(false);
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  useEffect(() => {
    (async () => {
      if (!opsUser?.obra_id) return;
      const { data } = await megaworkClient.from('ops_obras').select('nome').eq('id', opsUser.obra_id).maybeSingle();
      if (data) setObraNome((data as { nome: string }).nome);
    })();
  }, [opsUser?.obra_id]);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="bg-card border rounded-xl p-5">
        <p className="text-sm text-muted-foreground">Bem-vindo,</p>
        <h1 className="text-2xl font-bold text-foreground">{opsUser?.nome || opsUser?.email}</h1>
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> Obra: <strong className="text-foreground">{obraNome}</strong></span>
          <span className="flex items-center gap-2 text-muted-foreground capitalize"><CalendarDays className="h-4 w-4" /> {hoje}</span>
        </div>
        <Button
          onClick={() => { setCheckedIn(true); toast.success('Check-in registrado!'); }}
          disabled={checkedIn}
          className="w-full mt-4 h-11 gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <LogIn className="h-5 w-5" /> {checkedIn ? 'Check-in realizado' : 'Fazer Check-in'}
        </Button>
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Atividades do dia</h2>
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade programada para hoje.</p>
      </div>
    </div>
  );
}
