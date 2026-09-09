// The gate's normalisation (L-MEA-08: "normalises units in decimal (`UNIT_UNMAPPED`)").
//
// Every factor is the canon's and none is here (B-17, L-FRM-06): this asks the canon what a written
// spelling NAMES first, so a spelling it has no factor for — a packaging unit included, which holds
// nothing until a product property says what it holds — is answered `UNIT_UNMAPPED` rather than
// throwing out of the canon. A pair the canon refuses structurally (a length asked for as a mass)
// carries the canon's own registered code back, because that refusal is a different fact and
// reporting it as an unmapped unit would tell a reader the wrong thing (ARCH-03, R-SPINE-062).
import { REFUSALS, type RefusalCode } from "../errors";
import type { Measure } from "../offers/contract";
import { isDecimalFigure } from "../projects";
import { CANONICAL_UNIT, convert, exact, unitNamed, type Dimension, type Unit } from "../units/canon";

/** What a reading normalises to: the canonical value and its unit, or a registered refusal. */
export type NormalisedMeasure = { readonly ok: true; readonly value: string; readonly unit: Unit } | { readonly ok: false; readonly code: RefusalCode };

/**
 * One reading, carried into the canonical unit of the dimension it is supposed to be of, exactly.
 * The failing arm carries no value at all, so a caller cannot read a silent figure out of a reading
 * that could not be carried.
 */
export function normaliseMeasure(measure: Measure, dimension: Dimension): NormalisedMeasure {
  // A rail's reading is text a drawing was read into, and text that is not a decimal figure is not a
  // quantity: an empty reading, a word, `NaN` and `Infinity` alike are answered here, in the closed
  // taxonomy, rather than thrown out of the arithmetic further in. A line states "the SI value at
  // full precision" (L-QTY-03), and a value that is not a finite decimal is a hard block (L-QTY-04).
  // The grammar is the one the tree already stores decimals by, never a second one (B-07, B-17).
  if (!isDecimalFigure(measure.value)) return { ok: false, code: REFUSALS.OFFER_NOT_TO_CONTRACT.code };
  // A quantity below zero is the one thing L-QTY-04 forecloses outright — "a disclosure lets a reader
  // add; nothing lets a reader subtract" — so a negative reading is an inadmissible reading and a hard
  // block, never a figure carried into a line for a reader to subtract by.
  if (exact(measure.value).lt(0)) return { ok: false, code: REFUSALS.OFFER_NOT_TO_CONTRACT.code };
  // A rail carries a reading in the unit the drawing WROTE it in — "source unit as written"
  // (L-REG-01) — and a drawing writes the metre as `M` and the foot as `FT`. What a written spelling
  // names is the canon's to say and nobody else's, so this asks it rather than folding case of its
  // own accord (L-FRM-06, B-17): the same door `carryToMetres` asks of a storey height. A spelling
  // the canon names nothing for carries no factor, and that is `UNIT_UNMAPPED`.
  const named = unitNamed(measure.unit);
  if (named === null) return { ok: false, code: REFUSALS.UNIT_UNMAPPED.code };
  const unit = CANONICAL_UNIT[dimension];
  const carried = convert(measure.value, named, unit);
  if (!carried.ok) return { ok: false, code: carried.code };
  return { ok: true, value: carried.value, unit };
}
