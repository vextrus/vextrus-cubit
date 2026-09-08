/**
 * AC-1, AC-2, AC-3 — L-CAD-07's grid backbone as the third stage of the stored partition
 * (R-TO-030, L-CAD-07, L-MEA-01).
 *
 * The grid is driven through the SHIPPED job over a really recorded ingest: a drawing is seeded, the
 * shipped ingest pipeline records it from a stand-in CLI that hands back a hand-authored artifact,
 * and `runPartitionJob` is then run over that record. What is graded is what the run left in the
 * store, and what the module's own door answers about it.
 *
 * Nothing here transcribes a row. The rows a scenario owes are read off the artifact the scenario
 * built, by this acceptance's own reading of L-CAD-07's rule — a round closed ring enclosing exactly
 * one text that normalises to a bare letter or a bare numeral — so an artifact that changes changes
 * the expectation with it (B-19).
 *
 * The model is asked from an EMPTY fixture root: both captions of every staged artifact are ones the
 * grammar reads, so nothing can leave this suite for a network (L-AI-01).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ERRORS_MODULE,
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  productModule,
  rebuildDoor,
  stagePerson,
  tempFixtureRoot,
  viewAssignmentRows,
  viewsLaw,
  withFixtureRoot,
  type ErrorsSeam,
  type Person,
  type StepRecord,
} from "../support/partition-stage";
import {
  AXIS_X,
  AXIS_Y,
  CONVENTIONS_STAGE,
  FAMILY_LETTER,
  FAMILY_NUMERAL,
  GRID_NO_BUBBLE_EVIDENCE,
  GRID_STAGE,
  LAYOUT_PLAN,
  SCENARIO,
  STORED_STEP,
  axisRowOf,
  byBubble,
  deferralRowOf,
  expectedGridRows,
  gridDeferralRows,
  gridDoor,
  gridRows,
  normalisedLabelOf,
  runGridPartition,
  stageGridIngest,
  type GridAxisRow,
  type StagedGridIngest,
} from "../support/grid-stage";

/** How long a staged case may take: a database provisioned, two drawings ingested, two partitions run. */
const BUDGET_MS = 900_000;

