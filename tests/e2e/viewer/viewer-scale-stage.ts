/**
 * The stage J-020's scale leg walks its sheet on (test contract: `stageScaleSheet`).
 *
 * Mechanics only — nothing here judges the product. A scale is read over a PARTITIONED sheet whose
 * header names a mapped unit, and that is exactly the sheet inc-203's stage already records through
 * the shipped doors: a person enrolled, a project made, a drawing uploaded, its reading recorded by
 * the shipped ingest job and its partition rebuilt by the shipped partition job. Staging a second
 * sheet of its own would be a second way to record an ingest (B-17), so this file adds nothing but
 * the two facts a scale journey needs on top: that the sheet holds views, and that its header names
 * millimetres — which is what gives every view a `FILE_UNITS` proposal and no view an affirmation.
 */
import { expect, type Page } from "@playwright/test";
import { MODEL_SPACE, stagePartitionedSheet, type StagedPartitionedSheet } from "./viewer-partition-stage";

export { MODEL_SPACE };
export type StagedScaleSheet = StagedPartitionedSheet;

/**
 * The unit the staged artifact's header names (`insunits` code 4). It is the ONE unit spelling this
 * journey states, because the panel's own `FILE_UNITS` proposal is read off the screen rather than
 * transcribed here.
 */
export const HEADER_UNIT = "mm";

/**
 * A member of a fresh workspace, a project of theirs, and a sheet of theirs whose partition stands —
 * with no affirmation of record on any view of it, which is where R-TO-021's hatch and the panel's
 * declared absences begin.
 */
export async function stageScaleSheet(page: Page, options: { label?: string } = {}): Promise<StagedScaleSheet> {
  const staged = await stagePartitionedSheet(page, { label: options.label ?? "scale" });
  expect(staged.views.length, "the staged sheet holds views for a scale to be affirmed over (L-MEA-05)").toBeGreaterThan(0);
  return staged;
}
