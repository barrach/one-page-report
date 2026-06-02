import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [authLoading, user, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) { setError('E-mail ou senha inválidos.'); return; }
    navigate(redirectTo, { replace: true });
  };

  const handleForgot = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Informe o e-mail para redefinir a senha.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) { setError('Não foi possível enviar o e-mail de redefinição.'); return; }
    setInfo('Enviamos um link de redefinição de senha para o seu e-mail.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0F172A' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <span className="text-white font-black text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MegaHub</h1>
          <p className="text-sm text-white/60">Plataforma integrada MEGASTEAM</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-gray-700">E-mail</Label>
            <Input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Senha</Label>
            <Input
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" className="h-10"
            />
          </div>

          <Button type="submit" className="w-full h-10" style={{ backgroundColor: '#0F172A' }} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
          </Button>

          {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
          {info && <p className="text-sm text-green-600 font-medium text-center">{info}</p>}

          <button
            type="button" onClick={handleForgot}
            className="block w-full text-center text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="text-center text-[11px] text-white/40 mt-6">
          MegaHub · Plataforma integrada MEGASTEAM
        </p>
      </div>
    </div>
  );
}
