import { useNavigate } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { FinancialWorkspaceProvider } from "@budget/hooks/useFinancialWorkspace";
import ContractPortal from "@budget/components/financeiro/ContractPortal";

/**
 * Página principal do Financeiro = "Portal".
 * Sem sidebar interno. Apenas o portal de cards.
 */
const FinanceiroInner = () => {
  const navigate = useNavigate();

  return (
    <AppLayout mainClassName="p-0">
      <div className="bg-background">
        {/* Portal de cards (fluxo normal, sem container scrollável próprio) */}
        <div>
          <ContractPortal
            onOpenContract={(id) => navigate(`/financeiro/contrato/${id}`)}
          />
        </div>
      </div>
    </AppLayout>
  );
};

const Financeiro = () => (
  <FinancialWorkspaceProvider>
    <FinanceiroInner />
  </FinancialWorkspaceProvider>
);

export default Financeiro;
