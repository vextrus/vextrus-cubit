// FIXTURE: cubit/no-locale-methods MUST NOT report on this file.
// Conventionless call site: it asks the format seam, it does not carry options.

import Decimal from 'decimal.js';
import { formatNumber, formatTaka } from '@/core/format';

export function render(amount: string): string {
  return `${formatNumber(new Decimal(amount))} / ${formatTaka(new Decimal(amount))}`;
}

export function sortKeys(keys: readonly string[]): string[] {
  return [...keys].sort();
}
