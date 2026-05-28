import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { useFinanceiroAccess } from "@budget/hooks/useFinanceiroAccess";

interface FinanceiroPasswordGateProps {
  children: React.ReactNode;
}

const FinanceiroPasswordGate = ({ children }: FinanceiroPasswordGateProps) => {
  const { granted, tryUnlock } = useFinanceiroAccess();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (granted) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const ok = tryUnlock(password);
    setSubmitting(false);
    if (!ok) {
      setError("Senha incorreta. Tente novamente.");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-tight">Acesso restrito · Controladoria</h1>
                <p className="text-xs text-muted-foreground">
                  Informe a senha de acesso definida pelo administrador.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="financeiro-password" className="text-sm">
                Senha de acesso
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="financeiro-password"
                  type={showPassword ? "text" : "password"}
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Digite a senha"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/budget/projetos")}
                className="gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Cancelar
              </Button>
              <Button type="submit" className="ml-auto" disabled={submitting || !password}>
                Confirmar
              </Button>
            </div>
          </form>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          O acesso permanece liberado durante esta sessão. Ao sair, será necessário informar a senha novamente.
        </p>
      </div>
    </div>
  );
};

export default FinanceiroPasswordGate;
