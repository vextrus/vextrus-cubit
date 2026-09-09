// L-MEA-07 as values: what a level IS, what a storey-height reading may stand on, and how a height
// stands over the readings that compete for it. Pure — no store, no clock, no I/O — so the act
// seam's guard, the module door's read and the store's own CHECK are all written from this one
// roster (ARCH-02, B-17).

/**
 * The bases a storey-height reading may carry. R-UI-002 fixes seven bases for the product; these
 * three are the ones a storey height may be READ on, and the roster is closed here because the
 * store's CHECK, the act's guard and the module door all have to admit exactly the same set — the
 * same shape `OBSERVATION_BASES` takes for the register's readings (`src/core/identity/law.ts`).
 *
 * DEFAULTED is absent on purpose (L-MEA-07): a height nobody stated is unstated, and a default
 * would be a number the machine invented and then priced.
 */
export const STOREY_HEIGHT_BASES = ["TRANSCRIBED", "DERIVED", "ENTERED"] as const;

/** One basis, drawn from the closed roster above. */
export type StoreyHeightBasis = (typeof STOREY_HEIGHT_BASES)[number];

/** Is this spelling one of the three bases a storey height may be read on? */
export function isStoreyHeightBasis(value: unknown): value is StoreyHeightBasis {
  return typeof value === "string" && (STOREY_HEIGHT_BASES as readonly string[]).includes(value);
}

/**
 * How a storey height stands over its readings, in the same three words the register's attributes
 * stand in (R-TO-051, L-REG-03): AGREED where the current readings say one thing, SUSPENDED where
 * they disagree — declared, never resolved silently — and NONE where nobody has read it at all.
 */
export const STOREY_HEIGHT_STANDINGS = ["AGREED", "SUSPENDED", "NONE"] as const;

/** One standing, drawn from the closed roster above. */
export type StoreyHeightStandingName = (typeof STOREY_HEIGHT_STANDINGS)[number];

/**
 * An ordinal, as L-MEA-07 admits one: "the ordinal is physical" — a whole number, negative for a
 * basement, conventionally 0 at ground. A value that is not a whole number is no ordinal of a
 * building, so it is a mistake in the caller rather than a refusal anybody could act on (ARCH-03).
 */
export function declaredOrdinal(ordinal: number): number {
  if (!Number.isSafeInteger(ordinal)) {
    throw new Error(`${String(ordinal)} is no ordinal of a stack — an ordinal is physical and whole, negative for a basement (L-MEA-07)`);
  }
  return ordinal;
}
