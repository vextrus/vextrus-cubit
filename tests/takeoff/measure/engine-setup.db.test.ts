/**
 * OPEN-4, the db half of the engine seam: `railSetupOf` over F-RCC6-BNBC as the product stores it —
 * ingested, partitioned, pinned — derives VECTOR for every placement, and carries no raster identity
 * on any (s-drawings I-654). The derivation is proved case by case in the pure lane
 * (`engine-derivation.test.ts`); this is the proof that the real reading of a DXF set, through the
 * stored placements and their stored atoms, still publishes as it always did.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { RailSetup } from "@/core/offers/contract";
import { campaignsSeam, field } from "../gate/support/gate-stage";
import { bnbcArtifact, closeStage, pinRevisionNaming, runPlacementPartition, stageArtifactIngest, stagePlacementProject, type PlacementStage } from "../partition/support/placement-stage";
import { productModule } from "../rails/foundations/support/foundations-contract";

const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";

let stage: PlacementStage;
let setup: RailSetup;

beforeAll(async () => {
  stage = await stagePlacementProject("open4-engine");
  const staged = await stageArtifactIngest(stage, await bnbcArtifact(), "open4-engine-bnbc");
  await runPlacementPartition(stage, staged, "open4-engine");
  const setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
  const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };
  const opened = (await (await campaignsSeam()).campaignsOf(scope)).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(opened.length, "pinning the revision opened exactly one campaign").toBe(1);
  const editionId = String(field(opened[0], "editionId", "edition_id"));
  const door = await productModule<{ railSetupOf: (scope: Record<string, string>) => Promise<RailSetup> }>(MEASURE_SETUP_MODULE);
  setup = await door.railSetupOf({ ...scope, setRevisionId, editionId });
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("OPEN-4: a DXF set's placements are read by the vector engine", () => {
  test("every placement F-RCC6-BNBC's partition stores is VECTOR, with no raster identity beside it", () => {
    const placements = Object.entries(setup.placements);
    expect(placements.length, "the partition placed the set's members").toBeGreaterThan(100);
    const engines = new Map<string, number>();
    for (const [key, placement] of placements) {
      engines.set(placement.engine, (engines.get(placement.engine) ?? 0) + 1);
      expect(Object.hasOwn(placement, "raster"), `${key} was read off DXF handles, so it carries no trace's identity`).toBe(false);
    }
    expect([...engines.keys()], "no DXF placement is RASTER (L-QTY-03)").toEqual(["VECTOR"]);
  });
});