interface Staged {
  person: Person;
  projectId: string;
  plan: StagedGridIngest;
  planSteps: StepRecord[];
  bare: StagedGridIngest;
  bareSteps: StepRecord[];
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("grid");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const plan = await stageGridIngest(person, projectId, SCENARIO.PLAN, 71);
    const bare = await stageGridIngest(person, projectId, SCENARIO.NO_BUBBLES, 72);
    const root = tempFixtureRoot("grid-empty");
    const planSteps = await withFixtureRoot(root, async () => runGridPartition(person, plan, "grid-plan"));
    const bareSteps = await withFixtureRoot(root, async () => runGridPartition(person, bare, "grid-plan-no-bubbles"));
    return { person, projectId, plan, planSteps, bare, bareSteps };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The scope every door read is made in. */
function scopeOf(stage: Staged, ingest: StagedGridIngest): { tenantId: string; projectId: string; drawingId: string } {
  return { tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: ingest.drawing.drawingId };
}

/** Every layout-plan view the views stage left for one ingest — the views a grid may be read off. */
async function layoutPlanKeys(stage: Staged, ingest: StagedGridIngest): Promise<string[]> {
  const law = await viewsLaw();
  const plan = String(law.VIEW_TYPE[LAYOUT_PLAN]);
  return partitionViewRows(stage.person.tenantId, ingest.ingestId)
    .filter((view) => view.type === plan)
    .map((view) => view.viewKey);
}

/** The one layout-plan view of an ingest — named as a singular, because that is what the artifact draws. */
async function planViewKey(stage: Staged, ingest: StagedGridIngest): Promise<string> {
  const keys = await layoutPlanKeys(stage, ingest);
  expect(keys.length, `the ${ingest.artifact.scenario} artifact's plan caption anchors exactly one layout-plan view — with none there is no grid to read (L-CAD-06)`).toBe(1);
  return keys[0]!;
}

/** The rows AC-1 owes the layout plan: derived from the artifact, over the entities that view holds. */
async function owedRows(stage: Staged, ingest: StagedGridIngest): Promise<GridAxisRow[]> {
  const viewKey = await planViewKey(stage, ingest);
  const inView = viewAssignmentRows(stage.person.tenantId, ingest.ingestId)
    .filter((assignment) => assignment.viewKey === viewKey)
    .map((assignment) => assignment.entityKey);
  return expectedGridRows(ingest.artifact, inView).map((row) => ({ viewKey, ...row }));
}

describe("AC-1: the grid is read off the bubble content signature", () => {
  test("AC-1: every lawful bubble of the layout plan is one grids row, georeferenced by family and axis", async () => {
    const stage = await staged();
    const owed = await owedRows(stage, stage.plan);

    // The case is armed by the artifact rather than by a number written down here: it carries both
    // families, each with labels enough for a spacing to exist at all (B-19).
    expect(new Set(owed.map((row) => row.family)), "the staged plan really carries both a letter family and a numeral family").toEqual(new Set([FAMILY_LETTER, FAMILY_NUMERAL]));
    expect(new Set(owed.filter((row) => row.family === FAMILY_LETTER).map((row) => row.axis)), "the letters georeference along the world axis they spread along").toEqual(new Set([AXIS_X]));
    expect(new Set(owed.filter((row) => row.family === FAMILY_NUMERAL).map((row) => row.axis)), "and the numerals along theirs").toEqual(new Set([AXIS_Y]));

    expect(
      byBubble(gridRows(stage.person.tenantId, stage.plan.ingestId)),
      "one row per lawful bubble — the view it stands in, its family and label, the axis and position it georeferences at, the ring and the text it was read from, and the view's minimum spacing (L-CAD-07, L-MEA-01)",
    ).toEqual(byBubble(owed));
  }, BUDGET_MS);

  test("AC-1: a label is compared dotless and uppercase, and every row of the view carries one minimum spacing", async () => {
    const stage = await staged();
    const rows = gridRows(stage.person.tenantId, stage.plan.ingestId);
    const drawn = stage.plan.artifact.originals.filter((record) => rows.some((row) => row.labelKey === record.key)).map((record) => String(record.text ?? ""));
    expect(
      drawn.filter((text) => normalisedLabelOf(text)?.label !== text).length,
      `the staged plan really draws labels that are not already their own normalised form; it drew ${drawn.join(", ")}`,
    ).toBeGreaterThan(0);
    expect(
      rows.map((row) => row.label),
      "a stored label is the dotless-uppercase reading of the text the drawing carries (L-CAD-07)",
    ).toEqual(rows.map((row) => normalisedLabelOf(String(stage.plan.artifact.originals.find((record) => record.key === row.labelKey)?.text ?? ""))?.label ?? ""));

    const spacings = new Set(rows.map((row) => row.minSpacing));
    expect(spacings.size, `every row of one view carries that view's own minimum spacing, which placement scales its shares by (L-MEA-01); the rows carry ${[...spacings].join(", ")}`).toBe(1);
    expect([...spacings][0], "and a spacing is a real distance").toBeGreaterThan(0);
  }, BUDGET_MS);

  test("AC-1: a ring whose text is not a bare label, a label inside no ring, and a ring that is not round yield nothing", async () => {
    const stage = await staged();
    const rows = gridRows(stage.person.tenantId, stage.plan.ingestId);
    const read = new Set(rows.flatMap((row) => [row.bubbleKey, row.labelKey]));
    const excluded = stage.plan.artifact.excluded;
    expect(
      Object.entries(excluded).filter(([, key]) => key !== null && read.has(key)),
      "the paired-label ring, the bare letter standing inside no ring and the square ring are none of them grid evidence — detection is by the content signature, never by what a thing is drawn on or typed as (L-CAD-07)",
    ).toEqual([]);
    for (const [what, key] of Object.entries(excluded)) {
      expect(key, `the staged plan really draws the ${what} that AC-1 says yields nothing`).not.toBeNull();
    }
  }, BUDGET_MS);

  test("AC-1: gridOf answers the drawing's stored axes — the rows the overlay and placement read", async () => {
    const stage = await staged();
    const door = await gridDoor();
    const owed = await owedRows(stage, stage.plan);
    const answered = await door.gridOf(scopeOf(stage, stage.plan));
    expect(answered, "the drawing's grid is readable through the module's own door — it is what the overlay and placement read (R-TO-030)").toBeTruthy();
    expect(byBubble((answered?.axes ?? []).map(axisRowOf)), "and the door answers the rows the store holds").toEqual(byBubble(owed));
  }, BUDGET_MS);
});

describe("AC-2: a layout plan with no lawful bubble evidence georeferences as deferred", () => {
  test("AC-2: the run ends, writes no axis, and leaves one deferral naming the layout plan", async () => {
    const stage = await staged();
    expect(
      stage.bareSteps.map((step) => step.step),
      `a plan nobody bubbled is not a partition that failed — the run ends and says so; its log reads: ${stage.bareSteps.map((step) => step.step).join(" → ")}`,
    ).toContain(STORED_STEP);

    expect(gridRows(stage.person.tenantId, stage.bare.ingestId), "no axis is guessed from grid lines and loose letters (L-CAD-07)").toEqual([]);
    expect(gridDeferralRows(stage.person.tenantId, stage.bare.ingestId), "the view georeferences as one deferral, under the closed reason the register holds").toEqual([
      { viewKey: await planViewKey(stage, stage.bare), reason: GRID_NO_BUBBLE_EVIDENCE },
    ]);
  }, BUDGET_MS);

  test("AC-2: gridOf answers that same deferral, and no axes", async () => {
    const stage = await staged();
    const door = await gridDoor();
    const answered = await door.gridOf(scopeOf(stage, stage.bare));
    expect(answered, "a deferred grid is still an answer a caller can act on, never an absence (R-UI-050)").toBeTruthy();
    expect((answered?.deferrals ?? []).map(deferralRowOf), "the door answers the deferral the store holds").toEqual(gridDeferralRows(stage.person.tenantId, stage.bare.ingestId));
    expect((answered?.axes ?? []).length, "and no axis beside it").toBe(0);
  }, BUDGET_MS);

  test("AC-2: GRID_NO_BUBBLE_EVIDENCE is a registered refusal a person can read", async () => {
    const errors = await productModule<ErrorsSeam>(ERRORS_MODULE);
    const entry = errors.REFUSALS[GRID_NO_BUBBLE_EVIDENCE];
    expect(entry, `${GRID_NO_BUBBLE_EVIDENCE} is a registered refusal — the reason a deferral carries is a code the register holds (Q-07, R-UI-020)`).toBeTruthy();
    expect(entry?.code, "the entry is keyed by its own code").toBe(GRID_NO_BUBBLE_EVIDENCE);
    expect(entry?.severity, "a plan that never showed a bubble is information about the drawing, not a failure of ours").toBe("info");
    expect(entry?.surface, "and it is said beside the thing it is about").toBe("inline");
    expect((entry?.message ?? "").length, "the refusal says in one sentence what was refused").toBeGreaterThan(0);
    expect((entry?.remedy ?? "").length, "and in one sentence what resolves it").toBeGreaterThan(0);
  }, BUDGET_MS);
});

describe("AC-3: the grid stage runs inside the rebuild, after conventions, and is rebuilt per ingest", () => {
  test("AC-3: the stage list names the grid once, after the convention profile", async () => {
    const rebuild = await rebuildDoor();
    const stages = [...rebuild.PARTITION_STAGES];
    expect(
      stages.filter((stage) => stage === GRID_STAGE).length,
      `the stage list names \`${GRID_STAGE}\` exactly once — a roster that repeats one would run it twice; the list reads: ${stages.join(" → ")}`,
    ).toBe(1);
    expect(stages.indexOf(CONVENTIONS_STAGE), `and it names the convention profile the grid's candidates are filtered by; the list reads: ${stages.join(" → ")}`).toBeGreaterThanOrEqual(0);
    expect(
      stages.indexOf(GRID_STAGE),
      `the grid runs AFTER the conventions, because a candidate is an entity standing on a layer that profile gave a role to (L-CAD-07, L-CAD-08); the list reads: ${stages.join(" → ")}`,
    ).toBeGreaterThan(stages.indexOf(CONVENTIONS_STAGE));
  }, BUDGET_MS);

  test("AC-3: the run records a grid step between conventions and stored, saying what it examined and wrote", async () => {
    const stage = await staged();
    for (const [ingest, steps] of [
      [stage.plan, stage.planSteps],
      [stage.bare, stage.bareSteps],
    ] as const) {
      const said = steps.map((entry) => entry.step);
      const at = said.indexOf(GRID_STAGE);
      expect(at, `the ${ingest.artifact.scenario} run recorded a \`${GRID_STAGE}\` step — a stage with nothing behind it is not a visible stage (R-TO-030); the log reads: ${said.join(" → ")}`).toBeGreaterThanOrEqual(0);
      expect(at, `and it stands after the conventions step it reads the roles from; the log reads: ${said.join(" → ")}`).toBeGreaterThan(said.indexOf(CONVENTIONS_STAGE));
      expect(at, `and before the step that says the partition was written; the log reads: ${said.join(" → ")}`).toBeLessThan(said.indexOf(STORED_STEP));

      const detail = steps[at]?.detail ?? {};
      for (const key of ["views", "axes", "deferred"]) {
        expect(typeof detail[key], `the ${ingest.artifact.scenario} step says \`${key}\` as a number`).toBe("number");
      }
      // What the numbers SAY is what makes the step visible: a detail nobody could read off the
      // run's own result is a constant with a number's shape (R-TO-030).
      expect(detail["views"], "the step examined the layout-plan views the partition really holds").toBe((await layoutPlanKeys(stage, ingest)).length);
      expect(detail["axes"], "and wrote the axis rows the store now holds").toBe(gridRows(stage.person.tenantId, ingest.ingestId).length);
      expect(detail["deferred"], "and the deferrals the store now holds").toBe(gridDeferralRows(stage.person.tenantId, ingest.ingestId).length);
    }
  }, BUDGET_MS);

  test("AC-3: a second rebuild of the same ingest leaves the same rows, never a second set", async () => {
    const stage = await staged();
    const before = { axes: gridRows(stage.person.tenantId, stage.plan.ingestId), deferrals: gridDeferralRows(stage.person.tenantId, stage.plan.ingestId) };
    expect(before.axes.length, "the first rebuild really wrote rows — an empty partition would compare equal to anything").toBeGreaterThan(0);

    await withFixtureRoot(tempFixtureRoot("grid-empty-again"), async () => runGridPartition(stage.person, stage.plan, "grid-plan-again"));
    expect(
      { axes: gridRows(stage.person.tenantId, stage.plan.ingestId), deferrals: gridDeferralRows(stage.person.tenantId, stage.plan.ingestId) },
      "a partition is REBUILT per ingest: the second run rewrote the record's rows rather than standing a second set beside them (R-TO-030, L-REG-04)",
    ).toEqual(before);
  }, BUDGET_MS);
});
