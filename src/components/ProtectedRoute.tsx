import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Module } from '@/types/auth';

const LoadingScreen = () => {
  const [showReload, setShowReload] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowReload(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      {showReload && (
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-primary hover:underline"
        >
          Está demorando? Recarregar página
        </button>
      )}
    </div>
  );
};

/** Exige autenticação. Opcionalmente exige acesso a um módulo específico. */
export default function ProtectedRoute({ module, children }: { module?: Module; children: ReactNode }) {
  const { user, loading, hasModule } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (module && !hasModule(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
