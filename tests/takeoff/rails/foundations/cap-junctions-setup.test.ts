/**
 * FND-OWN, the setup's own door: `railSetupOf` over F-RCC6-BNBC as the product stores it — read by the
 * shipped `cad/` CLI, written by the shipped ingest job into storage, partitioned by the shipped job,
 * pinned through the one act seam — hands the rails the piles each pile cap stands on
 * (`RailSetup.capJunctions`, I-547).
 *
 * What is graded is the wiring the unit lane cannot reach: the grid read back out of the store and
 * carried from the partition's view keys to the placements' addresses, the caps' rings read back out
 * of the stored ARTIFACT by the keys the placement stage stored, and the relation composed from them —
 * 26 caps, each holding the PILES figure S-06's schedule prints for its type, 89 piles each held once,
 * and every held pile a placement the rails can read the schedule of. The heads' height is S-05's
 * embedment note, read off the stored artifact through the stored view assignments (FND-HEAD,
 * I-597); PC5's recess is S-07's section of it, read off the same artifact, views and
 * assignments (FND-RECESS, I-598), and no other cap carries one.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { RailSetup } from "@/core/offers/contract";
import { campaignsSeam, field } from "../../gate/support/gate-stage";
import {
  bnbcArtifact,
  closeStage,
  pinRevisionNaming,
  placementRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  type PlacementStage,
} from "../../partition/support/placement-stage";
import { productModule } from "./support/foundations-contract";

const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";

/** What S-06's PILE CAP SCHEDULE prints in its PILES column, per mark — the relation's yardstick. */
const PRINTED_PILES: Readonly<Record<string, number>> = Object.freeze({ PC1: 2, PC2: 3, PC3: 4, PC4: 5, PC5: 9 });

let stage: PlacementStage;
let setup: RailSetup;
let markOf: Map<string, string>;

beforeAll(async () => {
  stage = await stagePlacementProject("fnd-own");
  const staged = await stageArtifactIngest(stage, await bnbcArtifact(), "fnd-own-bnbc");
  await runPlacementPartition(stage, staged, "fnd-own");
  const setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
  const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };
  const opened = (await (await campaignsSeam()).campaignsOf(scope)).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(opened.length, "pinning the revision opened exactly one campaign").toBe(1);
  const editionId = String(field(opened[0], "editionId", "edition_id"));
  const door = await productModule<{ railSetupOf: (scope: Record<string, string>) => Promise<RailSetup> }>(MEASURE_SETUP_MODULE);
  setup = await door.railSetupOf({ ...scope, setRevisionId, editionId });
  markOf = new Map(placementRows(stage.person.tenantId, staged.ingestId).map((row) => [said(row, "placementKey", "placement_key"), String(row["mark"])]));
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("I-547: the measure setup hands the rails the piles each pile cap stands on", () => {
  test("26 caps, each holding the PILES figure S-06's schedule prints for its type; 89 piles, each held once", () => {
    const junctions = setup.capJunctions ?? {};
    expect(Object.keys(junctions).length, "every cap S-06 places has its piles read — the stored grid lays S-04 over S-06").toBe(26);
    const holders = new Map<string, number>();
    for (const [cap, junction] of Object.entries(junctions)) {
      const mark = markOf.get(cap) as string;
      expect(junction.piles.length, `${mark} (${cap}) holds the ${PRINTED_PILES[mark]} piles its schedule prints`).toBe(PRINTED_PILES[mark]);
      expect(junction.count, `${mark}: n is the count, MEASURED, cited to the cap`).toEqual({ value: String(junction.piles.length), unit: "pcs", basis: "MEASURED", source: cap });
      for (const pile of junction.piles) holders.set(pile, (holders.get(pile) ?? 0) + 1);
    }
    expect(holders.size, "all 89 piles stand under a cap").toBe(89);
    expect([...holders.values()].every((times) => times === 1), "each under exactly one").toBe(true);
  });

  test("every held pile is a placement of the setup, typed by the pile schedule the rails read its diameter from", () => {
    for (const junction of Object.values(setup.capJunctions ?? {})) {
      for (const pile of junction.piles) {
        const placement = setup.placements[pile];
        expect(placement, `${pile} is a placement the rails can read`).toBeDefined();
        const variants = setup.memberTypes[placement?.ingestId ?? ""]?.[placement?.memberFamily ?? ""] ?? [];
        expect(variants[0]?.dimensions["dia"], `${pile}'s family states the DIA the cap's \`d\` is read off (I-304)`).toMatchObject({ value: "500", unit: "mm", basis: "TRANSCRIBED" });
      }
    }
  });

  test("the heads' height as Rev C's S-05 states it — 3 in, RESOLVED, cited to its embedment line — on every cap", () => {
    const junctions = Object.values(setup.capJunctions ?? {});
    expect(junctions.length).toBe(26);
    for (const junction of junctions) {
      expect(junction.headHeight, "read off the stored artifact's words by the partition's stored view assignments (I-597)").toEqual({
        reading: { value: "3", unit: "in", basis: "TRANSCRIBED", source: "DXF_HANDLE:22A8" },
        standing: "RESOLVED",
      });
    }
  });

  test("PC5's recess as Rev C's S-07 section states it — 2493 × 2188 × 914 mm, each side cited — and no other cap carries one (I-598)", () => {
    const entries = Object.entries(setup.capJunctions ?? {});
    const recessed = entries.filter(([, junction]) => junction.recess !== null);
    expect(recessed.map(([key]) => markOf.get(key)), "PC5 alone, bound by its mark's section").toEqual(["PC5"]);
    expect(recessed[0]?.[1].recess, "read off the stored artifact, views and assignments").toEqual({
      length: { value: "2493", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22BA" },
      breadth: { value: "2188", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22DD" },
      depth: { value: "914", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22C9" },
    });
  });
});
