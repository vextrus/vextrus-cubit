/**
 * F-ARCH's walls in the register, and the discipline they are sighted under (ARCH-4; L-REG-03,
 * s-takeoff I-592, I-595) — the architect's set read by the SHIPPED `cad/` CLI, written by the
 * shipped ingest job, partitioned by the shipped job, and registered through the product's own
 * re-expansion under a set pinned through the act seam.
 *
 * What a QS sees follow from a person's confirmation:
 *   · until somebody confirms a sheet's discipline, the walls read on it stand in the partition and
 *     nowhere in the register — "an unconfirmed drawing is not walked" (L-REG-03);
 *   · the typical plan's sheet confirmed ARCHITECTURAL: every wall and opening of it registers
 *     ARCHITECTURAL, once on each storey its plan is typical of;
 *   · the ground plan's sheet confirmed STRUCTURAL — wrongly, as a person may: its walls register
 *     STRUCTURAL, and the measure job hands none of them to the brickwork rail, saying so of each by
 *     name (SIGHTING_NOT_AUTHORITATIVE) — brickwork is the architect's (KIND_DISCIPLINE).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { RailBatch, RailObservation } from "@/core/offers/contract";
import { INGEST_JOB_MODULE, corpusBytes, tempDir, withCadCommand } from "../support/ingest-stage";
import { actsSeam } from "../sets/support/sets-stage";
import {
  closeStage,
  field,
  pinRevisionNaming,
  placementRows,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  stageStack,
  storeRows,
  type PlacementStage,
  type StoreRow,
} from "./support/placement-stage";

/** How long the drawing's reading may take: a cold `uv run` and the stages over F-ARCH. */
const BUDGET_MS = 600_000;

/** The storeys F-ARCH's plans stand on: its ground plan, and the typical plan of 1ST TO 6TH. */
const STOREYS = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"] as const;

/** The two sheets the plans are captioned on (fixtures/gen/arch DECISIONS.md A-04). */
const GROUND_SHEET = "A-01 GROUND FLOOR PLAN";
const TYPICAL_SHEET = "A-02 TYPICAL FLOOR PLAN (1ST TO 6TH)";

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

/** The register's rows of one class under one revision. */
function registered(stage: PlacementStage, setRevisionId: string, elementType: string): StoreRow[] {
  return registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => said(row, "elementType", "element_type") === elementType);
}

/** The placements of one class the partition stored for the ingest, and the sheet each names. */
function placedOf(stage: PlacementStage, ingestId: string, elementType: string): StoreRow[] {
  return placementRows(stage.person.tenantId, ingestId).filter((row) => said(row, "elementType", "element_type") === elementType);
}

afterAll(async () => {
  await closeStage();
});

