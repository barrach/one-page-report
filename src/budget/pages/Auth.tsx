import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import { Label } from "@budget/components/ui/label";
import { HardHat, LogIn, UserPlus, KeyRound } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { useToast } from "@budget/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@budget/components/ui/dialog";
import BuildVersionBadge from "@budget/components/layout/BuildVersionBadge";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const normalizedEmail = String(formData.get("forgotEmail") ?? forgotEmail).trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "E-mail enviado",
        description: "Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.",
      });
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const normalizedEmail = String(formData.get("email") ?? email).trim().toLowerCase();
    const submittedPassword = String(formData.get("password") ?? password);
    const submittedFullName = String(formData.get("fullName") ?? fullName).trim();
    const submittedCompanyName = String(formData.get("companyName") ?? companyName).trim();

    try {
      if (isLogin) {
        await supabase.auth.signOut({ scope: "local" });
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: submittedPassword });
        if (error) {
          setLoginError("E-mail ou senha incorretos.");
          setLoading(false);
          return;
        }

        // Check profile status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("status")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.status === "pending") {
            await supabase.auth.signOut();
            toast({
              title: "Aguardando aprovação",
              description: "Sua conta está pendente de aprovação pelo administrador.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          if (profile?.status === "blocked") {
            await supabase.auth.signOut();
            toast({
              title: "Acesso bloqueado",
              description: "Sua conta foi bloqueada. Entre em contato com o administrador.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        navigate("/budget/projetos");
      } else {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: submittedPassword,
          options: {
            data: {
              full_name: submittedFullName,
              company_name: submittedCompanyName,
            },
          },
        });
        if (error) throw error;
        // Auto-confirm is enabled, sign out and show pending message
        await supabase.auth.signOut();
        toast({
          title: "Cadastro realizado!",
          description: "Aguarde a aprovação do administrador para acessar o sistema.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <Card className="w-full p-8 bg-card border-border">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <HardHat className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">MegaBudget</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Nome completo *</Label>
                <Input
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Empresa *</Label>
                <Input
                  name="companyName"
                  autoComplete="organization"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da empresa"
                  required
                />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <Input
              name="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
              placeholder="email@empresa.com"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <Input
              name="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          {isLogin && loginError && (
            <p className="text-sm text-destructive">{loginError}</p>
          )}
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Cadastrar"}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          {isLogin && (
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setForgotOpen(true);
              }}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary hover:underline"
          >
            {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
          </button>
        </div>
        </Card>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado. Enviaremos um link para você definir uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                name="forgotEmail"
                autoComplete="email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={forgotLoading} className="gap-2">
                <KeyRound className="w-4 h-4" />
                {forgotLoading ? "Enviando..." : "Enviar link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
