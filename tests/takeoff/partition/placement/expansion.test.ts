/**
 * AC-3: nine columns across six levels mint fifty-four instance rows.
 *
 * The stack is authored as ONE `INSERT_LEVEL` and the drawing is named by a pinned set revision, both
 * through the shipped doors; the expansion is then read off the register the job itself wrote. Every
 * key is derived from the placements the fifth stage stored and the surrogates the ledger minted —
 * fifty-four is what nine placements over six levels COMES TO here, never a number transcribed.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  COLUMN,
  DERIVED,
  EXPANSION_STAGE,
  FOUNDATION,
  MEASURED,
  SCENARIO,
  STACK_LABELS,
  STRUCTURAL,
  UNREGISTERED_PREFIX,
  UNRESOLVED,
  closeStage,
  levelNamed,
  ordered,
  pinRevisionNaming,
  placementRows,
  registerObjectRows,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  stepDetail,
  type PlacementStage,
  type StackedLevel,
  type StagedPlacementIngest,
  type StepRecord,
} from "../support/placement-stage";

let stage: PlacementStage;
let staged: StagedPlacementIngest;
let unnamed: StagedPlacementIngest;
let steps: StepRecord[];
let unnamedSteps: StepRecord[];
let levels: StackedLevel[];
let setRevisionId: string;

beforeAll(async () => {
  stage = await stagePlacementProject("expansion");
  levels = await stageStack(stage, STACK_LABELS);
  staged = await stagePlacementIngest(stage, SCENARIO.TYPICAL_RANGE, 0x23);
  setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
  steps = await runPlacementPartition(stage, staged, "expansion");

  // A second drawing of the same project that no pinned revision names: the revision stands, and it
  // does not cite this drawing (AC-3's second half).
  unnamed = await stagePlacementIngest(stage, SCENARIO.TYPICAL_RANGE, 0x24);
  unnamedSteps = await runPlacementPartition(stage, unnamed, "expansion-unnamed");
}, 600_000);

afterAll(async () => {
  await closeStage();
});

/** The object keys standing for this set revision, in code-point order. */
function objectKeys(): string[] {
  return ordered(registerObjectRows(stage.person.tenantId, setRevisionId).map((row) => said(row, "objectKey", "object_key")));
}

describe("AC-3: nine columns across six levels mint 54", () => {
  test("AC-3: every placement stands on every level of the stated range", () => {
    const placements = placementRows(stage.person.tenantId, staged.ingestId).map((row) => said(row, "placementKey", "placement_key"));
    expect(placements.length, "the plan placed its columns (AC-1)").toBe(staged.artifact.members.filter((member) => member.placed).length);
    expect(levels.length, `the stack the range names is live: ${STACK_LABELS.join(", ")}`).toBe(STACK_LABELS.length);

    const expected = ordered(placements.flatMap((placement) => levels.map((level) => `${placement}@${level.levelId}`)));
    expect(expected.length, "nine placements over six levels is fifty-four instance rows").toBe(placements.length * levels.length);
    expect(objectKeys(), "each row keys on its placement and the surrogate of the level it stands on (L-REG-04)").toEqual(expected);
  });

  test("AC-3: the drawn level is MEASURED and the undrawn ones DERIVED", () => {
    const rows = registerObjectRows(stage.person.tenantId, setRevisionId);
    const drawn = levelNamed(levels, STACK_LABELS[0] as string);
    const onDrawn = rows.filter((row) => said(row, "levelId", "level_id") === drawn.levelId);
    const elsewhere = rows.filter((row) => said(row, "levelId", "level_id") !== drawn.levelId);
    expect(onDrawn.length, "the range's first level carries one row per placement — the level the plan was drawn at").toBe(rows.length / levels.length);
    expect(new Set(onDrawn.map((row) => said(row, "standing", "standing"))), "a row on the drawn level is measured geometry").toEqual(new Set([MEASURED]));
    expect(new Set(elsewhere.map((row) => said(row, "standing", "standing"))), "a row on an undrawn level is derived geometry").toEqual(new Set([DERIVED]));
    expect(new Set(rows.map((row) => said(row, "elementType", "element_type"))), "every row of this view is a column").toEqual(new Set([COLUMN]));
    expect(new Set(rows.map((row) => said(row, "discipline", "discipline"))), "every row is registered under the drawing's discipline").toEqual(new Set([STRUCTURAL]));
  });

  test("AC-3: no placeholder key stands for a view whose range resolved", () => {
    const keys = objectKeys();
    expect(keys.length, "the view's placements stand on the levels of the range its caption states").toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.endsWith(`@${UNRESOLVED}`), `${key} stands on a level, not in the unresolved slot`).toBe(false);
      expect(key.endsWith(`@${FOUNDATION}`), `${key} is a vertical class, not a foundation`).toBe(false);
      expect(key.includes(UNREGISTERED_PREFIX), `${key} names an authored level, not one nobody authored`).toBe(false);
    }
  });

  test("AC-3: the expansion step reports the revision it resolved and the rows it registered", () => {
    const detail = stepDetail(steps, EXPANSION_STAGE);
    expect(Number(detail["revisions"]), "one pinned set revision names this drawing").toBe(1);
    expect(Number(detail["registered"]), "the step reports the rows it registered").toBe(objectKeys().length);
  });

  test("AC-3: a drawing no pinned revision names registers nothing", () => {
    const detail = stepDetail(unnamedSteps, EXPANSION_STAGE);
    expect(Number(detail["revisions"]), "no pinned set revision names this drawing").toBe(0);
    expect(Number(detail["registered"]), "and so nothing is registered for it").toBe(0);

    const placements = new Set(placementRows(stage.person.tenantId, unnamed.ingestId).map((row) => said(row, "placementKey", "placement_key")));
    expect(placements.size, "the unnamed drawing was still placed — the register is what stands empty").toBeGreaterThan(0);
    const cited = registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => placements.has(said(row, "placementKey", "placement_key")));
    expect(cited, "no register row cites a placement of a drawing no revision names").toEqual([]);
  });
});
