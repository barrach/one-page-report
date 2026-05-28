// ============================================================
// Acompanhamento Executivo — Plano Gerencial Megasteam
// ============================================================
// Renderiza EXATAMENTE a estrutura de 51 linhas + agrupadores
// definida em src/lib/planoGerencial.ts. Catálogo é fonte única
// de verdade — linhas legacy do banco são ignoradas aqui.
//
// Comportamento por tipo de linha:
//   • group   → cabeçalho visual (RECEITA, II, III, IV, V, VI, RESULTADO)
//   • input   → editável (1.01 e OS)
//   • cost    → vem do CUSTOS_MES; usuário pode sobrescrever
//   • tax     → calculado on-the-fly: 1.01 × alíquota (read-only)
//   • calc    → fórmulas derivadas (TI, VL, CO, MB, CT, RL, %s) (read-only)
// ============================================================

import { useMemo, useState, useEffect, Fragment, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CircleDot,
  Layers,
  Lock,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@budget/integrations/supabase/client";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL, formatPct } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";

import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Skeleton } from "@budget/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@budget/components/ui/tooltip";
import { EditableCell } from "./EditableCell";
import {
  useContractResults,
  useContractSettings,
  SAUDE_LABEL,
  SAUDE_CLASS,
} from "@budget/hooks/useContractResults";
import { Input } from "@budget/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@budget/components/ui/popover";
import { Settings2, Sparkles } from "lucide-react";
import {
  PLAN_GERENCIAL,
  COST_CODES,
  TAX_CODES,
  EDITABLE_INPUT_CODES,
  EDITABLE_COST_CODES,
  type PgRow,
} from "@budget/lib/planoGerencial";
import { useFixedAssetDepreciation } from "@budget/hooks/useFixedAssetDepreciation";

/** Linhas PG cuja Realizado vem EXCLUSIVAMENTE da aba Imobilizado. */
const IMOB_PG_CODES = new Set([
  "7.51", "7.52", "7.53", "7.54", "7.55", "7.56",
  "7.57", "7.58", "7.59", "7.60", "7.61", "7.62",
  "7.63", "7.64", "7.65", "7.66",
]);

// ============================================================
// Tipos & Constantes
// ============================================================

interface DrgLine {
  id: string;
  competence_month: string;
  line_code: string;
  line_label: string;
  is_percentage: boolean;
  sort_order: number;
  planned_value: number;
  actual_value: number;
}

type LightTone = "neutral" | "green" | "yellow" | "red";

const LIGHT_THRESHOLDS = { green: 5, yellow: 15 } as const;

/**
 * Direção de "bom" para uma linha:
 *   • cost   → realizar MENOS que o previsto é positivo
 *              (linhas 3.xx, PET, OS, TA, CO, CT, TI)
 *   • revenue → realizar MAIS que o previsto é positivo
 *              (1.01, VL, MB, RL — e percentuais MB%/ML%)
 */
type LightDirection = "cost" | "revenue";

/**
 * Calcula o farol e a variação % com sinal padronizado.
 * Para "cost": variation > 0 = pior (gastou mais).
 * Para "revenue": variation > 0 = pior (faturou menos).
 * Verde ≤ 5%, amarelo ≤ 15%, vermelho > 15%.
 * Quando não há previsto: neutral (cinza).
 */
const computeLightWithVariation = (
  planned: number,
  actual: number,
  direction: LightDirection,
): { tone: LightTone; variation: number; hasBaseline: boolean } => {
  const hasBaseline = Math.abs(planned) > 0.005;
  if (!hasBaseline) {
    return { tone: "neutral", variation: 0, hasBaseline: false };
  }
  // variation positivo = desvio DESFAVORÁVEL
  const raw = ((actual - planned) / Math.abs(planned)) * 100;
  const variation = direction === "cost" ? raw : -raw;
  if (variation <= LIGHT_THRESHOLDS.green) return { tone: "green", variation, hasBaseline };
  if (variation <= LIGHT_THRESHOLDS.yellow) return { tone: "yellow", variation, hasBaseline };
  return { tone: "red", variation, hasBaseline };
};

const computeLight = (
  planned: number,
  actual: number,
  direction: LightDirection = "cost",
): LightTone => computeLightWithVariation(planned, actual, direction).tone;

/** Retorna a direção do farol baseado no código da linha PG. */
const getLightDirection = (code: string): LightDirection => {
  // Receita e linhas de resultado: faturar/sobrar mais é melhor
  if (code === "1.01" || code === "VL" || code === "MB" || code === "MB_PCT" ||
      code === "RL" || code === "ML_PCT") {
    return "revenue";
  }
  // Demais (custos, impostos, OS, TA, TI, CO, CT, TAXA_PCT): gastar menos é melhor
  return "cost";
};

const LIGHT_DOT: Record<LightTone, string> = {
  neutral: "text-muted-foreground/40",
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-red-600",
};

const LIGHT_LABEL: Record<LightTone, string> = {
  neutral: "Sem previsto lançado",
  green: "Dentro do esperado",
  yellow: "Atenção",
  red: "Fora do esperado",
};


