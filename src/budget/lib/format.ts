export const formatBRL = (value: number): string =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatPct = (value: number, decimals = 2): string =>
  `${value.toFixed(decimals)}%`;

export const formatNumber = (value: number, decimals = 0): string =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Formato compacto para KPIs: R$ 8,18 mi · R$ 610,6 mil · R$ 845 */
export const formatCompactBRL = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}R$ ${(abs / 1_000_000_000).toFixed(2).replace(".", ",")} bi`;
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `${sign}R$ ${abs.toFixed(0)}`;
};

