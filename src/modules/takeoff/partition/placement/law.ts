// L-CAD-07's placement law: which class a member mark names, and which classes stand on a level
// rather than under one.
//
// "Label normalisation compares dotless-uppercase" — so a mark is read through the notation's own
// `normaliseMark` (B-17: one home) and the class is decided by the letters that mark opens with. The
// map is closed: a mark whose prefix it does not name is a member this stage does not place, which is
// an honest silence rather than a class guessed from a letter (L-QTY-04).
//
// Pure and storeless: the same mark reads the same class forever, which is what lets a stored
// partition be rebuilt onto identical rows (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { MemberShape } from "@/core/db";
import type { BandStatement } from "@/core/offers/contract";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { isMarkFamily, normaliseMark, parseDiameter, parseFloorZone } from "../notation";

/** The seven classes a mark names, each written as the member of the catalogue's roster it is. */
const COLUMN = "column" satisfies ElementType;
const SHEAR_WALL = "shear_wall" satisfies ElementType;
const FOOTING = "footing" satisfies ElementType;
const PILE_CAP = "pile_cap" satisfies ElementType;
const PILE = "pile" satisfies ElementType;
const BEAM = "beam" satisfies ElementType;
const TIE_BEAM = "tie_beam" satisfies ElementType;

/**
 * The closed map from the letters a mark opens with to the class it names (increment interfaces).
 * Exact rather than by longest prefix: `SW` is a shear wall and `S` is nothing, `TB` is a tie beam and
 * `T` is nothing, and a lookup that fell back on the first letter would place a stair mark as a shear
 * wall and every tie beam as a beam.
 */
const CLASS_OF_PREFIX: Readonly<Record<string, ElementType>> = Object.freeze({
  C: COLUMN,
  SW: SHEAR_WALL,
  F: FOOTING,
  PC: PILE_CAP,
  P: PILE,
  B: BEAM,
  TB: TIE_BEAM,
});

/** The letters a mark opens with, before the number that tells one member of a family from another. */
const MARK_PREFIX = /^([A-Z]+)\d/;

/**
 * L-CAD-07's vertical classes — "vertical classes (column, shear wall) expand per level at
 * placement". A member of one of these repeats over the levels its view's caption states.
 */
export const VERTICAL_CLASSES: readonly ElementType[] = Object.freeze([COLUMN, SHEAR_WALL]);

/**
 * L-CAD-07's foundation classes — "foundation classes take the lawful-null level basis". A footing
 * stands under the building rather than on a storey of it, so it takes the FOUNDATION slot whatever
 * the caption says (L-REG-04).
 */
export const FOUNDATION_CLASSES: readonly ElementType[] = Object.freeze([FOOTING, PILE_CAP, PILE, TIE_BEAM]);

/**
 * The classes that stand ON a level, and therefore expand over the levels their view states: L-CAD-07's
 * two verticals, and the beam. A beam is not a vertical — it does not run floor-to-floor through the
 * joint — but it is drawn once on a typical plan and stands on every storey that plan is typical of,
 * which is the same expansion (L-MEA-09, L-FRM-02).
 */
export const LEVEL_CLASSES: readonly ElementType[] = Object.freeze([...VERTICAL_CLASSES, BEAM]);

/**
 * The classes a layout plan draws as a PAIR OF EDGE LINES rather than as a closed outline: the members
 * that span between supports (L-MEA-09).
 *
 * A column is drawn as its own footprint, so the outline reader places it. A beam is not: a structural
 * plan draws it as two lines half a width either side of the axis it runs along, and the pair is what
 * anchors it (`./runs`). The two readers are exclusive, because a closed ring standing near a `B` mark
 * is whatever else the plan drew there — a stair well, a hatch boundary — and placing it would be a
 * member nobody drew, carrying no run to measure (L-QTY-04).
 */
export const FRAMED_CLASSES: readonly ElementType[] = Object.freeze([BEAM, TIE_BEAM]);

/**
 * The class this mark names, or null where it names none. Total over any text a drawing carries: a
 * caption, a dimension and a note all name no member and answer null rather than throwing, because a
 * plan's every text is put to this to find out which of them are marks at all.
 */
export function classOfMark(mark: string): ElementType | null {
  const normalised = normaliseMark(mark);
  if (!isMarkFamily(normalised)) return null;
  const prefix = MARK_PREFIX.exec(normalised)?.[1];
  return prefix === undefined ? null : (CLASS_OF_PREFIX[prefix] ?? null);
}

