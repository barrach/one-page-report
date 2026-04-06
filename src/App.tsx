import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { useProjectStore } from "./store/projectStore";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const AppContent = () => {
  const loadProjects = useProjectStore(s => s.loadProjects);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/install" element={<Install />} />
        <Route path="/" element={<Index />} />
        <Route path="/dados" element={
          <ProtectedRoute>
            <DadosPage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
              <Admin />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
