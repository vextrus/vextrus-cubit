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
 * IT ALSO PUTS A WORKER ON THE STAGE. Exporting the draft is an ENQUEUE (SEAM-JOBS): the door files
 * a `boq-render-draft` job and answers, and the bytes are rendered by the shipped worker afterwards.
 * The journeys' `webServer` starts `next start` and nothing else, so a lane with no worker would show
 * a job strip that never finishes — the product behaving correctly over a world with no hands. The
 * world is the stage's to make, so the stage starts the shipped worker (never a second copy of its
 * logic) against the same database and storage root the served product uses.
 *
 * The Builder may edit this file (test contract).
 */
import { type Page } from "@playwright/test";
import { startJourneyWorker, type JourneyWorker } from "../support/worker";
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
 * The one worker this Playwright worker process needs, started at most once however many journeys
 * of this file it runs: a second copy would claim the same jobs and prove nothing about either.
 *
 * It is stopped when the process ends. `stop()` sends SIGTERM before its first await, so an `exit`
 * handler — where nothing asynchronous can be waited for — still delivers the signal, and the worker
 * is never left polling the lane's database after the run that started it.
 */
let workerOfThisProcess: Promise<JourneyWorker> | null = null;

/** Make sure the jobs this journey's acts enqueue are actually run. */
async function jobsAreRun(): Promise<void> {
  workerOfThisProcess ??= startJourneyWorker().then((worker) => {
    process.once("exit", () => void worker.stop());
    return worker;
  });
  await workerOfThisProcess;
}

/**
 * A pinned campaign whose register published `rcc.concrete` lines on the ground floor, beside one
 * class sighted on a second level that no rail measured — and a worker to run what the draft's own
 * door enqueues.
 */
export async function stageBoq(page: Page, options: { label?: string } = {}): Promise<StagedBoq> {
  const staged = await stageCoverage(page, { label: options.label ?? "boq" });
  await jobsAreRun();
  return { ...staged, lineIds: [...staged.objectKeys] };
}
