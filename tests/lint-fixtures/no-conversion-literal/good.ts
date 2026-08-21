/**
 * Silent: conversions come from the canon in src/core/units.ts (L-FRM-06). The integer
 * 1000 below is a page size, not kg/MT — the rule reads it as a conversion only where it
 * multiplies or divides, which is how a mechanical guardrail stays believable.
 */
export interface UnitCanon {
  readonly cubicMetresPerCft: (cft: string) => string;
  readonly metricTonnesPerKilogram: (kilograms: string) => string;
}

export const PAGE_SIZE = 1000;

export function cubicMetres(canon: UnitCanon, cft: string): string {
  return canon.cubicMetresPerCft(cft);
}

export function metricTonnes(canon: UnitCanon, kilograms: string): string {
  return canon.metricTonnesPerKilogram(kilograms);
}
