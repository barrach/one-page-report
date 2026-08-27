import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Rota que só quem lança dados acessa: administrador, gestor e planejador.
 *
 * `visualizador` e `cliente` vão para o relatório. Até aqui a aba Dados era
 * aberta a qualquer usuário logado — o cliente externo inclusive podia importar
 * planilha e apagar dados de qualquer projeto.
 *
 * Enquanto o papel ainda não chegou, mostra o carregando em vez de redirecionar:
 * chutar "não pode" jogaria para fora quem tem permissão, a cada F5.
 */
export default function EditorRoute({ children }: { children: ReactNode }) {
  const { user, loading, canEdit } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!canEdit) return <Navigate to="/" replace />;
  return <>{children}</>;
}
