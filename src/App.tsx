import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
import Install from "./pages/Install";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import { useProjectStore } from "./store/projectStore";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useNotifications } from "./hooks/useNotifications";

const queryClient = new QueryClient();

const AppContent = () => {
  const loadProjects = useProjectStore(s => s.loadProjects);
  const { user } = useAuth();
  const { requestPermission } = useNotifications();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Solicita permissão de notificação após o primeiro login (uma vez)
  useEffect(() => {
    if (user && !sessionStorage.getItem('opr_notif_asked')) {
      sessionStorage.setItem('opr_notif_asked', '1');
      requestPermission();
    }
  }, [user, requestPermission]);

  const suspense = (node: React.ReactNode) => (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      {node}
    </Suspense>
  );

  return (
    <>
      <Routes>
        {/* Login / recuperação — públicos */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* One Page Report */}
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/dados" element={<ProtectedRoute><DadosPage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute>{suspense(<Admin />)}</AdminRoute>} />
        <Route path="/install" element={<ProtectedRoute><Install /></ProtectedRoute>} />

        {/* Catch-all: rotas desconhecidas vão para o login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <PWAInstallPrompt />
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
