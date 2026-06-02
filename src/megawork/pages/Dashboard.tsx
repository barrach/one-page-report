import { useEffect, useState } from 'react';
import { Building2, LogIn, ListChecks, AlertTriangle } from 'lucide-react';
import { megaworkClient } from '@megawork/lib/megaworkClient';

const KpiCard = ({ icon: Icon, label, value, hint, color }: {
  icon: typeof Building2; label: string; value: string | number; hint?: string; color: string;
}) => (
  <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs font-medium text-foreground mt-1">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

export default function Dashboard() {
  const [obrasAtivas, setObrasAtivas] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { count } = await megaworkClient
        .from('ops_obras')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativa');
      setObrasAtivas(count ?? 0);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação de campo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Building2} label="Obras ativas" value={obrasAtivas} color="bg-blue-600" />
        <KpiCard icon={LogIn} label="Check-ins hoje" value={0} hint="atualizado em tempo real" color="bg-emerald-600" />
        <KpiCard icon={ListChecks} label="Atividades" value="0 / 0" hint="previstas vs realizadas" color="bg-amber-600" />
        <KpiCard icon={AlertTriangle} label="Restrições abertas" value={0} color="bg-rose-600" />
      </div>

      <div className="bg-card border rounded-xl p-6 text-sm text-muted-foreground">
        Gráficos e indicadores detalhados (LPS, PPC, curva de restrições) serão exibidos aqui.
      </div>
    </div>
  );
}
