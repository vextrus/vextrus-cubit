// A hand measurement's figures as a quantity surveyor reads them (s-measure I-662): the card
// at the closing point, the chest's totals and the Trace of a hand line all say one figure one way.
//
// - A quantity is stated at the places its kind is written to — the places the register's cell and
//   the draft BOQ state it at (`placesOf`, L-FMT-02) — carried half-up on the text (`statedAt`), and
//   grouped by the format seam. `23.1951589143271937113530671625` m³ is `23.195`.
// - A variable of a formula is read in the unit a QS reads it in and at that unit's places: an area
//   traced in the drawing's square millimetres is square metres (`328,838,371.24 mm²` is
//   `328.838 m²`), and a metre, a square metre and a cubic metre are stated to three places, as the
//   running figure is (§ 2.4, `SI_DECIMALS`). Any other unit — a count, a thickness in millimetres —
//   is its exact reading, grouped.
//
// Display only: the exact value stays on the element (`data-value`), and what the bill publishes is
// the gate's figure, never this face of it (I-373).
import { isKind } from "@/core/catalogue/kinds";
import { placesOf } from "@/core/documents/kinds/boq-draft-law";
import { formatUserFigure } from "@/core/format";
import { convert } from "@/core/units/canon";
import { statedAt } from "../bbs-ui/present";
import { SI_DECIMALS } from "./figure";

/** The square and cubic sub-units a drawing is read in, and the SI unit a QS reads each in. */
const READ_IN: Readonly<Record<string, string>> = Object.freeze({ mm2: "m2", cm2: "m2" });

/** The SI units a QS reads to three places. */
const SI_UNITS: ReadonlySet<string> = new Set(["m", "m2", "m3"]);

/** A kind's figure at the places its kind is written to, grouped: `23.195`. A kind the catalogue does not hold is its exact figure, grouped. */
export function quantityAt(value: string, kind: string): string {
  return formatUserFigure(isKind(kind) ? statedAt(value, placesOf(kind)) : value);
}

/**
 * A formula variable's reading in the unit a QS reads it in, unformatted: an area the drawing gave in
 * square millimetres is square metres at three places (`{ value: "328.838", unit: "m2" }`); any other
 * reading is the line's own, unchanged. What the register's cell and the Trace block state, each
 * through its own format (I-662).
 */
export function variableReading(value: string, unit: string): { readonly value: string; readonly unit: string } {
  const into = READ_IN[unit];
  const converted = into === undefined ? null : convert(value, unit, into);
  return converted !== null && converted.ok ? { value: statedAt(converted.value, SI_DECIMALS), unit: into as string } : { value, unit };
}

/** A formula variable's reading in the unit a QS reads it in, at that unit's places: `{ value: "328.838", unit: "m2" }`. */
export function variableAt(value: string, unit: string): { readonly value: string; readonly unit: string } {
  const read = variableReading(value, unit);
  return { value: formatUserFigure(SI_UNITS.has(read.unit) ? statedAt(read.value, SI_DECIMALS) : read.value), unit: read.unit };
}
