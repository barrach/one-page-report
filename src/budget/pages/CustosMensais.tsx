import { useNavigate } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { FinancialWorkspaceProvider } from "@budget/hooks/useFinancialWorkspace";
import FinanceiroRealMensal from "@budget/components/financeiro/FinanceiroRealMensal";
import { Calendar, ChevronRight } from "lucide-react";

/**
 * Página separada — Custos Mensais Gerais.
 * Aqui acontece a importação geral. O sistema distribui automaticamente
 * para os contratos certos. Cada hub de contrato vê os lançamentos
 * filtrados na aba "Custos Mensais".
 */
const CustosMensaisInner = () => {
  const navigate = useNavigate();

  return (
    <AppLayout mainClassName="p-0">
      <div className="bg-background">
        {/* Header (fluxo normal — rola junto com o conteúdo) */}
        <div className="border-b bg-background">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-3 space-y-2">
            <nav className="flex items-center gap-1 text-xs text-muted-foreground">
              <button
                className="hover:text-foreground transition-colors"
                onClick={() => navigate("/budget/financeiro")}
              >
                Controladoria
              </button>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="font-semibold text-foreground">Custos Mensais Gerais</span>
            </nav>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Custos Mensais Gerais
                </h1>
                <p className="text-xs lg:text-sm text-muted-foreground mt-1 max-w-2xl">
                  Importação única da planilha mensal. O sistema distribui cada
                  lançamento para o contrato correto e atualiza automaticamente
                  os hubs de cada contrato. Reimportar o mesmo mês substitui
                  os dados anteriores daquela competência.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo (fluxo normal) */}
        <div>
          <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 lg:py-6 pb-12">
            <FinanceiroRealMensal />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const CustosMensais = () => (
  <FinancialWorkspaceProvider>
    <CustosMensaisInner />
  </FinancialWorkspaceProvider>
);

export default CustosMensais;
