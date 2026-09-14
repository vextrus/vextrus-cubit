// R-TO-034's notes grammar: what a sheet's general notes STATE about reinforcement, read
// deterministically off the sheet's own text (L-CAD-08 — a drawing's conventions resolve from what
// the drawing carries, never from a seed and never from a model).
//
// Pure by construction: no store, no clock, no model. The same texts read twice answer the same
// list, and the order is the READING's — by the entity each figure was read from, then by the law's
// own order of kinds — so the input's order cannot change the answer (L-ACT-02's digest depends on
// it, and a person comparing two sheets should see one shape).
//
// It reads FORMS, not sentences. Each kind below is a rule about how a note states that figure —
// the parenthesised MPa grade, the psi cylinder strength, the multiplier labelled TENSION, the
// multiplier under 135°, the stated minimum — so a drawing that states another figure in the same
// form is read as THAT figure, and a sentence that states none proposes nothing at all (L-MEA-01:
// nothing is assumed where a note is silent).
import { normaliseNotation } from "@/modules/takeoff/partition/notation";
import { NOTE_KINDS, type NoteKind } from "./law";

/** One text entity of a sheet, as the grammar is handed one: what it says, and where it stands. */
export type SheetText = {
  readonly sourceKey: string;
  readonly text: string;
};

/**
 * One figure a note states, offered for a person to accept or edit. `valueAsWritten` is the
 * substring the drawing wrote and `canonical` the figure alone — the two are kept apart because a
 * reading is recorded as it was written beside what was made of it (L-QTY-01, L-REG-01).
 */
export type NoteProposal = {
  readonly kind: NoteKind;
  readonly sourceKey: string;
  /** The sentence this figure was read out of, whole and verbatim. */
  readonly text: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
};

/* ------------------------------------------------------------------ the forms a figure is written in */

/** A figure as a drawing writes one: digits, the grouping commas a note may carry, and a decimal. */
const FIGURE = String.raw`\d[\d,]*(?:\.\d+)?`;

/** The units a concrete or steel strength is stated in on a Bangladeshi structural sheet. */
const STRENGTH_UNITS = String.raw`MPa|N/mm2|psi|ksi`;

/** The units a stated minimum length is written in. Longest first: `mm` is not an `m`. */
const LENGTH_UNITS = String.raw`mm|cm|in|m`;

/** `fy = …` — the reinforcement grade, however the rest of the sentence names its standard. */
const STATES_GRADE = /\bfy\b/i;

