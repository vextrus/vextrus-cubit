/**
 * The grid backbone, driven OUT OF PROCESS over every declared scenario and reported as data.
 *
 * Why this exists: the held-out mount carries no `@/` alias, so a set mounted outside the checkout
 * cannot import a product module that spells its own layers that way (every module under
 * `src/modules/**` does). `tsx` run from the checkout resolves the alias natively, so a held-out
 * criterion drives the product through this script and asserts over the JSON it prints. It is
 * MECHANICS ONLY — it stages, it runs, it reads the store back, and it judges nothing: every
 * expectation lives in the set that spawned it (the same shape as `../support/partition-probe.mts`).
 *
 * It is public on purpose (B-12/C-04): a Builder may read every literal it uses, and the staging it
 * does is the same staging the public grid suite does, through the same stage module (B-17).
 *
 *   node_modules/.bin/tsx tests/takeoff/partition/grid/grid-probe.mts evidence <outFile>
 *
 * `grid-plan` and `grid-plan-renamed` are staged with the SAME salt, so the two drawings carry the
 * identical source keys and a reader can compare their rows one for one.
 */
import { writeFileSync } from "node:fs";
import {
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  stagePerson,
  tempFixtureRoot,
  viewsLaw,
  withFixtureRoot,
} from "../support/partition-stage.ts";
import {
  LAYOUT_PLAN,
  SCENARIO,
  SCHEDULE,
  gridDeferralRows,
  gridRows,
  runGridPartition,
  stageGridIngest,
  type GridAxisRow,
  type GridDeferralRow,
  type GridScenario,
} from "../support/grid-stage.ts";

/** Which scenario is staged under which salt. The plan and its renaming share one. */
const SALTED: readonly (readonly [GridScenario, number])[] = [
  [SCENARIO.PLAN, 91],
  [SCENARIO.RENAMED, 91],
  [SCENARIO.NO_BUBBLES, 92],
  [SCENARIO.ROLELESS, 93],
  [SCENARIO.SCHEDULE_BUBBLES, 94],
];

/** What one scenario amounts to: the views it left, the rows it wrote, and whatever stopped it. */
type ScenarioReport = {
  scenario: string;
  salt: number;
  /** The message of whatever refused this scenario — a product that cannot do this yet says so here. */
  error: string | null;
  steps: string[];
  layoutPlanKeys: string[];
  scheduleKeys: string[];
  axes: GridAxisRow[] | null;
  deferrals: GridDeferralRow[] | null;
};

/** Whatever went wrong, as a line a reader can act on. */
function said(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

/** Every scenario, staged, partitioned and read back. */
async function evidence(): Promise<{ scenarios: ScenarioReport[] }> {
  await openSheetsStage();
  const { person, projectId } = await stagePerson("grid-evidence");
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

  const law = await viewsLaw();
  const planType = String(law.VIEW_TYPE[LAYOUT_PLAN]);
  const scheduleType = String(law.VIEW_TYPE[SCHEDULE]);
  const root = tempFixtureRoot("grid-evidence");

  const scenarios: ScenarioReport[] = [];
  for (const [scenario, salt] of SALTED) {
    const report: ScenarioReport = { scenario, salt, error: null, steps: [], layoutPlanKeys: [], scheduleKeys: [], axes: null, deferrals: null };
    try {
      const ingest = await stageGridIngest(person, projectId, scenario, salt);
      report.steps = (await withFixtureRoot(root, async () => runGridPartition(person, ingest, scenario))).map((step) => step.step);

      const views = partitionViewRows(person.tenantId, ingest.ingestId);
      report.layoutPlanKeys = views.filter((view) => view.type === planType).map((view) => view.viewKey);
      report.scheduleKeys = views.filter((view) => view.type === scheduleType).map((view) => view.viewKey);

      report.axes = gridRows(person.tenantId, ingest.ingestId);
      report.deferrals = gridDeferralRows(person.tenantId, ingest.ingestId);
    } catch (failure) {
      report.error = said(failure);
    }
    scenarios.push(report);
  }
  return { scenarios };
}

const [scenario, outFile] = process.argv.slice(2);
if (scenario === undefined || outFile === undefined) throw new Error("usage: grid-probe.mts <evidence> <outFile>");
if (scenario !== "evidence") throw new Error(`no such scenario: ${scenario}`);

writeFileSync(outFile, JSON.stringify(await evidence(), null, 2));
await closeStage();
process.stdout.write(`${scenario}: wrote ${outFile}\n`);
