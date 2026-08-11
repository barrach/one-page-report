import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DARK = '#002054';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [authLoading, user, navigate, redirectTo]);

  if (!authLoading && user) return <Navigate to={redirectTo} replace />;

  const reset = () => { setError(''); setInfo(''); };

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    reset(); setSubmitting(true);
    const { error } = await oprDataClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setSubmitting(false);
    if (error) {
      setError('E-mail ou senha inválidos.');
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  // ── ESQUECI A SENHA ──────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!email.trim()) { setError('Informe o e-mail.'); return; }
    setSubmitting(true);
    const { error } = await oprDataClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) { setError('Não foi possível enviar o e-mail de recuperação.'); return; }
    setInfo('Se já existe uma conta com este e-mail, o link de recuperação foi enviado.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img
            src="/megasteam-login.png"
            alt="Megasteam"
            className="h-16 w-auto max-w-full object-contain"
          />
          <h1 className="text-sm font-bold text-gray-500 tracking-[0.2em] uppercase">One Page Report</h1>
        </div>

        {/* Não há autocadastro: as contas são criadas pelo administrador, então o
            login não tem abas. */}

        {/* LOGIN */}
        {!forgot && (
          <form onSubmit={handleLogin} className="space-y-3">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail" autoComplete="email" className="h-11 bg-gray-100 border-none" />
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha" autoComplete="current-password" className="h-11 bg-gray-100 border-none" />
            <Button type="submit" className="w-full h-11" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
            <Messages error={error} info={info} />
            <button type="button" onClick={() => { reset(); setForgot(true); }} className="block w-full text-center text-xs text-gray-500 hover:text-gray-800 pt-1">
              Esqueci minha senha
            </button>
          </form>
        )}

        {/* ESQUECI A SENHA */}
        {forgot && (
          <form onSubmit={handleForgot} className="space-y-3">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail" autoComplete="email" className="h-11 bg-gray-100 border-none" />
            <Button type="submit" className="w-full h-11" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link de recuperação'}
            </Button>
            <Messages error={error} info={info} />
            <button type="button" onClick={() => { reset(); setForgot(false); }} className="block w-full text-center text-xs text-gray-500 hover:text-gray-800 pt-1">
              ← Voltar
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-gray-400 mt-6">
          O acesso é criado pelo administrador. Fale com ele se ainda não tem conta.
        </p>
      </div>
    </div>
  );
}

function Messages({ error, info }: { error: string; info: string }) {
  return (
    <>
      {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
      {info && <p className="text-sm text-green-600 font-medium text-center">{info}</p>}
    </>
  );
}
