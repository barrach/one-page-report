import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import DadosPage from "./pages/Dados";
const Admin = lazy(() => import("./pages/Admin"));
import Install from "./pages/Install";
import Login from "./pages/Login";
const TvMode = lazy(() => import("./pages/TvMode"));
import NotFound from "./pages/NotFound";
import { useProjectStore } from "./store/projectStore";
import { useAuth } from "./hooks/use-auth";

const queryClient = new QueryClient();

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const RequireAuth = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const loadProjects = useProjectStore(s => s.loadProjects);
  const init = useAuth(s => s.init);
  const user = useAuth(s => s.user);
  const isAdmin = useAuth(s => s.isAdmin);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (user) loadProjects();
  }, [user, isAdmin, loadProjects]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/install" element={<Install />} />
      <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
      <Route path="/dados" element={<RequireAuth><DadosPage /></RequireAuth>} />
      <Route path="/tv" element={
        <RequireAuth>
          <Suspense fallback={<Spinner />}>
            <TvMode />
          </Suspense>
        </RequireAuth>
      } />
      <Route path="/admin" element={
        <RequireAuth adminOnly>
          <Suspense fallback={<Spinner />}>
            <Admin />
          </Suspense>
        </RequireAuth>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
