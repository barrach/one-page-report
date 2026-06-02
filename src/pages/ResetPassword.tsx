import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const DARK = '#0F172A';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (password.length < 8) { setError('A senha deve ter no mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Senhas não conferem.'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError('Não foi possível salvar a nova senha. Abra o link do e-mail novamente.');
      return;
    }
    setInfo('Senha alterada com sucesso! Redirecionando…');
    setTimeout(() => navigate('/login', { replace: true }), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <span className="text-white font-black text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Nova senha</h1>
          <p className="text-sm text-white/60 text-center">Defina uma nova senha para sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Nova senha (mín. 8 caracteres)</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="new-password" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Confirmar nova senha</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••" autoComplete="new-password" className="h-10" />
          </div>
          <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
          </Button>
          {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
          {info && <p className="text-sm text-green-600 font-medium text-center">{info}</p>}
        </form>
      </div>
    </div>
  );
}
