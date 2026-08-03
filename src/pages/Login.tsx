import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import logo from '@/assets/megasteam-logo.png.asset.json';

const Login = () => {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);

    if (mode === 'login') {
      const err = await signIn(email.trim(), password);
      if (err) setError('Não foi possível entrar. Verifique e-mail e senha.');
      else navigate('/', { replace: true });
    } else {
      const { error: err, needsConfirmation } = await signUp(email.trim(), password, name.trim());
      if (err) {
        setError(err.includes('already') ? 'Este e-mail já possui uma conta.' : 'Não foi possível criar a conta.');
      } else if (needsConfirmation) {
        const signInErr = await signIn(email.trim(), password);
        if (signInErr) setInfo('Conta criada! Faça login para acessar.');
        else navigate('/', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary px-4">
      <div className="w-full max-w-sm bg-card rounded-xl border card-shadow-elevated p-6 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <div className="gradient-primary rounded-lg px-6 py-4">
            <img src={logo.url} alt="MEGASTEAM" className="h-12 w-auto object-contain" />
          </div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">One Page Report</p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className={`text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === m ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <Input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-primary">{info}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? (mode === 'login' ? 'Entrando...' : 'Criando...')
              : (mode === 'login' ? 'Entrar' : 'Criar conta')}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center">
          Novas contas entram como visualizador e precisam de aprovação de um administrador para acessar os contratos.
        </p>
      </div>
    </div>
  );
};

export default Login;
