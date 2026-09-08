/**
 * AC-4 — the convention profile is the partition's second stage, and one row per ingest is what it
 * leaves behind (R-TO-030, L-CAD-08, L-REG-04).
 *
 * The partition is driven through the SHIPPED job over a really recorded ingest: a drawing is
 * seeded, the shipped ingest pipeline records it from a stand-in CLI that hands back a
 * hand-authored artifact, and `runPartitionJob` is then run over that record. What is graded is
 * what the run left in the store.
 *
 * Nothing here transcribes a tally. The census the store holds is compared against the census the
 * product builds from the same artifact, and against this acceptance's own reading of AC-4's rule
 * over the artifact it built — so a corpus that changes changes both expectations with it (B-19).
 *
 * The model is asked from an EMPTY fixture root: every caption of the staged artifact is one the
 * grammar reads, and nothing can leave this suite for a network (L-AI-01).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  VIEWS_STAGE,
  byCodePoint,
  closeStage,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  rebuildDoor,
  stagePerson,
  tempFixtureRoot,
  unique,
  viewsLaw,
  withFixtureRoot,
  type Person,
  type StepRecord,
} from "../support/partition-stage";
import { stageDrawing } from "../../support/ingest-stage";
import {
  CONVENTIONS_STAGE,
  PARTITION_STEPS,
  RULE_ID,
  RULE_VERSION,
  byGrammar,
  byLayer,
  censusOfArtifact,
  conventionProfileRows,
  profileDoor,
  resolveDoor,
  runConventionPartition,
  stageConventionIngest,
  type GrammarCensus,
  type StagedConventionIngest,
} from "../support/conventions-stage";

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 600_000;

/** The bytes a stored drawing is addressed by; what they say decides nothing. */
const BYTES = new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n");

