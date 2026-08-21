// L-FMT-01 fixture: Intl outside the format seam, plus the banned locale.
export function formatTaka(amount: number): string {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(amount);
}

export function label(value: number): string {
  return value.toLocaleString();
}

export function byName(a: string, b: string): number {
  return a.localeCompare(b);
}
