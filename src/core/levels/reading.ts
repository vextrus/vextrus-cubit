// One storey-height reading, carried from what was written to what it is worth in canonical metres
// (L-REG-01: "a unit conversion is not origination only because it carries its derivation — source
// value, source unit as written, canonical unit, factor, factor provenance"; L-FRM-06).
//
// Every number here is the canon's. No factor is spelled in this file: `src/core/units/canon.ts` is
// the one home of the law, and this asks it (B-17).
import { refusal } from "../faults/refusal-marker";
import { CANONICAL_UNIT, convert, isUnit, toCanonical, type Unit } from "../units/canon";

/**
 * Where a conversion factor came from, recorded with the reading it carried: a derivation whose
 * factor has no stated source is a number somebody would have to trust (L-REG-01).
 */
export const FACTOR_PROVENANCE = "unit canon (L-FRM-06)";

/** The unit a storey height stands in once carried — the canon's own for LENGTH, never respelled. */
export const CANONICAL_LENGTH: Unit = CANONICAL_UNIT.LENGTH;

/** One reading, carried: what was written, what it is worth, and the derivation that took it there. */
export type CarriedReading = {
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly factor: string;
  readonly factorProvenance: string;
};

/**
 * Does this as-written value read as a number at all? Asked before any arithmetic, and asked of the
 * trimmed spelling the canon is then given, so the guard and the arithmetic read one grammar: a
 * reading transcribed with a trailing newline is an ordinary reading, not a crash inside a decimal
 * library (ARCH-03, L-FRM-06). What is kept as written is still what was written.
 */
function readsAsANumber(value: string): boolean {
  return value !== "" && Number.isFinite(Number(value));
}

/**
 * A written height in canonical metres, with its derivation.
 *
 * A unit that measures something other than length refuses by name (`DIMENSION_MISMATCH`), and a
 * packaging unit refuses `PRODUCT_FACTOR_MISSING` — never a silent 1.0 (L-FRM-06). A spelling the
 * canon does not know at all, and a value that is no number, are mistakes in the caller rather than
 * refusals anybody typed, so they say so where they are made (ARCH-03).
 */
export function carryToMetres(valueAsWritten: string, unitAsWritten: string): CarriedReading {
  const value = valueAsWritten.trim();
  // L-REG-01: "convert of no input is no output, never a zero".
  if (!readsAsANumber(value)) {
    throw new Error(`"${valueAsWritten}" is no reading of a storey height, so there is nothing to carry to metres — a convert of no input is no output, never a zero (L-REG-01)`);
  }
  if (!isUnit(unitAsWritten)) {
    const canonical = toCanonical(unitAsWritten);
    if (canonical.ok) throw new Error(`"${unitAsWritten}" canonicalised without being a unit of the canon — the canon and its guard disagree (L-FRM-06)`);
    throw refusal(canonical.code, `a storey height written in ${unitAsWritten} carries no factor into metres`, { unitAsWritten });
  }
  const source = toCanonical(unitAsWritten);
  if (!source.ok) throw refusal(source.code, `a storey height written in ${unitAsWritten} carries no factor into metres`, { unitAsWritten });
  const carried = convert(value, unitAsWritten, CANONICAL_LENGTH);
  if (!carried.ok) throw refusal(carried.code, `a storey height is a length, and ${unitAsWritten} does not measure one`, { unitAsWritten });
  return { valueAsWritten, unitAsWritten, canonicalMetres: carried.value, factor: source.factor, factorProvenance: FACTOR_PROVENANCE };
}
