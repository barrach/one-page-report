import { Routes, Route, Navigate } from 'react-router-dom';
import { MegaWorkAuthProvider, useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import MegaWorkHeader from '@megawork/components/MegaWorkHeader';
import MegaWorkSidebar from '@megawork/components/MegaWorkSidebar';
import MegaWorkLogin from '@megawork/pages/MegaWorkLogin';
import SolicitarAcesso from '@megawork/pages/SolicitarAcesso';
import Dashboard from '@megawork/pages/Dashboard';
import Obras from '@megawork/pages/Obras';
import ObrasDetalhe from '@megawork/pages/ObrasDetalhe';
import CheckinCheckout from '@megawork/pages/CheckinCheckout';
import Solicitacoes from '@megawork/pages/Solicitacoes';
import Stub from '@megawork/pages/Stub';

function InnerRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="obras" element={<Obras />} />
      <Route path="obras/:id" element={<ObrasDetalhe />} />
      <Route path="checkin" element={<CheckinCheckout />} />
      <Route path="solicitacoes" element={<Solicitacoes />} />
      <Route path="dds" element={<Stub title="DDS — Diálogo Diário de Segurança" />} />
      <Route path="atividades" element={<Stub title="Atividades" />} />
      <Route path="restricoes" element={<Stub title="Restrições" />} />
      <Route path="importar-cronograma" element={<Stub title="Importar Cronograma" />} />
      <Route path="importar-curva-s" element={<Stub title="Importar Curva S" />} />
      <Route path="reunioes" element={<Stub title="Reuniões" />} />
      <Route path="planejamento-puxado" element={<Stub title="Planejamento Puxado" />} />
      <Route path="rdo" element={<Stub title="Anotações / RDO" />} />
      <Route path="licoes" element={<Stub title="Lições Aprendidas" />} />
      <Route path="usuarios" element={<Stub title="Usuários" />} />
      <Route path="configuracoes" element={<Stub title="Configurações" />} />
      <Route path="*" element={<Navigate to="/megawork/dashboard" replace />} />
    </Routes>
  );
}

// Área autenticada do MegaWork: exige sessão própria (independente do MegaHub)
function AuthedArea() {
  const { user, loading } = useMegaWorkAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">
        Carregando MegaWork…
      </div>
    );
  }
  if (!user) return <Navigate to="/megawork/login" replace />;

  return (
    <div className="h-[calc(100vh-2.5rem)] flex flex-col bg-background">
      <MegaWorkHeader />
      <div className="flex flex-1 overflow-hidden">
        <MegaWorkSidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <InnerRoutes />
        </main>
      </div>
    </div>
  );
}

export default function MegaWorkApp() {
  return (
    <MegaWorkAuthProvider>
      <Routes>
        <Route path="login" element={<MegaWorkLogin />} />
        <Route path="solicitar-acesso" element={<SolicitarAcesso />} />
        <Route path="*" element={<AuthedArea />} />
      </Routes>
    </MegaWorkAuthProvider>
  );
}
