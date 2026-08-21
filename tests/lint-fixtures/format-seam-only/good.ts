// L-FMT-01 fixture: everything goes through src/core/format.ts.
import { formatTaka, compareNames } from '@/core/format';

export function label(amountInPoisha: bigint): string {
  return formatTaka(amountInPoisha);
}

export function byName(a: string, b: string): number {
  return compareNames(a, b);
}
