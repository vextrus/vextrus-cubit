/**
 * BREAKER: a sheet with TWO sections on it, and the stack the door offers for it.
 *
 * "The machine proposes a stack, never a level" (L-MEA-07), and the seventh stage reads BOTH section
 * classes — a long-section strip and a member section — into `proposed_levels`, which
 * `proposedLevelStackOf` offers as the `levels` of ONE `INSERT_LEVEL` (increment interfaces, AC-7).
 *
 * The stage ordinals each view's marks from zero, and the door maps every stored row into the offer
 * one for one. A sheet carrying two sections — the ordinary case: `SECTION A-A` beside `SECTION B-B`
 * — therefore offers a list whose ordinals restart and whose labels repeat, and `INSERT_LEVEL` takes
 * a list like that at its word: it shifts each proposal past the ones before it and mints a level per
 * entry, so confirming the machine's own proposal authors the building's storeys twice over. Levels
 * are authored, never edited (L-ACT-01), so what lands lands.
 *
 * The drawing is the acceptance's own SECTIONS artifact with its model space drawn a second time to
 * one side — the same section, on the same sheet, as a second view. The assertion is fix-agnostic:
 * whatever the door does about two sections, what it offers has to BE a stack — each storey named
 * once, standing at its own ordinal.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  LEVELS_PROPOSAL_STAGE,
  PLACEMENT_DOOR_MODULE,
  PROPOSED_LEVEL_STACK,
  SCENARIO,
  buildPlacementArtifact,
  closeStage,
  productModule,
  proposedLevelRows,
  runPlacementPartition,
  said,
  stagePlacementProject,
  stepDetail,
  unique,
  type JsonValue,
  type PlacementStage,
  type ProposedLevel,
} from "../support/placement-stage";
import { storageOf } from "../../support/sheets-stage";
import { stageDrawing, stubCli, tempDir, withCadCommand } from "../../support/ingest-stage";

/** The door the levels editor is offered the proposed stack through (increment interfaces). */
type ProposedStack = { group: { kind: string; drawingId: string; ingestId: string }; levels: readonly ProposedLevel[] } | null;
type ProposalDoor = { proposedLevelStackOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<ProposedStack> };

/** How far to one side the sheet's second section is drawn — clear of the first by any reading. */
const SECOND_SECTION_AT = 60_000;

/** The salt this file's own drawing is minted from — nobody else's artifact shares its handles. */
const SALT = 0x2122;

let stage: PlacementStage;
let drawingId: string;
let ingestId: string;
let steps: Awaited<ReturnType<typeof runPlacementPartition>>;
let offer: ProposedStack;

/** One entity of the artifact, as the built graph holds it. */
type Entity = { key: string; points?: number[][] } & Record<string, JsonValue>;

/**
 * The same section drawn twice on one sheet: every model-space entity is drawn again `SECOND_SECTION_AT`
 * to the right under a handle of its own, which is a second section view of the same building.
 */
function sheetWithTwoSections(): string {
  const built = buildPlacementArtifact(SCENARIO.SECTIONS, SALT);
  const graph = JSON.parse(built.json) as { entities: Entity[]; layouts: { kind: string; bbox: { min: number[]; max: number[] } }[] };

  const drawnAgain = graph.entities
    .filter((entity) => entity["space"] === "Model")
    .map((entity) => ({
      ...entity,
      key: `${entity.key}0`,
      points: (entity.points ?? []).map((point) => [(point[0] ?? 0) + SECOND_SECTION_AT, point[1] ?? 0]),
    }));
  expect(drawnAgain.length, "the SECTIONS artifact draws something in model space to draw a second time").toBeGreaterThan(0);
  graph.entities = [...graph.entities, ...drawnAgain];

  const model = graph.layouts.find((layout) => layout.kind === "model");
  expect(model, "the artifact carries a model-space layout").toBeTruthy();
  const box = model as { bbox: { min: number[]; max: number[] } };
  box.bbox = { min: box.bbox.min, max: [(box.bbox.max[0] ?? 0) + SECOND_SECTION_AT, box.bbox.max[1] ?? 0] };

  return JSON.stringify(graph);
}

beforeAll(async () => {
  stage = await stagePlacementProject("breaker-two-sections");

  const job = await productModule<{ runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> }>("src/modules/takeoff/ingest/job.ts");
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>("src/modules/takeoff/ingest/index.ts");

  const bytes = new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; two sections\n");
  const drawing = await stageDrawing(stage.person, stage.projectId, bytes, { name: unique("two-sections.dxf"), format: "dxf" });
  drawingId = drawing.drawingId;
  const stub = stubCli({ artifact: sheetWithTwoSections(), stderr: "", exitCode: 0 });
  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: stage.person.tenantId, drawingId, requestedBy: stage.person.userId, declared: null },
      { jobId: unique("ingest-two-sections"), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });
  const record = await records.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId });
  expect(record, "the two-section sheet was ingested").not.toBeNull();
  ingestId = (record as { ingestId: string }).ingestId;

  steps = await runPlacementPartition(stage, { drawingId, ingestId }, "two-sections");
  const door = await productModule<ProposalDoor>(PLACEMENT_DOOR_MODULE);
  offer = await door.proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId });
}, 240_000);

afterAll(async () => {
  await closeStage();
});

describe("the stack a sheet of two sections proposes", () => {
  test("the sheet really did read as two sections", () => {
    const detail = stepDetail(steps, LEVELS_PROPOSAL_STAGE);
    expect(Number(detail["views"]), "both sections of the sheet were examined by the seventh stage").toBe(2);
    const views = new Set(proposedLevelRows(stage.person.tenantId, ingestId).map((row) => said(row, "viewKey", "view_key")));
    expect(views.size, "the stage read level marks off both of them").toBe(2);
  });

  test("what the door offers is one stack: each storey named once", () => {
    expect(offer, "a sheet whose sections state levels offers a stack (AC-7)").not.toBeNull();
    const offered = offer as { group: { kind: string }; levels: readonly ProposedLevel[] };
    expect(offered.group.kind, "the offer is the proposed level stack").toBe(PROPOSED_LEVEL_STACK);

    const labels = offered.levels.map((level) => level.label);
    expect(
      labels.filter((label, at) => labels.indexOf(label) !== at),
      `one storey of a building is one level of its stack, and the offer names ${labels.join(", ")} (L-MEA-07)`,
    ).toEqual([]);
  });

  test("what the door offers stands in one order: the ordinals are the stack's own run", () => {
    const offered = offer as { levels: readonly ProposedLevel[] };
    const ordinals = offered.levels.map((level) => level.ordinal);
    expect(
      ordinals,
      `a stack's ordinals count its storeys from the foot up, once each — the offer states ${ordinals.join(", ")} (L-MEA-07)`,
    ).toEqual(ordinals.map((_, at) => at));
  });
});
