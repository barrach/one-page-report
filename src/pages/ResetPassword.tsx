import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setValid(true);
    }

    // Also listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValid(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
    setSubmitting(false);
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
          <button onClick={() => navigate('/login')} className="text-primary hover:underline text-sm mt-2">
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

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

        <div className="bg-card rounded-xl p-6 border card-shadow space-y-4">
          <h2 className="text-lg font-semibold text-foreground text-center flex items-center justify-center gap-2">
            <KeyRound className="h-5 w-5" /> Nova Senha
          </h2>

          {success ? (
            <div className="text-sm text-success bg-success/10 rounded-lg p-3 text-center">
              ✅ Senha alterada! Redirecionando...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center">
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Nova senha</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Confirmar senha</label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" minLength={6} />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                <KeyRound className="h-4 w-4" />
                {submitting ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
