// FIXTURE: cubit/no-float-arithmetic MUST NOT report on this file.
// Decimal at the seam; integer counting arithmetic stays legal.

import Decimal from 'decimal.js';

export function lineTotal(rate: string, qty: string): Decimal {
  return new Decimal(rate).times(qty).times('1.05');
}

export function pageCount(rows: number, perPage: number): number {
  return Math.ceil(rows / perPage) + 1;
}

export const zero = new Decimal(0);
