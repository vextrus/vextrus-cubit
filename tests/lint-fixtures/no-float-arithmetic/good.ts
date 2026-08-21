// B-07 fixture: Decimal at the seam, integers where integers are honest.
import Decimal from 'decimal.js';

const RETENTION_RATE = new Decimal('0.05');

export function retentionOf(contractValue: Decimal): Decimal {
  return contractValue.times(RETENTION_RATE);
}

export function parseAmount(raw: string): Decimal {
  return new Decimal(raw);
}

export const MAX_LINE_ITEMS = 500;
