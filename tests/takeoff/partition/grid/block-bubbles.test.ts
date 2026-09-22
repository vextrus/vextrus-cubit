/**
 * The grid bubble a drawing draws as ONE BLOCK (L-CAD-07, L-CAD-03, R-TO-030).
 *
 * A real structural drawing does not draw its bubbles as a circle beside a letter: it inserts a
 * GRID_BUBBLE block, whose ring arrives as derived paint carrying the instance's key and whose label
 * arrives as an attribute row carrying the same key. The content signature is the same signature —
 * a bare letter or numeral inside a circle — and the bond between the two halves is tighter than
 * "inside this circle": they came out of one original.
 *
 * Two things that are NOT that, staged beside it, because the rule is only as good as what it
 * refuses: an instance that PAINTS its own label (a picture of a bubble), and a key plan on the
 * title sheet painting eleven of them (a picture of a grid). Both carry a perfect signature in
 * geometry and neither SAYS anything, which is what makes them unreadable by construction rather
 * than merely out of frame (L-QTY-04).
 *
 * Driven through the SHIPPED job over a really recorded ingest, and nothing here transcribes a row:
 * the rows owed are read off the artifact the scenario built (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  stagePerson,
  tempFixtureRoot,
  viewAssignmentRows,
  viewsLaw,
  withFixtureRoot,
  type Person,
  type StepRecord,
} from "../support/partition-stage";
import {
  LAYOUT_PLAN,
  SCENARIO,
  STORED_STEP,
  axisRowOf,
  byBubble,
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

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 900_000;

interface Staged {
  person: Person;
  projectId: string;
  drawn: StagedGridIngest;
  steps: StepRecord[];
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("grid-blocks");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const drawn = await stageGridIngest(person, projectId, SCENARIO.BLOCK_DRAWN, 81);
    const steps = await withFixtureRoot(tempFixtureRoot("grid-blocks-empty"), async () => runGridPartition(person, drawn, "grid-plan-blocks"));
    return { person, projectId, drawn, steps };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** Every layout-plan view the views stage left for the staged ingest. */
async function layoutPlanKeys(stage: Staged): Promise<string[]> {
  const law = await viewsLaw();
  const plan = String(law.VIEW_TYPE[LAYOUT_PLAN]);
  return partitionViewRows(stage.person.tenantId, stage.drawn.ingestId)
    .filter((view) => view.type === plan)
    .map((view) => view.viewKey);
}

/** The rows the staged drawing owes, view by view, derived from the artifact and the partition. */
async function owedRows(stage: Staged): Promise<GridAxisRow[]> {
  const assignments = viewAssignmentRows(stage.person.tenantId, stage.drawn.ingestId);
  const owed: GridAxisRow[] = [];
  for (const viewKey of await layoutPlanKeys(stage)) {
    const inView = assignments.filter((assignment) => assignment.viewKey === viewKey).map((assignment) => assignment.entityKey);
    owed.push(...expectedGridRows(stage.drawn.artifact, inView).map((row) => ({ viewKey, ...row })));
  }
  return owed;
}

