import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Module } from '@/types/auth';

/** Exige autenticação. Opcionalmente exige acesso a um módulo específico. */
export default function ProtectedRoute({ module, children }: { module?: Module; children: ReactNode }) {
  const { user, loading, hasModule } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // Timeout de segurança: se o loading travar > 5s, recarrega para /login
  useEffect(() => {
    if (!loading) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  if (timedOut) {
    window.location.replace('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (module && !hasModule(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
