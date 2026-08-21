/**
 * Silent: the seam is decimal.js and the column is numeric (B-07). Rates arrive as
 * strings, arithmetic happens on Decimal, and the integers left over are counts.
 */
import Decimal from 'decimal.js';

export const VAT_RATE = new Decimal('0.15');

export function vatOn(amount: string): string {
  return new Decimal(amount).times(VAT_RATE).toFixed(2);
}

export function quantityFrom(raw: string): Decimal {
  return new Decimal(raw);
}

export const MAX_ROWS = 500;
