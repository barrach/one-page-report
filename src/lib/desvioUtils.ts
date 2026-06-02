import type { SCurvePoint, ProjectInfo } from '@/store/projectStore';

/**
 * Calcula o desvio acumulado (avanço real − referência prevista) a partir
 * da Curva S, considerando replanejamento quando presente.
 * Mesma lógica usada no ReportHeader para manter consistência entre
 * o card de KPI e o card "Análise de Desvio".
 */
export interface DesvioResult {
  desvio: number;        // pontos percentuais (real − previsto)
  avancoReal: number;
  refPrev: number;
  hasReplanejado: boolean;
  refLabel: 'replanj.' | 'LB';
}

export const computeDesvio = (sCurveData: SCurvePoint[], info: ProjectInfo): DesvioResult => {
  const ultIdx = (() => {
    for (let i = sCurveData.length - 1; i >= 0; i--) {
      if ((sCurveData[i]?.real ?? 0) > 0 || (sCurveData[i]?.realReplanejado ?? 0) > 0) return i;
    }
    return -1;
  })();
  const ultPoint = ultIdx >= 0 ? sCurveData[ultIdx] : null;
  const hasReplanejado = sCurveData.some(p => (p.replanejado ?? 0) > 0);

  const getRealAt = (p: SCurvePoint | null) =>
    p == null ? 0 : (p.realReplanejado ?? 0) > 0 ? (p.realReplanejado ?? 0) : (p.real ?? 0);
  const getPrevAt = (p: SCurvePoint | null) =>
    p == null ? 0 : (p.replanejado ?? 0) > 0 ? (p.replanejado ?? 0) : (p.previsto ?? 0);

  const avancoReal = info.realAcumulado ?? getRealAt(ultPoint);
  const refPrev    = info.prevAcumulado ?? getPrevAt(ultPoint);
  const desvio = hasReplanejado ? (avancoReal - refPrev) : (info.desvioAcumulado ?? (avancoReal - refPrev));

  return {
    desvio,
    avancoReal,
    refPrev,
    hasReplanejado,
    refLabel: hasReplanejado ? 'replanj.' : 'LB',
  };
};
