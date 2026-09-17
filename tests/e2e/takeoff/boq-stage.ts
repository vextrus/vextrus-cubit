/**
 * The stage J-033 stands on (inc-311a: R-TO-053, L-BD-08, docs/design/s-boq.md).
 *
 * Mechanics only — nothing here judges the product. A measured campaign with published lines is
 * `stageRegister`'s and the second, sighted-but-unmeasured level is `stageCoverage`'s (B-17: one
 * home for each), so what this file adds is a name: a draft read off a campaign whose coverage is
 * INCOMPLETE, which is the ONLY state under which the measured-scope subtotal rule can be seen.
 *
 * `stageBareProject` is re-exported because the empty checkpoint needs a project with no campaign
 * and the schedules stage already makes one.
 *
 * The Builder may edit this file (test contract).
 */
import { type Page } from "@playwright/test";
import { stageCoverage, type CoverageCellRef, type StagedCoverage } from "./coverage-stage";

export { stageBareProject } from "./schedules-stage";
export type { CoverageCellRef } from "./coverage-stage";

/** What a staged draft gives a journey: the campaign it reads, and the cell that leaves it partial. */
export type StagedBoq = StagedCoverage & {
  /** Every object the register published a line for — the lines the draft must list. */
  lineIds: string[];
  /** The borne cell that was sighted and never measured: why `data-coverage` reads INCOMPLETE. */
  unmeasured: CoverageCellRef;
};

/**
 * A pinned campaign whose register published `rcc.concrete` lines on the ground floor, beside one
 * class sighted on a second level that no rail measured.
 */
export async function stageBoq(page: Page, options: { label?: string } = {}): Promise<StagedBoq> {
  const staged = await stageCoverage(page, { label: options.label ?? "boq" });
  return { ...staged, lineIds: [...staged.objectKeys] };
}
