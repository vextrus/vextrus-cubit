// L-CAD-07's label law: what a bubble's text has to SAY for the thing around it to be a grid bubble
// at all, and which of the two families the label sorts into.
//
// "Label normalisation compares dotless-uppercase" — so every comparison a grid makes is made on the
// normalised form, and the drawing's own spelling ("a.", "c") is kept beside it in the entity the
// label was read from. A text that normalises to anything but a bare letter A–Z or a bare numeral is
// not a grid label, however it is drawn and whatever layer it stands on: a paired mark like "C1", a
// primed one like "A'" and a multi-letter one like "AA" are readings this rule does not make, and a
// guessed reading is worse than none (L-QTY-04).
//
// The two families are the seam's own closed roster (`GRID_FAMILIES`, which the store writes its
// CHECK from). This file NAMES two of its members rather than restating the list: `satisfies` binds
// each name to the roster's type, so a family this file could produce that the roster does not hold
// does not compile, and the roster keeps its one home (B-17). It is named rather than imported
// because the seam's barrel hands out the tables and main's own roster and no vocabulary of its own
// (SEAM-TENANT, and the db-split arbitration that says so).
import type { GridFamily } from "@/core/db";

/** The two, by name — the letters, and the numerals. */
const FAMILY_LETTER = "letter" satisfies GridFamily;
const FAMILY_NUMERAL = "numeral" satisfies GridFamily;

/** A bare letter of the Latin alphabet, normalised. */
const BARE_LETTER = /^[A-Z]$/;

/** A bare numeral — any number of digits, because grid lines run past nine. */
const BARE_NUMERAL = /^[0-9]+$/;

/**
 * One text as a grid compares it (L-CAD-07): dotless, trimmed and uppercase. The dots go because a
 * draughtsman writes "a." for the same axis another writes "A", and the case goes for the same
 * reason — the two are one label, and a grid that read them as two would georeference twice.
 */
export function normaliseGridLabel(text: string): string {
  return text.replaceAll(".", "").trim().toUpperCase();
}

/**
 * The family a text sorts into, or null where it is no grid label at all. Content, and nothing else:
 * this is the whole of what makes a mark grid evidence, so no layer name and no DXF type reaches it.
 */
export function gridFamilyOf(text: string): GridFamily | null {
  const label = normaliseGridLabel(text);
  if (BARE_LETTER.test(label)) return FAMILY_LETTER;
  if (BARE_NUMERAL.test(label)) return FAMILY_NUMERAL;
  return null;
}
