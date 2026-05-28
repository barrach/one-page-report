import { useMemo } from "react";
import type { ScopeItem } from "@budget/hooks/useScopeData";
import type { CostItem } from "@budget/hooks/useCostData";
import {
  computeScheduleIndicators,
  type WorkforceRow,
  type TimelinePhase,
  type ScheduleIndicators,
} from "@budget/hooks/useScheduleEngine";
import type { ScenarioPricing, PricingCalc } from "@budget/hooks/usePricingData";

interface BudgetStageStateInput {
  project: any;
  scopeItems: ScopeItem[];
  workforceRows: WorkforceRow[];
  timelinePhases: TimelinePhase[];
  costItems: CostItem[];
  pricing: ScenarioPricing | null;
  calc: PricingCalc;
}

export interface BudgetStageState {
  hasScope: boolean;
  hasScopeDescription: boolean;
  hasScopeItems: boolean;
  hasScheduleStructure: boolean;
  hasHH: boolean;
  hasPeak: boolean;
  hasCosts: boolean;
  hasPricing: boolean;
  isRevisionReady: boolean;
  totalHH: number;
  peakEffective: number;
  phaseCount: number;
  functionCount: number;
  populatedFunctionCount: number;
  validCostItemCount: number;
  indicators: ScheduleIndicators;
}

/**
 * Returns true only if the row represents a real function (not a title/group/subgroup)
 * with a non-empty label.
 */
function isRealFunction(row: WorkforceRow): boolean {
  return (
    row.row_type === "function" &&
    Boolean(row.label?.trim())
  );
}

/**
 * Returns true if a cost item has meaningful data (quantity * unit_cost > 0)
 * and a non-empty description.
 */
function isValidCostItem(item: CostItem): boolean {
  return (
    Boolean(item.description?.trim()) &&
    item.quantity > 0 &&
    item.unit_cost > 0
  );
}

export function useBudgetStageState({
  project,
  scopeItems,
  workforceRows,
  timelinePhases,
  costItems,
  pricing,
  calc,
}: BudgetStageStateInput): BudgetStageState {
  return useMemo(() => {
    // ── Schedule: only real function rows ──
    const realFunctions = workforceRows.filter(isRealFunction);
    const populatedFunctions = realFunctions.filter((row) =>
      row.weekly_values.some((value) => Number(value) > 0)
    );

    // Indicators computed only from function rows (already filtered inside)
    const indicators = computeScheduleIndicators(workforceRows);

    // ── Scope: only items with a non-empty title ──
    const validScopeItems = scopeItems.filter((s) => Boolean(s.title?.trim()));
    const hasScopeDescription = Boolean(project?.scope_description?.trim());
    const hasScopeItems = validScopeItems.length > 0;
    const hasScope = hasScopeDescription || hasScopeItems;

    // ── Schedule structure: real functions OR real timeline phases ──
    const realPhases = timelinePhases.filter((p) => Boolean(p.phase_name?.trim()));
    const hasScheduleStructure = realFunctions.length > 0 || realPhases.length > 0;

    // ── HH & Peak: only from computed indicators (already function-only) ──
    const hasHH = indicators.totalHH > 0;
    const hasPeak = indicators.peakEffective > 0;

    // ── Costs: only items with real value ──
    const validCostItems = costItems.filter(isValidCostItem);
    const hasCosts = validCostItems.length > 0;

    // ── Pricing: needs real costs AND a sale price ──
    const hasPricing = Boolean(pricing) && hasCosts && calc.salePrice > 0;

    const isRevisionReady = hasScope && hasScheduleStructure && hasHH && hasCosts && hasPricing;

    return {
      hasScope,
      hasScopeDescription,
      hasScopeItems,
      hasScheduleStructure,
      hasHH,
      hasPeak,
      hasCosts,
      hasPricing,
      isRevisionReady,
      totalHH: indicators.totalHH,
      peakEffective: indicators.peakEffective,
      phaseCount: realPhases.length,
      functionCount: realFunctions.length,
      populatedFunctionCount: populatedFunctions.length,
      validCostItemCount: validCostItems.length,
      indicators,
    };
  }, [project, scopeItems, workforceRows, timelinePhases, costItems, pricing, calc]);
}
