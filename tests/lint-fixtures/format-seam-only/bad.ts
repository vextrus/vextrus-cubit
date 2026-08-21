/**
 * Fires: cubit/format-seam-only (L-FMT-01).
 * Three ways to format outside the seam: Intl directly, a locale-aware method, and the
 * tag `en-BD`, which is not a CLDR locale and quietly falls back to Western grouping —
 * 1,25,000 becomes 125,000 and a Bangladeshi reader stops trusting the document.
 */
export function taka(amount: number): string {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(amount);
}

export function sheetLabel(count: number): string {
  return count.toLocaleString();
}

export function byName(a: string, b: string): number {
  return a.localeCompare(b);
}
