// L-FRM-06 fixture: one canon, in src/core/units.ts.
import { FT_TO_M, CFT_TO_M3, kilogramsToMetricTonnes } from '@/core/units';

export function feetToMetres(feet: number): number {
  return feet * FT_TO_M;
}

export function cftToCubicMetres(cft: number): number {
  return cft * CFT_TO_M3;
}

export { kilogramsToMetricTonnes };
