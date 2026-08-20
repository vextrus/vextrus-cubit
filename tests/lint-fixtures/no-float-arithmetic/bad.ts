// FIXTURE: cubit/no-float-arithmetic MUST report on this file.
// Money and quantity never ride binary floating point.

export function lineTotal(rate: number, qty: number): number {
  const wastageFactor = 1.05;
  return rate * qty * wastageFactor;
}

export function withRounding(raw: string): number {
  return parseFloat(raw) * 2;
}

export const drift = 0.1 + 0.2;
