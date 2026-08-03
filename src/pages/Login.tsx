import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import logo from '@/assets/megasteam-logo.png.asset.json';

const Login = () => {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) setError('Não foi possível entrar. Verifique e-mail e senha.');
    else navigate('/', { replace: true });
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

        <form onSubmit={handleSubmit} className="space-y-3">
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
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center">
          Acesso restrito. Solicite suas credenciais ao administrador do contrato.
        </p>
      </div>
    </div>
  );
};

export default Login;
