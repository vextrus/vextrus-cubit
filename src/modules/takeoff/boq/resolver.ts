// L-BD-08's resolution, most specific first: element-type override → group → division →
// UNCLASSIFIED, with the row that decided it recorded on every answer (AM-14 §1, AM-16).
//
// The resolver READS the taxonomy and knows nothing else. It holds no class by name, no chapter and
// no project: swap `./taxonomy.ts` and every answer moves with it, which is what "swappable data"
// means. What it adds to the table is the one thing a table cannot state — where the line stands —
// and it adds it by reading the level stack, never by judging a label.
//
// A LINE THE TABLE REACHES BY NO ROW IS KEPT. `UNCLASSIFIED` is an answer, labelled and reasoned,
// and the draft prints it: a mapping that failed is a VISIBLE defect. Dropping it, or filing it
// under a provisional sum, would make it an invisible one, and L-QTY-04 governs — a figure that
// hides what it does not cover is the failure this product is built against.
import {
  BILL_TAXONOMY,
  LOCATION,
  PLINTH_LEVEL_LABELS,
  UNCLASSIFIED,
  divisionOf,
  type Bill,
  type BillTaxonomy,
  type UnclassifiedReason,
} from "./taxonomy";

/** One level of the project's stack, as the level seam holds it. */
export type StackLevel = { readonly levelId: string; readonly ordinal: number; readonly label: string };

/** Which side of the plinth a line was read on (AM-14 §1). */
export const AT_OR_BELOW_PLINTH = "AT_OR_BELOW_PLINTH";
export const ABOVE_PLINTH = "ABOVE_PLINTH";

/** Where a plinth boundary came from: a level the stack names, or the ground floor beneath it. */
export const PLINTH_BASES = ["PLINTH_LEVEL_NAMED", "GROUND"] as const;

/** One basis, drawn from the closed roster above. */
export type PlinthBasis = (typeof PLINTH_BASES)[number];

/**
 * The cut AM-14 §1 makes: everything at or below this ordinal is Substructure, everything above it
 * Superstructure. The basis is carried so that a resolution can say WHY the boundary stands where
 * it does — a stack that names its plinth and one that does not are two different readings, and a
 * draft that could not tell them apart would state a boundary nobody chose.
 */
export type PlinthBoundary = { readonly ordinal: number; readonly basis: PlinthBasis; readonly levelId: string | null };

/** Which row of the taxonomy reached a line first, and the key that row is held under. */
export const DECIDING_ROWS = ["OVERRIDE", "GROUP", "DIVISION", "NONE"] as const;

/** One deciding row, drawn from the closed roster above. */
export type DecidingRow = (typeof DECIDING_ROWS)[number];

/** Which row decided a resolution, and under which key it stands in the taxonomy (L-BD-08). */
export type DecidedBy = { readonly row: DecidingRow; readonly key: string };

/** One line as the resolver reads it: what it is, what is measured of it, and where it stands. */
export type BillableLine = { readonly class: string; readonly kind: string; readonly levelOrdinal: number | null };

/** What a resolution answers: the bill, the row that decided it, and the stamp it was made under. */
export type BillResolution = {
  readonly bill: Bill | typeof UNCLASSIFIED;
  readonly decidedBy: DecidedBy;
  readonly reason: UnclassifiedReason | null;
  readonly location: typeof AT_OR_BELOW_PLINTH | typeof ABOVE_PLINTH | null;
  readonly taxonomyVersion: string;
};

/** The ordinal the ground floor stands at, and so the first storey of Superstructure (AM-14 §1). */
const GROUND_FLOOR_ORDINAL = 0;

/** The label the plinth is recognised by, compared as the stack writes it minus its spacing. */
function plinthLabelled(label: string): boolean {
  const spelled = label.trim().toUpperCase();
  return (PLINTH_LEVEL_LABELS as readonly string[]).includes(spelled);
}

/**
 * Where the plinth stands in this project's stack.
 *
 * No level carries a flag saying "this is the plinth", so the boundary is the LIVE level the stack
 * labels as one; absent that, it is the storey below the ground floor, because AM-14 ties
 * Superstructure to "the ground-floor slab up". Answering UNCLASSIFIED for every column and wall of
 * a project that never spelled `PL` would blank a whole frame over a labelling habit.
 */
export function plinthBoundaryOf(levels: readonly StackLevel[]): PlinthBoundary {
  const named = levels.filter((level) => plinthLabelled(level.label)).sort((one, other) => other.ordinal - one.ordinal)[0];
  if (named !== undefined) return Object.freeze({ ordinal: named.ordinal, basis: "PLINTH_LEVEL_NAMED", levelId: named.levelId });
  return Object.freeze({ ordinal: GROUND_FLOOR_ORDINAL - 1, basis: "GROUND", levelId: null });
}

/** The first row of the taxonomy that reaches this line, most specific first (L-BD-08). */
function rowFor(line: BillableLine, taxonomy: BillTaxonomy): { readonly target: string; readonly decidedBy: DecidedBy } | null {
  for (const row of taxonomy.overrides) {
    if (row.class !== line.class) continue;
    if (row.kind !== undefined && row.kind !== line.kind) continue;
    return { target: row.bill, decidedBy: { row: "OVERRIDE", key: row.kind === undefined ? row.class : `${row.class}:${row.kind}` } };
  }
  for (const row of taxonomy.groups) {
    if (row.group === line.kind) return { target: row.bill, decidedBy: { row: "GROUP", key: row.group } };
  }
  const division = divisionOf(line.kind);
  for (const row of taxonomy.divisions) {
    if (row.division === division) return { target: row.bill, decidedBy: { row: "DIVISION", key: row.division } };
  }
  return null;
}

/** A line that reached no row at all: kept, labelled and reasoned (L-BD-08). */
function unplaced(reason: UnclassifiedReason, decidedBy: DecidedBy, version: string): BillResolution {
  return Object.freeze({ bill: UNCLASSIFIED, decidedBy, reason, location: null, taxonomyVersion: version });
}

/**
 * The bill one line belongs in, under one taxonomy.
 *
 * `taxonomy` defaults to the shipped table and is a parameter because the table is data: a project
 * ruleset, a later edition or a suite may hand in another, and the version the answer is stamped
 * with is the version that was READ rather than a constant standing beside the resolver.
 */
export function resolveBill(line: BillableLine, boundary: PlinthBoundary, taxonomy: BillTaxonomy = BILL_TAXONOMY): BillResolution {
  const found = rowFor(line, taxonomy);
  if (found === null) return unplaced("NO_TAXONOMY_ROW", { row: "NONE", key: "" }, taxonomy.version);

  if (found.target !== LOCATION) {
    return Object.freeze({ bill: found.target as Bill, decidedBy: found.decidedBy, reason: null, location: null, taxonomyVersion: taxonomy.version });
  }

  // The location cut. A line the stack cannot place is not guessed at: a row that bills BY location
  // and a line with no location is exactly the gap L-BD-08 asks to be kept and labelled, and the
  // row that decided it is still recorded — the mapping was found, the level was not.
  if (line.levelOrdinal === null) return unplaced("LEVEL_NOT_IN_STACK", found.decidedBy, taxonomy.version);

  const below = line.levelOrdinal <= boundary.ordinal;
  return Object.freeze({
    bill: below ? "SUBSTRUCTURE" : "SUPERSTRUCTURE",
    decidedBy: found.decidedBy,
    reason: null,
    location: below ? AT_OR_BELOW_PLINTH : ABOVE_PLINTH,
    taxonomyVersion: taxonomy.version,
  });
}
