/**
 * Fires: cubit/no-float-arithmetic (B-07).
 * A rate as a binary float and a quantity parsed into one — the two ways money stops
 * being exact before it ever reaches a numeric column.
 */
export function vatOn(amount: number): number {
  return amount * 0.15;
}

export function quantityFrom(raw: string): number {
  return parseFloat(raw);
}
