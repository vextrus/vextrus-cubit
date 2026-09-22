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
  DERIVED,
  MEASURED,
  NOTED_BAND_FROM,
  NOTED_BINDING_MARK,
  NOTED_MINTING_MARK,
  NOTED_MINTING_NOTE,
  NOTED_SHAPE,
  SCENARIO,
  STACK_LABELS,
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
  type StoreRow,
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

/* ------------------------------------------------------------------ what the store has to carry */

/**
 * THE STRUCTURAL CLOSE, GRADED: a re-expansion answers the rows the ingest-time expansion answered,
 * for a drawing whose members a NOTE excepted (I-303, L-REG-04, B-17).
 *
 * The defect this case exists against is the shape of this file's own subject. There are two readers
 * of a stored partition — the partition job, which resolves what it has just DETECTED, and this
 * re-expansion, which resolves what it READS BACK — and until the store's one conversion was
 * published each of them spelled a placement row out by hand. A column the first learned to carry
 * and the second forgot is not a compile error and not a wrong number anywhere visible: it is a
 * member standing on seven storeys after an ingest and on one after a pin, depending on which reader
 * ran last.
 *
 * So the drawing here is the one whose answer DIFFERS between the two readings if the note is lost.
 * The NOTED plan is typical of six storeys and writes two sentences: one over a member its own mark
 * tags, stating a shape and no range (that member stands on the level the plan draws, alone), and
 * one over a ring nobody tags, stating `STARTS AT 3RD` (that member is placed by the sentence and
 * stands from the third floor up). A re-expansion that read the store without the note would put the
 * first on all six storeys and the second on all six from the first — and every assertion below
 * would be a different number.
 */
describe("re-expansion carries what the store carries: a noted member stands where its own note says", () => {
  let stage: PlacementStage;
  let ingest: StagedPlacementIngest;
  let setRevisionId: string;

  /** The label of the level each register row stands on, by the placement's mark, with its standing. */
  function standingByMark(): Map<string, string[]> {
    const marks = new Map(placementRows(stage.person.tenantId, ingest.ingestId).map((row) => [said(row, "placementKey", "placement_key"), said(row, "mark", "mark")]));
    const labels = new Map(levelsOfProject(stage).map((level) => [level.levelId, level.label]));
    const byMark = new Map<string, string[]>();
    for (const row of registerObjectRows(stage.person.tenantId, setRevisionId)) {
      const mark = marks.get(said(row, "placementKey", "placement_key"));
      if (mark === undefined) continue;
      byMark.set(mark, [...(byMark.get(mark) ?? []), `${labels.get(said(row, "levelId", "level_id")) ?? "?"}:${said(row, "standing", "standing")}`].sort());
    }
    return byMark;
  }

  beforeAll(async () => {
    stage = await stagePlacementProject("reexpand-noted");
    ingest = await stagePlacementIngest(stage, SCENARIO.NOTED, 0x2e40);
    await runPlacementPartition(stage, ingest, "reexpand-noted");
    // Both inputs move behind the doors, as the case above stages them, so what registers the rows
    // is the re-expansion and nothing else.
    setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);
    await stageStack(stage, STACK_LABELS);
  }, 240_000);

  afterAll(async () => {
    await closeStage();
  });

  /** The one placement of this drawing standing under a mark — asserted singular rather than assumed. */
  function placedUnder(mark: string): StoreRow {
    const found = placementRows(stage.person.tenantId, ingest.ingestId).filter((row) => said(row, "mark", "mark") === mark);
    expect(found.length, `exactly one member of this drawing stands under ${mark}`).toBe(1);
    return found[0] as StoreRow;
  }

  test("the store holds the note the stage read, whole: its key, its words, its range and its shape", () => {
    const bound = placedUnder(NOTED_BINDING_MARK);
    expect(said(bound, "noteShape", "note_shape"), "the plan states the shape (I-304)").toBe(NOTED_SHAPE);
    expect(
      [said(bound, "noteFromLabel", "note_from_label"), said(bound, "noteToLabel", "note_to_label")],
      "and states no range, which I-303 reads as the level the plan DRAWS",
    ).toEqual(["", ""]);

    // The minted member: its own mark tags nothing on this plan, so the sentence is the entity that
    // named it and the store carries that citation (I-303, L-CAD-03).
    const minted = placedUnder(NOTED_MINTING_MARK);
    expect(said(minted, "markKey", "mark_key"), "the sentence is the entity that named it").toBe(said(minted, "noteKey", "note_key"));
    expect(said(minted, "markText", "mark_text"), "kept as the drawing spelled it").toBe(NOTED_MINTING_NOTE);
    expect(said(minted, "noteFromLabel", "note_from_label"), "and the storey its words name").toBe(NOTED_BAND_FROM);
  });

  test("before the re-expansion nothing stands, pin and stack notwithstanding", () => {
    expect(registerObjectRows(stage.person.tenantId, setRevisionId), "the resolver has not run since the inputs moved").toEqual([]);
  });

  test("re-expanding registers each member on the levels ITS OWN evidence names, and no others", async () => {
    const seam = await reexpandSeam();
    await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    const byMark = standingByMark();

    // The nine the plan tags are its typical: every storey the caption is typical of, measured at
    // the one it was drawn at.
    for (const mark of ["C1", "C2", "C3"]) {
      expect(byMark.get(mark)?.length, `${mark} names three members, each over six storeys`).toBe(3 * STACK_LABELS.length);
    }
    // And the two the sentences are about are not typical of anything (I-303).
    expect(byMark.get(NOTED_BINDING_MARK), "a note stating no range leaves its member on the level the plan draws, alone").toEqual([`${STACK_LABELS[0]}:${MEASURED}`]);
    expect(byMark.get(NOTED_MINTING_MARK), "a note stating `STARTS AT 3RD` stands its member there and derives it above").toEqual(
      [`${NOTED_BAND_FROM}:${MEASURED}`, ...STACK_LABELS.slice(3).map((label) => `${label}:${DERIVED}`)].sort(),
    );
  });

  test("re-expanding again answers the same rows: reading the store twice is reading one drawing", async () => {
    const before = standingByMark();
    const seam = await reexpandSeam();
    const again = await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
    expect(again.find((one) => one.drawingId === ingest.drawingId)?.registered, "nothing new to register").toBe(0);
    expect(standingByMark(), "and no member moved a storey between two readings of one store (L-REG-04)").toEqual(before);
  });
});
