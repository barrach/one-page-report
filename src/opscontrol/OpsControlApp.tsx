import { Routes, Route, Navigate } from 'react-router-dom';
import { OpsAuthProvider, useOpsAuth } from '@opscontrol/context/OpsAuthContext';
import OpsHeader from '@opscontrol/components/OpsHeader';
import OpsSidebar from '@opscontrol/components/OpsSidebar';
import Dashboard from '@opscontrol/pages/Dashboard';
import Obras from '@opscontrol/pages/Obras';
import Inicio from '@opscontrol/pages/Inicio';
import Stub from '@opscontrol/pages/Stub';

function OpsRoutes() {
  const { loading, role } = useOpsAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">
        Carregando OpsControl…
      </div>
    );
  }

  // Encarregado entra na tela "Início"; demais no Dashboard
  const indexEl = role === 'Encarregado' ? <Inicio /> : <Dashboard />;

  return (
    <Routes>
      <Route index element={indexEl} />
      <Route path="inicio" element={<Inicio />} />
      <Route path="obras" element={<Obras />} />
      <Route path="checkin" element={<Stub title="Check-in / Check-out" />} />
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
      <Route path="*" element={<Navigate to="/opscontrol" replace />} />
    </Routes>
  );
}

function OpsShell() {
  return (
    <div className="h-[calc(100vh-2.5rem)] flex flex-col bg-background">
      <OpsHeader />
      <div className="flex flex-1 overflow-hidden">
        <OpsSidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <OpsRoutes />
        </main>
      </div>
    </div>
  );
}

export default function OpsControlApp() {
  return (
    <OpsAuthProvider>
      <OpsShell />
    </OpsAuthProvider>
  );
}
