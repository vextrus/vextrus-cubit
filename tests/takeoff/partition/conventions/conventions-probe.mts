/**
 * The convention profile, driven OUT OF PROCESS and reported as data.
 *
 * Why this exists: a set mounted outside the checkout carries no `@/` alias, so it cannot import a
 * product module that spells its own layers that way — and both the method (`@/core/errors` for the
 * refusal register) and the partition module do. `tsx` run from the checkout resolves the alias
 * natively, so a criterion drives the product through this script and asserts over the JSON it
 * prints. It is MECHANICS ONLY — it stages, it runs, it reads the store back, and it judges
 * nothing: every expectation lives in the set that spawned it.
 *
 * It is public on purpose (B-12/C-04): a Builder may read every literal it uses, and the staging it
 * does is the same staging the public suites do, through the same stage module (B-17).
 *
 *   node_modules/.bin/tsx tests/takeoff/partition/conventions/conventions-probe.mts profile <outFile>
 *
 * The report is written to `<outFile>` as JSON; anything printed on stdout is progress a human
 * might want.
 */
import { writeFileSync } from "node:fs";
import { PRINCIPAL, closeStage, grantRole, openSheetsStage, partitionViewRows, stagePerson, tempFixtureRoot, withFixtureRoot, type Person } from "../support/partition-stage.ts";
import {
  conventionProfileRows,
  profileDoor,
  resolveDoor,
  runConventionPartition,
  stageConventionIngest,
  type EntityCensus,
  type StagedConventionIngest,
} from "../support/conventions-stage.ts";

/**
 * A census of four layers: one whose two kinds tie, one nothing was drawn on, one of plain
 * linework and one of plain text — and no grammar read any caption at all. The layer names are
 * census data; the resolver is told nothing about what they mean.
 */
const CENSUS: EntityCensus = {
  layers: [
    { layer: "Tie", paths: 4, rings: 4, texts: 0, dimensions: 0 },
    { layer: "Blank", paths: 0, rings: 0, texts: 0, dimensions: 0 },
    { layer: "GRID", paths: 6, rings: 0, texts: 0, dimensions: 0 },
    { layer: "NOTES", paths: 0, rings: 0, texts: 9, dimensions: 0 },
  ],
  grammars: [],
};

/** Everything the store holds about one ingest's profile, plus what the door answers for it. */
async function snapshot(person: Person, projectId: string, staged: StagedConventionIngest): Promise<Record<string, unknown>> {
  const door = await profileDoor();
  return {
    rows: conventionProfileRows(person.tenantId, staged.ingestId),
    answered: await door.conventionProfileOf({ tenantId: person.tenantId, projectId, drawingId: staged.drawing.drawingId }),
    views: partitionViewRows(person.tenantId, staged.ingestId),
  };
}

/**
 * The pure method over the census above, and the shipped partition run TWICE over one staged ingest
 * whose model space carries no dimension at all.
 */
async function profile(): Promise<Record<string, unknown>> {
  const { resolve } = await resolveDoor();
  const pure = { census: CENSUS, profile: resolve(CENSUS) };

  await openSheetsStage();
  const { person, projectId } = await stagePerson("conventions-probe");
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

  // Undimensioned on purpose: a role no layer carries is what a deferral is for.
  const staged = await stageConventionIngest(person, projectId, { salt: 71, dimensioned: false }, "undimensioned");

  // An empty fixture root: every caption here is one the grammar reads, so no model is asked and
  // nothing can leave for a network (L-AI-01).
  const root = tempFixtureRoot("conventions-probe");
  const firstSteps = await withFixtureRoot(root, async () => runConventionPartition(person, staged, "first"));
  const first = await snapshot(person, projectId, staged);

  const secondSteps = await withFixtureRoot(root, async () => runConventionPartition(person, staged, "second"));
  const second = await snapshot(person, projectId, staged);

  return {
    pure,
    layers: staged.artifact.layers,
    first: { steps: firstSteps, state: first },
    second: { steps: secondSteps, state: second },
  };
}

/* ------------------------------------------------------------------ the entry point */

const [scenario, outFile] = process.argv.slice(2);
if (scenario === undefined || outFile === undefined) throw new Error("usage: conventions-probe.mts <profile> <outFile>");

const report = scenario === "profile" ? await profile() : null;
if (report === null) throw new Error(`no such scenario: ${scenario}`);

writeFileSync(outFile, JSON.stringify(report, null, 2));
await closeStage();
process.stdout.write(`${scenario}: wrote ${outFile}\n`);