describe("L-CAD-07, L-CAD-03: a plan whose bubbles are block instances georeferences", () => {
  test("the five instances stand in the layout-plan view the views stage read", async () => {
    const stage = await staged();
    const blocks = stage.drawn.artifact.blocks;
    expect(blocks.bubbles.length, "the scenario really draws its bubbles as block instances").toBeGreaterThan(1);

    const plans = new Set(await layoutPlanKeys(stage));
    const assignments = viewAssignmentRows(stage.person.tenantId, stage.drawn.ingestId);
    const homes = blocks.bubbles.map((key) => assignments.find((assignment) => assignment.entityKey === key)?.viewKey ?? "");
    expect(
      homes.filter((viewKey) => plans.has(viewKey)).length,
      `every block-drawn bubble belongs to the layout plan it was drawn in — an instance carries no geometry of its own, so where it STANDS is where its paint stands (L-CAD-06, L-CAD-03); they landed in ${homes.join(", ")}`,
    ).toBe(blocks.bubbles.length);
  }, BUDGET_MS);

  test("one grids row per block-drawn bubble, keyed by the instance and centred on the ring it painted", async () => {
    const stage = await staged();
    const owed = await owedRows(stage);
    const stored = gridRows(stage.person.tenantId, stage.drawn.ingestId);

    // Armed by the artifact: the rows owed are really the block-drawn ones, and there is no ring and
    // no text standing in model space for a geometric reading to have found instead (B-19).
    expect(owed.length, "the staged plan owes a row for every bubble its blocks draw").toBe(stage.drawn.artifact.blocks.bubbles.length);
    expect(
      stage.drawn.artifact.originals.filter((record) => record.closed === true).length,
      "the scenario really draws NO ring of its own: every circle in it is paint that came out of an instance",
    ).toBe(0);

    expect(
      byBubble(stored),
      "the ring came out of the instance and the label is the instance's own attribute row — one row per bubble, georeferenced by family and axis at the view's own spacing (L-CAD-07)",
    ).toEqual(byBubble(owed));
    for (const row of stored) {
      expect(row.bubbleKey, "L-CAD-03: an original entity is the only thing a source key names, and neither paint nor an attribute row is one").toBe(row.labelKey);
      expect(stage.drawn.artifact.blocks.bubbles, "and the key a row cites is the instance's own").toContain(row.bubbleKey);
    }
    expect(
      stored.map((row) => row.label).sort(),
      "a stored label is the dotless-uppercase reading of what the attribute row says, whatever tag it was said in",
    ).toEqual(
      stage.drawn.artifact.attributes
        .filter((attribute) => stage.drawn.artifact.blocks.bubbles.includes(attribute.src))
        .map((attribute) => normalisedLabelOf(attribute.text)?.label ?? "")
        .sort(),
    );
  }, BUDGET_MS);

  test("the plan georeferenced, so it defers nothing, and the run ended and said so", async () => {
    const stage = await staged();
    expect(
      stage.steps.map((step) => step.step),
      `the run ends and records that it stored what it read; its log reads: ${stage.steps.map((step) => step.step).join(" → ")}`,
    ).toContain(STORED_STEP);

    const plans = new Set(await layoutPlanKeys(stage));
    const read = new Set(gridRows(stage.person.tenantId, stage.drawn.ingestId).map((row) => row.viewKey));
    expect(
      gridDeferralRows(stage.person.tenantId, stage.drawn.ingestId).filter((deferral) => read.has(deferral.viewKey)),
      "a view yields rows or a deferral, never both (L-CAD-07)",
    ).toEqual([]);
    expect([...read].every((viewKey) => plans.has(viewKey)), "and only a layout-plan-class view yielded anything at all (L-CAD-06)").toBe(true);
  }, BUDGET_MS);
});

describe("L-QTY-04: a block that PAINTS its label has drawn a picture of a grid", () => {
  test("neither the painted-label instance nor the key plan is cited by any row", async () => {
    const stage = await staged();
    const blocks = stage.drawn.artifact.blocks;

    // Armed: both really carry the whole geometric signature — a round ring about a bare label —
    // and neither carries one attribute row. What refuses them is where their labels came from.
    for (const [what, key] of [
      ["painted-label instance", blocks.paintedLabel],
      ["key plan", blocks.keyPlan],
    ] as const) {
      expect(key, `the scenario really stages the ${what}`).not.toBeNull();
      const painted = stage.drawn.artifact.derived.filter((record) => record.src === key);
      expect(painted.filter((record) => record.closed === true).length, `the ${what} really paints a ring`).toBeGreaterThan(0);
      expect(
        painted.filter((record) => normalisedLabelOf(record.text ?? "") !== null).length,
        `and really paints bare labels inside those rings — the ${what} carries the signature in full`,
      ).toBeGreaterThan(0);
      expect(stage.drawn.artifact.attributes.filter((attribute) => attribute.src === key).length, `and says nothing of its own`).toBe(0);
    }

    const cited = new Set(gridRows(stage.person.tenantId, stage.drawn.ingestId).flatMap((row) => [row.bubbleKey, row.labelKey]));
    expect(cited.has(String(blocks.paintedLabel)), "a label a block painted is block geometry, never a statement about where an axis runs").toBe(false);
    expect(cited.has(String(blocks.keyPlan)), "and a key plan on a title sheet is a picture of a grid, drawn where L-CAD-06 partitions nothing").toBe(false);
  }, BUDGET_MS);

  test("gridOf answers the same rows the store holds", async () => {
    const stage = await staged();
    const door = await gridDoor();
    const answered = await door.gridOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: stage.drawn.drawing.drawingId });
    expect(answered, "a block-drawn grid is readable through the module's own door — it is what the overlay and placement read (R-TO-030)").toBeTruthy();
    expect(byBubble((answered?.axes ?? []).map(axisRowOf)), "and the door answers the rows the store holds").toEqual(byBubble(await owedRows(stage)));
  }, BUDGET_MS);
});