/**
 * L-REG-03: "each quantity kind has exactly one authoritative discipline". Every class this map
 * names is an RCC member — a column, a shear wall, a footing, a pile cap, a pile — and the discipline
 * that measures one is the structural. Read off the sheet law's closed roster rather than spelled
 * beside the sighting it is registered under (Q-07, B-17).
 */
export const PLACEMENT_DISCIPLINE: Discipline = DISCIPLINES[0];

/** Does a member of this class expand over the levels its view states (L-CAD-07)? */
export function isVerticalClass(type: ElementType): boolean {
  return VERTICAL_CLASSES.includes(type);
}

/** Does a member of this class stand in the lawful-null FOUNDATION slot (L-CAD-07, L-REG-04)? */
export function isFoundationClass(type: ElementType): boolean {
  return FOUNDATION_CLASSES.includes(type);
}

/** Does a member of this class expand over the levels its view stands over (L-CAD-07, L-MEA-09)? */
export function isLevelClass(type: ElementType): boolean {
  return LEVEL_CLASSES.includes(type);
}

/** Is a member of this class drawn as a run between its supports rather than as an outline (L-MEA-09)? */
export function isFramedClass(type: ElementType | null): type is ElementType {
  return type !== null && FRAMED_CLASSES.includes(type);
}

/** What separates the words of a caption or a schedule cell: everything that is not a letter or a digit. */
const LEVEL_WORDS = /[^A-Za-z0-9]+/;

/**
 * The level words a piece of the drawing's text says, in the order it says them. Each word is put to
 * the notation's own floor-zone reading (B-17: one home) — `1ST`, `GF`, `ROOF` name levels; `TYPICAL`,
 * `FLOOR`, `PLAN` and `TO` name none — so a caption's range is read by the same grammar a schedule's
 * `LEVELS` cell is, which is what lets the two be compared at all (L-CAD-07).
 *
 * Here rather than beside either reader because both read it: the expansion asks it of a caption, and
 * the placement asks it of a caption and of a schedule band (B-17).
 */
export function levelWordsOf(said: string): string[] {
  return levelSightingsOf(said).flatMap((sighting) => sighting.level ?? []);
}

/**
 * One word of a text as the level reading saw it: the word itself, uppercased the way every other
 * word of the notation is compared, and the level it names or null where it names none.
 *
 * The SIGHTINGS rather than the levels alone, because a note's range is stated by a word that is not
 * a level standing before one that is — `STARTS AT 1F` — and a reader handed only the levels cannot
 * see that `STARTS` was ever written. `levelWordsOf` is this projected onto the levels it saw, so the
 * two readings are one traversal and a word can never read as a level in one and not in the other
 * (B-17). The words are kept in the order the drawing wrote them, which is the only thing that says
 * which level a bounding word bounds.
 */
export type LevelSighting = { readonly word: string; readonly level: string | null };

/** Every word of the text, in order, each with the level it names or null (L-CAD-07). */
export function levelSightingsOf(said: string): LevelSighting[] {
  const sightings: LevelSighting[] = [];
  for (const word of said.split(LEVEL_WORDS)) {
    if (word === "") continue;
    const band = parseFloorZone(word);
    // A single word reads as a band of one level, or as no level at all; a word that read as a band of
    // two would be a separator this split already dropped.
    const level = band === null || band.from !== band.to ? null : band.from;
    sightings.push({ word: word.toUpperCase(), level });
  }
  return sightings;
}

/**
 * The shapes a plan note STATES about its member. One member for now — the circle — because that is
 * the one shape a plan writes in words a schedule has no cell for: `C7 Ø450 PORCH COLUMN` is a
 * circular column whose schedule row states `450x450` under every band, and the two are not in
 * disagreement (b = d = 450 either way; a B x D column schedule has no shape column). THE PLAN STATES
 * THE SHAPE, THE SCHEDULE STATES THE SIZE (I-304).
 *
 * THE ROSTER'S ONE HOME IS THE SEAM'S, and this file NAMES its members rather than restating the
 * list. `MemberShape` is `@/core/db`'s, because the store writes its CHECK from the same roster and a
 * second copy here would be two answers to what a plan note may say (B-17). It is the settled shape
 * of this question in this tree: `../grid/law` names two members of the seam's `GRID_FAMILIES` the
 * same way, for the same reason, and says so in as many words. The naming below is what `satisfies`
 * buys — a caller spells a shape by the roster and a member that left the roster stops compiling.
 */
const SHAPE: Readonly<Record<MemberShape, MemberShape>> = Object.freeze({ ROUND: "ROUND" });

/**
 * A plan note about one member: which mark it names, the class that mark is, the range of storeys it
 * states, and the shape it states. Interpretation I-303's whole evidence, read from the text alone.
 */
