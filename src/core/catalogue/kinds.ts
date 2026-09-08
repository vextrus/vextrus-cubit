// L-MEA-04's quantity kind: `kind = chapter × dimension, named for the trade`. The enum is
// code-owned and closed — a kind exists because this roster names it, never because a row or a
// person spelled one — and every member is named for a trade and its material and for nothing else.
//
// What "and for nothing else" means is decided in one place beside this one: `kind-law.ts` reads a
// name against the dimension set, the units, the element classes, the pricing roles and the book
// codes, and a member added here must answer that law with no objection (B-17).
export const KINDS = ["rcc.concrete"] as const;

/** One quantity kind, drawn from the closed roster above. */
export type Kind = (typeof KINDS)[number];

/** Is this value one of the kinds? Asked wherever a kind arrives as text — a row, a wire, a book. */
export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}
