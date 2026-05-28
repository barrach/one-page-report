import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import { Label } from "@budget/components/ui/label";
import { HardHat, KeyRound } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { useToast } from "@budget/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Supabase posta tokens no hash; o SDK processa automaticamente e dispara
  // o evento PASSWORD_RECOVERY. A partir daí o usuário tem uma sessão temporária
  // que permite chamar updateUser({ password }).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Caso a página carregue depois do hash já ter sido processado
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas diferentes", description: "Confirme a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha redefinida!", description: "Faça login com a nova senha." });
      await supabase.auth.signOut();
      navigate("/budget/auth");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <HardHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">MegaBudget</h1>
          <p className="text-sm text-muted-foreground mt-1">Definir nova senha</p>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Validando link... Se não carregar em alguns segundos, abra o link de recuperação
            do e-mail novamente.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <KeyRound className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
