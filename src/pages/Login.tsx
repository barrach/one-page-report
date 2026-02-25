import { useState, useEffect, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, ShieldCheck, ArrowLeft, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot' | 'setup';

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('megasteam_remember_me') === 'true');
  const [mode, setMode] = useState<Mode>('login');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('user_roles').select('id').eq('role', 'admin').limit(1);
      if (!data || data.length === 0) setMode('setup');
      setCheckingSetup(false);
    };
    check();
  }, [setupDone]);

  if (loading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
  };

  const switchMode = (newMode: Mode) => {
    resetForm();
    setResetSent(false);
    setSignupSuccess(false);
    setMode(newMode);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke('setup-admin', {
        body: { email, password },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      setSetupDone(true);
      switchMode('login');
    } catch (err: any) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    if (rememberMe) {
      localStorage.setItem('megasteam_remember_me', 'true');
    } else {
      localStorage.removeItem('megasteam_remember_me');
    }
    const err = await signIn(email, password);
    if (err) setError(err);
    setSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setSignupSuccess(true);
    }
    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-6 w-1 bg-primary rounded-full" />
            <h1 className="text-xl font-bold tracking-[0.15em] uppercase text-foreground">MEGASTEAM</h1>
          </div>
          <p className="text-sm text-muted-foreground">One Page Report</p>
        </div>

        {setupDone && (
          <div className="text-sm text-success bg-success/10 rounded-lg p-3 text-center mb-4">
            ✅ Administrador criado! Faça login abaixo.
          </div>
        )}

        <div className="bg-card rounded-xl p-6 border card-shadow space-y-4">
          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <>
              <h2 className="text-lg font-semibold text-foreground text-center flex items-center justify-center gap-2">
                <Mail className="h-5 w-5" /> Redefinir Senha
              </h2>
              <p className="text-xs text-muted-foreground text-center">
                Informe seu e-mail para receber o link de redefinição.
              </p>
              {resetSent ? (
                <div className="text-sm text-success bg-success/10 rounded-lg p-3 text-center">
                  ✅ E-mail enviado! Verifique sua caixa de entrada.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={submitting}>
                    <Mail className="h-4 w-4" />
                    {submitting ? 'Enviando...' : 'Enviar link'}
                  </Button>
                </form>
              )}
              <button type="button" onClick={() => switchMode('login')} className="flex items-center gap-1 text-sm text-primary hover:underline mx-auto">
                <ArrowLeft className="h-3 w-3" /> Voltar ao login
              </button>
            </>
          )}

          {/* SIGNUP */}
          {mode === 'signup' && (
            <>
              <h2 className="text-lg font-semibold text-foreground text-center flex items-center justify-center gap-2">
                <UserPlus className="h-5 w-5" /> Criar Conta
              </h2>
              {signupSuccess ? (
                <div className="text-sm text-success bg-success/10 rounded-lg p-3 text-center">
                  ✅ Conta criada! Verifique seu e-mail para confirmar o cadastro.
                </div>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Nome</label>
                    <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Senha</label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={submitting}>
                    <UserPlus className="h-4 w-4" />
                    {submitting ? 'Criando...' : 'Criar Conta'}
                  </Button>
                </form>
              )}
              <button type="button" onClick={() => switchMode('login')} className="flex items-center gap-1 text-sm text-primary hover:underline mx-auto">
                <ArrowLeft className="h-3 w-3" /> Já tenho conta
              </button>
            </>
          )}

          {/* SETUP */}
          {mode === 'setup' && (
            <>
              <h2 className="text-lg font-semibold text-foreground text-center flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Configuração Inicial
              </h2>
              <p className="text-xs text-muted-foreground text-center">
                Crie o primeiro usuário administrador para começar.
              </p>
              <form onSubmit={handleSetup} className="space-y-4">
                {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Senha</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <ShieldCheck className="h-4 w-4" />
                  {submitting ? 'Criando...' : 'Criar Administrador'}
                </Button>
              </form>
            </>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-foreground text-center">Entrar</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Senha</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
                    <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">Permanecer logado</label>
                  </div>
                  <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-primary hover:underline">Esqueci minha senha</button>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <LogIn className="h-4 w-4" />
                  {submitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
              <div className="text-center">
                <button type="button" onClick={() => switchMode('signup')} className="text-sm text-primary hover:underline">
                  Não tem conta? Cadastre-se
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