// ============================================================
// Componente principal
// ============================================================
const ContractBudgetAcomp = () => {
  const { contractId } = useFinancialWorkspace();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Resultados calculados (VL, CO, MB, TA, RL, ML%) e settings (taxa_adm_pct)
  const {
    results: contractResults,
    recompute: recomputeResults,
  } = useContractResults(contractId ?? undefined, selectedYear ?? undefined);
  const { settings: contractSettings, save: saveSettings } = useContractSettings(
    contractId ?? undefined,
  );
  const taxaAdmPct = Number(contractSettings?.taxa_adm_pct ?? 8);

  // Imobilizado — override do Realizado das linhas PG 7.51..7.66
  const { byMonthAndAccount: imobByMonthAndAccount } = useFixedAssetDepreciation({
    projectId: contractId ?? null,
  });
  const [taxaInput, setTaxaInput] = useState<string>("8");
  useEffect(() => {
    setTaxaInput(String(taxaAdmPct));
  }, [taxaAdmPct]);

  // ---- Carrega TODAS as linhas DRG do contrato
  const { data: allLines = [], isLoading } = useQuery({
    queryKey: ["budget-acomp-drg-lines", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<DrgLine[]> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("financial_drg_lines")
        .select(
          "id, competence_month, line_code, line_label, is_percentage, sort_order, planned_value, actual_value",
        )
        .eq("project_id", contractId)
        .order("competence_month", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DrgLine[];
    },
  });

  // ---- Carrega rateios administrativos alocados a este contrato (TA real)
  // Cadeia de cálculo (spec): TA = soma de financial_apportionments para o contrato no mês.
  // Se não houver rateio para um mês, faz fallback para `VL × taxa_adm_pct` (híbrido).
  const { data: apportionmentRows = [] } = useQuery({
    queryKey: ["budget-acomp-apportionments", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<Array<{ competence_month: string; apportioned_value: number }>> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("financial_apportionments")
        .select("competence_month, apportioned_value")
        .eq("target_project_id", contractId);
      if (error) throw error;
      return (data ?? []) as Array<{ competence_month: string; apportioned_value: number }>;
    },
  });

  /** Mapa YYYY-MM → soma absoluta do rateio admin alocado ao contrato. */
  const apportionmentByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of apportionmentRows) {
      const ym = String(r.competence_month).slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + Math.abs(Number(r.apportioned_value || 0)));
    }
    return map;
  }, [apportionmentRows]);

  // ---- Rateio Administrativo COMPUTADO (fallback quando financial_apportionments está vazio)
  // Pool ADM = lançamentos do CUSTOS_MES sem contract_project_id (despesas centralizadas).
  // Base = soma das receitas (revenue_actual) dos contratos que tiveram receita no mês.
  // Absorção do contrato = pool_mes × (receita_contrato_mes / base_mes).
  // Pool ADM = lançamentos sem contrato OU vinculados a projetos administrativos
  // (dept_group='ADMINISTRATIVO', 'CONSOLIDADO', ou is_company_entity=true).
  const { data: adminProjectIds = [] } = useQuery({
    queryKey: ["budget-acomp-admin-project-ids"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, dept_group, is_company_entity")
        .or("dept_group.in.(ADMINISTRATIVO,CONSOLIDADO),is_company_entity.eq.true");
      if (error) throw error;
      return (data ?? []).map((p: { id: string }) => p.id);
    },
  });

  const { data: adminPoolRows = [] } = useQuery({
    queryKey: ["budget-acomp-admin-pool", adminProjectIds],
    enabled: true,
    queryFn: async (): Promise<Array<{ competence_date: string | null; cost_value: number }>> => {
      let q = supabase
        .from("financial_entries")
        .select("competence_date, cost_value, contract_project_id")
        .eq("is_excluded", false)
        .eq("is_duplicate", false);
      // Filtra: contract_project_id IS NULL OR in (admin ids)
      if (adminProjectIds.length > 0) {
        q = q.or(`contract_project_id.is.null,contract_project_id.in.(${adminProjectIds.join(",")})`);
      } else {
        q = q.is("contract_project_id", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ competence_date: string | null; cost_value: number }>;
    },
  });

  const { data: allContractRevRows = [] } = useQuery({
    queryKey: ["budget-acomp-all-contract-revenue"],
    queryFn: async (): Promise<Array<{ project_id: string; competence_month: string; revenue_actual: number }>> => {
      const { data, error } = await supabase
        .from("contract_revenues")
        .select("project_id, competence_month, revenue_actual");
      if (error) throw error;
      return (data ?? []) as Array<{ project_id: string; competence_month: string; revenue_actual: number }>;
    },
  });

  /** Mapa YYYY-MM → absorção computada do rateio admin para ESTE contrato. */
  const computedApportionmentByMonth = useMemo(() => {
    const out = new Map<string, number>();
    if (!contractId) return out;
    const poolByMonth = new Map<string, number>();
    for (const r of adminPoolRows) {
      const ym = String(r.competence_date ?? "").slice(0, 7);
      if (ym.length !== 7) continue;
      poolByMonth.set(ym, (poolByMonth.get(ym) ?? 0) + Number(r.cost_value || 0));
    }
    const baseByMonth = new Map<string, number>();
    const myRevByMonth = new Map<string, number>();
    for (const r of allContractRevRows) {
      const ym = String(r.competence_month).slice(0, 7);
      const v = Number(r.revenue_actual || 0);
      if (v <= 0) continue;
      baseByMonth.set(ym, (baseByMonth.get(ym) ?? 0) + v);
      if (r.project_id === contractId) {
        myRevByMonth.set(ym, (myRevByMonth.get(ym) ?? 0) + v);
      }
    }
    for (const [ym, myRev] of myRevByMonth.entries()) {
      const base = baseByMonth.get(ym) ?? 0;
      const pool = poolByMonth.get(ym) ?? 0;
      if (base <= 0 || pool <= 0) continue;
      out.set(ym, (myRev / base) * pool);
    }
    return out;
  }, [adminPoolRows, allContractRevRows, contractId]);

  // ---- Realizado dos lançamentos do CUSTOS_MES agregado por (pg_line_code, mês)
  // Fonte: financial_entries (importação Custos Mensais Gerais). Esses lançamentos
  // já foram classificados por categoria → pg_line_code e atribuídos ao contrato.
  // financial_drg_lines só tem agregados (CUSTO_PESSOAL, CUSTO_DIRETO, ...) então
  // os "buckets" detalhados (3.01, 3.14, 3.50, 3.77, PET, etc.) precisam vir
  // direto dos lançamentos para que o CO/MB do Acompanhamento não fique zerado.
  const { data: entryAggRows = [] } = useQuery({
    queryKey: ["budget-acomp-entries-by-pg", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<Array<{ pg_line_code: string | null; competence_date: string | null; cost_value: number }>> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("pg_line_code, competence_date, cost_value")
        .eq("contract_project_id", contractId)
        .eq("is_excluded", false)
        .eq("is_duplicate", false);
      if (error) throw error;
      return (data ?? []) as Array<{ pg_line_code: string | null; competence_date: string | null; cost_value: number }>;
    },
  });

  /** Mapa "PG|YYYY-MM" → soma de cost_value (valor positivo, depois é normalizado). */
  const entriesByPgAndMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of entryAggRows) {
      const code = r.pg_line_code;
      if (!code) continue;
      const ym = String(r.competence_date ?? "").slice(0, 7);
      if (!ym || ym.length !== 7) continue;
      const k = `${code}|${ym}`;
      map.set(k, (map.get(k) ?? 0) + Number(r.cost_value || 0));
    }
    return map;
  }, [entryAggRows]);

  // ---- Headcount real por mês (HISTOGRAMA — TOTAL realizado)
  // Vem de payroll_entries (preenchido pela importação DRG da Megasteam).
  // Como o banco não separa MOI/MOD, usamos só o TOTAL aqui.
  const { data: headcountRows = [] } = useQuery({
    queryKey: ["budget-acomp-headcount", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<Array<{ competence_month: string; headcount: number }>> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("competence_month, headcount")
        .eq("contract_project_id", contractId);
      if (error) throw error;
      return (data ?? []) as Array<{ competence_month: string; headcount: number }>;
    },
  });

  // ---- Receita Bruta (linha 1.01) — fonte oficial é contract_revenues
  // (preenchida via BM/Boletim de Medição e/ou importação do DRG individual).
  // financial_drg_lines raramente tem o code "1.01" populado, então usamos
  // contract_revenues como override para garantir que a receita apareça.
  const { data: revenueRows = [] } = useQuery({
    queryKey: ["budget-acomp-revenue", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<Array<{ competence_month: string; revenue_planned: number; revenue_actual: number }>> => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("contract_revenues")
        .select("competence_month, revenue_planned, revenue_actual")
        .eq("project_id", contractId);
      if (error) throw error;
      return (data ?? []) as Array<{ competence_month: string; revenue_planned: number; revenue_actual: number }>;
    },
  });

  /** Mapa YYYY-MM → { planned, actual } da receita bruta (1.01). */
  const revenueByMonthOverride = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();
    for (const r of revenueRows) {
      const ym = String(r.competence_month).slice(0, 7);
      const prev = map.get(ym) ?? { planned: 0, actual: 0 };
      map.set(ym, {
        planned: prev.planned + Number(r.revenue_planned || 0),
        actual: prev.actual + Number(r.revenue_actual || 0),
      });
    }
    return map;
  }, [revenueRows]);

  /** Mapa YYYY-MM → headcount realizado total do contrato. */
  const headcountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of headcountRows) {
      const ym = String(r.competence_month).slice(0, 7);
      // Mantém o maior valor caso haja duplicatas (snapshot por competência).
      map.set(ym, Math.max(map.get(ym) ?? 0, Number(r.headcount || 0)));
    }
    return map;
  }, [headcountRows]);

  const { data: sourceYears = [] } = useQuery({
    queryKey: ["budget-acomp-source-years", contractId],
    enabled: !!contractId,
    queryFn: async (): Promise<number[]> => {
      if (!contractId) return [];

      const [planned, actual] = await Promise.all([
        supabase
          .from("financial_planned_entries")
          .select("competence_month")
          .eq("project_id", contractId),
        supabase
          .from("financial_entries")
          .select("competence_date, issue_date")
          .eq("contract_project_id", contractId)
          .eq("is_excluded", false)
          .eq("is_duplicate", false),
      ]);

      if (planned.error) throw planned.error;
      if (actual.error) throw actual.error;

      const years = new Set<number>();
      for (const row of planned.data ?? []) {
        const y = Number(String(row.competence_month).slice(0, 4));
        if (Number.isFinite(y) && y >= 2000 && y <= 2100) years.add(y);
      }
      for (const row of actual.data ?? []) {
        const date = row.competence_date ?? row.issue_date;
        const y = Number(String(date).slice(0, 4));
        if (Number.isFinite(y) && y >= 2000 && y <= 2100) years.add(y);
      }
      return Array.from(years).sort();
    },
  });

  // ---- Anos disponíveis (extraídos das competências)
  const availableYears = useMemo(() => {
    const set = new Set<number>(sourceYears);
    for (const l of allLines) {
      const y = Number(String(l.competence_month).slice(0, 4));
      // Ignora anos inválidos vindos de importações (ex.: 1905 do epoch do Excel)
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) set.add(y);
    }
    return Array.from(set).sort();
  }, [allLines, sourceYears]);

  // Sincroniza ano selecionado quando os dados chegam
  useEffect(() => {
    if (selectedYear === null && availableYears.length > 0) {
      const currentYear = new Date().getFullYear();
      setSelectedYear(
        availableYears.includes(currentYear) ? currentYear : availableYears[0],
      );
    } else if (selectedYear !== null && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // ---- Indexação dos valores brutos por (line_code, YYYY-MM)
  // Usado para preencher linhas `cost` e `input` (1.01, OS) com os dados que
  // já existem em financial_drg_lines. Linhas `tax` e `calc` são ignoradas
  // aqui — elas são calculadas on-the-fly.
  //
  // FALLBACK: importadores legados (Resumo Resultado, Unipar Baseline) gravam
  // line_code agregados (RECEITA_BRUTA, CUSTO_PESSOAL, CUSTO_DIRETO,
  // CUSTO_INDIRETO, IMPOSTOS, IMP_PIS, IMP_COFINS, IMP_CSLL, IMP_ISS) em vez
  // dos códigos detalhados do Plano Gerencial Megasteam (1.01, 3.xx, 2.0x).
  // Mapeamos esses agregados para os "buckets" de exibição correspondentes
  // para que TI/VL/CO/MB/RL apareçam corretamente, mesmo que os subitens
  // detalhados fiquem em uma única linha agregada.
  // Mapeamento de códigos legados (Resumo Resultado, Unipar Baseline) para os
  // códigos do Plano Gerencial. Importadores legados gravam agregados — este
  // mapa redireciona para o "bucket" correto.
  //
  // IMPORTANTE (spec):
  //   • IMPOSTOS/IMP_TOTAL → TI (linha agrupador). O Previsto de TI vem
  //     DIRETO do Budget — NUNCA é calculado a partir de 2.01..2.06.
  //   • Agrupadores como MARGEM_BRUTA, CUSTO_OPERACIONAL, RESULTADO_LIQUIDO
  //     são IGNORADOS — sempre recalculados pela engine.
  const LEGACY_CODE_MAP: Record<string, string> = {
    RECEITA_BRUTA: "1.01",
    REC_BRUTA: "1.01",
    IMPOSTOS: "TI",
    IMP_TOTAL: "TI",
    IMP_PIS: "2.01",
    IMP_COFINS: "2.02",
    IMP_CSLL: "2.03",
    IMP_ISS: "2.06",
    CUSTO_PESSOAL: "3.01",
    CUSTO_DIRETO: "3.72",
    CUSTO_INDIRETO: "3.50",
    TAXA_ADM: "TA",
  };

  /** Agrupadores legados ignorados (recalculados pela engine). */
  const LEGACY_IGNORE = new Set([
    "RECEITA_LIQUIDA", "REC_LIQUIDA",
    "MARGEM_BRUTA", "MARG_BRUTA",
    "CUSTO_OPERACIONAL",
    "CUSTO_TOTAL",
    "RESULTADO_LIQUIDO", "RES_LIQUIDO", "RES_FINAL",
    "MARG_LIQUIDA", "MARG_FINAL",
    "PCT_IMPOSTOS", "PCT_MARGEM_BRUTA", "PCT_MARGEM_LIQUIDA", "PCT_TAXA_SEDE",
    "DESP_ADM", "DESP_FIN",
    "IMP_IRPJ",
  ]);

  const valuesByKey = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();
    // DEDUPLICAÇÃO: quando múltiplos line_codes legados mapeiam para o mesmo
    // código PG no mesmo mês (ex.: REC_BRUTA + RECEITA_BRUTA → 1.01), pegamos
    // o MAIOR valor absoluto, não a soma. Isso evita duplicação quando a
    // planilha foi importada por duas rotas (template_unipar + imported_resumo).
    const pickMax = (a: number, b: number) =>
      Math.abs(a) >= Math.abs(b) ? a : b;
    const upsert = (code: string, ym: string, planned: number, actual: number) => {
      const k = `${code}|${ym}`;
      const prev = map.get(k);
      if (!prev) {
        map.set(k, { planned, actual });
        return;
      }
      map.set(k, {
        planned: pickMax(prev.planned, planned),
        actual: pickMax(prev.actual, actual),
      });
    };
    for (const l of allLines) {
      if (LEGACY_IGNORE.has(l.line_code)) continue;
      const ym = String(l.competence_month).slice(0, 7);
      const planned = Number(l.planned_value || 0);
      const actual = Number(l.actual_value || 0);
      const mapped = LEGACY_CODE_MAP[l.line_code];
      const finalCode = mapped ?? l.line_code;
      upsert(finalCode, ym, planned, actual);
    }
    return map;
  }, [allLines]);


  // ---- Meses do ano selecionado (sempre 12, mesmo sem dado)
  const yearMonths = useMemo(() => {
    if (selectedYear === null) return [] as { ym: string; label: string }[];
    const arr: { ym: string; label: string }[] = [];
    const monthLabels = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    for (let m = 0; m < 12; m++) {
      const ym = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
      arr.push({ ym, label: monthLabels[m] });
    }
    return arr;
  }, [selectedYear]);

  // ---- Alíquotas (em %) — fonte: contract_settings
  const taxRates = useMemo(
    () => ({
      pis_pct: Number(contractSettings?.pis_pct ?? 0),
      cofins_pct: Number(contractSettings?.cofins_pct ?? 0),
      csll_pct: Number(contractSettings?.csll_pct ?? 0),
      inss_fat_pct: Number(contractSettings?.inss_fat_pct ?? 0),
      icms_pct: Number((contractSettings as { icms_pct?: number } | null)?.icms_pct ?? 0),
      iss_pct: Number(contractSettings?.iss_pct ?? 0),
    }),
    [contractSettings],
  );

  // ---- Construção das linhas de exibição
  // Para cada item do PLAN_GERENCIAL, calcula valores por mês conforme o tipo:
  //   • input/cost → lê de valuesByKey (ou 0)
  //   • tax        → calcula como 1.01 (mesmo mês) × alíquota
  //   • calc       → aplica fórmula (TI, VL, CO, MB, CT, RL, %s)
  //   • group      → linha visual sem valores
  type MonthCell = {
    ym: string;
    planned: number;
    actual: number;
    diff: number;
    light: LightTone;
    variation: number;
    hasBaseline: boolean;
  };
  type RenderRow = {
    code: string;
    label: string;
    kind: PgRow["kind"];
    isPercentage: boolean;
    isCount: boolean;
    formula?: PgRow["formula"];
    monthly: MonthCell[];
    totalPlanned: number;
    totalActual: number;
    totalDiff: number;
    totalLight: LightTone;
    totalVariation: number;
    totalHasBaseline: boolean;
  };

  const renderRows = useMemo<RenderRow[]>(() => {
    if (yearMonths.length === 0) return [];

    // ============================================================
    // CONVENÇÃO DE SINAL (spec):
    //   • Receita (1.01)        → POSITIVA
    //   • Impostos (TI, 2.xx)   → NEGATIVOS
    //   • Custos (3.xx, PET, 7.04) → NEGATIVOS
    //   • OS (Outras Saídas)    → NEGATIVO
    //   • TA (Absorção)         → NEGATIVA
    //   • CSLL 6.02             → NEGATIVA
    //   • CUSTO_FILIAL          → NEGATIVO
    //
    // Cadeia de cálculo (spec):
    //   VL  = 1.01 + TI                       (TI já negativo)
    //   CO  = II + III + IV + V + VI          (todos negativos)
    //   MB  = VL + CO
    //   CT  = CO + OS + TA
    //   CM2 = MB + OS + TA − CSLL
    //   CM4 = CM2 − CUSTO_FILIAL
    //
    // Diferença = Realizado − Previsto (em todas as linhas).
    // ============================================================

    /** Normaliza um valor de custo para SEMPRE ser ≤ 0 no display. */
    const negCost = (v: number) => -Math.abs(v);
    /** Normaliza receita para SEMPRE ser ≥ 0 no display. */
    const posRev = (v: number) => Math.abs(v);

    const taxByMonth = new Map<string, { planned: number; actual: number }>();
    const costByMonth = new Map<string, { planned: number; actual: number }>();
    const revenueByMonth = new Map<string, { planned: number; actual: number }>();
    const osByMonth = new Map<string, { planned: number; actual: number }>();

    // Pré-calcula receita (1.01) e OS por mês — necessário antes dos taxes.
    for (const m of yearMonths) {
      const rev = valuesByKey.get(`1.01|${m.ym}`) ?? { planned: 0, actual: 0 };
      // Override: contract_revenues é a fonte oficial da Receita Bruta (BM).
      const ov = revenueByMonthOverride.get(m.ym);
      const finalPlanned = ov && ov.planned !== 0 ? ov.planned : rev.planned;
      const finalActual = ov && ov.actual !== 0 ? ov.actual : rev.actual;
      revenueByMonth.set(m.ym, {
        planned: posRev(finalPlanned),
        actual: posRev(finalActual),
      });
      const os = valuesByKey.get(`OS|${m.ym}`) ?? { planned: 0, actual: 0 };
      osByMonth.set(m.ym, {
        planned: negCost(os.planned),
        actual: negCost(os.actual),
      });
    }

    /** TI Previsto importado direto do Budget (preferência sobre soma 2.01..2.06). */
    const tiImportedPlannedByMonth = new Map<string, number>();
    for (const m of yearMonths) {
      const ti = valuesByKey.get(`TI|${m.ym}`);
      if (ti && (ti.planned !== 0 || ti.actual !== 0)) {
        tiImportedPlannedByMonth.set(m.ym, negCost(ti.planned));
      }
    }

    /**
     * FALLBACK Custo Operacional Agregado:
     * Quando a planilha foi importada apenas como agregado (CUSTO_OPERACIONAL,
     * sem detalhar 3.01..3.82), usamos esse total para alimentar CO/MB/CT/CM2.
     * Lemos do dataset original (allLines) porque o LEGACY_IGNORE remove esses
     * códigos de valuesByKey.
     */
    const coAggregateByMonth = new Map<string, { planned: number; actual: number }>();
    for (const l of allLines) {
      if (l.line_code !== "CUSTO_OPERACIONAL") continue;
      const ym = String(l.competence_month).slice(0, 7);
      const prev = coAggregateByMonth.get(ym) ?? { planned: 0, actual: 0 };
      coAggregateByMonth.set(ym, {
        planned: prev.planned + Number(l.planned_value || 0),
        actual: prev.actual + Number(l.actual_value || 0),
      });
    }

    const calcTax = (rate: number, ym: string) => {
      const rev = revenueByMonth.get(ym) ?? { planned: 0, actual: 0 };
      const f = rate / 100;
      // Impostos sempre negativos (saída do caixa).
      return { planned: -(rev.planned * f), actual: -(rev.actual * f) };
    };

    // ---- 1ª passada: linhas folha (input, cost, tax)
    const petPct = Number(contractSettings?.pet_pct ?? 80.06);
    const petFactor = petPct / 100;

    const monthsByCode = new Map<string, MonthCell[]>();
    for (const row of PLAN_GERENCIAL) {
      if (row.kind === "group" || row.kind === "calc") continue;

      const direction = getLightDirection(row.code);
      const monthly: MonthCell[] = yearMonths.map(({ ym }) => {
        let planned = 0;
        let actual = 0;

        if (row.kind === "input") {
          // 1.01 (receita): SEMPRE positivo. OS/CUSTO_FILIAL: SEMPRE negativos.
          const v = valuesByKey.get(`${row.code}|${ym}`) ?? { planned: 0, actual: 0 };
          if (row.code === "1.01") {
            // Override de Receita Bruta: contract_revenues (BM) tem prioridade.
            const ov = revenueByMonthOverride.get(ym);
            const p = ov && ov.planned !== 0 ? ov.planned : v.planned;
            const a = ov && ov.actual !== 0 ? ov.actual : v.actual;
            planned = posRev(p);
            actual = posRev(a);
          } else {
            planned = negCost(v.planned);
            actual = negCost(v.actual);
          }
        } else if (row.kind === "cost") {
          if (row.code === "PET") {
            // PET: prioriza CUSTOS_MES (4102); senão 3.01 × pet_pct.
            const stored = valuesByKey.get(`PET|${ym}`);
            const sal = valuesByKey.get(`3.01|${ym}`) ?? { planned: 0, actual: 0 };
            const fallbackPlanned = Math.abs(sal.planned) * petFactor;
            const fallbackActual = Math.abs(sal.actual) * petFactor;
            planned = negCost(
              stored && stored.planned !== 0 ? stored.planned : fallbackPlanned,
            );
            actual = negCost(
              stored && stored.actual !== 0 ? stored.actual : fallbackActual,
            );
          } else {
            const v = valuesByKey.get(`${row.code}|${ym}`) ?? { planned: 0, actual: 0 };
            // costSign === -1 (apenas 7.04): inverte para POSITIVO (reembolso).
            const sign = row.costSign ?? 1;
            planned = sign === -1 ? Math.abs(v.planned) : negCost(v.planned);
            actual = sign === -1 ? Math.abs(v.actual) : negCost(v.actual);
            // Override do Realizado a partir dos lançamentos do CUSTOS_MES
            // (financial_entries com pg_line_code). Substitui o que veio de
            // financial_drg_lines, exceto nas linhas 7.51..7.66 (Imobilizado),
            // que têm fonte própria abaixo.
            if (!IMOB_PG_CODES.has(row.code)) {
              const fromEntries = entriesByPgAndMonth.get(`${row.code}|${ym}`);
              if (fromEntries !== undefined && fromEntries !== 0) {
                actual = sign === -1 ? Math.abs(fromEntries) : negCost(fromEntries);
              }
            }
            // Override: linhas 7.51..7.66 vêm da aba Imobilizado.
            if (IMOB_PG_CODES.has(row.code)) {
              const imob = imobByMonthAndAccount.get(`${ym}|${row.code}`) ?? 0;
              actual = negCost(imob);
            }
          }
          const acc = costByMonth.get(ym) ?? { planned: 0, actual: 0 };
          costByMonth.set(ym, {
            planned: acc.planned + planned,
            actual: acc.actual + actual,
          });
        } else if (row.kind === "tax") {
          // 2.01..2.06: 1.01 × alíquota, sempre NEGATIVO.
          const rate = row.taxRate ? taxRates[row.taxRate] : 0;
          const v = calcTax(rate, ym);
          planned = v.planned;
          actual = v.actual;
          const acc = taxByMonth.get(ym) ?? { planned: 0, actual: 0 };
          taxByMonth.set(ym, {
            planned: acc.planned + planned,
            actual: acc.actual + actual,
          });
        }

        const lt = computeLightWithVariation(planned, actual, direction);
        return {
          ym,
          planned,
          actual,
          diff: actual - planned,
          light: lt.tone,
          variation: lt.variation,
          hasBaseline: lt.hasBaseline,
        };
      });
      monthsByCode.set(row.code, monthly);
    }

    // ---- 2ª passada: linhas calculadas
    const calcMonthly = (
      formula: NonNullable<PgRow["formula"]>,
      code: string,
    ): MonthCell[] => {
      const direction = getLightDirection(code);
      return yearMonths.map(({ ym }) => {
        const rev = revenueByMonth.get(ym) ?? { planned: 0, actual: 0 };
        const taxCalc = taxByMonth.get(ym) ?? { planned: 0, actual: 0 };
        const costRaw = costByMonth.get(ym) ?? { planned: 0, actual: 0 };
        // Fallback agregado: se não há detalhes 3.xx, usa CUSTO_OPERACIONAL.
        const coAgg = coAggregateByMonth.get(ym);
        const cost = {
          planned: costRaw.planned !== 0 ? costRaw.planned : (coAgg ? -Math.abs(coAgg.planned) : 0),
          actual: costRaw.actual !== 0 ? costRaw.actual : (coAgg ? -Math.abs(coAgg.actual) : 0),
        };
        const os = osByMonth.get(ym) ?? { planned: 0, actual: 0 };

        // ───── TI: Previsto = importado direto; Realizado = soma 2.01..2.06 ─────
        const tiImportedPlan = tiImportedPlannedByMonth.get(ym);
        const tiPlan = tiImportedPlan !== undefined ? tiImportedPlan : taxCalc.planned;
        const tiAct = taxCalc.actual;

        // ───── VL = 1.01 + TI (TI já negativo) ─────
        const vlPlan = rev.planned + tiPlan;
        const vlAct = rev.actual + tiAct;

        // ───── TA: ordem de precedência ─────
        // 1) rateio real (financial_apportionments)
        // 2) TA importado da DRG (TAXA_ADM via LEGACY_CODE_MAP)
        // 3) rateio computado on-the-fly (pool ADM × participação na receita)
        // 4) fallback VL × taxa_adm_pct
        const realApportionment = apportionmentByMonth.get(ym) ?? 0;
        const computedApp = computedApportionmentByMonth.get(ym) ?? 0;
        const taImported = valuesByKey.get(`TA|${ym}`);
        const taImpPlan = taImported?.planned ?? 0;
        const taImpAct = taImported?.actual ?? 0;
        const pickTa = (imp: number, vl: number) => {
          if (realApportionment !== 0) return -Math.abs(realApportionment);
          if (imp !== 0) return -Math.abs(imp);
          if (computedApp !== 0) return -Math.abs(computedApp);
          return -Math.abs(vl * (taxaAdmPct / 100));
        };
        const taPlan = pickTa(taImpPlan, vlPlan);
        const taAct = pickTa(taImpAct, vlAct);

        // ───── MB = VL + CO (CO já negativo) ─────
        const mbPlan = vlPlan + cost.planned;
        const mbAct = vlAct + cost.actual;

        // ───── CM2 (preliminar, sem CSLL) — usado para decidir se há CSLL ─────
        const cm2PrePlan = mbPlan + os.planned + taPlan;
        const cm2PreAct = mbAct + os.actual + taAct;

        // ───── CSLL 6.02: só calcula quando CM2 > 0 (lucro tributável) ─────
        // Alíquota efetiva (CSLL+IRPJ) — usa csll_pct das settings.
        const csllRate = (taxRates.csll_pct ?? 0) / 100;
        const csll602Plan = cm2PrePlan > 0 ? -Math.abs(cm2PrePlan * csllRate) : 0;
        const csll602Act = cm2PreAct > 0 ? -Math.abs(cm2PreAct * csllRate) : 0;

        // ───── CM2 final = MB + OS + TA − CSLL (todos com seus sinais) ─────
        const rlPlanCalc = cm2PrePlan + csll602Plan;
        const rlActCalc = cm2PreAct + csll602Act;

        // ───── CM4 = CM2 − CUSTO_FILIAL ─────
        const filialRaw = valuesByKey.get(`CUSTO_FILIAL|${ym}`) ?? { planned: 0, actual: 0 };
        const filialPlan = -Math.abs(filialRaw.planned);
        const filialAct = -Math.abs(filialRaw.actual);
        const cm4Plan = rlPlanCalc + filialPlan;
        const cm4Act = rlActCalc + filialAct;

        let planned = 0;
        let actual = 0;
        switch (formula) {
          case "TI": planned = tiPlan; actual = tiAct; break;
          case "VL": planned = vlPlan; actual = vlAct; break;
          case "CO": planned = cost.planned; actual = cost.actual; break;
          case "MB": planned = mbPlan; actual = mbAct; break;
          case "MB_PCT":
            // Divisão por zero em VL → exibe "—" (NaN).
            planned = vlPlan !== 0 ? (mbPlan / vlPlan) * 100 : NaN;
            actual = vlAct !== 0 ? (mbAct / vlAct) * 100 : NaN;
            break;
          case "TA": planned = taPlan; actual = taAct; break;
          case "TAXA_PCT": planned = taxaAdmPct; actual = taxaAdmPct; break;
          case "CT":
            // CT = CO + OS + TA (todos negativos)
            planned = cost.planned + os.planned + taPlan;
            actual = cost.actual + os.actual + taAct;
            break;
          case "CSLL_602":
            planned = csll602Plan;
            actual = csll602Act;
            break;
          case "RL":
            planned = rlPlanCalc;
            actual = rlActCalc;
            break;
          case "ML_PCT":
            planned = vlPlan !== 0 ? (rlPlanCalc / vlPlan) * 100 : NaN;
            actual = vlAct !== 0 ? (rlActCalc / vlAct) * 100 : NaN;
            break;
          case "CM4":
            planned = cm4Plan;
            actual = cm4Act;
            break;
          case "ML_FILIAL_PCT":
            planned = vlPlan !== 0 ? (cm4Plan / vlPlan) * 100 : NaN;
            actual = vlAct !== 0 ? (cm4Act / vlAct) * 100 : NaN;
            break;
          case "IMP_REAL_PCT":
            planned = rev.planned !== 0 ? (Math.abs(tiPlan) / rev.planned) * 100 : NaN;
            actual = rev.actual !== 0 ? (Math.abs(tiAct) / rev.actual) * 100 : NaN;
            break;
          case "TAXA_SEDE_PCT":
            planned = vlPlan !== 0 ? (Math.abs(taPlan) / vlPlan) * 100 : NaN;
            actual = vlAct !== 0 ? (Math.abs(taAct) / vlAct) * 100 : NaN;
            break;
          case "TAXA_FILIAL_PCT":
            planned = vlPlan !== 0 ? (Math.abs(filialPlan) / vlPlan) * 100 : NaN;
            actual = vlAct !== 0 ? (Math.abs(filialAct) / vlAct) * 100 : NaN;
            break;
          case "ENC_MOI_PCT":
          case "ENC_MOD_PCT":
            // Encargos MOI/MOD: dataset de pessoal não estruturado por tipo.
            planned = 0;
            actual = 0;
            break;
          case "MOI_QTY":
          case "MOD_QTY":
            // MOI/MOD individuais: split não disponível no dataset atual.
            // Mantemos 0 — o TOTAL traz o headcount real do contrato no mês.
            planned = 0;
            actual = 0;
            break;
          case "MOI_MOD_TOTAL": {
            // TOTAL realizado = headcount do mês (payroll_entries snapshot).
            // Previsto = ainda não estruturado no Budget atual → 0.
            const hc = headcountByMonth.get(ym) ?? 0;
            planned = 0;
            actual = hc;
            break;
          }
        }

        // Quando planned/actual é NaN (divisão por zero em VL), neutraliza
        // farol e diff para que o renderizador exiba "—" sem comparações.
        const isNaNCell = !Number.isFinite(planned) || !Number.isFinite(actual);
        const lt = isNaNCell
          ? { tone: "neutral" as LightTone, variation: 0, hasBaseline: false }
          : computeLightWithVariation(planned, actual, direction);
        return {
          ym,
          planned,
          actual,
          diff: isNaNCell ? NaN : actual - planned,
          light: lt.tone,
          variation: lt.variation,
          hasBaseline: lt.hasBaseline,
        };
      });
    };

    // ---- Monta a lista final
    const out: RenderRow[] = [];
    for (const row of PLAN_GERENCIAL) {
      if (row.kind === "group") {
        out.push({
          code: row.code,
          label: row.label,
          kind: "group",
          isPercentage: false,
          isCount: false,
          monthly: [],
          totalPlanned: 0,
          totalActual: 0,
          totalDiff: 0,
          totalLight: "neutral",
          totalVariation: 0,
          totalHasBaseline: false,
        });
        continue;
      }

      const monthly =
        row.kind === "calc"
          ? calcMonthly(row.formula!, row.code)
          : monthsByCode.get(row.code) ?? [];

      let totalPlanned: number;
      let totalActual: number;
      if (row.isPercentage) {
        // Média ponderada por |VL| (mesmo mês). Ignora células NaN
        // (divisão por zero — mês sem receita).
        let np = 0, na = 0, dp = 0, da = 0;
        for (const c of monthly) {
          const rev = revenueByMonth.get(c.ym) ?? { planned: 0, actual: 0 };
          const tax = taxByMonth.get(c.ym) ?? { planned: 0, actual: 0 };
          const wp = Math.abs(rev.planned - tax.planned);
          const wa = Math.abs(rev.actual - tax.actual);
          if (Number.isFinite(c.planned)) { np += c.planned * wp; dp += wp; }
          if (Number.isFinite(c.actual)) { na += c.actual * wa; da += wa; }
        }
        totalPlanned = dp > 0 ? np / dp : NaN;
        totalActual = da > 0 ? na / da : NaN;
      } else if (row.isCount) {
        // HISTOGRAMA: total horizontal = último mês com dado (snapshot).
        // Somar headcount mensal não tem semântica.
        const last = [...monthly].reverse().find((m) => m.actual > 0 || m.planned > 0);
        totalPlanned = last?.planned ?? 0;
        totalActual = last?.actual ?? 0;
      } else {
        totalPlanned = monthly.reduce((s, m) => s + m.planned, 0);
        totalActual = monthly.reduce((s, m) => s + m.actual, 0);
      }

      const totalLt = computeLightWithVariation(
        totalPlanned,
        totalActual,
        getLightDirection(row.code),
      );
      out.push({
        code: row.code,
        label: row.label,
        kind: row.kind,
        isPercentage: !!row.isPercentage,
        isCount: !!row.isCount,
        formula: row.formula,
        monthly,
        totalPlanned,
        totalActual,
        totalDiff: totalActual - totalPlanned,
        totalLight: totalLt.tone,
        totalVariation: totalLt.variation,
        totalHasBaseline: totalLt.hasBaseline,
      });
    }
    return out;
  }, [yearMonths, valuesByKey, taxRates, taxaAdmPct, apportionmentByMonth, computedApportionmentByMonth, revenueByMonthOverride, headcountByMonth, contractSettings?.pet_pct, imobByMonthAndAccount, entriesByPgAndMonth, allLines]);

  // ---- KPIs do ano: Receita Bruta = linha 1.01
  // Regras (spec):
  //  • Previsto (ANO)        = soma do Budget para todos os 12 meses
  //  • Realizado (ANO)       = soma APENAS dos meses com receita lançada
  //  • Desvio / Variação     = comparam realizado vs previsto APENAS dos
  //                            meses que têm realizado (comparáveis).
  //  • Quando não há nenhum mês comparável (contrato sem receita lançada
  //    no ano), Desvio e Variação retornam null → exibidos como "—".
  const yearTotals = useMemo(() => {
    const revenueRow = renderRows.find((r) => r.code === "1.01");
    if (!revenueRow) {
      return {
        planned: 0,
        actual: 0,
        diff: null as number | null,
        plannedComparable: 0,
        variation: null as number | null,
        monthsWithActual: 0,
      };
    }
    const planned = revenueRow.totalPlanned; // ano inteiro
    let actual = 0;
    let plannedComparable = 0;
    let monthsWithActual = 0;
    for (const m of revenueRow.monthly) {
      if (Math.abs(m.actual) > 0.005) {
        actual += m.actual;
        plannedComparable += m.planned;
        monthsWithActual += 1;
      }
    }
    const hasComparable = monthsWithActual > 0;
    const diff = hasComparable ? actual - plannedComparable : null;
    const variation =
      hasComparable && Math.abs(plannedComparable) > 0.005
        ? ((actual - plannedComparable) / Math.abs(plannedComparable)) * 100
        : null;
    return { planned, actual, diff, plannedComparable, variation, monthsWithActual };
  }, [renderRows]);


  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- Salvar edição inline (Previsto/Realizado) numa célula
  // Faz upsert em financial_drg_lines pela chave (project_id, line_code, competence_month)
  const saveCell = useCallback(
    async (params: {
      lineCode: string;
      lineLabel: string;
      isPercentage: boolean;
      sortOrder?: number;
      ym: string; // "YYYY-MM"
      field: "planned_value" | "actual_value";
      value: number;
    }) => {
      if (!contractId) return;
      const competence = `${params.ym}-01`;
      const sortOrder =
        params.sortOrder ??
        Math.max(0, PLAN_GERENCIAL.findIndex((r) => r.code === params.lineCode));
      const existing = allLines.find(
        (l) =>
          l.line_code === params.lineCode &&
          String(l.competence_month).slice(0, 7) === params.ym,
      );

      try {
        if (existing) {
          const patch =
            params.field === "planned_value"
              ? { planned_value: params.value, planned_manual_override: true }
              : { actual_value: params.value, actual_manual_override: true };
          const { error } = await supabase
            .from("financial_drg_lines")
            .update(patch)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData.user?.id;
          if (!uid) throw new Error("Sessão expirada — faça login novamente.");
          const { error } = await supabase.from("financial_drg_lines").insert({
            project_id: contractId,
            user_id: uid,
            competence_month: competence,
            line_code: params.lineCode,
            line_label: params.lineLabel,
            is_percentage: params.isPercentage,
            sort_order: sortOrder,
            planned_value: params.field === "planned_value" ? params.value : 0,
            actual_value: params.field === "actual_value" ? params.value : 0,
            planned_manual_override: params.field === "planned_value",
            actual_manual_override: params.field === "actual_value",
          });
          if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: ["budget-acomp-drg-lines", contractId] });
      } catch (err: any) {
        toast.error("Erro ao salvar célula", {
          description: err?.message ?? "Não foi possível salvar a alteração.",
        });
      }
    },
    [contractId, allLines, queryClient],
  );

  // ---- Sincronizar ano: puxa Previsto do Budget e Realizado do CUSTOS_MES
  const [isSyncing, setIsSyncing] = useState(false);
  const handleSync = useCallback(async () => {
    if (!contractId || selectedYear === null) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.rpc("manual_sync_budget_acomp", {
        _project_id: contractId,
        _year: selectedYear,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast.success("Budget_Acomp sincronizada", {
        description: `${row?.months_synced ?? 0} mês(es) · ${row?.lines_planned ?? 0} previstos · ${row?.lines_actual ?? 0} realizados atualizados.`,
      });
      queryClient.invalidateQueries({ queryKey: ["budget-acomp-drg-lines", contractId] });
      // Recalcula as linhas-resultado (VL/CO/MB/TA/RL/ML%) automaticamente
      await recomputeResults.mutateAsync({ year: selectedYear });
    } catch (err: any) {
      toast.error("Erro ao sincronizar", { description: err?.message });
    } finally {
      setIsSyncing(false);
    }
  }, [contractId, selectedYear, queryClient]);

  // ---- Reverter ano para automático: zera os flags de override
  const handleResetOverrides = useCallback(async () => {
    if (!contractId || selectedYear === null) return;
    if (!window.confirm(`Reverter TODAS as células de ${selectedYear} para o cálculo automático? Edições manuais serão perdidas.`)) return;
    setIsSyncing(true);
    try {
      const start = `${selectedYear}-01-01`;
      const end = `${selectedYear}-12-31`;
      const { error } = await supabase
        .from("financial_drg_lines")
        .update({ planned_manual_override: false, actual_manual_override: false })
        .eq("project_id", contractId)
        .gte("competence_month", start)
        .lte("competence_month", end);
      if (error) throw error;
      // Resincroniza imediatamente
      await supabase.rpc("manual_sync_budget_acomp", {
        _project_id: contractId,
        _year: selectedYear,
      });
      toast.success("Overrides removidos e dados resincronizados.");
      queryClient.invalidateQueries({ queryKey: ["budget-acomp-drg-lines", contractId] });
    } catch (err: any) {
      toast.error("Erro ao reverter", { description: err?.message });
    } finally {
      setIsSyncing(false);
    }
  }, [contractId, selectedYear, queryClient]);


  // ====== Empty / Loading ======
  if (!contractId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Selecione um contrato para acompanhar o Budget_Acomp.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (allLines.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhuma linha DRG carregada para este contrato.
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Importe o Budget na aba <strong>Budget</strong> ou use a importação
            consolidada na aba <strong>Medição (BM)</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============= Cabeçalho ============= */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Acompanhamento Executivo
          </h2>
          <p className="text-xs text-muted-foreground">
            Espelho mensal por linha DRG: Previsto vs Realizado, com diferença e farol automático.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Ano</span>
          <Select
            value={selectedYear?.toString() ?? ""}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y.toString()} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={handleSync}
            disabled={isSyncing || selectedYear === null}
            title="Puxa o Previsto do Budget e o Realizado dos lançamentos (CUSTOS_MES) para o ano selecionado. Células editadas manualmente são preservadas."
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            Sincronizar ano
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 text-muted-foreground"
            onClick={handleResetOverrides}
            disabled={isSyncing || selectedYear === null}
            title="Remove TODAS as edições manuais do ano e recalcula a partir das fontes (Budget + CUSTOS_MES)."
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reverter para automático
          </Button>

          {/* Configurações: Taxa Administrativa */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                title="Configurar Taxa Administrativa do contrato (impacta os cálculos automáticos de TA, RL e ML%)"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Config. ({taxaAdmPct.toFixed(1)}%)
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" align="end">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Configurações do contrato</h4>
                <p className="text-[11px] text-muted-foreground">
                  Esses parâmetros alimentam os cálculos automáticos das linhas-resultado
                  (TA, RL, ML%) na grade abaixo.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Taxa Administrativa (%)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxaInput}
                    onChange={(e) => setTaxaInput(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const v = Number(taxaInput);
                      if (!Number.isFinite(v) || v < 0 || v > 100) {
                        toast.error("Informe um percentual entre 0 e 100.");
                        return;
                      }
                      saveSettings.mutate({ taxa_adm_pct: v });
                    }}
                    disabled={saveSettings.isPending}
                  >
                    Salvar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Padrão: 8%. Aplicado sobre a Receita Líquida (VL).
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ============= KPIs anuais ============= */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Previsto (ano)" value={formatBRL(yearTotals.planned)} tone="blue" />
        <KpiTile
          label="Realizado (ano)"
          value={formatBRL(yearTotals.actual)}
          hint={
            yearTotals.monthsWithActual > 0
              ? `${yearTotals.monthsWithActual} ${yearTotals.monthsWithActual === 1 ? "mês lançado" : "meses lançados"}`
              : "Nenhum mês lançado"
          }
          tone="indigo"
        />
        <KpiTile
          label="Desvio (ano)"
          value={
            yearTotals.diff === null
              ? "—"
              : `${yearTotals.diff >= 0 ? "+" : ""}${formatBRL(yearTotals.diff)}`
          }
          tone={
            yearTotals.diff === null
              ? "slate"
              : yearTotals.diff >= 0
              ? "emerald"
              : "red"
          }
          icon={
            yearTotals.diff === null
              ? undefined
              : yearTotals.diff >= 0
              ? TrendingUp
              : TrendingDown
          }
        />
        <KpiTile
          label="Variação"
          value={
            yearTotals.variation === null
              ? "—"
              : `${yearTotals.variation >= 0 ? "+" : ""}${formatPct(yearTotals.variation, 1)}`
          }
          tone={
            yearTotals.variation === null
              ? "slate"
              : yearTotals.variation >= 0
              ? "emerald"
              : "red"
          }
        />
      </section>

      {/* ============= Tabela ============= */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold">
              Linhas DRG · {selectedYear ?? "—"}
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-emerald-600" /> ≤ {LIGHT_THRESHOLDS.green}%
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-amber-600" /> ≤ {LIGHT_THRESHOLDS.yellow}%
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="h-2.5 w-2.5 text-red-600" /> &gt; {LIGHT_THRESHOLDS.yellow}%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <BudgetAcompTable
            yearMonths={yearMonths}
            renderRows={renderRows}
            onSaveCell={saveCell}
          />
        </CardContent>
      </Card>

      {/* ============= Resultados calculados (read-only) ============= */}
      <ResultsSummaryCard
        yearMonths={yearMonths}
        results={contractResults}
        taxaAdmPct={taxaAdmPct}
        onRecompute={() => recomputeResults.mutate({ year: selectedYear ?? undefined })}
        isRecomputing={recomputeResults.isPending}
      />
    </div>
  );
};

// ============================================================
// Resultados calculados (VL, CO, MB, TA, RL, ML%) — read-only
// Linhas espelhadas em colunas: Previsto / Realizado / Diferença por mês
// + Total do ano. Persistidos em contract_results.
// ============================================================
interface ResultsSummaryProps {
  yearMonths: { ym: string; label: string }[];
  results: import("@budget/hooks/useContractResults").ContractResultRow[];
  taxaAdmPct: number;
  onRecompute: () => void;
  isRecomputing: boolean;
}

const RESULT_LINES = [
  { key: "vl", label: "VL · Receita Líquida", isPct: false, costish: false },
  { key: "co", label: "CO · Custo Operacional", isPct: false, costish: true },
  { key: "mb", label: "MB · Margem Bruta", isPct: false, costish: false },
  { key: "ta", label: "TA · Taxa Administrativa", isPct: false, costish: true },
  { key: "rl", label: "RL · Resultado Líquido", isPct: false, costish: false },
  { key: "ml", label: "ML% · Margem Líquida", isPct: true, costish: false },
] as const;

const ResultsSummaryCard = ({
  yearMonths,
  results,
  taxaAdmPct,
  onRecompute,
  isRecomputing,
}: ResultsSummaryProps) => {
  // Indexa por YYYY-MM
  const byMonth = useMemo(() => {
    const m = new Map<string, ResultsSummaryProps["results"][number]>();
    for (const r of results) {
      m.set(String(r.competence_month).slice(0, 7), r);
    }
    return m;
  }, [results]);

  const fmt = (v: number, isPct: boolean) =>
    isPct ? `${v.toFixed(1)}%` : v === 0 ? "—" : formatBRL(v);

  // Para diferença, "favorável" depende do tipo da linha:
  //   - linhas de custo (CO, TA): diff < 0 é melhor (gastou menos) → verde
  //   - demais (VL, MB, RL, ML%): diff > 0 é melhor → verde
  const diffTone = (diff: number, costish: boolean) => {
    if (diff === 0) return "text-muted-foreground";
    const favorable = costish ? diff < 0 : diff > 0;
    return favorable ? "text-emerald-600" : "text-red-600";
  };

  const yearTotal = (
    line: typeof RESULT_LINES[number],
    field: "actual" | "planned" | "diff",
  ) => {
    if (line.isPct) {
      // ML% no total do ano = média ponderada por VL do mesmo bucket
      let num = 0;
      let den = 0;
      for (const r of results) {
        const vl =
          field === "actual" ? r.vl_actual
          : field === "planned" ? r.vl_planned
          : (r.vl_actual - r.vl_planned);
        const ml =
          field === "actual" ? r.ml_actual_pct
          : field === "planned" ? r.ml_planned_pct
          : r.ml_diff_pct;
        num += ml * Math.abs(vl);
        den += Math.abs(vl);
      }
      return den > 0 ? num / den : 0;
    }
    return results.reduce((s, r) => {
      const k = `${line.key}_${field === "diff" ? "diff" : field === "actual" ? "actual" : "planned"}`;
      return s + Number((r as unknown as Record<string, number>)[k] ?? 0);
    }, 0);
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Resultados calculados (read-only)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              VL, CO, MB, TA, RL e ML% são derivados automaticamente das linhas DRG e dos lançamentos do CUSTOS_MES.
              Taxa Administrativa atual: <strong>{taxaAdmPct.toFixed(1)}%</strong>.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={onRecompute}
            disabled={isRecomputing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRecomputing && "animate-spin")} />
            Recalcular
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {results.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum resultado calculado ainda. Clique em <strong>Recalcular</strong> para processar este ano.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 bg-muted/50 px-2 py-1.5 text-left font-medium text-muted-foreground border-r min-w-[220px]"
                  >
                    Linha
                  </th>
                  {yearMonths.map((m) => (
                    <th
                      key={m.ym}
                      colSpan={3}
                      className="px-1.5 py-1 text-center text-[10px] uppercase font-semibold tracking-wide text-muted-foreground border-r"
                    >
                      {m.label}
                    </th>
                  ))}
                  <th
                    colSpan={3}
                    className="px-1.5 py-1 text-center text-[10px] uppercase font-semibold tracking-wide bg-foreground/5 text-foreground"
                  >
                    Total
                  </th>
                </tr>
                <tr className="border-b text-[9px] uppercase tracking-wider text-muted-foreground/80">
                  {yearMonths.map((m) => (
                    <Fragment key={m.ym}>
                      <th className="px-1.5 py-1 text-right font-medium min-w-[78px]">Prev</th>
                      <th className="px-1.5 py-1 text-right font-medium min-w-[78px]">Real</th>
                      <th className="px-1.5 py-1 text-right font-medium border-r min-w-[78px]">Dif</th>
                    </Fragment>
                  ))}
                  <th className="px-1.5 py-1 text-right font-medium bg-foreground/5 min-w-[90px]">Prev</th>
                  <th className="px-1.5 py-1 text-right font-medium bg-foreground/5 min-w-[90px]">Real</th>
                  <th className="px-1.5 py-1 text-right font-medium bg-foreground/5 min-w-[90px]">Dif</th>
                </tr>
              </thead>
              <tbody>
                {RESULT_LINES.map((line) => (
                  <tr
                    key={line.key}
                    className={cn(
                      "border-b font-medium",
                      line.key === "rl" || line.key === "ml" ? "bg-primary/[0.04]" : "hover:bg-muted/20",
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-background px-2 py-1.5 border-r">
                      {line.label}
                    </td>
                    {yearMonths.map((m) => {
                      const r = byMonth.get(m.ym);
                      const planned = !r ? 0 : Number((r as unknown as Record<string, number>)[`${line.key}_${line.isPct ? "planned_pct" : "planned"}`] ?? 0);
                      const actual = !r ? 0 : Number((r as unknown as Record<string, number>)[`${line.key}_${line.isPct ? "actual_pct" : "actual"}`] ?? 0);
                      const diff = !r ? 0 : Number((r as unknown as Record<string, number>)[`${line.key}_${line.isPct ? "diff_pct" : "diff"}`] ?? 0);
                      return (
                        <Fragment key={m.ym}>
                          <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">
                            {fmt(planned, line.isPct)}
                          </td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums">
                            {fmt(actual, line.isPct)}
                          </td>
                          <td className={cn("px-1.5 py-1.5 text-right tabular-nums border-r", diffTone(diff, line.costish))}>
                            {diff === 0 ? "—" : (line.isPct ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : `${diff > 0 ? "+" : ""}${formatBRL(diff)}`)}
                          </td>
                        </Fragment>
                      );
                    })}
                    {(() => {
                      const tp = yearTotal(line, "planned");
                      const ta = yearTotal(line, "actual");
                      const td = line.isPct ? (ta - tp) : yearTotal(line, "diff");
                      return (
                        <>
                          <td className="px-1.5 py-1.5 text-right tabular-nums bg-foreground/5 text-muted-foreground">
                            {fmt(tp, line.isPct)}
                          </td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums bg-foreground/5 font-semibold">
                            {fmt(ta, line.isPct)}
                          </td>
                          <td className={cn("px-1.5 py-1.5 text-right tabular-nums bg-foreground/5", diffTone(td, line.costish))}>
                            {td === 0 ? "—" : (line.isPct ? `${td > 0 ? "+" : ""}${td.toFixed(1)}%` : `${td > 0 ? "+" : ""}${formatBRL(td)}`)}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Faróis dos meses */}
        {results.length > 0 && (
          <div className="border-t px-3 py-2 flex items-center gap-2 flex-wrap bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
              Saúde por mês:
            </span>
            {yearMonths.map((m) => {
              const r = byMonth.get(m.ym);
              const s = r?.saude ?? "sem_dados";
              return (
                <Badge
                  key={m.ym}
                  variant="outline"
                  className={cn("h-5 px-1.5 text-[10px] gap-1", SAUDE_CLASS[s])}
                >
                  <CircleDot className="h-2 w-2" />
                  {m.label} · {SAUDE_LABEL[s]}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================
// Tabela principal
// ============================================================
type PgKind = PgRow["kind"];
interface TableRow {
  code: string;
  label: string;
  kind: PgKind;
  isPercentage: boolean;
  isCount?: boolean;
  monthly: Array<{
    ym: string;
    planned: number;
    actual: number;
    diff: number;
    light: LightTone;
    variation: number;
    hasBaseline: boolean;
  }>;
  totalPlanned: number;
  totalActual: number;
  totalDiff: number;
  totalLight: LightTone;
  totalVariation: number;
  totalHasBaseline: boolean;
}
interface TableProps {
  yearMonths: { ym: string; label: string }[];
  renderRows: TableRow[];
  onSaveCell: (params: {
    lineCode: string;
    lineLabel: string;
    isPercentage: boolean;
    ym: string;
    field: "planned_value" | "actual_value";
    value: number;
  }) => void | Promise<void>;
}

const BudgetAcompTable = ({
  yearMonths,
  renderRows,
  onSaveCell,
}: TableProps) => {
  const valFmt = (v: number) =>
    v === 0 ? <span className="text-muted-foreground/40">—</span> : formatBRL(v);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          {/* ===== Cabeçalho (fixo apenas no eixo horizontal — não acompanha scroll da página) ===== */}
          <thead className="bg-background">
            <tr className="border-b">
              <th
                rowSpan={2}
                className="sticky left-0 z-30 bg-background px-2 py-1.5 text-left font-medium text-muted-foreground border-r min-w-[260px]"
              >
                Linha DRG
              </th>
              {yearMonths.map((m) => (
                <th
                  key={m.ym}
                  colSpan={3}
                  className="px-1.5 py-1 text-center text-[10px] uppercase font-semibold tracking-wide text-muted-foreground border-r"
                >
                  {m.label}
                </th>
              ))}
              <th
                colSpan={3}
                className="px-1.5 py-1 text-center text-[10px] uppercase font-semibold tracking-wide bg-muted/40 text-foreground"
              >
                Total
              </th>
            </tr>
            <tr className="border-b text-[9px] uppercase tracking-wider text-muted-foreground/80">
              {yearMonths.map((m) => (
                <Fragment key={m.ym}>
                  <th className="px-1.5 py-1 text-right font-medium min-w-[78px]">Prev</th>
                  <th className="px-1.5 py-1 text-right font-medium min-w-[78px]">Real</th>
                  <th className="px-1 py-1 text-center font-medium border-r min-w-[28px]">●</th>
                </Fragment>
              ))}
              <th className="px-1.5 py-1 text-right font-medium bg-muted/40 min-w-[90px]">Prev</th>
              <th className="px-1.5 py-1 text-right font-medium bg-muted/40 min-w-[90px]">Real</th>
              <th className="px-1 py-1 text-center font-medium bg-muted/40 min-w-[28px]">●</th>
            </tr>
          </thead>

          {/* ===== Corpo ===== */}
          <tbody>
            {renderRows.map((row, i) => {
              if (row.kind === "group") {
                // Separador visual (label vazio) — linha em branco entre blocos.
                if (!row.label) {
                  return (
                    <tr key={i} className="h-2">
                      <td colSpan={1 + yearMonths.length * 3 + 3} className="p-0" />
                    </tr>
                  );
                }
                // Códigos internos (G1..G6, H_*) não são exibidos como chip.
                const showCode = !/^(G\d+|H_|SEP)/.test(row.code);
                return (
                  <tr key={i} className="bg-primary/[0.04] border-y border-primary/10">
                    <td
                      colSpan={1 + yearMonths.length * 3 + 3}
                      className="sticky left-0 px-2 py-1.5 font-semibold text-[11px] text-foreground bg-primary/[0.04]"
                    >
                      {showCode && (
                        <span className="font-mono text-[10px] text-primary mr-1">{row.code}</span>
                      )}
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const isCalc = row.kind === "calc";
              const isTax = row.kind === "tax";
              const isEditable =
                EDITABLE_INPUT_CODES.has(row.code) || EDITABLE_COST_CODES.has(row.code);
              const readOnly = isCalc || isTax || !isEditable;
              const rowBg = isCalc ? "bg-foreground/[0.04] font-semibold" : "hover:bg-muted/30";
              const stickyBg = isCalc ? "bg-foreground/[0.04]" : "bg-background";
              const totalBg = isCalc ? "bg-muted/60" : "bg-muted/30";
              const fmtVal = (v: number) => {
                // NaN (divisão por zero em VL) → exibe "—".
                if (!Number.isFinite(v)) {
                  return <span className="text-muted-foreground/40">—</span>;
                }
                return row.isCount
                  ? (v === 0
                      ? <span className="text-muted-foreground/40">—</span>
                      : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))
                  : row.isPercentage ? formatPct(v / 100) : valFmt(v);
              };

              return (
                <tr key={i} className={cn("border-b transition-colors", rowBg)}>
                  <td className={cn("sticky left-0 z-10 px-2 py-1 pl-6 border-r", stickyBg)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="truncate max-w-[240px]">
                          <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                            {row.code}
                          </span>
                          <span>{row.label}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs font-mono">{row.code}</p>
                        <p className="text-xs">{row.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {yearMonths.map((m) => {
                    const cell = row.monthly.find((x) => x.ym === m.ym);
                    const planned = cell?.planned ?? 0;
                    const actual = cell?.actual ?? 0;
                    const light = cell?.light ?? "neutral";
                    const variation = cell?.variation ?? 0;
                    const hasBaseline = cell?.hasBaseline ?? false;
                    return (
                      <Fragment key={m.ym}>
                        <td className="p-0 px-1 align-middle">
                          {readOnly ? (
                            <div className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">
                              {fmtVal(planned)}
                            </div>
                          ) : (
                            <EditableCell
                              value={planned}
                              muted
                              onCommit={(v) =>
                                onSaveCell({
                                  lineCode: row.code,
                                  lineLabel: row.label,
                                  isPercentage: row.isPercentage,
                                  ym: m.ym,
                                  field: "planned_value",
                                  value: v,
                                })
                              }
                            />
                          )}
                        </td>
                        <td className="p-0 px-1 align-middle">
                          {readOnly ? (
                            <div className="px-1.5 py-1 text-right tabular-nums font-medium">
                              {fmtVal(actual)}
                            </div>
                          ) : (
                            <EditableCell
                              value={actual}
                              onCommit={(v) =>
                                onSaveCell({
                                  lineCode: row.code,
                                  lineLabel: row.label,
                                  isPercentage: row.isPercentage,
                                  ym: m.ym,
                                  field: "actual_value",
                                  value: v,
                                })
                              }
                            />
                          )}
                        </td>
                        <td className="px-1 py-1 text-center border-r">
                          <LightIndicator
                            tone={light}
                            variation={variation}
                            hasBaseline={hasBaseline}
                          />
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className={cn("px-1.5 py-1 text-right tabular-nums text-muted-foreground", totalBg)}>
                    {fmtVal(row.totalPlanned)}
                  </td>
                  <td className={cn("px-1.5 py-1 text-right tabular-nums font-medium", totalBg)}>
                    {fmtVal(row.totalActual)}
                  </td>
                  <td className={cn("px-1 py-1 text-center", totalBg)}>
                    <LightIndicator
                      tone={row.totalLight}
                      variation={row.totalVariation}
                      hasBaseline={row.totalHasBaseline}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
};

// ============================================================
// Light Indicator (farol com tooltip)
// ============================================================
const LightIndicator = ({
  tone,
  variation,
  hasBaseline,
}: {
  tone: LightTone;
  variation: number;
  hasBaseline: boolean;
}) => {
  if (!hasBaseline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground/60 text-xs">—</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Sem previsto lançado
        </TooltipContent>
      </Tooltip>
    );
  }
  const sign = variation > 0 ? "+" : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <CircleDot className={cn("h-2.5 w-2.5 inline-block cursor-help", LIGHT_DOT[tone])} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">{LIGHT_LABEL[tone]}</div>
        <div className="text-muted-foreground">
          Desvio: {sign}{variation.toFixed(1)}% (limite: {LIGHT_THRESHOLDS.green}% / {LIGHT_THRESHOLDS.yellow}%)
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// ============================================================
// KPI Tile
// ============================================================
const TONE_BG: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-700",
  indigo: "bg-indigo-500/10 text-indigo-700",
  emerald: "bg-emerald-500/10 text-emerald-700",
  red: "bg-red-500/10 text-red-700",
  slate: "bg-muted text-muted-foreground",
};

const KpiTile = ({
  label,
  value,
  hint,
  tone = "slate",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONE_BG;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("h-6 w-6 rounded-md flex items-center justify-center", TONE_BG[tone])}>
            <Icon className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className={cn("text-base font-bold tabular-nums", TONE_BG[tone].split(" ")[1])}>
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </CardContent>
  </Card>
);

export default ContractBudgetAcomp;
