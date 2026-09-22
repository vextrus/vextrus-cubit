// How a level's storey height stands over the readings made of it (L-MEA-07, R-TO-051, L-REG-03).
// Pure and derived at read time: no column anywhere holds a "current height", because a stored
// current value is exactly the overwrite R-TO-051 forbids, and a silently-resolved disagreement is
// what L-REG-03 forbids.
//
// Readings are append-only, so "current" is not a flag on a row. A reading key is (level, actor,
// basis, source key), and the LATEST reading under one key is what that key says today — an earlier
// one under the same key is superseded by the re-affirmation, which is the only thing that clears a
// contest. Every key's current reading then competes: they agree and the height is AGREED at what
// they agree on, or they do not and it is SUSPENDED with no value at all.
//
// D-001 (docs/decisions/deviations.md) departs from L-MEA-07's "equality is on canonical metres" in
// one place and no other. A drawing that states its levels in two notations prints the metric one as
// the imperial design converted and ROUNDED (F-RCC6-BNBC S-25: `EL +11'-0"` beside `1F EL +3.353`,
// and 11'-0" is 3.3528 m), so the two prints of one height can never be equal in canonical metres —
// and the Bible's own trap register says they resolve to one stack (T-NOT-LEVEL). Two such prints
// AGREE where the exact one, rounded half to even to the places the decimal print states, IS the
// decimal print, and the height is carried at the exact one. Everything else — two prints in one
// notation, a figure a person entered, a reading that says nothing of how it was written — is judged
// by the Bible's equality exactly as before.
import Decimal from "decimal.js";
import type { RefusalCode } from "../errors";
import { CANONICAL_UNIT, dimensionOf, exact, factorOf, unitNamed } from "../units/canon";
import { STOREY_HEIGHT_ABSENCE, STOREY_HEIGHT_BASES, STOREY_HEIGHT_STANDINGS, type StoreyHeightStandingName } from "./law";

/**
 * The facts a standing is derived from — a caller's row is free to carry more (C-05).
 *
 * The key and the metres are all the Bible's equality reads. The other four say how the reading was
 * made and what was written (L-REG-01); they are optional because only a PRINT is ever judged at the
 * places it was printed to (D-001), and a caller that carries none of them is judged by equality.
 */
export type ReadingOfHeight = {
  readonly readingKey: string;
  readonly canonicalMetres: string;
  readonly basis?: string;
  readonly sourceKey?: string | null;
  readonly valueAsWritten?: string;
  readonly unitAsWritten?: string;
};

/**
 * How a height stands, whole: the standing, the metres it stands at where it stands at one, the
 * code a quantity line would report the absence under, and the readings behind both. The value is
 * null under SUSPENDED and under NONE — a height whose readings disagree has no height.
 */
export type StoreyHeightStanding<R extends ReadingOfHeight = ReadingOfHeight> = {
  readonly standing: StoreyHeightStandingName;
  readonly canonicalMetres: string | null;
  readonly refusal: RefusalCode | null;
  /**
   * The current reading the height stands AT, or null where it stands at none. Under AGREED every
   * current reading says this height; where two notations print it, this is the exact one of them
   * (D-001) — the reading `canonicalMetres` is the figure of — so whatever binds the height binds the
   * figure it stands at and cites the entity that states it (L-QTY-03), never the rounded print.
   */
  readonly reading: R | null;
  /** One reading per key: what each key says today. */
  readonly current: readonly R[];
  /** Every reading a later re-affirmation under the same key superseded. Superseded, never erased. */
  readonly superseded: readonly R[];
};

/** The three standings, read off the roster rather than spelled beside it (B-17). */
const [AGREED, SUSPENDED, NONE]: readonly StoreyHeightStandingName[] = STOREY_HEIGHT_STANDINGS;

/** The codes a level with no height, and a level with a contested one, are reported under. */
const STOREY_HEIGHT_UNSTATED = STOREY_HEIGHT_ABSENCE.NONE as RefusalCode;
const STOREY_HEIGHT_CONTESTED = STOREY_HEIGHT_ABSENCE.SUSPENDED as RefusalCode;

/** The basis that says a figure was read off a drawing AS PRINTED — the one basis a print stands on. */
const TRANSCRIBED = STOREY_HEIGHT_BASES[0];

/** A figure as it is written: a sign, the digits, and the decimals it was printed to (group 1). */
const WRITTEN_FIGURE = /^[+-]?\d+(?:\.(\d+))?$/;

/**
 * One print of a height, as D-001 judges one: what it is worth in metres, and the places of the metre
 * it was printed to — or null for a print in a notation that is not decimal, whose figure the canon
 * carries into metres EXACTLY (11'-0" is 3.3528 m, no rounding anywhere) and which therefore states
 * no decimal place of the metre at all.
 */
type Print = { readonly metres: Decimal; readonly places: number | null };

