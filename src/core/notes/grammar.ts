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
// never by a second control-code table (B-17) — and every sentence is read AFTER its MTEXT codes are
// resolved, so a paragraph or font code glued to `fy` or `LAP` no longer hides the word from the
// reader that looks for it (Interpretation I-459).
import type { ElementType } from "../catalogue/classes";
import { normaliseNotation } from "../entitygraph/notation";
import { classesDeclaredBy } from "../residue/declared";
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
  /**
   * The element class the note scopes this figure to — `f'c = 3000 psi (BORED PILES)` states the
   * piles' strength, not the project's — or null where it names none, which is a figure that governs
   * every class no scoped figure of its kind speaks for (Interpretation I-652).
   */
  readonly scopeClass: ElementType | null;
};

/** A figure as a note writes one: digits, the thousands commas a draughtsman groups them with. */
const FIGURE = String.raw`\d[\d,]*(?:\.\d+)?`;

/**
 * The same pattern, published: the clause reader beside this file lists the figures a clause states
 * so a model classifies with the drawing's own numbers in view, and a second spelling of "what a
 * figure looks like" would list numbers this grammar would not read (B-17).
 */
export const NOTE_FIGURE: string = FIGURE;

/** The units a strength is stated in. The roster is closed: a unit nobody wrote is not a unit. */
const STRENGTH_UNITS = String.raw`MPa|N\/mm2|N\/mm²|psi|ksi|kg\/cm2|kg\/cm²`;

/** The reinforcement grade names itself — `fy`, `f_y` — before it states anything. */
const STATES_FY = /\bf[\s_]?y\b/i;

