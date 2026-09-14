// R-TO-034's note grammar (L-CAD-08): the detailing figures a sheet's general notes state, read by
// pure functions over the sheet's own text.
//
// Deterministic and total, like the schedule notation beside it: no store, no clock, no model, and a
// sentence stating no figure proposes nothing rather than a guess (L-MEA-01 — nothing is assumed
// where a note is silent). The same texts read twice answer the same list, and the order is the
// reading's own (source key, then the law's roster of kinds) rather than the order they arrived in.
//
// A proposal is an OFFER: it is what the sheet says, and it becomes a record only when a person
// commits it through TRANSCRIBE_SHEET_NOTES, which re-reads the sheet and judges what they kept
// against what was offered (L-ACT-01).
//
// The glyphs are resolved by the one reading of a drawing's text (`@/core/entitygraph/notation`),
// never by a second control-code table (B-17).
import { normaliseNotation } from "../entitygraph/notation";
import { NOTE_KINDS, type NoteKind } from "./law";

/** One text entity of a sheet, as the grammar is handed one: the entity it is, and what it says. */
export type SheetText = {
  readonly sourceKey: string;
  readonly text: string;
};

/**
 * One figure a note states, as the grammar reads it: what was read, off which sentence, and how the
 * drawing wrote it. `canonical` is the figure alone — the thing two readings are compared on — and
 * `valueAsWritten` is the drawing's own words for it, kept beside (L-QTY-01, L-REG-01).
 */
export type NoteProposal = {
  readonly kind: NoteKind;
  readonly sourceKey: string;
  /** The whole sentence the figure was read off, verbatim (L-CAD-03). */
  readonly text: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
};

/** A figure as a note writes one: digits, the thousands commas a draughtsman groups them with. */
const FIGURE = String.raw`\d[\d,]*(?:\.\d+)?`;

/** The units a strength is stated in. The roster is closed: a unit nobody wrote is not a unit. */
const STRENGTH_UNITS = String.raw`MPa|N\/mm2|N\/mm²|psi|ksi|kg\/cm2|kg\/cm²`;

/** The reinforcement grade names itself — `fy`, `f_y` — before it states anything. */
const STATES_FY = /\bf[\s_]?y\b/i;

