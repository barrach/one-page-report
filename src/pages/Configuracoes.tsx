import { useState } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';
import { useAuth, type AppRole } from '@/context/AuthContext';
import { toast } from 'sonner';

const NOME_DO_PAPEL: Record<AppRole, string> = {
  admin: 'Administrador',
  planejador: 'Planejador',
  gestor: 'Gestor',
  visualizador: 'Visualizador',
  cliente: 'Cliente',
};

const MINIMO_SENHA = 6;

/**
 * Configurações da própria conta — disponível para qualquer usuário.
 *
 * A troca de senha vai direto no Supabase Auth (`auth.updateUser`), que atualiza
 * a senha do usuário logado; não passa pela função de admin, justamente para o
 * usuário comum poder trocar a sua sem depender de ninguém.
 */
const Configuracoes = () => {
  const { user, role } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const curta = senha.length > 0 && senha.length < MINIMO_SENHA;
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;
  const podeSalvar = senha.length >= MINIMO_SENHA && senha === confirmacao && !salvando;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    setSalvando(true);
    try {
      const { error } = await oprDataClient.auth.updateUser({ password: senha });
      if (error) throw error;
      toast.success('Senha alterada. Ela já vale para o próximo acesso.');
      setSenha('');
      setConfirmacao('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar a senha';
      // O Supabase recusa a senha igual à atual e senhas em listas de vazamento;
      // repassar a mensagem dele é mais útil que um texto genérico.
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 min-w-0">
        <div className="bg-card border-b border-border px-3 sm:px-5 py-2.5 flex items-center justify-between sticky top-0 z-50">
          <span className="text-xs font-bold text-muted-foreground tracking-[0.2em] uppercase">
            Configurações
          </span>
        </div>

        <div className="p-3 sm:p-4 space-y-6 max-w-2xl">
          {/* Conta */}
          <div className="bg-card rounded-xl p-6 border card-shadow">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Minha conta
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  E-mail
                </span>
                <p className="text-sm font-medium text-foreground mt-0.5 break-all">{user?.email}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Perfil
                </span>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {role ? NOME_DO_PAPEL[role] : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Senha */}
          <div className="bg-card rounded-xl p-6 border card-shadow">
            <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Alterar senha
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Troque a senha que foi criada para você. Mínimo de {MINIMO_SENHA} caracteres.
            </p>

            <form onSubmit={salvar} autoComplete="off" className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Nova senha
                </label>
                <Input
                  type="password"
                  name="nova-senha"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  minLength={MINIMO_SENHA}
                  required
                />
                {curta && (
                  <p className="text-[11px] text-destructive mt-1">
                    Use ao menos {MINIMO_SENHA} caracteres.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Confirmar nova senha
                </label>
                <Input
                  type="password"
                  name="confirmar-senha"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {diferentes && (
                  <p className="text-[11px] text-destructive mt-1">As senhas não coincidem.</p>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={!podeSalvar} className="gap-1.5">
                  <Save className="h-4 w-4" />
                  {salvando ? 'Salvando...' : 'Alterar senha'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
