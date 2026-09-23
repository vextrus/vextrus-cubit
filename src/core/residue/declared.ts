// What the drawings DECLARE they show (s-coverage I-479, L-QTY-05's second and third
// channels read at their own grain): a view's caption and a schedule's title name the members the
// view is a drawing of. "GRADE BEAM LAYOUT & GF SLAB ON GRADE" is a drawing of tie beams and of a
// slab whether or not the partition placed a single member off it, and a coverage that knew only the
// classes the partition placed would print a boundary that silently leaves both out — which is the
// omission L-QTY-07 exists to forbid.
//
// Read by a closed word table, first match per word and never guessed: a word the table does not
// hold says nothing, and a caption naming no member names no class. Pure — every reading below is of
// strings a caller has already read — so it is judged without a database, and the grid and the
// certificate read the same answer (B-19).
import type { ElementType } from "../catalogue/classes";
import type { UnclassedDeclaration } from "./law";
// L-CAD-06's view classes are read from the one place core may reach them, in the law's own order —
// never spelled here (the vocabulary has one home; `view-type-literals.test.ts` holds the ban).
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";

/** The three view classes whose caption draws no member: a note or legend, a title, and no caption at all. */
const [, , , , , , , LEGEND_NOTES, TITLE, , UNASSIGNED] = VIEW_TYPE_SPELLINGS;

/** One view of the pinned manifest, as the partition stored it and a reader addresses it. */
export type ManifestView = {
  readonly drawingId: string;
  /** L-REG-04's address of the view — the key a placement, an offer and a rail's report name it by. */
  readonly address: string;
  /** L-CAD-06's class of the view, as the partition's grammar read it. */
  readonly type: string;
  /** The caption as the drawing states it; empty where none anchors the view. */
  readonly caption: string;
  /** The source key of the caption's own entity — what a reader is flown to — or null where none anchors it. */
  readonly anchorKey: string | null;
};

// The shape stands with the residue's vocabulary (`./law`), which the reading and the certificate
// both read; this file only produces it.
export type { UnclassedDeclaration } from "./law";

/**
 * The view classes whose caption is not a drawing OF a member: a title block names the project and
 * a note or a legend talks ABOUT members without drawing one, so neither declares a class (L-CAD-06).
 */
const NOT_A_DRAWING_OF_MEMBERS: ReadonlySet<string> = new Set<string>([TITLE, LEGEND_NOTES, UNASSIGNED]);

/** The DXF text escapes a caption may carry, which say nothing about what the view is. */
const ESCAPES = ["%%U", "%%O", "%%C", "%%D", "%%P"];

/** A caption as the table reads it: its words, upper case, the escapes gone. */
function wordsOf(caption: string): string[] {
  let text = caption.toUpperCase();
  for (const escape of ESCAPES) text = text.split(escape).join("");
  return text.split(/[^A-Z0-9]+/u).filter((word) => word !== "");
}

/** The words that make the BEAM after them a tie beam — a grade beam is the tie beam at ground (R-TO-032). */
const TIE_BEAM_QUALIFIERS: ReadonlySet<string> = new Set(["GRADE", "TIE", "PLINTH"]);

/** The words that make the WALL after them an RCC wall — a lift core's walls are shear walls. */
const RCC_WALL_QUALIFIERS: ReadonlySet<string> = new Set(["SHEAR", "CORE", "RETAINING", "LIFT"]);

/** The words after LIFT that name its RCC enclosure rather than the machine. */
const LIFT_ENCLOSURE: ReadonlySet<string> = new Set(["CORE", "PIT", "SHAFT", "WELL"]);

/**
 * The closed table: what one word, read beside its neighbours, declares. `null` is "this word names
 * no class" — the table's only other answer, never a guess.
 */
