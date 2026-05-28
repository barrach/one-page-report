import { Routes, Route } from "react-router-dom";
import { useOfflineSync } from "@prodcontrol/hooks/useOfflineSync";
import { AuthProvider, useAuth } from "@prodcontrol/contexts/AuthContext";
import Dashboard from "@prodcontrol/pages/Dashboard";
import NewObservation from "@prodcontrol/pages/NewObservation";
import Records from "@prodcontrol/pages/Records";
import RoutesPage from "@prodcontrol/pages/RoutesPage";
import SettingsPage from "@prodcontrol/pages/SettingsPage";
import CadastroRotas from "@prodcontrol/pages/CadastroRotas";
import CadastroEspecialidades from "@prodcontrol/pages/CadastroEspecialidades";
import CadastroCategorias from "@prodcontrol/pages/CadastroCategorias";
import CadastroObras from "@prodcontrol/pages/CadastroObras";
import AuditoriaPage from "@prodcontrol/pages/AuditoriaPage";
import AprovacoesPage from "@prodcontrol/pages/AprovacoesPage";
import RelatorioIA from "@prodcontrol/pages/RelatorioIA";
import RelatoriosPage from "@prodcontrol/pages/RelatoriosPage";
import RelatoriosSalvosPage from "@prodcontrol/pages/RelatoriosSalvosPage";
import LoginPage from "@prodcontrol/pages/LoginPage";
import NotFound from "@prodcontrol/pages/NotFound";

function ProdControlRoutes() {
  useOfflineSync();
  const { user, loading, isApproved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user || !isApproved) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="nova-observacao" element={<NewObservation />} />
      <Route path="registros" element={<Records />} />
      <Route path="rotas" element={<RoutesPage />} />
      <Route path="configuracoes" element={<SettingsPage />} />
      <Route path="cadastro/rotas" element={<CadastroRotas />} />
      <Route path="cadastro/especialidades" element={<CadastroEspecialidades />} />
      <Route path="cadastro/categorias" element={<CadastroCategorias />} />
      <Route path="cadastro/obras" element={<CadastroObras />} />
      <Route path="auditoria" element={<AuditoriaPage />} />
      <Route path="aprovacoes" element={<AprovacoesPage />} />
      <Route path="relatorios" element={<RelatoriosPage />} />
      <Route path="relatorios-salvos" element={<RelatoriosSalvosPage />} />
      <Route path="relatorio-ia" element={<RelatorioIA />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function ProdControlApp() {
  return (
    <AuthProvider>
      <ProdControlRoutes />
    </AuthProvider>
  );
}