export type MemberNote = {
  readonly mark: string;
  readonly type: ElementType;
  readonly band: BandStatement | null;
  readonly shape: MemberShape | null;
};

/** What separates the words of a note: whitespace, and nothing else — a mark carries its own dashes. */
const NOTE_WORDS = /\s+/;

/**
 * The words that BOUND a note's range, and the only ones. Exactly one is admitted, because each such
 * word is a licence to narrow a member's span and the cost of admitting one wrongly is measured in
 * whole storeys: this fixture's paper-space revision row `C4 3RD-4TH BARS REVISED; ISSUED FO` and its
 * schedule sheet's `C2 GF TO 2ND:` both name a mark and then name two levels, and a rule that read a
 * range out of any two level words would pin seven C4 placements to 3F-4F — a five-storey
 * under-measurement of the biggest mark family on the sheet (L-QTY-06: no cell may go under by more
 * than 3 %). Neither of those texts says anything about where a member STANDS; both are talking about
 * something else that happens to name floors. `STARTS` is the one word that says where a member
 * begins and nothing else (L-QTY-01: never a guess).
 */
const BOUNDING_WORDS: ReadonlySet<string> = new Set(["STARTS"]);

/**
 * The range of storeys a note STATES, or null where it states none — `C5 FLOATING COLUMN OVER TG1
 * (STARTS AT 1F)` states 1F upwards, and `C7 Ø450 PORCH COLUMN` states nothing and answers null, at
 * which the caller reads I-303's other half: the member stands on the level the plan DRAWS.
 *
 * The statement is read by core's own `bandCovers`, whose meaning is already exactly what `STARTS AT
 * 1F` says: "an open end is no bound: a band stating only its start runs to the top of whatever it is
 * read against" (B-17 — the band has one meaning and this is not a second one).
 *
 * A band with BOTH ends open is unreachable here BY CONSTRUCTION, and that is the point of the shape
 * this returns rather than a convention it observes: `bandOpen` already means "covers everything"
 * (`contract.ts`), which is the precise OPPOSITE of what a note stating no range says, so a note
 * stating no range must answer null and never a band. The only band this can build is built from a
 * level word it actually saw, so `from` is a string every time it answers at all.
 */
export function bandStatedIn(said: string): BandStatement | null {
  const sightings = levelSightingsOf(said);
  const bound = sightings.findIndex((sighting) => sighting.level === null && BOUNDING_WORDS.has(sighting.word));
  if (bound < 0) return null;
  // The level the bounding word bounds is the first one written AFTER it: a note naming a level
  // before it names a beam it sits over, not the storey it starts at.
  const from = sightings.slice(bound + 1).find((sighting) => sighting.level !== null)?.level;
  return from === undefined || from === null ? null : { from, to: null };
}

/**
 * The shape the note's remainder states, read TOKEN BY TOKEN rather than over the sentence whole.
 * A diameter is a word — `Ø450` — and putting a whole note to a diameter reader asks it to find one
 * inside prose, which is how `C1 4-16Ø MAIN` would come back a 16 mm column. One token, one reading
 * (L-QTY-01).
 */
function shapeStatedIn(words: readonly string[]): MemberShape | null {
  return words.some((word) => parseDiameter(word) !== null) ? SHAPE.ROUND : null;
}