/** The concrete strength names itself, however the font drew the prime: `f'c`, `f’c`, `fc`. */
const STATES_FC = /\bf[\s_]?['’´ʹ]?\s?c\b/i;

/** A lap is stated as a multiple of the bar diameter: `50d`. The `d` is the unit. */
const MULTIPLE_OF_D = new RegExp(String.raw`(${FIGURE})\s*d\b`, "i");

/** The lap a note states for bars in TENSION, which is the one detailing applies (AM-03(f)). */
const TENSION = /\bTENSION\b/i;

/** What a note separates its clauses with — one sentence states the tension lap and the other's. */
const CLAUSES = /[/;]/;

/** The stirrup and tie hook this product bills: the 135° bend (AM-03, BS 8666). */
const HOOK_BEND = "135";

/** A minimum length, as a hook note states one: `min 75 mm`. */
const MINIMUM_MM = new RegExp(String.raw`\bmin(?:imum)?\.?\s*(${FIGURE})\s*(mm)\b`, "i");

/** Where one figure was found, so a later rule can ask what stood after it. */
type Found = { readonly at: number; readonly valueAsWritten: string; readonly canonical: string; readonly unitAsWritten: string };

/** The figure alone: the thousands commas a draughtsman grouped it with are not part of it. */
function figureOf(written: string): string {
  return written.replace(/,/g, "");
}

/** The first figure this text states in one of the units named, at or after `from`. */
function strengthIn(said: string, units: string, from = 0): Found | null {
  const pattern = new RegExp(String.raw`(${FIGURE})\s*(${units})`, "i");
  const match = pattern.exec(said.slice(from));
  if (match === null || match.index === undefined) return null;
  return { at: from + match.index, valueAsWritten: match[0], canonical: figureOf(match[1] as string), unitAsWritten: match[2] as string };
}

/** The first multiple of the bar diameter this text states at or after `from`. */
function multipleOfD(said: string, from = 0): Found | null {
  const match = MULTIPLE_OF_D.exec(said.slice(from));
  if (match === null || match.index === undefined) return null;
  return { at: from + match.index, valueAsWritten: match[0], canonical: figureOf(match[1] as string), unitAsWritten: "d" };
}

/**
 * The grade this note states, or null. AM-03(f) reads the grade in MPa where the note gives one —
 * `fy = 72,500 psi (500 MPa)` states one figure twice and the metric half is the one the detailing
 * rules are written in — and otherwise keeps the figure the drawing wrote, in the unit it wrote it.
 */
function readFy(said: string): Found | null {
  if (!STATES_FY.test(said)) return null;
  return strengthIn(said, String.raw`MPa|N\/mm2|N\/mm²`) ?? strengthIn(said, STRENGTH_UNITS);
}

/**
 * The concrete strength this note states, or null. AM-03(f) keys f'c in psi, so a note stating both
 * — `f'c = 3500 psi (24 MPa)` — is read at the psi figure; a note stating one unit keeps it.
 */
function readFc(said: string): Found | null {
  if (!STATES_FC.test(said)) return null;
  return strengthIn(said, "psi") ?? strengthIn(said, STRENGTH_UNITS);
}

/**
 * The tension lap this note states, or null. A note states two laps — one for bars in tension and
 * one for bars in compression — and the tension figure is the one a bill applies (AM-03(f)); the
 * clause that names TENSION is what says which figure that is, never the order they were written in.
 */
function readLap(said: string): Found | null {
  if (!/\bLAP\b/i.test(said)) return null;
  for (const clause of said.split(CLAUSES)) {
    if (!TENSION.test(clause)) continue;
    const stated = multipleOfD(clause);
    if (stated !== null) return stated;
  }
  return multipleOfD(said);
}

/**
 * The 135° hook extension this note states, or null. A hook note states the 90° bend beside it, and
 * the figure this product bills is the stirrup-and-tie 135° one (AM-03) — so the bend is found
 * first and the multiple read after it, rather than the first multiple in the sentence.
 */
function readHook(said: string): Found | null {
  const bend = said.indexOf(HOOK_BEND);
  return bend < 0 ? null : multipleOfD(said, bend);
}

/** The minimum hook length this note states, or null. Its own kind: one reading, one (value, unit). */
function readHookMin(said: string): Found | null {
  const match = MINIMUM_MM.exec(said);
  if (match === null) return null;
  return { at: match.index, valueAsWritten: `${match[1] as string} ${match[2] as string}`, canonical: figureOf(match[1] as string), unitAsWritten: match[2] as string };
}

/**
 * How each kind is read, keyed by the law's own roster: a kind the law gains has a reading here or
 * does not compile, and a reading here that names no kind cannot be written (B-19).
 */
const READINGS: Readonly<Record<NoteKind, (said: string) => Found | null>> = Object.freeze({
  FY: readFy,
  FC: readFc,
  LAP: readLap,
  HOOK: readHook,
  HOOK_MIN: readHookMin,
});

/**
 * Every figure these texts state, in the reading's own order (AC-1): by the source key the sentence
 * stands under, then by the order the law's roster of kinds stands in.
 *
 * A sentence stating no figure of a kind proposes nothing for it, and a sheet with no text at all
 * proposes nothing at all — an absence stated as the absence it is (R-UI-050, L-MEA-01).
 */
export function proposeNotes(texts: readonly SheetText[]): NoteProposal[] {
  const proposed: NoteProposal[] = [];
  for (const one of texts) {
    const said = normaliseNotation(one.text);
    for (const kind of NOTE_KINDS) {
      const found = READINGS[kind](said);
      if (found === null) continue;
      proposed.push({
        kind,
        sourceKey: one.sourceKey,
        text: one.text,
        valueAsWritten: found.valueAsWritten,
        unitAsWritten: found.unitAsWritten,
        canonical: found.canonical,
      });
    }
  }
  return proposed.sort((left, right) => {
    if (left.sourceKey !== right.sourceKey) return left.sourceKey < right.sourceKey ? -1 : 1;
    return NOTE_KINDS.indexOf(left.kind) - NOTE_KINDS.indexOf(right.kind);
  });
}