interface Staged {
  person: Person;
  projectId: string;
  ingested: StagedConventionIngest;
  steps: StepRecord[];
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("conventions");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingested = await stageConventionIngest(person, projectId, { salt: 61, dimensioned: true }, "conventions");
    const steps = await withFixtureRoot(tempFixtureRoot("conventions-empty"), async () => runConventionPartition(person, ingested, "conventions"));
    return { person, projectId, ingested, steps };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The one row this ingest's profile stands in — named as a singular, because that is the claim. */
async function storedRow(): Promise<ReturnType<typeof conventionProfileRows>[number]> {
  const stage = await staged();
  const rows = conventionProfileRows(stage.person.tenantId, stage.ingested.ingestId);
  expect(rows.length, "a rebuilt partition leaves exactly one convention profile for the ingest it rebuilt (R-TO-030)").toBe(1);
  return rows[0]!;
}

describe("AC-4: the conventions stage runs after the views stage", () => {
  test("AC-4: the stage list is the views stage and then the convention profile", async () => {
    const rebuild = await rebuildDoor();
    expect([...rebuild.PARTITION_STAGES], "R-TO-030's stored partition runs the view classification first and the convention profile after it (L-CAD-08)").toEqual([
      VIEWS_STAGE,
      CONVENTIONS_STAGE,
    ]);
  }, BUDGET_MS);

  test("AC-4: the run records resolve, views, conventions and stored, in that order", async () => {
    const { steps } = await staged();
    const said = steps.map((entry) => entry.step);
    const at = PARTITION_STEPS.map((step) => said.indexOf(step));
    for (const [index, step] of PARTITION_STEPS.entries()) {
      expect(at[index], `the run never recorded the step \`${step}\` — its log reads: ${said.join(" → ")}`).toBeGreaterThanOrEqual(0);
    }
    expect([...at].sort((left, right) => left - right), `the steps stand in the order the stage list runs them; the log reads: ${said.join(" → ")}`).toEqual(at);
  }, BUDGET_MS);

  test("AC-4: the conventions step says how much it read and how much it could not resolve", async () => {
    const { steps } = await staged();
    const row = await storedRow();
    const step = steps.find((entry) => entry.step === CONVENTIONS_STAGE);
    expect(step, `the run recorded a \`${CONVENTIONS_STAGE}\` step`).toBeTruthy();
    expect(typeof step?.detail["layers"], "the step says over how many layers the census was taken — a stage that reports nothing is not a visible stage (R-TO-030)").toBe("number");
    expect(typeof step?.detail["deferrals"], "and how many roles it would not default").toBe("number");

    // What the numbers SAY is what makes the step visible: a detail nobody reads off the run's own
    // result is a constant with a number's shape (R-TO-030: each stage's result is visible).
    expect(step?.detail["layers"], "and the count is the census this run really took — one entry per layer it tallied").toBe(row.census.layers.length);
    expect(step?.detail["deferrals"], "and the deferrals are the ones the profile it stored really carries").toBe(row.profile.deferrals.length);
  }, BUDGET_MS);
});

describe("AC-4: the profile is stored per ingest, and read back", () => {
  test("AC-4: exactly one row stands for the ingest, under the method that resolved it", async () => {
    const row = await storedRow();
    expect(row.ruleId, "the row names the rule that wrote it — a stored derivation with no method is unattributable (L-CAD-08: the resolver enters the edition as (rule id, version))").toBe(
      RULE_ID,
    );
    expect(String(row.ruleVersion), "and the version of it").toBe(RULE_VERSION);
  }, BUDGET_MS);

  test("AC-4: the stored census is the census of that artifact and its views", async () => {
    const stage = await staged();
    const row = await storedRow();
    const built = await censusOfArtifact(stage.ingested.artifact.graph);
    expect({ layers: byLayer(row.census.layers), grammars: byGrammar(row.census.grammars) }, "the row holds the census the product builds from the artifact and the views stage's result").toEqual(
      { layers: byLayer(built.layers), grammars: byGrammar(built.grammars) },
    );
  }, BUDGET_MS);

  test("AC-4: the census tallies every model-space original by kind, and counts no paper entity and no derived paint", async () => {
    const stage = await staged();
    const row = await storedRow();
    expect(
      byLayer(row.census.layers),
      "each layer is tallied by the kind of each ORIGINAL record standing in model space — a text, else a dimension, else a closed ring, else a path — and a paper layout's entities and exploded paint are no part of it (L-CAD-03, L-CAD-05)",
    ).toEqual(stage.ingested.artifact.layers);
  }, BUDGET_MS);

  test("AC-4: the census names one grammar per view class a caption was read under, with how many views it named", async () => {
    const stage = await staged();
    const row = await storedRow();
    const law = await viewsLaw();
    const unread = [String(law.VIEW_TYPE["UNTYPED"]), String(law.VIEW_TYPE["UNASSIGNED"])];
    const tally = new Map<string, number>();
    for (const view of partitionViewRows(stage.person.tenantId, stage.ingested.ingestId)) {
      if (unread.includes(view.type)) continue;
      tally.set(view.type, (tally.get(view.type) ?? 0) + 1);
    }
    const expected: GrammarCensus[] = byCodePoint([...tally.keys()]).map((grammar) => ({ grammar, captions: tally.get(grammar) ?? 0 }));
    expect(expected.length, "the staged captions were read by the grammar — a census with no grammar in it would grade nothing here").toBeGreaterThan(0);
    expect(
      byGrammar(row.census.grammars),
      `one entry per class the views stage read a caption under, and neither of the two that stand for "not read at all" (${unread.join(", ")})`,
    ).toEqual(expected);
  }, BUDGET_MS);

  test("AC-4: the stored profile is what the method resolves from the stored census", async () => {
    const row = await storedRow();
    const { resolve } = await resolveDoor();
    expect(row.profile, "the row holds the profile `resolve` answers for the census beside it — the store keeps a derivation, never a second opinion (L-CAD-08)").toEqual(resolve(row.census));
  }, BUDGET_MS);

  test("AC-4: conventionProfileOf answers the drawing's profile, and nothing for a drawing with no partition", async () => {
    const stage = await staged();
    const row = await storedRow();
    const door = await profileDoor();
    const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.ingested.drawing.drawingId };
    const answered = await door.conventionProfileOf(scope);
    expect(answered, `the drawing's profile is readable through the module's own door (R-TO-030: each stage's result is visible)`).toBeTruthy();
    expect(answered?.ingestId, "for the ingest record that stands for the drawing now").toBe(stage.ingested.ingestId);
    expect({ ruleId: answered?.ruleId, ruleVersion: String(answered?.ruleVersion) }, "under the method that resolved it").toEqual({ ruleId: RULE_ID, ruleVersion: RULE_VERSION });
    expect(answered?.profile, "with the profile the store holds").toEqual(row.profile);
    expect(answered?.census, "and the census it was resolved from").toEqual(row.census);

    const unpartitioned = await stageDrawing(stage.person, stage.projectId, BYTES, { name: unique("unpartitioned.dxf"), format: "dxf" });
    expect(
      await door.conventionProfileOf({ ...scope, drawingId: unpartitioned.drawingId }),
      "a drawing whose partition has never been rebuilt has no profile — an absence a caller can act on, not a refusal (R-UI-050)",
    ).toBeNull();
    expect(await door.conventionProfileOf({ ...scope, drawingId: randomUUID() }), "and neither has a drawing this workspace does not hold").toBeNull();
  }, BUDGET_MS);
});