/**
 * This text read as a plan note about one member (Interpretation I-303: a plan note is evidence about
 * its member — the member it names is not one of the plan's typical, so it is not expanded by the
 * view's authored typical range; it stands on the level the plan draws, or over the range its own
 * note states), or null where the text is not one.
 *
 * Total over any text a drawing carries, the way `classOfMark` is: a plan's every text is put to this
 * to find out which of them are notes at all.
 *
 * THE TWO READERS PARTITION A PLAN'S TEXTS BY CONSTRUCTION. A text whose whole content is a mark IS a
 * mark and is `markOf`'s (`./detect`); a text this answers for is one `classOfMark` answers null for,
 * because `normaliseMark` strips whitespace (`@/core/identity`'s `dotlessUpper`) and so closes a whole
 * note up into one word that `MARK_FAMILY` refuses — `C7 %%C450 PORCH COLUMN` normalises to
 * `C7Ø450PORCHCOLUMN`, which is why both of this fixture's door strings read as NOTHING today and why
 * placing them is a door rather than a change of reading. The refusal is not left to that accident,
 * though: the guard below asks `classOfMark` of the WHOLE text first, because whitespace is the only
 * thing between `C7 450` and the mark `C7450`, and a text the mark reader takes may never also be
 * read as a note about itself.
 *
 * NO LAYER IS CONSULTED, here or anywhere below. L-CAD-07 reads a drawing by content signature and
 * never by layer names, and the mark reader this partitions against reads no layer either
 * (`./detect`'s `markOf`) — a note is what a text SAYS, not where a draughtsman filed it.
 *
 * A FRAMED class is refused for the same reason the mark reader refuses one: a beam is not placed
 * from an outline standing near its text, so a note about one has no member here to be evidence about
 * (L-MEA-09, `./runs`).
 *
 * AND THE LAST FENCE: THE REMAINDER MUST STATE SOMETHING THIS RULE CAN ACT ON. A note is read here
 * only where its words yield a SHAPE or a BOUNDED RANGE — the two answers I-303 admits and the only
 * two this stage knows what to do with. A mark followed by prose the grammar takes nothing from is a
 * draughtsman's aside, not a statement about where a member stands, and it leaves its member exactly
 * as the plan's typical range found it.
 *
 * That fence is what makes the rule SAFE rather than merely narrow, and it is worth saying why in
 * full, because the unsafe version passes this fixture. Without it, every mark-headed sentence on a
 * plan reads as a note stating no range — and a note stating no range is not inert: I-303's other
 * half puts its member on the level the plan DRAWS and takes every other storey away. So
 * `C4 SEE DETAIL 3/S-12` would pin the C4 family to one storey on the strength of a cross-reference,
 * and this fixture's own `C4 3RD-4TH BARS REVISED; ISSUED FO` and `C2 GF TO 2ND:` would do the same
 * on the strength of two texts that are talking about bars and a schedule band. Each of those three
 * is refused here by its own words rather than by an accident of where it was drawn — which matters,
 * because the two fences that keep this fixture's pair out of the stage at all (a paper-space text is
 * in no view's assignment map, `../views/assign`; a SCHEDULE view yields no instances, `./detect`)
 * are true of THIS drawing and are no guarantee about the next one. A reading that is only safe
 * because of where a text was filed is not a reading (L-QTY-01: never a guess; L-QTY-04: the drawing
 * was silent, so never a silent default).
 *
 * It also makes the singularity guard (`soleNotesAmong`) belt-and-braces rather than load-bearing:
 * S-23's three `SW1 L=…` notes state neither a shape nor a range and are refused right here, before
 * anything has to notice that there are three of them.
 */
export function memberNoteOf(said: string): MemberNote | null {
  const words = said.trim().split(NOTE_WORDS).filter((word) => word !== "");
  const named = words[0];
  // A bare mark carries no further word, and a note is a mark followed by something said about it.
  if (named === undefined || words.length < 2) return null;
  // The whole text read as a mark is a mark, whatever its words look like taken apart.
  if (classOfMark(said) !== null) return null;
  const type = classOfMark(named);
  if (type === null || isFramedClass(type)) return null;
  const rest = words.slice(1);
  const band = bandStatedIn(rest.join(" "));
  const shape = shapeStatedIn(rest);
  // Neither answer stated: this text names a mark and then says something else.
  if (band === null && shape === null) return null;
  return { mark: normaliseMark(named), type, band, shape };
}

/**
 * The notes that are the ONLY note naming their mark, keyed by that mark — the note half of I-303's
 * singularity guard.
 *
 * A note excepts its member from the view's typical range, and an exception may only be taken where
 * there is no doubt which member is excepted. F-RCC6-BNBC's S-23 LIFT CORE PLAN writes TWO notes
 * naming `SW1`, neither of them stating a storey; a blunt rule that let either one except the mark
 * would collapse every shear wall of that core onto the one level the plan draws, which is the
 * over-narrowing I-303 exists to forbid (I-303 only ever NARROWS, and never past what the evidence
 * singles out). Two notes about one mark are two statements, and this stage is in no position to
 * choose between them, so it takes neither and the mark expands as it always did (L-QTY-01).
 *
 * This is HALF the guard, and the half that is a fact about the notes alone. The other half — that
 * the mark names exactly one member — is a fact about the placements the stage holds, and is the
 * stage's to apply beside its own roster.
 */
export function soleNotesAmong(notes: readonly MemberNote[]): Map<string, MemberNote> {
  const byMark = new Map<string, MemberNote[]>();
  for (const note of notes) byMark.set(note.mark, [...(byMark.get(note.mark) ?? []), note]);
  const sole = new Map<string, MemberNote>();
  for (const [mark, named] of byMark) {
    const only = named.length === 1 ? named[0] : undefined;
    if (only !== undefined) sole.set(mark, only);
  }
  return sole;
}