/** The concrete strength names itself, however the font drew the prime: `f'c`, `f’c`, `fc`. */
const STATES_FC = /\bf[\s_]?['’´ʹ]?\s?c\b/i;

/**
 * Where a figure a reading takes may NOT start (Interpretation I-459; L-MEA-01: measure less,
 * never a guess):
 *   · inside a number — after a digit, or after a digit and the point or comma inside it — so a
 *     reading refused at `12` never starts again at its `2`;
 *   · after a figure and a slash — the lower half of a fraction or a ratio. A stacked fraction reads
 *     `a/b` once its MTEXT code is resolved, so `f'c = 4\S1/2; ksi` reads `4 1/2 ksi`, four and a
 *     half: taking its `2` as the strength, or the `2` of `\S1/2; ksi`, or the `12` of `4\S1/12;`,
 *     would propose a figure the note never stated. A ratio `415/500 MPa` states two grades, and
 *     reading the second alone would choose between them.
 * Nothing is read there instead. A figure after a slash that follows a word — `50d/40d`,
 * `60 ksi/415 MPa` — is read as before.
 */
const FIGURE_STARTS = String.raw`(?<!\d[.,]?)(?<!\d\s*\/\s*)`;

/** A lap is stated as a multiple of the bar diameter: `50d`. The `d` is the unit. */
const MULTIPLE_OF_D = new RegExp(String.raw`${FIGURE_STARTS}(${FIGURE})\s*d\b`, "i");

/** The lap a note states for bars in TENSION, which is the one detailing applies (AM-03(f)). */
const TENSION = /\bTENSION\b/i;

/** Does this text speak of a lap at all — `LAP`, `LAPS`, in either case? */
const STATES_LAP = /\bLAPS?\b/i;

/**
 * The clauses a lap is read within — what a note separates its clauses with (one sentence states the
 * tension lap and the other's), plus the line break an MTEXT paragraph mark `\P` reads as once its
 * codes are resolved (`normaliseNotation`), and a sentence end — a general-notes block is many
 * clauses in one text, and a lap figure belongs to the clause that names the lap, never to a stirrup
 * clause two paragraphs on.
 *
 * A slash between two figures is no clause boundary: it is a fraction's bar (`40 1/2d`) or a ratio's,
 * and cutting there would hand the figure under the bar to a clause of its own, where nothing is left
 * to say it was a denominator (I-459). A slash after a word still cuts: `50d/40d`, `TENSION / 40d`.
 */
const LAP_CLAUSES = /(?<!\d\s*)\/|\/(?!\s*\d)|[;\n]|\.(?=\s|$)/;

/** The stirrup and tie hook this product bills: the 135° bend (AM-03, BS 8666). */
const HOOK_BEND = "135";

/** A minimum length, as a hook note states one: `min 75 mm`. */
const MINIMUM_MM = new RegExp(String.raw`\bmin(?:imum)?\.?\s*(${FIGURE})\s*(mm)\b`, "i");

/**
 * Where one figure was found, so a later rule can ask what stood after it — and the statement it was
 * read in, which is where its scope is read (`scopeOf`).
 */
type Found = { readonly at: number; readonly valueAsWritten: string; readonly canonical: string; readonly unitAsWritten: string; readonly statement: string };

/** The figure alone: the thousands commas a draughtsman grouped it with are not part of it. */
function figureOf(written: string): string {
  return written.replace(/,/g, "");
}

/** The figure standing inside a written value, in one spelling for the grammar and the act (B-17). */
const WRITTEN_FIGURE = new RegExp(FIGURE);

/**
 * The canonical figure of a value as somebody wrote it: `500 MPa` and `50d` and `100` all stand at
 * the number inside them, which is what two readings of one note are compared on (R-TO-034).
 *
 * A value stating no figure at all canonicalises to its own words trimmed — the comparison then says
 * what it always says, that two readings agree when they say the same thing.
 */
export function canonicalFigure(valueAsWritten: string): string {
  const match = WRITTEN_FIGURE.exec(normaliseNotation(valueAsWritten));
  return match === null ? valueAsWritten.trim() : figureOf(match[0]);
}

/** The first figure this text states in one of the units named, at or after `from`. */
function strengthIn(said: string, units: string, from = 0): Found | null {
  const pattern = new RegExp(String.raw`${FIGURE_STARTS}(${FIGURE})\s*(${units})`, "i");
  const match = pattern.exec(said.slice(from));
  if (match === null || match.index === undefined) return null;
  return { at: from + match.index, valueAsWritten: match[0], canonical: figureOf(match[1] as string), unitAsWritten: match[2] as string, statement: said };
}

/** The first multiple of the bar diameter this text states at or after `from`. */
function multipleOfD(said: string, from = 0): Found | null {
  const match = MULTIPLE_OF_D.exec(said.slice(from));
  if (match === null || match.index === undefined) return null;
  return { at: from + match.index, valueAsWritten: match[0], canonical: figureOf(match[1] as string), unitAsWritten: "d", statement: said };
}

/** Either strength's name — where the statement of the other one ends. */
const NAMES_A_STRENGTH = new RegExp(`${STATES_FY.source}|${STATES_FC.source}`, "i");

/** Where one clause of a note ends once its MTEXT codes are resolved: the paragraph mark's line break. */
const CLAUSE_BREAK = "\n";

/**
 * What a note STATES of the strength one name names: in each clause (paragraph) that names it, the
 * words after the name up to where the clause names the other strength, or ends (I-459). A
 * notes block states fy and f'c a paragraph apart — `NOTES:\Pf'c = 3,500 psi\Pfy = 60,000 psi` — or a
 * comma apart — `(fy=60 ksi, f'c=4.5 ksi)` — and one strength's figure is never the other's: read
 * over the whole text, fy took the 3,500 psi of f'c and f'c took the 60 ksi of fy (L-MEA-01).
 */
function statementsOf(said: string, name: RegExp): string[] {
  const statements: string[] = [];
  for (const clause of said.split(CLAUSE_BREAK)) {
    const named = name.exec(clause);
    if (named === null) continue;
    const after = clause.slice(named.index + named[0].length);
    const other = NAMES_A_STRENGTH.exec(after);
    statements.push(other === null ? after : after.slice(0, other.index));
  }
  return statements;
}

/** The first figure a statement of this strength gives in the first roster of units that finds one. */
function strengthStated(said: string, name: RegExp, rosters: readonly string[]): Found | null {
  for (const statement of statementsOf(said, name)) {
    for (const units of rosters) {
      const found = strengthIn(statement, units);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * The grade this note states, or null. AM-03(f) reads the grade in MPa where the note gives one —
 * `fy = 72,500 psi (500 MPa)` states one figure twice and the metric half is the one the detailing
 * rules are written in — and otherwise keeps the figure the drawing wrote, in the unit it wrote it.
 * Either is read in what the note states of fy, never beside it (`statementsOf`).
 */
function readFy(said: string): Found | null {
  return strengthStated(said, STATES_FY, [String.raw`MPa|N\/mm2|N\/mm²`, STRENGTH_UNITS]);
}

/**
 * The concrete strength this note states, or null. AM-03(f) keys f'c in psi, so a note stating both
 * — `f'c = 3500 psi (24 MPa)` — is read at the psi figure; a note stating one unit keeps it. Either
 * is read in what the note states of f'c, never beside it (`statementsOf`).
 */
function readFc(said: string): Found | null {
  return strengthStated(said, STATES_FC, ["psi", STRENGTH_UNITS]);
}

/**
 * The tension lap this note states, or null. A note states two laps — one for bars in tension and
 * one for bars in compression — and the tension figure is the one a bill applies (AM-03(f)); the
 * clause that names TENSION is what says which figure that is, never the order they were written in.
 */
function readLap(said: string): Found | null {
  if (!STATES_LAP.test(said)) return null;
  const clauses = said.split(LAP_CLAUSES);
  for (const clause of clauses) {
    if (!TENSION.test(clause)) continue;
    const stated = multipleOfD(clause);
    if (stated !== null) return stated;
  }
  // No clause names TENSION: the figure is read from a clause that names the lap itself, and from no
  // other. A detailing note that says "NO LAP WITHIN A BEAM-COLUMN JOINT" and, two paragraphs on,
  // "STIRRUP ZONES: 2D FROM EACH SUPPORT FACE" states no lap — F-RCC6-BNBC's S-02 does exactly this,
  // and reading the whole text's first multiple of d proposed a 2d lap against the 50d the sheet
  // states beside it, suspending the standing (R-TO-034, L-MEA-01: nothing is assumed where a note
  // is silent).
  for (const clause of clauses) {
    if (!STATES_LAP.test(clause)) continue;
    const stated = multipleOfD(clause);
    if (stated !== null) return stated;
  }
  return null;
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
  return { at: match.index, valueAsWritten: `${match[1] as string} ${match[2] as string}`, canonical: figureOf(match[1] as string), unitAsWritten: match[2] as string, statement: said };
}

/** A parenthetical of a statement: the words between one pair of round brackets, nesting none. */
const PARENTHETICAL = /\(([^()]*)\)/g;

/**
 * A parenthetical that points AT another drawing rather than saying what the figure is for —
 * `(SEE S-05 PILE DETAIL)`, `(REFER S-03)` — names a sheet, not a scope, however many member nouns
 * its title carries.
 */
const REFERENCE = /^\s*(?:SEE|REF(?:ER)?\.?|AS PER)\b/i;

/** What a statement says of the class its figure is for: none, exactly one, or more than one. */
type Scope = { readonly named: "none" } | { readonly named: "one"; readonly scopeClass: ElementType } | { readonly named: "many" };

/**
 * The element class a statement scopes its figure to (Interpretation I-652), read through the
 * catalogue's closed word table (`classesDeclaredBy`) — the one reading of which member a drawing's
 * words name, never a second list of nouns here (B-17).
 *
 * The scope is what a parenthetical of the statement names: `f'c = 3000 psi (BORED PILES)` is the
 * piles' strength. A parenthetical naming no class — `(24 MPa)`, `(S-03)` — scopes nothing, and one
 * pointing at another sheet is a reference rather than a scope. A statement whose parentheticals name
 * two classes or more states a scope one reading cannot carry: `proposeNotes` offers no figure off it
 * rather than applying the figure beyond, or short of, what it was stated for (L-MEA-01).
 */
function scopeOf(statement: string): Scope {
  const named = new Set<ElementType>();
  for (const match of statement.matchAll(PARENTHETICAL)) {
    const inner = match[1] as string;
    if (REFERENCE.test(inner)) continue;
    for (const one of classesDeclaredBy(inner)) named.add(one);
  }
  if (named.size === 0) return { named: "none" };
  if (named.size > 1) return { named: "many" };
  return { named: "one", scopeClass: [...named][0] as ElementType };
}

/**
 * The class one statement of a note scopes its figures to, or null where it scopes none — published
 * so a model's offer on a clause carries the scope CODE read off that clause, never one the model
 * proposed (L-AI-03). A clause naming more than one class answers null here, and its figure is read
 * by the same rule `proposeNotes` applies: `readFigure` reads none off it.
 */
export function scopeClassOf(said: string): ElementType | null {
  const scope = scopeOf(normaliseNotation(said));
  return scope.named === "one" ? scope.scopeClass : null;
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

/** A figure one kind's own reader found, as a caller outside this file reads it. */
export type ReadFigure = {
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  /** The class the statement the figure was read in scopes it to, or null (I-652). */
  readonly scopeClass: ElementType | null;
};

/** One kind's figure off one normalised text, with its scope — or null where none is read or none can be scoped. */
function readScoped(kind: NoteKind, said: string): (Found & { readonly scopeClass: ElementType | null }) | null {
  const found = READINGS[kind](said);
  if (found === null) return null;
  const scope = scopeOf(found.statement);
  if (scope.named === "many") return null;
  return { ...found, scopeClass: scope.named === "one" ? scope.scopeClass : null };
}

/**
 * What ONE kind's reader reads off one sentence, or null where that sentence states no such figure.
 *
 * Published so the figure of a clause a MODEL classified is still the grammar's own reading of it:
 * the class is the only thing the model answers, and the digits are read here, by the same function
 * `proposeNotes` runs, off the same normalised text (L-AI-03 — a model reads and classifies, and
 * never moves a figure).
 */
export function readFigure(kind: NoteKind, said: string): ReadFigure | null {
  const found = readScoped(kind, normaliseNotation(said));
  if (found === null) return null;
  return { valueAsWritten: found.valueAsWritten, unitAsWritten: found.unitAsWritten, canonical: found.canonical, scopeClass: found.scopeClass };
}

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
      const found = readScoped(kind, said);
      if (found === null) continue;
      proposed.push({
        kind,
        sourceKey: one.sourceKey,
        text: one.text,
        valueAsWritten: found.valueAsWritten,
        unitAsWritten: found.unitAsWritten,
        canonical: found.canonical,
        scopeClass: found.scopeClass,
      });
    }
  }
  return proposed.sort((left, right) => {
    if (left.sourceKey !== right.sourceKey) return left.sourceKey < right.sourceKey ? -1 : 1;
    return NOTE_KINDS.indexOf(left.kind) - NOTE_KINDS.indexOf(right.kind);
  });
}