describe("F-ARCH's walls are sighted under the discipline a person confirms for their sheet (L-REG-03, I-592)", () => {
  let stage: PlacementStage;
  let staged: { drawingId: string; ingestId: string };
  let setRevisionId: string;

  beforeAll(async () => {
    stage = await stagePlacementProject("arch-walls");
    staged = await stageArtifactIngest(stage, await archArtifact(), "arch");
    await runPlacementPartition(stage, staged, "arch-walls");
    await stageStack(stage, STOREYS, 0);
    setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
    await reexpand(stage);
  }, BUDGET_MS);

  test(
    "the partition stores the walls and openings it read, each naming its sheet — and an unconfirmed sheet's are not walked",
    () => {
      const walls = placedOf(stage, staged.ingestId, "brick_wall");
      const openings = placedOf(stage, staged.ingestId, "opening");
      expect(walls.length, "both plans place walls").toBeGreaterThan(0);
      expect(openings.length, "and openings in them").toBeGreaterThan(0);
      expect(new Set([...walls, ...openings].map((row) => said(row, "layoutName", "layout_name"))), "each names the sheet its plan was captioned on").toEqual(new Set([GROUND_SHEET, TYPICAL_SHEET]));
      expect(storeRows("wall_runs", stage.person.tenantId).filter((row) => said(row, "ingestId", "ingest_id") === staged.ingestId).length, "a wall_runs row stands for every wall").toBe(walls.length);
      expect(registered(stage, setRevisionId, "brick_wall"), "no sheet is confirmed yet, so no wall is walked (L-REG-03)").toEqual([]);
      expect(registered(stage, setRevisionId, "opening"), "and no opening").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "the typical plan's sheet confirmed ARCHITECTURAL: its walls and openings register ARCHITECTURAL on each of 1F to 6F",
    async () => {
      await confirmSheet(stage, staged.ingestId, TYPICAL_SHEET, "ARCHITECTURAL");
      await reexpand(stage);
      const typicalWalls = placedOf(stage, staged.ingestId, "brick_wall").filter((row) => said(row, "layoutName", "layout_name") === TYPICAL_SHEET);
      const walls = registered(stage, setRevisionId, "brick_wall");
      expect(walls.length, "every typical wall stands once on each of the six storeys its plan is typical of").toBe(typicalWalls.length * 6);
      expect(new Set(walls.map((row) => said(row, "discipline", "discipline"))), "sighted under the discipline a person confirmed").toEqual(new Set(["ARCHITECTURAL"]));
      const openings = registered(stage, setRevisionId, "opening");
      expect(openings.length, "and every typical opening likewise").toBe(placedOf(stage, staged.ingestId, "opening").filter((row) => said(row, "layoutName", "layout_name") === TYPICAL_SHEET).length * 6);
      expect(new Set(openings.map((row) => said(row, "discipline", "discipline")))).toEqual(new Set(["ARCHITECTURAL"]));
    },
    BUDGET_MS,
  );

  test(
    "the ground plan's sheet confirmed STRUCTURAL: its walls register STRUCTURAL, and none is measured under masonry.brickwork",
    async () => {
      await confirmSheet(stage, staged.ingestId, GROUND_SHEET, "STRUCTURAL");
      await reexpand(stage);
      const ground = registered(stage, setRevisionId, "brick_wall").filter((row) => said(row, "discipline", "discipline") === "STRUCTURAL");
      const groundPlaced = placedOf(stage, staged.ingestId, "brick_wall").filter((row) => said(row, "layoutName", "layout_name") === GROUND_SHEET);
      expect(ground.length, "every ground-floor wall stands once, sighted STRUCTURAL").toBe(groundPlaced.length);

      const campaigns = await productModule<{ campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<StoreRow[]> }>("src/core/campaigns/index.ts");
      const campaign = (await campaigns.campaignsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId })).find((row) => said(row, "setRevisionId", "set_revision_id") === setRevisionId);
      expect(campaign, "pinning the set opened its campaign").toBeTruthy();
      const job = await productModule<{ runMeasureJob: (payload: unknown, progress: unknown, deps: unknown) => Promise<void> }>("src/modules/takeoff/measure/job.ts");
      const rails = await productModule<{ brickworkRail: unknown }>("src/modules/takeoff/rails/masonry-finishes/index.ts");
      let judged: RailBatch | null = null;
      await job.runMeasureJob(
        { tenantId: stage.person.tenantId, projectId: stage.projectId, campaignId: String(field(campaign as StoreRow, "campaignId", "campaign_id")) },
        { jobId: "arch-walls-measure", step: async () => undefined },
        {
          rails: { "masonry.brickwork": rails.brickworkRail },
          gate: async (_scope: unknown, batch: RailBatch) => {
            judged = batch;
            return { published: 0, refused: 0, queued: 0, refusals: [] };
          },
        },
      );
      const batch = judged as RailBatch | null;
      expect(batch, "the job handed the gate its batch").not.toBeNull();
      const groundKeys = new Set(ground.map((row) => said(row, "objectKey", "object_key")));
      const aboutGround = (batch?.observations ?? []).filter((observation: RailObservation) => groundKeys.has(observation.objectKey ?? ""));
      expect(new Set(aboutGround.map((observation) => observation.code)), "each ground wall is said, and only said: sighted on a sheet that does not state brickwork").toEqual(new Set(["SIGHTING_NOT_AUTHORITATIVE"]));
      expect(aboutGround.length, "once per wall").toBe(ground.length);
      expect((batch?.offers ?? []).filter((offer) => groundKeys.has(offer.register.objectKey)), "and no brickwork is offered off any of them").toEqual([]);
      // The typical walls, sighted ARCHITECTURAL, reach the rail: each is answered by it, by name.
      const typicalKeys = new Set(registered(stage, setRevisionId, "brick_wall").filter((row) => said(row, "discipline", "discipline") === "ARCHITECTURAL").map((row) => said(row, "objectKey", "object_key")));
      const reached = new Set([...(batch?.observations ?? []).map((observation: RailObservation) => observation.objectKey ?? ""), ...(batch?.offers ?? []).map((offer) => offer.register.objectKey)].filter((key) => typicalKeys.has(key)));
      expect(reached.size, "every typical wall reached the brickwork rail and was answered").toBe(typicalKeys.size);
    },
    BUDGET_MS,
  );
});
