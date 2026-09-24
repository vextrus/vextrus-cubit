/**
 * F-ARCH's rooms in the store and in the register (ARCH-5; s-takeoff I-643…d, L-REG-03, I-592) —
 * the architect's set read by the SHIPPED `cad/` CLI, partitioned by the shipped job, and registered
 * through the product's own re-expansion under a set pinned through the act seam.
 *
 * What a QS sees follow from the partition and a person's confirmation:
 *   · the rooms stage runs and says what it read — the rooms, the unclosed one, the voids, the
 *     surfaces — and `room_outlines` holds each, the guard room with no outline and its reason;
 *   · until somebody confirms a sheet's discipline, the surfaces stand in the partition and nowhere in
 *     the register — "an unconfirmed drawing is not walked" (L-REG-03);
 *   · the typical plan's sheet confirmed ARCHITECTURAL: every surface of it registers ARCHITECTURAL,
 *     once on each storey its plan is typical of.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { INGEST_JOB_MODULE, corpusBytes, tempDir, withCadCommand } from "../support/ingest-stage";
import { actsSeam } from "../sets/support/sets-stage";
import {
  closeStage,
  pinRevisionNaming,
  placementRows,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  stageStack,
  stepDetail,
  storeRows,
  type PlacementStage,
  type StepRecord,
  type StoreRow,
} from "./support/placement-stage";

/** How long the drawing's reading may take: a cold `uv run` and the stages over F-ARCH. */
const BUDGET_MS = 600_000;

/** The storeys F-ARCH's plans stand on: its ground plan, and the typical plan of 1ST TO 6TH. */
const STOREYS = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"] as const;

/** The two sheets the plans are captioned on (fixtures/gen/arch DECISIONS.md A-04). */
const GROUND_SHEET = "A-01 GROUND FLOOR PLAN";
const TYPICAL_SHEET = "A-02 TYPICAL FLOOR PLAN (1ST TO 6TH)";

/** The storeys the typical plan stands for. */
const TYPICAL_STOREYS = 6;

/** F-ARCH as the shipped extractor reads it, once. */
async function archArtifact(): Promise<string> {
  const ingest = await productModule<{
    ingestDrawing: (bytes: Uint8Array, format: string, options: { tempDir: string }) => Promise<{ ok: boolean; artifact?: Uint8Array; refusal?: string; detail?: string }>;
  }>(INGEST_JOB_MODULE);
  const outcome = await withCadCommand(undefined, async () => ingest.ingestDrawing(corpusBytes("fixtures/arch/arch.dxf"), "dxf", { tempDir: tempDir("arch") }));
  expect(outcome.ok, `the shipped cad CLI read F-ARCH: ${outcome.ok ? "" : `${outcome.refusal} — ${outcome.detail}`}`).toBe(true);
  return new TextDecoder().decode(outcome.artifact as Uint8Array);
}

type Reexpand = { reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<unknown> };

/** Re-expand the project through the product's own door, as every act that moves an input does. */
async function reexpand(stage: PlacementStage): Promise<void> {
  const seam = await productModule<Reexpand>("src/modules/takeoff/partition/expansion/reexpand.ts");
  await seam.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });
}

/** A person's confirmation of one sheet's discipline, through the act seam (L-ACT-02). */
async function confirmSheet(stage: PlacementStage, ingestId: string, layoutName: string, discipline: string): Promise<void> {
  const acts = (await actsSeam()) as unknown as {
    preview: (actor: unknown, input: unknown) => Promise<unknown>;
    commit: (actor: unknown, input: unknown, digest: string) => Promise<{ actId: string }>;
    consequenceDigest: (consequence: unknown) => string;
  };
  const input = { type: "CONFIRM_DISCIPLINE", projectId: stage.projectId, group: { kind: "SHEET", sheetId: `${ingestId}:${layoutName}`, discipline } };
  const consequence = await acts.preview(stage.actor, input);
  await acts.commit(stage.actor, input, acts.consequenceDigest(consequence));
}

/** The rooms the partition stored for the ingest. */
function roomsOf(stage: PlacementStage, ingestId: string): StoreRow[] {
  return storeRows("room_outlines", stage.person.tenantId).filter((row) => said(row, "ingestId", "ingest_id") === ingestId);
}

/** The surfaces the partition stored for the ingest, and the sheet each names. */
function surfacesOf(stage: PlacementStage, ingestId: string): StoreRow[] {
  return placementRows(stage.person.tenantId, ingestId).filter((row) => said(row, "elementType", "element_type") === "surface");
}

afterAll(async () => {
  await closeStage();
});

describe("F-ARCH's rooms are stored with the partition and their surfaces registered ARCHITECTURAL (I-643…d, I-592)", () => {
  let stage: PlacementStage;
  let staged: { drawingId: string; ingestId: string };
  let steps: StepRecord[];
  let setRevisionId: string;

  beforeAll(async () => {
    stage = await stagePlacementProject("arch-rooms");
    staged = await stageArtifactIngest(stage, await archArtifact(), "arch");
    steps = await runPlacementPartition(stage, staged, "arch-rooms");
    await stageStack(stage, STOREYS, 0);
    setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
    await reexpand(stage);
  }, BUDGET_MS);

  test(
    "the rooms stage says what it read, and room_outlines holds every room — the guard room with no outline and its reason",
    () => {
      expect(stepDetail(steps, "rooms"), "GF's four rooms and the typical plan's eighteen, one unclosed, ten voids, 62 surfaces").toMatchObject({
        views: 2,
        rooms: 22,
        not_closed: 1,
        voids: 10,
        dropped: 0,
        surfaces: 62,
      });
      const rooms = roomsOf(stage, staged.ingestId);
      expect(rooms.length).toBe(33);
      const guard = rooms.filter((row) => said(row, "status", "status") === "NOT_CLOSED");
      expect(guard.map((row) => [said(row, "name", "name"), said(row, "reason", "reason"), row["outline"] ?? null])).toEqual([["GUARD ROOM", "SURFACE_NOT_CLOSED", null]]);
      expect(new Set(rooms.map((row) => said(row, "layoutName", "layout_name"))), "each names its plan's sheet").toEqual(new Set([GROUND_SHEET, TYPICAL_SHEET]));
      const surfaces = surfacesOf(stage, staged.ingestId);
      expect(surfaces.length, "each surface stands with the placements").toBe(62);
      expect(registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => said(row, "elementType", "element_type") === "surface"), "no sheet is confirmed yet, so no surface is walked (L-REG-03)").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "the typical plan's sheet confirmed ARCHITECTURAL: its surfaces register ARCHITECTURAL on each of 1F to 6F",
    async () => {
      await confirmSheet(stage, staged.ingestId, TYPICAL_SHEET, "ARCHITECTURAL");
      await reexpand(stage);
      const typical = surfacesOf(stage, staged.ingestId).filter((row) => said(row, "layoutName", "layout_name") === TYPICAL_SHEET);
      const registered = registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => said(row, "elementType", "element_type") === "surface");
      expect(registered.length, "every typical surface stands once on each of the six storeys its plan is typical of").toBe(typical.length * TYPICAL_STOREYS);
      expect(new Set(registered.map((row) => said(row, "discipline", "discipline"))), "sighted under the discipline a person confirmed").toEqual(new Set(["ARCHITECTURAL"]));
    },
    BUDGET_MS,
  );
});
