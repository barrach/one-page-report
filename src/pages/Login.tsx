import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { permissionsClient } from '@/lib/permissionsClient';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot';
const DARK = '#0F172A';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [authLoading, user, navigate, redirectTo]);

  if (!authLoading && user) return <Navigate to={redirectTo} replace />;

  const reset = () => { setError(''); setInfo(''); };
  const switchMode = (m: Mode) => { reset(); setPassword(''); setConfirm(''); setMode(m); };

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    reset(); setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setSubmitting(false);
    if (error) {
      setError('E-mail ou senha inválidos. Primeiro acesso? Clique em "Criar conta" para definir sua senha.');
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  // ── CADASTRO ───────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    const mail = email.trim().toLowerCase();
    if (password.length < 8) { setError('A senha deve ter no mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Senhas não conferem.'); return; }

    setSubmitting(true);
    // 1. e-mail precisa estar autorizado em user_permissions
    const { data: perm } = await permissionsClient
      .from('user_permissions')
      .select('email')
      .eq('email', mail)
      .maybeSingle();
    if (!perm) {
      setSubmitting(false);
      setError('Este e-mail não está autorizado. Entre em contato com michel.zabalia@megasteam.com.br');
      return;
    }
    // 2. cria a conta no Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email: mail, password });
    setSubmitting(false);
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        setError('Conta já existe. Faça login.');
      } else {
        setError('Não foi possível criar a conta: ' + error.message);
      }
      return;
    }
    // 3. se já houver sessão (confirmação de e-mail desativada) → entra direto
    if (data.session) { navigate(redirectTo, { replace: true }); return; }
    // senão, tenta logar imediatamente
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (signErr) {
      setInfo('Conta criada! Verifique seu e-mail para confirmar e depois faça login.');
      setMode('login');
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) { setError('Não foi possível enviar o e-mail de recuperação.'); return; }
    setInfo('Se já existe uma conta com este e-mail, o link de recuperação foi enviado. Se for seu primeiro acesso, use "Criar conta" para definir a senha.');
  };

  const title = mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Recuperar senha' : 'MegaHub';
  const subtitle = mode === 'signup'
    ? 'Use o e-mail corporativo @megasteam.com.br'
    : mode === 'forgot'
      ? 'Enviaremos um link para redefinir sua senha'
      : 'Plataforma integrada MEGASTEAM';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.svg" alt="MegaHub" className="h-16 w-16 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-black text-white tracking-tight">{title}</h1>
          <p className="text-sm text-white/60 text-center">{subtitle}</p>
        </div>

        {/* LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" autoComplete="email" />
            <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
            <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
            <Messages error={error} info={info} />
            <div className="flex flex-col gap-1.5 pt-1">
              <button type="button" onClick={() => switchMode('forgot')} className="text-center text-xs text-gray-500 hover:text-gray-800">
                Esqueci minha senha
              </button>
              <button type="button" onClick={() => switchMode('signup')} className="text-center text-xs font-semibold text-gray-700 hover:text-gray-900">
                Criar conta
              </button>
            </div>
          </form>
        )}

        {/* CADASTRO */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@megasteam.com.br" autoComplete="email" />
            <Field label="Senha (mín. 8 caracteres)" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />
            <Field label="Confirmar senha" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" autoComplete="new-password" />
            <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta'}
            </Button>
            <Messages error={error} info={info} />
            <button type="button" onClick={() => switchMode('login')} className="block w-full text-center text-xs font-semibold text-gray-700 hover:text-gray-900 pt-1">
              Já tenho conta → Entrar
            </button>
          </form>
        )}

        {/* ESQUECI A SENHA */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" autoComplete="email" />
            <Button type="submit" className="w-full h-10" style={{ backgroundColor: DARK }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link de recuperação'}
            </Button>
            <Messages error={error} info={info} />
            <button type="button" onClick={() => switchMode('login')} className="block w-full text-center text-xs font-semibold text-gray-700 hover:text-gray-900 pt-1">
              ← Voltar para o login
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-white/40 mt-6">
          MegaHub · Plataforma integrada MEGASTEAM
        </p>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-700">{label}</Label>
      <Input type={type} required value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} className="h-10" />
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
