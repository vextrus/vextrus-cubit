// The heat the grid paints (Design Direction 00 §4.3, Decision § 1): the seven MARKS, the share a
// cell is published at, and the ramp step that share falls in.
//
// Meaning never rides on colour alone, so a mark is three things at once — a glyph (`glyphs.tsx`), a
// pattern and a colour (`coverage.css`, off `--pattern-*` and `--cov-0..4`). This file is the one
// home of which mark a reading wears and of the arithmetic behind the fill; the stylesheet reads the
// mark off `data-mark` and the step off `data-cov`, and computes nothing of its own.
//
// Nothing here reaches the token table: a module may not (ARCH-01). It states the STEP, 0–4, and the
// screen's own stylesheet turns a step into `var(--cov-N)`.
import type { ResidueCell, TruncatedSheet } from "@/core/residue/law";
import type { GlyphReading } from "./glyphs";
import { COVERAGE_COPY } from "./copy";

/** The seven marks of §4.3, in the order a legend and a footer read them. */
export const MARKS = ["published", "partial", "absent", "out-of-scope", "held", "no-class", "catalogue"] as const;

/** One mark, drawn from the closed roster above. */
export type Mark = (typeof MARKS)[number];

/**
 * Which mark one reading wears. TOTAL over the readings a cell can hold, exactly as `CAUSE_GLYPHS`
 * is: a reading with no mark is a compile error rather than an unpainted cell. §4.3's table is this
 * map, in its own order: published, partial, absent (unexplained), declared out of scope, held out of
 * the bill, no class sighted, and the catalogue-only kind. The drawn mark of each is `glyphs.tsx`'s —
 * this file names which mark a reading wears and never draws one (B-17: the basis glyph table in
 * `@/ui/primitives/core/basis.ts` is the tree's only roster of glyph CHARACTERS, and nothing here
 * spells one).
 */
export const MARK_OF: Readonly<Record<GlyphReading, Mark>> = Object.freeze({
  QUANTITY_BEARING: "published",
  // A sheet read only in part is the one cell whose reading is genuinely PARTIAL: some of the
  // evidence it would have been measured from never arrived (risk note 4, L-QTY-05).
  INGESTION_TRUNCATED: "partial",
  NOT_ESTABLISHED: "absent",
  NOT_IN_PROJECT_SCOPE: "out-of-scope",
  NOT_IN_THIS_BILL: "held",
  NO_BEARER_SIGHTED: "no-class",
  KIND_NOT_YET_SEEDED: "catalogue",
});

/** The word a mark is read by on the key line — one word or two, never a sentence (§3.5). */
export const MARK_WORD: Readonly<Record<Mark, string>> = Object.freeze({
  published: COVERAGE_COPY.takeoff_coverage_mark_published,
  partial: COVERAGE_COPY.takeoff_coverage_mark_partial,
  absent: COVERAGE_COPY.takeoff_coverage_mark_absent,
  "out-of-scope": COVERAGE_COPY.takeoff_coverage_mark_out_of_scope,
  held: COVERAGE_COPY.takeoff_coverage_mark_held,
  "no-class": COVERAGE_COPY.takeoff_coverage_mark_no_class,
  catalogue: COVERAGE_COPY.takeoff_coverage_mark_catalogue,
});

/** The same word as a tally reads it, mid-sentence: "6 absent", never "6 Absent" (§6). */
export const MARK_TALLY: Readonly<Record<Mark, string>> = Object.freeze({
  published: COVERAGE_COPY.takeoff_coverage_tally_published,
  partial: COVERAGE_COPY.takeoff_coverage_tally_partial,
  absent: COVERAGE_COPY.takeoff_coverage_tally_absent,
  "out-of-scope": COVERAGE_COPY.takeoff_coverage_tally_out_of_scope,
  held: COVERAGE_COPY.takeoff_coverage_tally_held,
  "no-class": COVERAGE_COPY.takeoff_coverage_tally_no_class,
  catalogue: COVERAGE_COPY.takeoff_coverage_tally_catalogue,
});

/** The ramp's five steps (§4.3): 0 %, 1–25, 26–50, 51–75, 76–100. */
export const RAMP_STEPS = 5;

/** The step a share falls in. Nothing rounds UP into "measured": a share of zero is step 0. */
export function rampStep(share: number): number {
  if (!Number.isFinite(share) || share <= 0) return 0;
  if (share >= 1) return RAMP_STEPS - 1;
  return Math.min(RAMP_STEPS - 1, Math.floor(share * (RAMP_STEPS - 1)) + 1);
}

/**
 * The share of one cell that is PUBLISHED — the number the ramp paints it at (§4.3).
 *
 * A cell bearing published quantity is whole; a cell standing under any other cause has published
 * nothing and is 0. The one reading between them is the partial one: a cell whose sheet was read in
 * part is published to the share of its own evidence that survived ingestion, which is a fact this
 * reading already carries (`truncated`, risk note 4). Nothing else is invented for it.
 */
export function sharePublished(cell: ResidueCell, truncated: readonly TruncatedSheet[]): number {
  if (cell.measurement === "QUANTITY_BEARING") return 1;
  if (cell.measurement !== "INGESTION_TRUNCATED") return 0;
  if (cell.sightings.length === 0) return 0;
  const lost = new Set(truncated.map((sheet) => `${sheet.drawingId}:${sheet.layoutName}`));
  const whole = cell.sightings.filter((seen) => !lost.has(`${seen.drawingId}:${seen.layoutName}`)).length;
  return whole / cell.sightings.length;
}

/** How much of one kind's row is measured: the heat a reader reads the row itself by. */
export function rowShare(cells: readonly ResidueCell[]): { published: number; total: number; share: number } {
  const borne = cells.filter((cell) => cell.grain !== "KIND");
  const published = borne.filter((cell) => cell.measurement === "QUANTITY_BEARING").length;
  return { published, total: borne.length, share: borne.length === 0 ? 0 : published / borne.length };
}

/** One tally of the footer: a mark, and how many cells of this reading wear it. */
export type MarkTally = { readonly mark: Mark; readonly count: number };

/**
 * The counts by mark, in the marks' own order, with the marks nothing wears left out: a footer that
 * printed "0 held" would be saying something about a boundary nobody moved (§3.5, L-QTY-07).
 */
export function countsByMark(cells: readonly ResidueCell[], markOf: (cell: ResidueCell) => Mark): readonly MarkTally[] {
  const counted = new Map<Mark, number>();
  for (const cell of cells) counted.set(markOf(cell), (counted.get(markOf(cell)) ?? 0) + 1);
  return MARKS.map((mark) => ({ mark, count: counted.get(mark) ?? 0 })).filter((tally) => tally.count > 0);
}
