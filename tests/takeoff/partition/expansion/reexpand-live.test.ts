/**
 * THE REGISTER FOLLOWS THE ACTS THAT MOVE ITS INPUTS (L-CAD-07, L-REG-03, L-REG-06, J-000).
 *
 * WHY. The expansion resolver is "an order-independent resolver over the whole set revision"
 * (L-CAD-07), and until 2026-09-21 it ran in exactly one place: the partition job's expansion stage,
 * at ingest — before any set was pinned and before any level stood. A drawing's sightings are scoped
 * to a pinned set revision (L-REG-03), so at ingest the stage resolved rows and registered nothing;
 * then the customer pinned a set and inserted the levels the partition proposed, and nothing ran the
 * resolver again. There was no order of clicks that reached a measurable campaign on a project a
 * customer had just made (tests/e2e/journeys/j-000/m2-column-lines.spec.ts, MISSING DOOR).
 *
 * The door: the stored partition (placements, views, schedule bands) is re-resolved over the live
 * stack and re-registered under every pinned revision naming the drawing whenever an act moves one
 * of the resolver's inputs — a pin (the revision set), a level inserted or repudiated (the stack), a
 * typical range authored — through one function, `reexpandProject`, which the partition job's own
 * stage stands beside. No artifact is re-read; nothing of the cad lane runs (L-CAD-01).
 *
 * The scenario is the placement stage's SINGLE_LEVEL plan: nine columns on a plan captioned for one
 * level, so a level of that label is what makes the nine resolvable (the expansion breaker's own).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { actionsAs, setsSeam } from "../../sets/support/sets-stage";
import { door, insertion, takeoffCaller } from "../../levels-ui/support/levels-ui-stage";
import {
  SCENARIO,
  closeStage,
  levelsOfProject,
  pinRevisionNaming,
  placementRows,
  registerObjectRows,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  type PlacementStage,
  type StagedPlacementIngest,
} from "../support/placement-stage";

const LEVEL_LABEL = "2nd";
const SALT = 0x2e2e;

/** The nine columns the SINGLE_LEVEL plan draws (the placement stage's own count). */
const DRAWN_COLUMNS = 9;

type Reexpand = { reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<{ drawingId: string; registered: number; rows: number }[]> };

async function reexpandSeam(): Promise<Reexpand> {
  return (await import("@/modules/takeoff/partition/expansion/reexpand")) as unknown as Reexpand;
}

function registeredUnder(stage: PlacementStage, ingest: StagedPlacementIngest, setRevisionId: string): string[] {
  const placed = new Set(placementRows(stage.person.tenantId, ingest.ingestId).map((row) => said(row, "placementKey", "placement_key")));
  return registerObjectRows(stage.person.tenantId, setRevisionId)
    .filter((row) => placed.has(said(row, "placementKey", "placement_key")))
    .map((row) => said(row, "objectKey", "object_key"));
}

describe("reexpandProject: the stored partition re-resolved over the live stack and re-registered under the pinned revisions", () => {
  let stage: PlacementStage;
  let ingest: StagedPlacementIngest;
  let setRevisionId: string;

  beforeAll(async () => {
    stage = await stagePlacementProject("reexpand-function");
    ingest = await stagePlacementIngest(stage, SCENARIO.SINGLE_LEVEL, SALT);
    await runPlacementPartition(stage, ingest, "reexpand-at-ingest");
    // Both inputs move BEHIND the doors — through the seams, as the breaker stages them — so this
    // case proves the function, and the cases below prove the doors call it.
    setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);
    await stageStack(stage, [LEVEL_LABEL], 2);
  }, 240_000);

  afterAll(async () => {
    await closeStage();
  });

  test("the gap: a partition run at ingest, then a pin and a level through the seams, registers nothing", () => {
    expect(placementRows(stage.person.tenantId, ingest.ingestId).length, "the plan placed its nine columns").toBe(DRAWN_COLUMNS);
    expect(levelsOfProject(stage).map((level) => level.label), "the level the caption names now stands").toEqual([LEVEL_LABEL]);
    expect(registeredUnder(stage, ingest, setRevisionId), "and yet the pinned revision holds no register object — the resolver never ran again").toEqual([]);
  });

  test("re-expanding the project registers the nine columns under the pinned revision", async () => {
    const seam = await reexpandSeam();
    const answered = await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    const forDrawing = answered.find((one) => one.drawingId === ingest.drawingId);
    expect(forDrawing, "the drawing with a stored partition was re-expanded").toBeTruthy();
    expect(forDrawing?.rows, "the nine placements resolve to nine rows over the live stack").toBe(DRAWN_COLUMNS);
    expect(forDrawing?.registered, "and all nine are registered under the one pinned revision").toBe(DRAWN_COLUMNS);
    const keys = registeredUnder(stage, ingest, setRevisionId);
    expect(keys.length, `the register holds one object per drawn column: ${keys.slice().sort().join("\n")}`).toBe(DRAWN_COLUMNS);
    expect(new Set(keys).size, "each placement stands under exactly one register object (L-REG-03)").toBe(keys.length);
  });

  test("re-expanding again is idempotent: the same nine stand, none duplicated", async () => {
    const seam = await reexpandSeam();
    const again = await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    const forDrawing = again.find((one) => one.drawingId === ingest.drawingId);
    expect(forDrawing?.registered, "nothing new to register").toBe(0);
    expect(registeredUnder(stage, ingest, setRevisionId).length).toBe(DRAWN_COLUMNS);
  });
});

