/**
 * J-021 (partition leg): the three new stages are TOTAL over the real corpus.
 *
 * The journey's own leg is `tests/e2e/viewer-partition.spec.ts`, which this increment neither owns
 * nor changes: it adds no screen, no route and no string. What this leaf can move — and therefore
 * what this file grades — is the partition run the leg stands on: over `fixtures/rcc6`, read by the
 * shipped `cad/` CLI and partitioned by the shipped job, the three new stages record their steps,
 * the expansion says `revisions: 0` where no set revision is pinned, and the views the leg reads are
 * still stored. A stage that threw on a view with no evidence of its kind would take the whole leg
 * down; this is that check, at the level this increment can affect.
 *
 * What the leg RENDERS — the viewer route, the axes drawn on it — is the screen's, and no line this
 * increment may lawfully write moves it, so it is not asserted here.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  EXPANSION_STAGE,
  EXPECTED_STAGES,
  GRID_STAGE,
  LEVELS_PROPOSAL_STAGE,
  PLACEMENT_STAGE,
  SCHEDULES_STAGE,
  STORED_STEP,
  VIEWS_STAGE,
  closeStage,
  placementRows,
  proposedLevelRows,
  rowsOfIngest,
  runPlacementPartition,
  stageCorpusIngest,
  stagePlacementProject,
  stepDetail,
  stepNames,
  type PlacementStage,
  type StepRecord,
} from "../support/placement-stage";

/** The stored partition's own table of views — what the leg's viewer reads a view out of. */
const PARTITION_VIEWS = "partition_views";

let stage: PlacementStage;
let corpus: { drawingId: string; ingestId: string };
let steps: StepRecord[];

beforeAll(async () => {
  stage = await stagePlacementProject("journey");
  corpus = await stageCorpusIngest(stage, "j021-rcc6");
  // The run itself is the assertion of totality: a stage that threw over the corpus fails here.
  steps = await runPlacementPartition(stage, corpus, "j021");
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("J-021: the partition leg keeps running over the real corpus", () => {
  test("J-021: every stage of the list records its step over fixtures/rcc6, in order", () => {
    const recorded = stepNames(steps);
    for (const stageName of EXPECTED_STAGES) expect(recorded, `the run over the corpus recorded a \`${stageName}\` step`).toContain(stageName);
    const order = [VIEWS_STAGE, GRID_STAGE, SCHEDULES_STAGE, PLACEMENT_STAGE, EXPANSION_STAGE, LEVELS_PROPOSAL_STAGE, STORED_STEP].map((step) => recorded.indexOf(step));
    expect(order.every((at) => at >= 0), `every step of the order was recorded: ${recorded.join(", ")}`).toBe(true);
    expect(order, `the steps stand in order: ${recorded.join(", ")}`).toEqual([...order].sort((left, right) => left - right));
  });

  test("J-021: nothing is registered where no set revision is pinned", () => {
    const detail = stepDetail(steps, EXPANSION_STAGE);
    expect(Number(detail["revisions"]), "no set of this project is pinned, so no revision names the drawing (L-REG-06)").toBe(0);
    expect(Number(detail["registered"]), "and a drawing nothing has been measured under registers nothing").toBe(0);
  });

  test("J-021: the views the leg reads are still stored, and each new stage stored what it says it read", () => {
    const views = rowsOfIngest(PARTITION_VIEWS, stage.person.tenantId, corpus.ingestId);
    const stored = stepDetail(steps, STORED_STEP);
    expect(views.length, "the partition stores the views it says it stored").toBe(Number(stored["views"]));
    expect(views.length, "the corpus is a drawing set: the leg has views to read").toBeGreaterThan(0);

    // Whatever the corpus gives the two storing stages — evidence or nothing at all — what they say
    // they read is what stands in the store afterwards. A stage that examined nothing writes nothing
    // and says so; it does not throw, and it does not leave rows it never reported (R-UI-050).
    const placement = stepDetail(steps, PLACEMENT_STAGE);
    expect(placementRows(stage.person.tenantId, corpus.ingestId).length, "the placements the placement stage reported are the placements stored").toBe(Number(placement["placements"]));
    const proposal = stepDetail(steps, LEVELS_PROPOSAL_STAGE);
    expect(proposedLevelRows(stage.person.tenantId, corpus.ingestId).length, "and the levels the proposal stage reported are the levels proposed").toBe(Number(proposal["proposed"]));
  });
});
