/**
 * Fires: cubit/no-conversion-literal (L-FRM-06).
 * The cft→m³ factor copied into a module, and kg→MT written as a division. Two copies of
 * a canon constant is two answers to the same certificate.
 */
export function cubicMetres(cft: number): number {
  return cft * 0.028316846592;
}

export function metricTonnes(kilograms: number): number {
  return kilograms / 1000;
}
