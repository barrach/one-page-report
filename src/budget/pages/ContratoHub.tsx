import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { FinancialWorkspaceProvider } from "@budget/hooks/useFinancialWorkspace";
import ContractWorkspace from "@budget/components/financeiro/ContractWorkspace";

/**
 * Hub do contrato — abre numa rota própria /financeiro/contrato/:id.
 * Conteúdo organizado em ABAS HORIZONTAIS (sem sidebar interno).
 */
const ContratoHubInner = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate("/budget/contratos", { replace: true });
    return null;
  }

  return (
    <AppLayout mainClassName="p-0">
      <ContractWorkspace
        contractId={id}
        onBack={() => navigate("/budget/contratos")}
      />
    </AppLayout>
  );
};

const ContratoHub = () => (
  <FinancialWorkspaceProvider>
    <ContratoHubInner />
  </FinancialWorkspaceProvider>
);

export default ContratoHub;
