/**
 * Silent: formatting is asked for, never performed here (L-FMT-01). src/core/format.ts is
 * the tree's sole caller of Intl, so lakh/crore grouping and collation are decided once.
 */
export interface Format {
  readonly taka: (amount: string) => string;
  readonly compare: (a: string, b: string) => number;
}

export function taka(format: Format, amount: string): string {
  return format.taka(amount);
}

export function sortSheets(format: Format, names: readonly string[]): string[] {
  return [...names].sort((a, b) => format.compare(a, b));
}