describe("the doors that move the resolver's inputs re-expand: INSERT_LEVEL through the router", () => {
  let stage: PlacementStage;
  let ingest: StagedPlacementIngest;
  let setRevisionId: string;

  beforeAll(async () => {
    stage = await stagePlacementProject("reexpand-level-door");
    ingest = await stagePlacementIngest(stage, SCENARIO.SINGLE_LEVEL, SALT + 1);
    await runPlacementPartition(stage, ingest, "reexpand-level-door");
    setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);
  }, 240_000);

  afterAll(async () => {
    await closeStage();
  });

  test("inserting the level the caption names, through the shipped door, leaves the nine columns standing in the register", async () => {
    expect(registeredUnder(stage, ingest, setRevisionId), "before the level, nothing stands").toEqual([]);
    const caller = await takeoffCaller(stage.person);
    const input = insertion(stage.projectId, [{ label: LEVEL_LABEL, ordinal: 2 }]);
    const previewed = (await door(caller, "previewInsertLevel")({ input })) as { consequenceDigest: string };
    await door(caller, "commitInsertLevel")({ input, consequenceDigest: previewed.consequenceDigest });
    const keys = registeredUnder(stage, ingest, setRevisionId);
    expect(keys.length, `the door re-expanded: ${keys.slice().sort().join("\n")}`).toBe(DRAWN_COLUMNS);
  });
});

describe("the doors that move the resolver's inputs re-expand: the pin through the sets action", () => {
  let stage: PlacementStage;
  let ingest: StagedPlacementIngest;

  beforeAll(async () => {
    stage = await stagePlacementProject("reexpand-pin-door");
    ingest = await stagePlacementIngest(stage, SCENARIO.SINGLE_LEVEL, SALT + 2);
    await runPlacementPartition(stage, ingest, "reexpand-pin-door");
    await stageStack(stage, [LEVEL_LABEL], 2);
  }, 240_000);

  afterAll(async () => {
    await closeStage();
  });

  test("pinning a set that names the drawing, through the shipped action, registers the nine columns under the new revision", async () => {
    const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };
    const sets = await setsSeam();
    const created = (await sets.createSet(scope, { userId: stage.person.userId }, `reexpand set ${SALT}`)) as { created: boolean; setId?: string };
    expect(created.created, "the set was created").toBe(true);
    const setId = created.setId as string;
    const toggled = (await sets.toggleMember(scope, setId, ingest.drawingId)) as { toggled: boolean };
    expect(toggled.toggled, "the drawing is in the set's draft").toBe(true);

    const pinned = await actionsAs(stage.person, async (actions) => {
      const previewed = await actions.previewPin({ ...scope, setId });
      expect(previewed.previewed, `the pin previews: ${JSON.stringify(previewed)}`).toBe(true);
      return actions.commitPin({ ...scope, setId, consequenceDigest: previewed.consequenceDigest as string });
    });
    expect(pinned.committed, `the pin commits: ${JSON.stringify(pinned)}`).toBe(true);
    const keys = registeredUnder(stage, ingest, pinned.setRevisionId as string);
    expect(keys.length, `the pin re-expanded onto its own revision: ${keys.slice().sort().join("\n")}`).toBe(DRAWN_COLUMNS);
  });
});
