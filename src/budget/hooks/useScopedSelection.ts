import { useMemo } from "react";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import {
  useFinancialContracts,
  useCompanyEntities,
  type CompanyEntity,
  type FinancialContract,
} from "@budget/hooks/useFinancialContracts";

export type ScopeKind = "company" | "contract";

export interface ScopedSelection {
  /** Escopo atual da tela (Empresa ou Contrato). */
  scope: ScopeKind;
  /** Lista efetiva de project_ids que a tela deve consultar. */
  projectIds: string[];
  /**
   * Quando true, a tela está em escopo Empresa e o objeto selecionado
   * representa um CONSOLIDADO (todas as empresas/contratos somados).
   */
  isConsolidatedCompany: boolean;
  /** Entidade de empresa ativa (se scope = company). */
  activeCompany: CompanyEntity | null;
  /** Contrato operacional ativo (se scope = contract). */
  activeContract: FinancialContract | null;
  /** Rótulo legível do objeto ativo (ex: "Megasteam", "5040.107 · Unipar"). */
  objectLabel: string;
  /** Nada selecionado (ex.: contrato vazio). */
  isEmpty: boolean;
}

/**
 * Resolve, para a tela atual, qual conjunto de project_ids deve ser usado
 * com base no escopo (Empresa/Contrato) e no objeto selecionado.
 *
 * Regras:
 *  - Escopo Contrato → apenas o `contractId`.
 *  - Escopo Empresa + GERAL OH (consolidado) → todos os contratos operacionais
 *    + todas as entidades de empresa (visão consolidada da Megasteam).
 *  - Escopo Empresa + Megasteam → projeto da entidade Megasteam (ADM).
 *  - Escopo Empresa + Administrativo → projeto da entidade Administrativo.
 */
export const useScopedSelection = (): ScopedSelection => {
  const { view, contractId, companyEntityId } = useFinancialWorkspace();
  const { data: contracts } = useFinancialContracts({
    onlyActive: false,
    includeCompanyEntities: true,
  });
  const { data: companyEntities } = useCompanyEntities();

  return useMemo<ScopedSelection>(() => {
    const allContracts = contracts ?? [];
    const allCompany = companyEntities ?? [];

    if (view === "contract") {
      const active = allContracts.find((c) => c.id === contractId && !c.is_company_entity) ?? null;
      return {
        scope: "contract",
        projectIds: active ? [active.id] : [],
        isConsolidatedCompany: false,
        activeCompany: null,
        activeContract: active,
        objectLabel: active
          ? `${active.dept_code ?? "—"} · ${active.project_name}`
          : "Selecione um contrato",
        isEmpty: !active,
      };
    }

    // view === "company"
    const activeCompany =
      allCompany.find((c) => c.id === companyEntityId) ??
      allCompany.find((c) => c.entity_kind === "consolidado") ??
      allCompany[0] ??
      null;

    const isConsolidated = activeCompany?.entity_kind === "consolidado";

    let projectIds: string[];
    if (isConsolidated) {
      // Consolidado da empresa = todos os contratos operacionais + todas as entidades de empresa
      projectIds = allContracts.map((c) => c.id);
    } else if (activeCompany) {
      projectIds = [activeCompany.id];
    } else {
      projectIds = [];
    }

    return {
      scope: "company",
      projectIds,
      isConsolidatedCompany: isConsolidated,
      activeCompany,
      activeContract: null,
      objectLabel: activeCompany
        ? activeCompany.entity_kind === "consolidado"
          ? "GERAL OH (Consolidado)"
          : activeCompany.entity_kind === "megasteam"
            ? "Megasteam"
            : activeCompany.entity_kind === "administrativo"
              ? "Administrativo"
              : (activeCompany.project_name ?? "Empresa")
        : "Selecione uma empresa",
      isEmpty: projectIds.length === 0,
    };
  }, [view, contractId, companyEntityId, contracts, companyEntities]);
};
