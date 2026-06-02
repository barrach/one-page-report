import { useState } from 'react';
import { Link } from 'react-router-dom';
import { megaworkClient } from '@megawork/lib/megaworkClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { HardHat, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

const DARK = '#0F172A';

export default function SolicitarAcesso() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [obra, setObra] = useState('');
  const [roleDesejado, setRoleDesejado] = useState('Encarregado');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nome.trim() || !email.trim()) { setError('Preencha nome e e-mail.'); return; }
    setSubmitting(true);
    const { error } = await megaworkClient.from('ops_solicitacoes').insert([{
      nome: nome.trim(), email: email.trim().toLowerCase(), telefone: telefone.trim(),
      obra_interesse: obra.trim(), role_desejado: roleDesejado,
    }]);
    setSubmitting(false);
    if (error) { setError('Não foi possível enviar a solicitação. Tente novamente.'); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: DARK }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <HardHat className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MegaWork</h1>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-base font-bold text-gray-900">Solicitação enviada!</p>
            <p className="text-sm text-gray-600">Aguarde aprovação do administrador.</p>
            <Link to="/megawork/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 mt-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Solicitar acesso</h2>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Obra / Contrato de interesse</Label>
              <Input value={obra} onChange={(e) => setObra(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Perfil desejado</Label>
              <Select value={roleDesejado} onValueChange={setRoleDesejado}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Encarregado">Encarregado</SelectItem>
                  <SelectItem value="Engenheiro">Engenheiro</SelectItem>
                  <SelectItem value="Gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar solicitação'}
            </Button>
            {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
            <Link to="/megawork/login" className="block text-center text-xs font-semibold text-gray-700 hover:text-gray-900">
              ← Já tenho acesso · Entrar
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