/**
 * The print a reading is, or null where it is none: a reading TRANSCRIBED off a drawing entity it
 * cites, whose figure and length unit were kept as written. A figure a person entered was never
 * printed to any places, so it is no print — `3` typed for a storey is three metres, not "a height
 * somewhere between 2.5 and 3.5", and reading it as the latter would hide the disagreement L-REG-03
 * declares. A notation is decimal where its unit is the metre times a power of ten (m, mm): n places
 * of the millimetre are n + 3 of the metre.
 */
function printOf(reading: ReadingOfHeight): Print | null {
  if (reading.basis !== TRANSCRIBED || reading.sourceKey === undefined || reading.sourceKey === null || reading.sourceKey.length === 0) return null;
  if (reading.valueAsWritten === undefined || reading.unitAsWritten === undefined) return null;
  const unit = unitNamed(reading.unitAsWritten);
  const written = WRITTEN_FIGURE.exec(reading.valueAsWritten.trim());
  if (unit === null || written === null || dimensionOf(unit) !== dimensionOf(CANONICAL_UNIT.LENGTH)) return null;
  const step = exact(factorOf(unit));
  const shift = step.decimalPlaces();
  const decimal = step.mul(exact(10).pow(shift)).eq(1);
  return { metres: exact(reading.canonicalMetres), places: decimal ? (written[1]?.length ?? 0) + shift : null };
}

/**
 * Do two readings say the same height?
 *
 * Judged on canonical metres first, which is L-MEA-07's equality: "10 ft" and "3.048 m" agree. Where
 * that fails, two PRINTS in two notations — one decimal, one exact — still agree where the exact one,
 * rounded half to even to the places the decimal print states, is that print (D-001): `+3.353` beside
 * 11'-0" (3.3528) agree, `3.0482 m` beside 10'-0" (3.0480) do not, and `3.350 m` beside 11'-0" do not
 * either, because the places are the ones PRINTED, never the ones the canon's normal form keeps. Two
 * prints in one notation are held to equality: nothing converted one into the other, so nothing
 * rounded it, and 3.353 m beside 3.3528 m is a disagreement the drawings declare.
 */
function agree(left: ReadingOfHeight, right: ReadingOfHeight): boolean {
  if (exact(left.canonicalMetres).eq(exact(right.canonicalMetres))) return true;
  const one = printOf(left);
  const other = printOf(right);
  if (one === null || other === null || (one.places === null) === (other.places === null)) return false;
  const [decimal, exactly] = one.places === null ? [other, one] : [one, other];
  return exactly.metres.toDecimalPlaces(decimal.places as number, Decimal.ROUND_HALF_EVEN).eq(decimal.metres);
}

/**
 * The reading an agreed height is carried at: the one stated to the most places of the metre, which
 * under agreement is the exact print wherever two notations print it (D-001), and otherwise a reading
 * equal to every other — the first of those in the order the level acquired them, as before.
 */
function finest<R extends ReadingOfHeight>(current: readonly R[]): R {
  let carried = current[0] as R;
  for (const reading of current) {
    if (exact(reading.canonicalMetres).decimalPlaces() > exact(carried.canonicalMetres).decimalPlaces()) carried = reading;
  }
  return carried;
}

/**
 * How one level's storey height stands, derived from every reading ever made of it.
 *
 * `readings` arrive in the order they were appended — oldest first — because that order is what
 * decides which reading under a key is the current one. The keys keep their first-appearance order
 * so a reader sees the competing readings in the order the level acquired them.
 */
export function storeyHeightStanding<R extends ReadingOfHeight>(readings: readonly R[]): StoreyHeightStanding<R> {
  const latest = new Map<string, R>();
  const superseded: R[] = [];
  for (const reading of readings) {
    const standing = latest.get(reading.readingKey);
    if (standing !== undefined) superseded.push(standing);
    latest.set(reading.readingKey, reading);
  }
  const current = [...latest.values()];

  if (current.length === 0) {
    return { standing: NONE as StoreyHeightStandingName, canonicalMetres: null, refusal: STOREY_HEIGHT_UNSTATED, reading: null, current: [], superseded };
  }
  // Agreement is judged between EVERY pair of current readings: one that disagrees with any other
  // suspends the height rather than correcting it, because a correction that carried the day by being
  // appended later would be the silent resolution L-REG-03 forbids — a correction declares itself by
  // re-affirming under its own key, which supersedes the reading it corrects (L-MEA-07). Every pair,
  // and not every reading against one of them, because D-001's agreement is not transitive: `3.353 m`
  // and `3.3528 m` each agree with 11'-0" and not with each other, and a third reading must never
  // clear a contest two readings already declare.
  if (current.some((reading, at) => current.slice(at + 1).some((other) => !agree(reading, other)))) {
    return { standing: SUSPENDED as StoreyHeightStandingName, canonicalMetres: null, refusal: STOREY_HEIGHT_CONTESTED, reading: null, current, superseded };
  }
  const carried = finest(current);
  return { standing: AGREED as StoreyHeightStandingName, canonicalMetres: carried.canonicalMetres, refusal: null, reading: carried, current, superseded };
}
