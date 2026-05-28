import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@budget/components/ui/sonner";
import { Toaster } from "@budget/components/ui/toaster";
import { TooltipProvider } from "@budget/components/ui/tooltip";
import { useAuth } from "@budget/hooks/useAuth";
import { FinanceiroAccessProvider } from "@budget/hooks/useFinanceiroAccess";
import FinanceiroPasswordGate from "@budget/components/financeiro/FinanceiroPasswordGate";

// Auth fica eager (sempre é a 1ª tela para quem não está logado)
import Auth from "./pages/Auth";

// Demais páginas viram lazy → reduzem drasticamente o bundle inicial.
// Mantemos o loader exposto para permitir prefetch dos chunks no hover/focus.
const loadResetPassword = () => import("./pages/ResetPassword");
const loadProjetos = () => import("./pages/Projetos");
const loadProjetoDetalhe = () => import("./pages/ProjetoDetalhe");
const loadPropostas = () => import("./pages/Propostas");
const loadPropostaDetalhe = () => import("./pages/PropostaDetalhe");
const loadBiblioteca = () => import("./pages/Biblioteca");
const loadImportacao = () => import("./pages/Importacao");
const loadConfiguracoes = () => import("./pages/Configuracoes");
const loadContratoHub = () => import("./pages/ContratoHub");
const loadContratos = () => import("./pages/Contratos");
const loadExecutiveBudgetDetalhe = () => import("./pages/ExecutiveBudgetDetalhe");
const loadNotFound = () => import("./pages/NotFound");

const ResetPassword = lazy(loadResetPassword);
const Projetos = lazy(loadProjetos);
const ProjetoDetalhe = lazy(loadProjetoDetalhe);
const Propostas = lazy(loadPropostas);
const PropostaDetalhe = lazy(loadPropostaDetalhe);
const Biblioteca = lazy(loadBiblioteca);
const Importacao = lazy(loadImportacao);
const Configuracoes = lazy(loadConfiguracoes);
const ContratoHub = lazy(loadContratoHub);
const Contratos = lazy(loadContratos);
const ExecutiveBudgetDetalhe = lazy(loadExecutiveBudgetDetalhe);
const NotFound = lazy(loadNotFound);

// Mapa consumido pelo AppSidebar para prefetch (hover/focus dos links).
export const ROUTE_PREFETCH: Record<string, () => Promise<unknown>> = {
  "/budget/projetos": loadProjetos,
  "/budget/propostas": loadPropostas,
  "/budget/contratos": loadContratos,
  "/budget/biblioteca": loadBiblioteca,
  "/budget/importacao": loadImportacao,
  "/budget/configuracoes": loadConfiguracoes,
};

// Cache agressivo: queries permanecem "frescas" por 5min e em memória por 30min,
// evitando refetch a cada troca de aba e tornando a navegação quase instantânea.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

// Faz prefetch dos chunks principais quando o navegador estiver ocioso,
// para que cliques em qualquer aba sejam praticamente instantâneos.
const schedulePrefetch = () => {
  const run = () => {
    Object.values(ROUTE_PREFETCH).forEach((loader) => {
      try {
        loader();
      } catch {
        /* ignore */
      }
    });
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run);
  } else {
    window.setTimeout(run, 1500);
  }
};

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
    Carregando...
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/budget/auth" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (user) return <Navigate to="/budget/projetos" replace />;
  return <>{children}</>;
};

const PrefetchOnIdle = () => {
  useEffect(() => {
    schedulePrefetch();
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinanceiroAccessProvider>
        <PrefetchOnIdle />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="projetos" element={<ProtectedRoute><Projetos /></ProtectedRoute>} />
            <Route path="projeto/:id" element={<ProtectedRoute><ProjetoDetalhe /></ProtectedRoute>} />
            <Route path="propostas" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
            <Route path="proposta/:id" element={<ProtectedRoute><PropostaDetalhe /></ProtectedRoute>} />
            <Route path="orcamento-executivo/:id" element={<ProtectedRoute><ExecutiveBudgetDetalhe /></ProtectedRoute>} />
            <Route path="biblioteca" element={<ProtectedRoute><Biblioteca /></ProtectedRoute>} />
            <Route path="contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
            <Route path="financeiro/contrato/:id" element={<ProtectedRoute><FinanceiroPasswordGate><ContratoHub /></FinanceiroPasswordGate></ProtectedRoute>} />
            <Route path="importacao" element={<ProtectedRoute><Importacao /></ProtectedRoute>} />
            <Route path="configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            {/* Redirect old routes to projetos */}
            <Route path="dashboard" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="escopo" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="cronograma" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="custos" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="preco" element={<Navigate to="/budget/projetos" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </FinanceiroAccessProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
