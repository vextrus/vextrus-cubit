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
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { isMarkFamily, normaliseMark, parseFloorZone } from "../notation";

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
 * which is the same expansion (L-MEA-09, increment interfaces).
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
  const words: string[] = [];
  for (const word of said.split(LEVEL_WORDS)) {
    if (word === "") continue;
    const band = parseFloorZone(word);
    // A single word reads as a band of one level, or as no level at all; a word that read as a band of
    // two would be a separator this split already dropped.
    if (band === null || band.from !== band.to) continue;
    words.push(band.from);
  }
  return words;
}
