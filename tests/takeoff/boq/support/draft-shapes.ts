/**
 * The draft BOQ's vocabulary and its payload shape, as the increment's interfaces publish them —
 * and NOTHING ELSE. No product module, no browser, no assertion.
 *
 * It stands apart from `boq-stage.ts` because three lanes read it: the unit suites (vitest, jsdom),
 * the PERF-311 spec (Playwright, no DOM) and the held-out set. A file that dragged
 * `@testing-library/react` into the perf lane would make the renderer's own budget pay for a mount
 * nobody asked for.
 *
 * Every type here is the SPEC's, never the product's: a suite that imported the product's own types
 * would agree with whatever the product happened to declare.
 */

/** The six sections of L-BD-08, in L-BD-08's order (AM-16). */
export const SIX_BILLS: readonly string[] = Object.freeze(["SUBSTRUCTURE", "SUPERSTRUCTURE", "FINISHES", "ELECTRICAL", "PLUMBING", "EXTERNAL"]);

/** The taxonomy id every document is stamped with (interfaces, docs/decisions/bill-taxonomy.md). */
export const TAXONOMY_VERSION = "bill-taxonomy/2026-09-16";

/** The document kind the draft is filed under, and the job that renders it. */
export const BOQ_DRAFT = "boq-draft";
export const BOQ_RENDER_DRAFT = "boq-render-draft";

/** The names a resolution, a location and a coverage are read by. */
export const UNCLASSIFIED = "UNCLASSIFIED";
export const PROVISIONAL_SUM = "PROVISIONAL_SUM";
export const LOCATION = "LOCATION";
export const NO_TAXONOMY_ROW = "NO_TAXONOMY_ROW";
export const LEVEL_NOT_IN_STACK = "LEVEL_NOT_IN_STACK";
export const AT_OR_BELOW_PLINTH = "AT_OR_BELOW_PLINTH";
export const ABOVE_PLINTH = "ABOVE_PLINTH";
export const COMPLETE = "COMPLETE";
export const INCOMPLETE = "INCOMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";
export const MEASURED = "MEASURED";

/** The permission the export door asks for, and the codes it refuses by. */
export const MEASURE = "MEASURE";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const BOQ_NO_CAMPAIGN = "BOQ_NO_CAMPAIGN";

/** One line as the payload holds it (interfaces' `boqDraftPayloadSchema`). */
export type PayloadLineShape = {
  lineId: string;
  objectKey: string;
  level: string;
  quantity: string | null;
  unit: string;
  coverage: string;
  quantityBasis: string;
  selectionBasis: string;
  decidedBy: string;
};

export type PayloadGroupShape = {
  class: string;
  kind: string;
  description: string;
  unit: string;
  lines: PayloadLineShape[];
  subtotals: { unit: string; value: string }[];
};

export type PayloadSectionShape = { bill: string; label: string; groups: PayloadGroupShape[]; subtotals: { unit: string; value: string }[] };

export type PayloadShape = {
  title: string;
  project: string;
  campaignId: string;
  setRevisionId: string;
  taxonomyVersion: string;
  coverage: string;
  sections: PayloadSectionShape[];
  unclassified: { label: string; lines: (PayloadLineShape & { reason: string })[] };
};
