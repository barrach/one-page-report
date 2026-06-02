import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardHat, Loader2 } from 'lucide-react';

const DARK = '#0F172A';

export default function MegaWorkLogin() {
  const navigate = useNavigate();
  const { signIn } = useMegaWorkAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) { setError(error); return; }
    navigate('/megawork/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <HardHat className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MegaWork</h1>
          <p className="text-sm text-white/60">Gestão de campo · MEGASTEAM</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">E-mail</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Senha</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" className="h-10" />
          </div>
          <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
          </Button>
          {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
          <Link to="/megawork/solicitar-acesso" className="block text-center text-xs font-semibold text-gray-700 hover:text-gray-900">
            Solicitar acesso
          </Link>
        </form>

        <p className="text-center text-[11px] text-white/40 mt-6">MegaWork · Plataforma MEGASTEAM</p>
      </div>
    </div>
  );
}
