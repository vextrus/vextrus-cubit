/**
 * I-366, through the store: a placeholder the caption's ordinal word left is retired onto the storey
 * the one resolver reads that word as, by the rebuild — never stood beside it.
 *
 * `expansion-carry-breaker` closed the CASE of one label (`2ND` typed `2nd`): INSERT_LEVEL's own carry
 * compares in the comparison form, so it moves that placeholder itself. This is the other half of the
 * same breaker, the one J-000 walked into on F-RCC6-BNBC: the drawing writes the storey in ordinal
 * words (`2ND FLOOR PLAN`) and the stack a person confirms writes it as the section marks it (`2F`).
 * The act carries nothing — `2ND` is not `2F` letter by letter — while the resolver reads `2ND` as `2F`
 * (`sameStorey`), so before this the rebuild after the act registered the nine columns on 2F beside
 * their nine placeholders, and the register held eighteen rows for nine drawn columns (L-REG-03).
 *
 * Both rebuild paths are graded, because both enter the one register pass (`registerExpansion`): the
 * partition job, and the re-expansion every level act's door runs after it commits.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  REGISTER_OBJECTS,
  SCENARIO,
  closeStage,
  field,
  levelsOfProject,
  pinRevisionNaming,
  placementRows,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  tableStands,
  type PlacementStage,
  type StagedPlacementIngest,
  type StoreRow,
} from "../support/placement-stage";

/** The word the caption `2ND FLOOR PLAN` names its storey by, and the label the section marks it. */
const DRAWN_LABEL = "2ND";
const STACK_LABEL = "2F";

/** The re-expansion, as the router calls it after a level act commits (L-REG-06). */
const REEXPAND_MODULE = "src/modules/takeoff/partition/expansion/reexpand.ts";
type Reexpand = {
  reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<{ drawingId: string; registered: number; carried: number; stale: readonly string[] }[]>;
};

/** One staged project: the single-level plan partitioned over an empty stack under a pinned revision. */
type Staged = { stage: PlacementStage; ingest: StagedPlacementIngest; setRevisionId: string };

async function stagePinnedBeforeTheStack(label: string, salt: number): Promise<Staged> {
  const stage = await stagePlacementProject(label);
  const ingest = await stagePlacementIngest(stage, SCENARIO.SINGLE_LEVEL, salt);
  const setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);
  // The stack is empty, so the caption's storey is one nobody has authored: the members stand under
  // `@unregistered:2ND` and wait to be carried (L-REG-04's one-hop carry).
  await runPlacementPartition(stage, ingest, `${label}-before`);
  return { stage, ingest, setRevisionId };
}

/** Every register row of the pinned revision that stands for this drawing's placements. */
function rowsOf(staged: Staged): StoreRow[] {
  const placed = new Set(placementRows(staged.stage.person.tenantId, staged.ingest.ingestId).map((row) => said(row, "placementKey", "placement_key")));
  return registerObjectRows(staged.stage.person.tenantId, staged.setRevisionId).filter((row) => placed.has(said(row, "placementKey", "placement_key")));
}

/** The row's level segment, as the grader reads it: the placeholder's word, or the surrogate it stands on. */
function standsAt(row: StoreRow): string {
  const label = field(row, "levelLabel", "level_label") ?? null;
  return label === null ? String(field(row, "levelId", "level_id")) : `@unregistered:${String(label)}`;
}

/** The nine columns stand once each, all on the surrogate the stack's 2F stands under. */
function expectOncePerColumn(staged: Staged, why: string): void {
  const rows = rowsOf(staged);
  const placements = rows.map((row) => said(row, "placementKey", "placement_key"));
  const surrogate = levelsOfProject(staged.stage).find((level) => level.label === STACK_LABEL)?.levelId;
  expect(surrogate, `the person authored ${STACK_LABEL}`).toBeTruthy();
  expect(rows.length, `${why}: the register holds one row per drawn column, and it holds ${String(rows.length)}: ${rows.map(standsAt).sort().join(", ")}`).toBe(9);
  expect(new Set(placements).size, "each of the nine placements stands under exactly one register row").toBe(placements.length);
  expect(new Set(rows.map(standsAt)), `every one of them on ${STACK_LABEL}, none left under the caption's word`).toEqual(new Set([String(surrogate)]));
}

afterAll(async () => {
  await closeStage();
});

describe("I-366: a caption's ordinal word and the stack's storey label are one storey, and the register holds the member once", () => {
  let staged: Staged;

  beforeAll(async () => {
    staged = await stagePinnedBeforeTheStack("carry-storey-partition", 0x2123);
  }, 240_000);

  test("the staging really did leave nine placeholders under the caption's own word", () => {
    tableStands(REGISTER_OBJECTS);
    expect(rowsOf(staged).map(standsAt), "nine columns, all under @unregistered:2ND").toEqual(Array.from({ length: 9 }, () => `@unregistered:${DRAWN_LABEL}`));
  });

  test("INSERT_LEVEL 2F moves none of them — its carry compares letters, and 2ND is not 2F — so the rebuild is what retires them", async () => {
    await stageStack(staged.stage, [STACK_LABEL], 2);
    expect(rowsOf(staged).map(standsAt), "the act's own carry left all nine where they stood").toEqual(Array.from({ length: 9 }, () => `@unregistered:${DRAWN_LABEL}`));
    await runPlacementPartition(staged.stage, staged.ingest, "carry-storey-partition-after");
    expectOncePerColumn(staged, "after the partition job's rebuild");
  }, 240_000);

  test("a second rebuild finds every key standing and carries nothing again (L-REG-04: one hop)", async () => {
    await runPlacementPartition(staged.stage, staged.ingest, "carry-storey-partition-again");
    expectOncePerColumn(staged, "after a second rebuild");
  }, 240_000);
});

describe("I-366 on the router's path: the re-expansion after the level act carries them, and says so", () => {
  let staged: Staged;
  let reexpand: Reexpand;

  beforeAll(async () => {
    staged = await stagePinnedBeforeTheStack("carry-storey-reexpand", 0x2124);
    reexpand = await productModule<Reexpand>(REEXPAND_MODULE);
    await stageStack(staged.stage, [STACK_LABEL], 2);
  }, 240_000);

  test("reexpandProject retires the nine placeholders onto 2F and registers nothing beside them", async () => {
    const answered = await reexpand.reexpandProject({ tenantId: staged.stage.person.tenantId, projectId: staged.stage.projectId });
    const drawing = answered.find((one) => one.drawingId === staged.ingest.drawingId);
    expect(drawing, "the drawing was re-expanded").toBeTruthy();
    expect(drawing?.carried, "nine placeholders carried, one hop each").toBe(9);
    expect(drawing?.registered, "and nothing registered beside them").toBe(0);
    expect(drawing?.stale, "and nothing left standing that the drawing no longer derives").toEqual([]);
    expectOncePerColumn(staged, "after the re-expansion");
  }, 240_000);
});
