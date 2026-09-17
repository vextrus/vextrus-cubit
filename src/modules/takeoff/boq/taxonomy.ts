// L-BD-08's presentation taxonomy AS DATA: the six bills, and the rows that place a measured line in
// one of them (AM-14, AM-16, docs/decisions/bill-taxonomy.md).
//
// Nothing here resolves anything — `./resolver.ts` reads this table and answers. The split is the
// clause's own: "six bills … as swappable data, resolved most-specific-first". A taxonomy that was
// written as conditionals inside a resolver could not be swapped, and a resolver that knew a class
// by name would go on knowing it after the table was replaced.
//
// THE THREE ROW KINDS, most specific first. An `override` names an element class (and, where the
// same class bills two ways for two trades, its kind as well); a `group` names a whole kind; a
// `division` names a kind's chapter — the text before the dot. A row targets one of the six bills,
// or `LOCATION`, which is AM-14 §1's plinth cut expressed as DATA rather than as a conditional: the
// line bills to Substructure at or below the plinth and to Superstructure above it, and which side
// it stands on is read off the level stack.
//
// NO PROJECT NAMES (L-BD-08). Every key here is a class, a kind or a chapter of this product's own
// closed rosters, so a project cannot be special-cased by adding a row.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { BOQ_SECTIONS } from "@/core/documents/kinds/boq-draft";

/**
 * L-BD-08's six bills (L244), in the clause's own order — AM-16 restored Electrical and Plumbing and
 * took Masonry and Provisional sums out.
 *
 * The roster itself is declared in core, beside the document kind whose schema and presenter read it:
 * ARCH-01 forbids the document seam to import this module, and a draft that printed six sections
 * while the taxonomy placed lines into a seventh would be two rosters pretending to be one (B-17).
 * This is the name the takeoff module knows it by, and it re-declares nothing.
 */
export const BILLS = BOQ_SECTIONS;

/** One bill of the taxonomy, drawn from the closed roster above. */
export type Bill = (typeof BILLS)[number];

/**
 * What a line the taxonomy places in no bill is kept as: labelled, reasoned and never dropped
 * (L-BD-08). It is the resolver's own answer and never a seventh member of `BILLS`.
 */
export const UNCLASSIFIED = "UNCLASSIFIED";

/**
 * A provisional sum is a LABELLED LINE at the end of the bill whose scope it provides for, never a
 * bill of its own (AM-16). The constant stands here because the placement rule is the taxonomy's;
 * no act authors one at M3, so nothing yet carries it.
 */
export const PROVISIONAL_SUM = "PROVISIONAL_SUM";

/**
 * A row target meaning "Substructure at or below the plinth, Superstructure above it" (AM-14 §1).
 * Masonry, lintels and the verticals bill this way: their bill is their location, and the location
 * cut is therefore a row of the table rather than a branch of the resolver.
 */
export const LOCATION = "LOCATION";

/** Why a line is unclassified: no row reached it, or the location cut could not read its level. */
export const UNCLASSIFIED_REASONS = ["NO_TAXONOMY_ROW", "LEVEL_NOT_IN_STACK"] as const;

/** One registered reason, drawn from the closed roster above. */
export type UnclassifiedReason = (typeof UNCLASSIFIED_REASONS)[number];

/**
 * The labels a level stack names the plinth with. No level carries a flag saying "this is the
 * plinth", so the boundary is recognised by the label a drawing set writes it under; a stack that
 * names none falls back to the ground floor, which is where AM-14 puts Superstructure's first storey
 * ("from the ground-floor slab up").
 */
export const PLINTH_LEVEL_LABELS = ["PL", "P.L", "P.L.", "PLINTH", "PLINTH LEVEL", "PLINTH LVL"] as const;

/** What a row may send a line to: one of the six bills, or the location cut that chooses between two. */
export type BillTarget = Bill | typeof LOCATION;

/** The most specific row: an element class, optionally narrowed to one kind it bears. */
export type BillOverrideRow = { readonly class: ElementType; readonly kind?: Kind; readonly bill: BillTarget };

/** A whole kind, whatever class bears it — the trade-grain row. */
export type BillGroupRow = { readonly group: Kind; readonly bill: BillTarget };

/** A kind's chapter, the text before the dot: `rcc`, `piling`, `earthwork`, `pcc`, `masonry`, `finish`. */
export type BillDivisionRow = { readonly division: string; readonly bill: BillTarget };

