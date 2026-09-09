/**
 * BREAKER: the placeholder a level's own label is supposed to retire.
 *
 * The expansion resolves a single-level caption against the live stack by NORMALISED label
 * (`normaliseMark`, so `2nd` and `2ND` are one level), while the placeholder a level authored later
 * carries an object off (`objectsUnderPlaceholders` / `carryLevel`) matches the label EXACTLY. Two
 * grammars for one comparison, and a person who types their stack in lower case falls between them:
 * the carry moves nothing, the next rebuild resolves the same members onto the surrogate anyway, and
 * the register ends up holding two rows for every column that was drawn once.
 *
 * L-REG-03 is the clause: "no matcher merges sightings — a wrong merge silently deletes quantity",
 * and its mirror is what happens here — a register that holds one physical scope twice is
 * over-measurement, which is the thing the whole register exists to make impossible.
 *
 * The assertion is fix-agnostic: whichever side of the comparison is made to agree with the other,
 * nine drawn columns leave nine register rows for the revision, one per placement.
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

/** The label the caption `2ND FLOOR PLAN` names, and the case a person happens to type it in. */
const DRAWN_LABEL = "2ND";
const TYPED_LABEL = "2nd";

/** The salt this file's own drawing is minted from — nobody else's artifact shares its handles. */
const SALT = 0x2121;

let stage: PlacementStage;
let ingest: StagedPlacementIngest;
let setRevisionId: string;

beforeAll(async () => {
  stage = await stagePlacementProject("breaker-carry");
  ingest = await stagePlacementIngest(stage, SCENARIO.SINGLE_LEVEL, SALT);
  setRevisionId = await pinRevisionNaming(stage, ingest.drawingId);

  // 1. The stack is empty, so the caption's level is one nobody has authored: the members stand
  //    under `@unregistered:2ND` and wait to be carried (L-REG-04's one-hop carry).
  await runPlacementPartition(stage, ingest, "carry-before");

  // 2. A person authors that very level — spelled the way they typed it, which is the same level.
  await stageStack(stage, [TYPED_LABEL], 2);

  // 3. The drawing is partitioned again, as it is after any act that moves what a stage reads.
  await runPlacementPartition(stage, ingest, "carry-after");
}, 240_000);

afterAll(async () => {
  await closeStage();
});

/** Every register row of the pinned revision that stands for this drawing's placements. */
function rowsOfRevision(): StoreRow[] {
  const placed = new Set(placementRows(stage.person.tenantId, ingest.ingestId).map((row) => said(row, "placementKey", "placement_key")));
  return registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => placed.has(said(row, "placementKey", "placement_key")));
}

describe("a placeholder and the level that retires it are one comparison", () => {
  test("the staging really did draw nine members and author the level the caption names", () => {
    tableStands(REGISTER_OBJECTS);
    expect(placementRows(stage.person.tenantId, ingest.ingestId).length, "the single-level plan placed its nine columns (AC-1)").toBe(9);
    const stack = levelsOfProject(stage);
    expect(stack.map((level) => level.label), "the person authored exactly the one level the caption names").toEqual([TYPED_LABEL]);
  });

  test("nine columns drawn once stand in the register once (L-REG-03)", () => {
    const rows = rowsOfRevision();
    const keys = rows.map((row) => said(row, "objectKey", "object_key"));
    const placements = rows.map((row) => said(row, "placementKey", "placement_key"));

    expect(
      rows.length,
      `the register holds one row per drawn column, and it holds ${String(rows.length)}: ${keys.slice().sort().join("\n")}`,
    ).toBe(9);
    expect(new Set(placements).size, "each of the nine placements stands under exactly one register row").toBe(placements.length);
  });

  test("no member is left standing under the placeholder for a level that now stands", () => {
    const stack = levelsOfProject(stage);
    const authored = stack[0];
    expect(authored, "the stack carries the level the caption named").toBeTruthy();

    const orphaned = rowsOfRevision().filter((row) => (field(row, "levelLabel", "level_label") ?? null) !== null);
    expect(
      orphaned.map((row) => said(row, "objectKey", "object_key")),
      `${DRAWN_LABEL} stands as a level now, so nothing waits under its placeholder (L-REG-04's one-hop carry)`,
    ).toEqual([]);
  });
});
