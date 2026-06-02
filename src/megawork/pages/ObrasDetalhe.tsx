import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { megaworkClient } from '@megawork/lib/megaworkClient';
import type { OpsObra } from '@megawork/types';
import { ArrowLeft, Building2, LogIn, ListChecks, AlertTriangle, Loader2 } from 'lucide-react';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm font-medium text-foreground mt-0.5">{value || '—'}</p>
  </div>
);

const KpiCard = ({ icon: Icon, label, value, color }: {
  icon: typeof LogIn; label: string; value: number; color: string;
}) => (
  <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="h-4 w-4 text-white" />
    </div>
    <div>
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  </div>
);

export default function ObrasDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [obra, setObra] = useState<OpsObra | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await megaworkClient.from('ops_obras').select('*').eq('id', id).maybeSingle();
      setObra((data as OpsObra) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!obra) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/megawork/obras')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Obras
        </button>
        <p className="text-center py-16 text-sm text-muted-foreground">Obra não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/megawork/obras')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para Obras
      </button>

      {/* Cabeçalho da obra */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#0F172A] flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{obra.nome}</h1>
              <p className="text-sm text-muted-foreground">{obra.cliente}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded ${obra.status === 'ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            {obra.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t">
          <Field label="Contrato" value={obra.contrato} />
          <Field label="Gestor responsável" value={obra.gestor_responsavel} />
          <Field label="Status" value={obra.status} />
          <Field label="Data de início" value={fmtDate(obra.data_inicio)} />
          <Field label="Término previsto" value={fmtDate(obra.data_termino)} />
          <Field label="Cliente" value={obra.cliente} />
        </div>
      </div>

      {/* Cards de resumo */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Resumo da obra</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={LogIn} label="Check-ins hoje" value={0} color="bg-emerald-600" />
          <KpiCard icon={ListChecks} label="Atividades previstas" value={0} color="bg-amber-600" />
          <KpiCard icon={AlertTriangle} label="Restrições abertas" value={0} color="bg-rose-600" />
        </div>
      </div>
    </div>
  );
}