/** The taxonomy as one swappable value: a version to stamp documents with, the bills, and the rows. */
export type BillTaxonomy = {
  readonly version: string;
  readonly bills: readonly Bill[];
  readonly overrides: readonly BillOverrideRow[];
  readonly groups: readonly BillGroupRow[];
  readonly divisions: readonly BillDivisionRow[];
};

/**
 * The taxonomy this product ships, and the version every document it drafts is stamped with. Moving
 * a row moves the version with it: an issued document states the taxonomy it was drafted under and
 * never follows a later one (L-BD-08, `BOQ_TAXONOMY_VERSION_MOVED`).
 */
export const BILL_TAXONOMY: BillTaxonomy = Object.freeze({
  version: "bill-taxonomy/2026-09-16",
  bills: BILLS,

  // The class rows, in docs/decisions/bill-taxonomy.md's own table order. The substructure classes
  // are Substructure wherever they stand — a pile cap above the plinth is not a thing — and the
  // frame above it is Superstructure the same way. The three that bill BY LOCATION are the ones the
  // plinth actually cuts: the verticals that run through it, the masonry that infills them, and the
  // lintels that follow their wall (AM-16: "lintels follow their masonry, not the finish over them").
  overrides: Object.freeze([
    Object.freeze({ class: "pile", bill: "SUBSTRUCTURE" }),
    Object.freeze({ class: "pile_cap", bill: "SUBSTRUCTURE" }),
    Object.freeze({ class: "footing", bill: "SUBSTRUCTURE" }),
    Object.freeze({ class: "tie_beam", bill: "SUBSTRUCTURE" }),
    Object.freeze({ class: "column", bill: LOCATION }),
    Object.freeze({ class: "shear_wall", bill: LOCATION }),
    Object.freeze({ class: "brick_wall", bill: LOCATION }),
    Object.freeze({ class: "lintel", bill: LOCATION }),
    Object.freeze({ class: "beam", bill: "SUPERSTRUCTURE" }),
    Object.freeze({ class: "slab", bill: "SUPERSTRUCTURE" }),
    Object.freeze({ class: "stair", bill: "SUPERSTRUCTURE" }),
  ]) as readonly BillOverrideRow[],

  // The trade-grain rows: a finished face is Finishes whatever bears it, which is the one
  // surface-trade bill L-BD-08 names.
  groups: Object.freeze([
    Object.freeze({ group: "finish.plaster", bill: "FINISHES" }),
    Object.freeze({ group: "finish.paint", bill: "FINISHES" }),
  ]) as readonly BillGroupRow[],

  // The chapter rows: what places a class the table above has no row for. Earthwork, blinding and
  // piling are ground work and bill to Substructure; concrete and formwork bill where they stand;
  // masonry does too (AM-16's whole argument); a finish is Finishes.
  divisions: Object.freeze([
    Object.freeze({ division: "earthwork", bill: "SUBSTRUCTURE" }),
    Object.freeze({ division: "pcc", bill: "SUBSTRUCTURE" }),
    Object.freeze({ division: "piling", bill: "SUBSTRUCTURE" }),
    Object.freeze({ division: "rcc", bill: LOCATION }),
    Object.freeze({ division: "masonry", bill: LOCATION }),
    Object.freeze({ division: "finish", bill: "FINISHES" }),
  ]) as readonly BillDivisionRow[],
});

/**
 * What a section is called on a page (AM-05: the word the law reserves for a signed bill appears in
 * no label this product prints). The words are the Design Decision's own; they stand here because
 * ARCH-01 forbids the module and the document seam to read `src/ui/strings`, and one table read by
 * the emission is what keeps the draft on screen and the draft in the PDF saying the same word.
 */
export const BILL_LABELS: Readonly<Record<Bill, string>> = Object.freeze({
  SUBSTRUCTURE: "Substructure",
  SUPERSTRUCTURE: "Superstructure",
  FINISHES: "Finishes",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  EXTERNAL: "External",
});

/** What the kept-and-labelled block of unplaced lines is called (L-BD-08, I-266). */
export const UNCLASSIFIED_LABEL = "Unclassified";

/** Is this value one of the six bills? Asked wherever a bill arrives as text — a payload, a wire. */
export function isBill(value: unknown): value is Bill {
  return typeof value === "string" && (BILLS as readonly string[]).includes(value);
}

/** A kind's chapter: the text before the dot, which is what a division row is keyed on (L-MEA-04). */
export function divisionOf(kind: string): string {
  const dot = kind.indexOf(".");
  return dot === -1 ? kind : kind.slice(0, dot);
}
