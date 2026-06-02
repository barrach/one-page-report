import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import HubPage from "./pages/HubPage";
import Login from "./pages/Login";
import ControladoriaPage from "./pages/ControladoriaPage";
import { useProjectStore } from "./store/projectStore";
import ModuleTopNav from "./components/ModuleTopNav";
import ProdControlApp from "./prodcontrol/ProdControlApp";
import BudgetApp from "./budget/BudgetApp";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth, RequireAdmin } from "./components/auth/RouteGuards";

const queryClient = new QueryClient();

const AppContent = () => {
  const loadProjects = useProjectStore(s => s.loadProjects);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const suspense = (node: React.ReactNode) => (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      {node}
    </Suspense>
  );

  return (
    <>
      <ModuleTopNav />
      {/* pt-10 para compensar a barra MegaHub fixa (h-10) */}
      <div className="pt-10">
        <Routes>
          {/* Login — público */}
          <Route path="/login" element={<Login />} />

          {/* Hub — exige autenticação */}
          <Route path="/" element={<RequireAuth><HubPage /></RequireAuth>} />

          {/* Painel Admin — só admin */}
          <Route path="/admin" element={<RequireAdmin>{suspense(<UserManagement />)}</RequireAdmin>} />

          {/* One Page Report — módulo opr */}
          <Route path="/opr" element={<RequireAuth module="opr"><Index /></RequireAuth>} />
          <Route path="/opr/dados" element={<RequireAuth module="opr"><DadosPage /></RequireAuth>} />
          <Route path="/opr/admin" element={<RequireAdmin>{suspense(<Admin />)}</RequireAdmin>} />
          <Route path="/opr/install" element={<RequireAuth module="opr"><Install /></RequireAuth>} />

          {/* ProdControl */}
          <Route path="/prodcontrol/*" element={<RequireAuth module="prodcontrol"><ProdControlApp /></RequireAuth>} />

          {/* Controladoria */}
          <Route path="/controladoria" element={<RequireAuth module="controladoria"><ControladoriaPage /></RequireAuth>} />

          {/* Budget Builder / MegaPricing */}
          <Route path="/budget/*" element={<RequireAuth module="megapricing"><BudgetApp /></RequireAuth>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
