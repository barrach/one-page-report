import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
import Install from "./pages/Install";
import HubPage from "./pages/HubPage";
import Login from "./pages/Login";
import ControladoriaPage from "./pages/ControladoriaPage";
import { useProjectStore } from "./store/projectStore";
import ModuleTopNav from "./components/ModuleTopNav";
import ProdControlApp from "./prodcontrol/ProdControlApp";
import BudgetApp from "./budget/BudgetApp";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

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
          <Route path="/" element={<ProtectedRoute><HubPage /></ProtectedRoute>} />

          {/* Painel Admin — só admin */}
          <Route path="/admin" element={<AdminRoute>{suspense(<UserManagement />)}</AdminRoute>} />

          {/* One Page Report — módulo opr */}
          <Route path="/opr" element={<ProtectedRoute module="opr"><Index /></ProtectedRoute>} />
          <Route path="/opr/dados" element={<ProtectedRoute module="opr"><DadosPage /></ProtectedRoute>} />
          <Route path="/opr/admin" element={<AdminRoute>{suspense(<Admin />)}</AdminRoute>} />
          <Route path="/opr/install" element={<ProtectedRoute module="opr"><Install /></ProtectedRoute>} />

          {/* ProdControl */}
          <Route path="/prodcontrol/*" element={<ProtectedRoute module="prodcontrol"><ProdControlApp /></ProtectedRoute>} />

          {/* Controladoria */}
          <Route path="/controladoria" element={<ProtectedRoute module="controladoria"><ControladoriaPage /></ProtectedRoute>} />

          {/* Budget Builder / MegaPricing */}
          <Route path="/budget/*" element={<ProtectedRoute module="megapricing"><BudgetApp /></ProtectedRoute>} />

          {/* Catch-all: rotas desconhecidas vão para o login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
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
