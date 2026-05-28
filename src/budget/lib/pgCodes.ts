// Whitelist de códigos do Plano Gerencial Megasteam
export const PG_CODES = [
  "1.01", "2.01", "2.02", "2.06", "TI", "VL",
  "PE-II", "3.01", "PET", "3.02", "3.03", "3.04", "3.05", "3.06", "3.07",
  "PL-III", "3.08", "3.09", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.72", "3.79",
  "SE-IV", "3.50", "3.51", "3.52", "3.53", "3.54", "3.55", "3.56", "3.57", "3.58", "3.59", "3.60", "3.61", "3.73", "3.74",
  "MA-V", "3.63", "3.64", "3.77", "3.78",
  "OC-VI", "3.62", "3.66", "3.67", "3.68", "3.69", "3.70", "3.71", "3.75", "3.76", "3.81", "3.82", "7.04",
  "RT-Absorção", "OS", "CO", "MB", "RL",
] as const;

export type PgCode = (typeof PG_CODES)[number];

export const PG_CODES_SET: ReadonlySet<string> = new Set(PG_CODES);

export const isValidPgCode = (code: string | null | undefined): boolean =>
  !!code && PG_CODES_SET.has(code.trim());
