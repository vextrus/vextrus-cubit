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
import { isMarkFamily, normaliseMark } from "../notation";

/** The five classes a mark names, each written as the member of the catalogue's roster it is. */
const COLUMN = "column" satisfies ElementType;
const SHEAR_WALL = "shear_wall" satisfies ElementType;
const FOOTING = "footing" satisfies ElementType;
const PILE_CAP = "pile_cap" satisfies ElementType;
const PILE = "pile" satisfies ElementType;

/**
 * The closed map from the letters a mark opens with to the class it names (increment interfaces).
 * Exact rather than by longest prefix: `SW` is a shear wall and `S` is nothing, and a lookup that
 * fell back on the first letter would place a stair mark as a shear wall.
 */
const CLASS_OF_PREFIX: Readonly<Record<string, ElementType>> = Object.freeze({
  C: COLUMN,
  SW: SHEAR_WALL,
  F: FOOTING,
  PC: PILE_CAP,
  P: PILE,
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
export const FOUNDATION_CLASSES: readonly ElementType[] = Object.freeze([FOOTING, PILE_CAP, PILE]);

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
