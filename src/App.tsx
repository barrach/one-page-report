import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import HubPage from "./pages/HubPage";
import { useProjectStore } from "./store/projectStore";
import ModuleTopNav from "./components/ModuleTopNav";
import ProdControlApp from "./prodcontrol/ProdControlApp";

const queryClient = new QueryClient();

const AppContent = () => {
  const loadProjects = useProjectStore(s => s.loadProjects);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <>
      <ModuleTopNav />
      {/* pt-10 para compensar a barra MegaHub fixa (h-10) */}
      <div className="pt-10">
        <Routes>
          {/* Hub — página de seleção de módulo */}
          <Route path="/" element={<HubPage />} />

          {/* One Page Report — movido para /opr */}
          <Route path="/opr" element={<Index />} />
          <Route path="/opr/dados" element={<DadosPage />} />
          <Route path="/opr/admin" element={
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
              <Admin />
            </Suspense>
          } />
          <Route path="/opr/install" element={<Install />} />

          {/* ProdControl */}
          <Route path="/prodcontrol/*" element={<ProdControlApp />} />

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
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
