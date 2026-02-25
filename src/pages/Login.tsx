import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, ShieldCheck, ArrowLeft, Mail } from 'lucide-react';

const Login = () => {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('megasteam_remember_me') === 'true');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    // Check if any admin exists
    const check = async () => {
      const { data } = await supabase.from('user_roles').select('id').eq('role', 'admin').limit(1);
      if (!data || data.length === 0) setSetupMode(true);
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
      setSetupMode(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

        {forgotMode ? (
          <div className="bg-card rounded-xl p-6 border card-shadow space-y-4">
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
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">
                    {error}
                  </div>
                )}
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

            <button
              type="button"
              onClick={() => { setForgotMode(false); setResetSent(false); setError(''); }}
              className="flex items-center gap-1 text-sm text-primary hover:underline mx-auto"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={setupMode ? handleSetup : handleSubmit} className="bg-card rounded-xl p-6 border card-shadow space-y-4">
            <h2 className="text-lg font-semibold text-foreground text-center flex items-center justify-center gap-2">
              {setupMode ? <><ShieldCheck className="h-5 w-5" /> Configuração Inicial</> : 'Entrar'}
            </h2>
            
            {setupMode && (
              <p className="text-xs text-muted-foreground text-center">
                Crie o primeiro usuário administrador para começar.
              </p>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Senha</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
            </div>

            {!setupMode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Permanecer logado
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setError(''); }}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {setupMode ? <ShieldCheck className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {submitting ? (setupMode ? 'Criando...' : 'Entrando...') : (setupMode ? 'Criar Administrador' : 'Entrar')}
            </Button>

            {!setupMode && (
              <p className="text-xs text-muted-foreground text-center">
                Acesso restrito. Solicite credenciais ao administrador.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