/** `f'c = …` — the cylinder strength, with the prime written as any of the marks a CAD text carries. */
const STATES_STRENGTH = /\bf\s*['’´]?\s*c\b/i;

/** The sentence that rules laps, and the one that rules hooks. */
const STATES_LAP = /\blaps?\b/i;
const STATES_HOOK = /\bhooks?\b/i;

/** The word that tells a lap's two multipliers apart — a lap in tension is the one that is billed. */
const IN_TENSION = /\btension\b/i;

/** The bend a stirrup or tie is hooked at (L-FRM-05): the multiplier stated under it is the hook's. */
const AT_STIRRUP_BEND = /135/;

/** A figure with its strength unit, anywhere in the sentence. */
const strengthFigures = new RegExp(String.raw`(${FIGURE})\s*(${STRENGTH_UNITS})\b`, "gi");

/** A multiplier of the bar diameter: `50d`, `10 d` — never the `d` inside a word. */
const diameterMultipliers = new RegExp(String.raw`(?<![A-Za-z0-9])(${FIGURE})\s*d\b`, "gi");

/** A stated minimum with its unit: `min 75 mm`, `minimum 100mm`. */
const statedMinimum = new RegExp(String.raw`\bmin(?:\.|imum)?\s*((${FIGURE})\s*(${LENGTH_UNITS}))\b`, "i");

/** What a rule read out of one sentence: the drawing's own words, and the figure alone. */
type Read = { readonly valueAsWritten: string; readonly unitAsWritten: string; readonly canonical: string };

/** The figure alone, as a decimal string: the grouping commas a note writes are not part of it. */
function figureOf(written: string): string {
  return written.replace(/,/g, "");
}

/** One occurrence of a form: what it said, and where in the sentence it stood. */
type Occurrence = { readonly at: number; readonly end: number; readonly read: Read };

/** Every figure-with-unit in one sentence, in the order the sentence writes them. */
function strengthsIn(said: string): Occurrence[] {
  const found: Occurrence[] = [];
  for (const match of said.matchAll(strengthFigures)) {
    const at = match.index ?? 0;
    found.push({
      at,
      end: at + match[0].length,
      read: { valueAsWritten: match[0], unitAsWritten: match[2] as string, canonical: figureOf(match[1] as string) },
    });
  }
  return found;
}

/** Every bar-diameter multiplier in one sentence, in the order the sentence writes them. */
function multipliersIn(said: string): Occurrence[] {
  const found: Occurrence[] = [];
  for (const match of said.matchAll(diameterMultipliers)) {
    const at = match.index ?? 0;
    found.push({
      at,
      end: at + match[0].length,
      read: { valueAsWritten: match[0], unitAsWritten: "d", canonical: figureOf(match[1] as string) },
    });
  }
  return found;
}

/**
 * A strength stated in the unit its clause is keyed in, or — where the note states no figure in that
 * unit — the first figure it states, in the unit it wrote. AM-03(f) keys f'c in psi and the grade in
 * MPa; a note that states only the other one has still stated a figure, and it is kept as written
 * rather than converted here (the conversion is inc-309's, IOU §8).
 */
function strengthKeyedIn(said: string, unit: string): Read | null {
  const stated = strengthsIn(said);
  const keyed = stated.find((one) => one.read.unitAsWritten.toLowerCase() === unit.toLowerCase());
  return (keyed ?? stated[0])?.read ?? null;
}

/** The reinforcement grade: `fy = 72,500 psi (500 MPa)` states 500 MPa, and `fy = 420 MPa` states 420. */
function readGrade(said: string): Read | null {
  return STATES_GRADE.test(said) ? strengthKeyedIn(said, "MPa") : null;
}

/** The concrete strength: `f'c = 3500 psi (24 MPa) cylinder` states 3500 psi (AM-03(f) keys it in psi). */
function readStrength(said: string): Read | null {
  return STATES_STRENGTH.test(said) ? strengthKeyedIn(said, "psi") : null;
}

/**
 * The lap multiplier a bill is measured with: the one the note labels TENSION, which is the lap a
 * spliced bar in tension carries (AM-03(a): laps are billed as their own component). A note stating
 * one multiplier and no label has stated the lap it has.
 */
function readLap(said: string): Read | null {
  if (!STATES_LAP.test(said)) return null;
  const stated = multipliersIn(said);
  const labelled = stated.find((one, at) => IN_TENSION.test(said.slice(one.end, stated[at + 1]?.at ?? said.length)));
  return (labelled ?? stated[0])?.read ?? null;
}

/**
 * The hook's multiplier: the one stated under the 135° bend a stirrup or tie is hooked at, told from
 * the 90° bend stated beside it by the clause each stands in. A hooks note that states no 135° bend
 * states no stirrup hook, and proposes none.
 */
function readHook(said: string): Read | null {
  if (!STATES_HOOK.test(said)) return null;
  const stated = multipliersIn(said);
  const bent = stated.find((one, at) => AT_STIRRUP_BEND.test(said.slice(stated[at - 1]?.end ?? 0, one.at)));
  return bent?.read ?? null;
}

/** The hook's stated minimum length: `min 75 mm`, the floor the multiplier is taken against. */
function readHookMinimum(said: string): Read | null {
  if (!STATES_HOOK.test(said)) return null;
  const stated = statedMinimum.exec(said);
  return stated === null
    ? null
    : { valueAsWritten: stated[1] as string, unitAsWritten: stated[3] as string, canonical: figureOf(stated[2] as string) };
}

/**
 * The grammar itself: one rule per kind, total over the law's roster. A kind added to `NOTE_KINDS`
 * with no rule here does not compile, which is what keeps the two in step (B-19).
 */
const RULES: Readonly<Record<NoteKind, (said: string) => Read | null>> = Object.freeze({
  FY: readGrade,
  FC: readStrength,
  LAP: readLap,
  HOOK: readHook,
  HOOK_MIN: readHookMinimum,
});

/* ------------------------------------------------------------------------------- the reading */

/**
 * What a sheet's texts propose (test contract: `proposeNotes`). Every text is read for itself —
 * whatever stands beside it on the sheet — and the answers are sorted by the entity each was read
 * from, then by the law's own order of kinds.
 *
 * The text is put through the notation's one normaliser first, so a note carrying a DXF control code
 * reads as the words it draws; the proposal keeps the sentence exactly as the drawing wrote it, so
 * what a person is shown is the drawing's own line (L-CAD-03).
 */
export function proposeNotes(texts: readonly SheetText[]): NoteProposal[] {
  const proposed: NoteProposal[] = [];
  for (const one of texts) {
    const said = normaliseNotation(one.text);
    for (const kind of NOTE_KINDS) {
      const read = RULES[kind](said);
      if (read === null) continue;
      proposed.push({ kind, sourceKey: one.sourceKey, text: one.text, ...read });
    }
  }
  return proposed.sort(
    (left, right) =>
      (left.sourceKey < right.sourceKey ? -1 : left.sourceKey > right.sourceKey ? 1 : 0) ||
      NOTE_KINDS.indexOf(left.kind) - NOTE_KINDS.indexOf(right.kind),
  );
}