function classOfWord(word: string, before: string | undefined, after: string | undefined): ElementType | null {
  switch (word) {
    case "BEAM":
    case "BEAMS":
      return before !== undefined && TIE_BEAM_QUALIFIERS.has(before) ? "tie_beam" : "beam";
    case "COLUMN":
    case "COLUMNS":
      return "column";
    case "PILECAP":
    case "PILECAPS":
      return "pile_cap";
    case "PILE":
    case "PILES":
      return after === "CAP" || after === "CAPS" ? "pile_cap" : "pile";
    case "FOOTING":
    case "FOOTINGS":
      return "footing";
    case "SLAB":
    case "SLABS":
      return "slab";
    // A stair's ROOF is the stair room's roof — its slab and beams — and not a flight of stairs.
    case "STAIR":
    case "STAIRS":
    case "STAIRCASE":
      return after === "ROOF" ? null : "stair";
    case "LINTEL":
    case "LINTELS":
      return "lintel";
    case "WALL":
    case "WALLS":
      if (before === "BRICK") return "brick_wall";
      return before !== undefined && RCC_WALL_QUALIFIERS.has(before) ? "shear_wall" : null;
    case "LIFT":
      return after !== undefined && LIFT_ENCLOSURE.has(after) ? "shear_wall" : null;
    case "BRICKWORK":
      return "brick_wall";
    default:
      return null;
  }
}

/**
 * The members a drawing shows that no class of the roster is, by the word that names each. Closed:
 * these are the ones a Bangladeshi structural set draws a sheet for (a water tank, a septic tank, a
 * reservoir, a parapet, a sunshade, a ramp, a canopy), and a word outside it says nothing.
 */
const UNCLASSED_WORDS: Readonly<Record<string, string>> = Object.freeze({
  TANK: "tank",
  TANKS: "tank",
  RESERVOIR: "reservoir",
  PARAPET: "parapet",
  SUNSHADE: "sunshade",
  SUNSHADES: "sunshade",
  CHAJJA: "sunshade",
  RAMP: "ramp",
  CANOPY: "canopy",
});

/** The classes one caption declares, each once, in the order the caption names them. */
export function classesDeclaredBy(caption: string): ElementType[] {
  const words = wordsOf(caption);
  const held: ElementType[] = [];
  words.forEach((word, at) => {
    const named = classOfWord(word, words[at - 1], words[at + 1]);
    if (named !== null && !held.includes(named)) held.push(named);
  });
  return held;
}

/** The unclassed members one caption names, each word once, in the order the caption names them. */
export function unclassedDeclaredBy(caption: string): string[] {
  const held: string[] = [];
  for (const word of wordsOf(caption)) {
    const named = UNCLASSED_WORDS[word];
    if (named !== undefined && !held.includes(named)) held.push(named);
  }
  return held;
}

/** Whether a view's caption is one that can declare what it draws at all. */
export function declaresMembers(view: Pick<ManifestView, "type" | "caption">): boolean {
  return view.caption.trim() !== "" && !NOT_A_DRAWING_OF_MEMBERS.has(view.type);
}

/** One class declared by one view: what the residue turns into a declared sighting. */
export type ClassDeclaration = {
  readonly class: ElementType;
  readonly view: ManifestView;
};

/**
 * Every class the manifest's views declare, one per (class, drawing, caption) — the same caption
 * stored twice across two ingests of one drawing is one declaration, not two.
 */
export function classDeclarationsOf(views: readonly ManifestView[]): ClassDeclaration[] {
  const seen = new Set<string>();
  const held: ClassDeclaration[] = [];
  for (const view of views) {
    if (!declaresMembers(view)) continue;
    for (const klass of classesDeclaredBy(view.caption)) {
      const key = `${klass}\u0000${view.drawingId}\u0000${view.caption}`;
      if (seen.has(key)) continue;
      seen.add(key);
      held.push({ class: klass, view });
    }
  }
  return held;
}

/**
 * Every unclassed member the manifest's views draw, one per (word, drawing, caption), in the order
 * the views were read — the certificate's order is `unclassedStatementOf`'s, in one home.
 */
export function unclassedDeclarationsOf(views: readonly ManifestView[]): UnclassedDeclaration[] {
  const seen = new Set<string>();
  const held: UnclassedDeclaration[] = [];
  for (const view of views) {
    if (!declaresMembers(view)) continue;
    for (const word of unclassedDeclaredBy(view.caption)) {
      const key = `${word}\u0000${view.drawingId}\u0000${view.caption}`;
      if (seen.has(key)) continue;
      seen.add(key);
      held.push({ drawingId: view.drawingId, address: view.address, caption: view.caption, word });
    }
  }
  return held;
}
