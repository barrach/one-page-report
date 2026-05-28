import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type WorkspaceView = "company" | "contract";

export interface FinancialWorkspaceState {
  view: WorkspaceView;
  setView: (view: WorkspaceView) => void;
  /** Contrato operacional selecionado (DRG XXXX.XXX). Apenas válido quando view = contract. */
  contractId: string | null;
  setContractId: (id: string | null) => void;
  /** Entidade da empresa selecionada (Megasteam / Administrativo / GERAL OH). Apenas válido quando view = company. */
  companyEntityId: string | null;
  setCompanyEntityId: (id: string | null) => void;
  /** ISO date YYYY-MM-01 — always a single month (never null on the UI; default = current month) */
  competenceMonth: string;
  setCompetenceMonth: (month: string) => void;
  /** Derived: YYYY-MM (e.g. "2026-04") for legacy APIs that expect this format */
  competenceYm: string;
  /**
   * Quando true, o Dashboard do contrato deve ignorar o filtro de mês e mostrar
   * o **acumulado total** (toda a vida do contrato). Outros módulos continuam
   * usando o mês selecionado normalmente.
   */
  showAllPeriods: boolean;
  setShowAllPeriods: (value: boolean) => void;
}

const STORAGE_KEY = "financeiro:workspace-state:v3";

const FinancialWorkspaceContext = createContext<FinancialWorkspaceState | null>(null);

interface PersistedState {
  view?: WorkspaceView;
  contractId?: string | null;
  companyEntityId?: string | null;
  competenceMonth?: string;
  showAllPeriods?: boolean;
}

const currentMonthIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const loadInitial = (): PersistedState => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
};

export const FinancialWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const initial = useMemo(loadInitial, []);
  const [view, setView] = useState<WorkspaceView>(initial.view ?? "company");
  const [contractId, setContractId] = useState<string | null>(initial.contractId ?? null);
  const [companyEntityId, setCompanyEntityId] = useState<string | null>(initial.companyEntityId ?? null);
  const [competenceMonth, setCompetenceMonth] = useState<string>(
    initial.competenceMonth ?? currentMonthIso(),
  );
  const [showAllPeriods, setShowAllPeriods] = useState<boolean>(
    initial.showAllPeriods ?? false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PersistedState = {
      view, contractId, companyEntityId, competenceMonth, showAllPeriods,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / private mode errors
    }
  }, [view, contractId, companyEntityId, competenceMonth, showAllPeriods]);

  const value = useMemo<FinancialWorkspaceState>(
    () => ({
      view,
      setView,
      contractId,
      setContractId,
      companyEntityId,
      setCompanyEntityId,
      competenceMonth,
      setCompetenceMonth,
      competenceYm: competenceMonth.slice(0, 7),
      showAllPeriods,
      setShowAllPeriods,
    }),
    [view, contractId, companyEntityId, competenceMonth, showAllPeriods],
  );

  return <FinancialWorkspaceContext.Provider value={value}>{children}</FinancialWorkspaceContext.Provider>;
};

export const useFinancialWorkspace = () => {
  const ctx = useContext(FinancialWorkspaceContext);
  if (!ctx) {
    throw new Error("useFinancialWorkspace must be used inside FinancialWorkspaceProvider");
  }
  return ctx;
};
