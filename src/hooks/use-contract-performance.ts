import { useCurrentProject } from '@/store/projectStore';

export type HealthStatus = 'ok' | 'risk' | 'late';

/**
 * Métricas de desempenho do contrato (realizado × previsto/replanejado acumulado).
 * Fonte única para o ReportHeader (KPIs) e o Termômetro do Contrato — assim os
 * dois nunca divergem.
 */
export const useContractPerformance = () => {
  const { info, sCurveData } = useCurrentProject();

  // ULTIMA_SEMANA = último índice com Real > 0 OU Real Replanejado > 0
  const ultIdx = (() => {
    for (let i = sCurveData.length - 1; i >= 0; i--) {
      if ((sCurveData[i]?.real ?? 0) > 0 || (sCurveData[i]?.realReplanejado ?? 0) > 0) return i;
    }
    return -1;
  })();
  // PENULTIMA_SEMANA = índice anterior com dado real
  const penIdx = (() => {
    for (let i = ultIdx - 1; i >= 0; i--) {
      if ((sCurveData[i]?.real ?? 0) > 0 || (sCurveData[i]?.realReplanejado ?? 0) > 0) return i;
    }
    return -1;
  })();

  const ultPoint = ultIdx >= 0 ? sCurveData[ultIdx] : null;
  const penPoint = penIdx >= 0 ? sCurveData[penIdx] : null;

  const hasReplanejado = sCurveData.some((p) => (p.replanejado ?? 0) > 0);
  const refLabel = hasReplanejado ? 'replanj.' : 'LB';

  // Real: usa realReplanejado (Formato C) quando disponível, senão real
  const getRealAt = (p: typeof ultPoint) =>
    p == null ? 0 : (p.realReplanejado ?? 0) > 0 ? (p.realReplanejado ?? 0) : (p.real ?? 0);
  // Previsto: usa replanejado (Formato C) quando disponível, senão previsto
  const getPrevAt = (p: typeof ultPoint) =>
    p == null ? 0 : (p.replanejado ?? 0) > 0 ? (p.replanejado ?? 0) : (p.previsto ?? 0);

  // Prefere os valores autoritativos do import (FORMATO D), senão deriva da Curva S
  const avancoReal = info.realAcumulado ?? getRealAt(ultPoint);
  const refPrev = info.prevAcumulado ?? getPrevAt(ultPoint);
  const prevAvancoReal = getRealAt(penPoint);
  const prevRefPrev = getPrevAt(penPoint);

  const desvio = hasReplanejado ? avancoReal - refPrev : (info.desvioAcumulado ?? avancoReal - refPrev);
  const idp = refPrev > 0 ? (avancoReal / refPrev) * 100 : 0;
  const prevIdp = prevRefPrev > 0 ? (prevAvancoReal / prevRefPrev) * 100 : 0;

  const status: HealthStatus = idp >= 95 ? 'ok' : idp >= 80 ? 'risk' : 'late';
  const statusLabel = status === 'ok' ? 'No Prazo' : status === 'risk' ? 'Em Risco' : 'Atrasado';

  return {
    ultIdx,
    penIdx,
    ultPoint,
    penPoint,
    hasReplanejado,
    refLabel,
    getRealAt,
    getPrevAt,
    avancoReal,
    refPrev,
    prevAvancoReal,
    prevRefPrev,
    desvio,
    idp,
    prevIdp,
    status,
    statusLabel,
  };
};
