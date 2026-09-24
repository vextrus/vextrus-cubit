// @vitest-environment node
/**
 * The `walls{}` seam filled off F-ARCH, and the brickwork rail over it (ARCH-4; s-takeoff I-594,
 * L-MEA-02, L-QTY-04): the architect's set read by the SHIPPED `cad/` CLI through the partition's pure
 * stages, the walls and openings it places stood up as the stores hold them, and each wall handed to
 * the rail exactly as the measure setup hands it — so what is graded is the product's own path from
 * the plan to the rail's answer, with no database.
 *
 * What a QS reads off it:
 *   · every wall's length is its faces' own, MEASURED and cited to a face; its thickness is its WALL
 *     TYPES row's, TRANSCRIBED and cited to the cell; its height is read nowhere, and the rail keeps
 *     the row and names it — a brick wall rises to whatever stands over its centreline, and the
 *     architect's set does not say what that is;
 *   · each opening in a wall is its plan's schedule row, one per placement, its area w × h in exact
 *     square metres over the floors the row claims (L-MEA-02);
 *   · what stops a wall stops it by name: T-OPENING-NOS's D2 (the schedule prints eight, the plan
 *     places nine: declared, and every wall a D2 stands in refused until a person states it), a lintel
 *     deducted nowhere over an opening, and — driven here by taking one placement away — a schedule
 *     row the plan places fewer of than it prints, which refuses EVERY wall of that plan.
 */
import { describe, expect, test } from "vitest";
import type { PlacementSetup, RailSetup, RegisterObjectRow, WallSetup } from "@/core/offers/contract";
import { brickworkRail } from "@/modules/takeoff/rails/masonry-finishes";
import { wallSetupsOf, type WallStores } from "@/modules/takeoff/measure/walls";
import type { StoredWall, StoredWallOpening } from "@/modules/takeoff/partition";
import type { DetectedWalls } from "@/modules/takeoff/partition/walls/pairs";
import { archStages } from "../../partition/support/arch-stages";

const BUDGET_MS = 240_000;

const TENANT = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";
const DRAWING = "00000000-0000-4000-8000-000000000003";
const INGEST = "00000000-0000-4000-8000-000000000004";
const REVISION = "00000000-0000-4000-8000-000000000005";
const FIRST = "00000000-0000-4000-8000-000000000011";

/** The typical plan's caption, which the schedule of 1ST TO 6TH checks its quantities against. */
const TYPICAL = "TYPICAL FLOOR PLAN (1ST TO 6TH)";

/** F-ARCH read once, and the walls it places stood up as the stores hold them. */
let held: ReturnType<typeof stageOnce> | undefined;
function staged(): ReturnType<typeof stageOnce> {
  held ??= stageOnce();
  return held;
}

async function stageOnce(): Promise<{ read: Awaited<ReturnType<typeof archStages>>; detected: DetectedWalls; stores: WallStores }> {
  const read = await archStages();
  // The placement stage's own answer, composed as the rebuild runs it (`detectPlacements`).
  const detected: DetectedWalls = { placements: read.placed.placements, walls: read.placed.walls ?? [], openings: read.placed.wallOpenings ?? [] };
  const stamp = { tenantId: TENANT, projectId: PROJECT, drawingId: DRAWING, ingestId: INGEST, createdAt: new Date(0) };
  const walls: StoredWall[] = detected.walls.map((wall) => ({
    ...stamp,
    placementKey: wall.placementKey,
    viewKey: wall.viewKey,
    family: wall.family,
    layoutName: wall.sheet,
    fromX: wall.from[0],
    fromY: wall.from[1],
    toX: wall.to[0],
    toY: wall.to[1],
    thicknessValue: wall.thickness.value,
    thicknessUnit: wall.thickness.unit,
    thicknessSourceKeys: [...wall.thickness.sourceKeys],
    lengthValue: wall.length.value,
    lengthUnit: wall.length.unit,
    lengthSourceKeys: [...wall.length.sourceKeys],
  }));
  const openings: StoredWallOpening[] = detected.openings.map((opening) => ({
    ...stamp,
    placementKey: opening.placementKey,
    hostPlacementKey: opening.hostPlacementKey,
    viewKey: opening.viewKey,
    mark: opening.mark,
    tagKey: opening.tagKey,
    layoutName: opening.sheet,
    fromX: opening.from[0],
    fromY: opening.from[1],
    toX: opening.to[0],
    toY: opening.to[1],
    width: opening.width,
    checked: opening.checked,
  }));
  const views = read.evidence.views.flatMap((view) => (view.anchorKey === null ? [] : [{ viewKey: view.viewKey, address: `v:${view.viewKey}`, caption: view.caption }]));
  return { read, detected, stores: { walls, openings, families: read.registered.families, views } };
}

/** The address of the typical plan, as a placement names it. */
function typicalAddress(stores: WallStores): string {
  const view = stores.views.find((one) => one.caption.startsWith(`${TYPICAL}  SCALE`));
  if (view === undefined) throw new Error("F-ARCH draws no typical plan");
  return view.address;
}

/** One wall's register row on the first floor, sighted ARCHITECTURAL as the register walks it. */
function rowOf(wall: StoredWall): RegisterObjectRow {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    setRevisionId: REVISION,
    objectKey: `${wall.placementKey}@1F`,
    discipline: "ARCHITECTURAL",
    elementType: "brick_wall",
    mark: "~m.test",
    viewKey: wall.viewKey,
    placementKey: wall.placementKey,
    levelId: FIRST,
    levelSlot: null,
    levelLabel: null,
    standing: "DERIVED",
    semantic: wall.placementKey,
    registeredAt: new Date(0),
  };
}

/** The setup the rail is handed for these walls: their placements, an affirmed scale, the first floor. */
function setupOf(walls: readonly StoredWall[], seam: Record<string, WallSetup>): RailSetup {
  const placements = Object.fromEntries(
    walls.map((wall): [string, PlacementSetup] => [
      wall.placementKey,
      { drawingId: DRAWING, ingestId: INGEST, viewKey: wall.viewKey, memberFamily: wall.family, engine: "VECTOR", sourceEntity: wall.placementKey, outline: null, noteShape: null, noteKey: null },
    ]),
  );
  return {
    placements,
    memberTypes: {},
    levels: [{ levelId: FIRST, label: "1F", ordinal: 1, height: { standing: "AGREED", value: "3.048", unit: "m", basis: "ENTERED", sourceKey: "TEST:1F" } }],
    calibrations: { [INGEST]: Object.fromEntries(walls.map((wall) => [wall.viewKey, "calibration:test"])) },
    grades: {},
    plans: {},
    runs: {},
    lintels: {},
    walls: seam,
    surfaces: {},
    siteFacts: {},
    edition: { digest: "edition", parameters: { openingDeductionMinM2: { value: "0.1", unit: "m2" } } },
    detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] },
  };
}

describe("the walls seam, filled off F-ARCH's typical plan (I-594)", () => {
  test(
    "a wall standing clear of every opening is offered on its own length and its type's thickness, its height named unread",
    async () => {
      const { stores } = await staged();
      const seam = wallSetupsOf(stores);
      const typical = stores.walls.filter((wall) => wall.viewKey === typicalAddress(stores));
      const clear = typical.filter((wall) => (seam[wall.placementKey]?.openings ?? []).length === 0 && (seam[wall.placementKey]?.blocked ?? []).length === 0);
      expect(clear.length, "the typical plan draws walls with no opening in them").toBeGreaterThan(0);
      const batch = brickworkRail({ campaignId: "c", setRevisionId: REVISION, kind: "masonry.brickwork", objects: clear.map(rowOf), setup: setupOf(clear, seam) });
      expect(batch.observations, "nothing stops a wall with no opening in it").toEqual([]);
      expect(batch.offers).toHaveLength(clear.length);
      for (const offer of batch.offers) {
        const wall = clear.find((one) => one.placementKey === offer.register.objectKey.replace(/@1F$/u, "")) as StoredWall;
        expect(offer.bindings["L"], "the length its faces run, measured and cited to a face").toEqual({ value: wall.lengthValue, unit: "mm", basis: "MEASURED", source: wall.lengthSourceKeys[0] });
        expect(offer.bindings["t"], "the thickness its WALL TYPES row states, transcribed and cited to the cell").toEqual({ value: wall.thicknessValue, unit: "mm", basis: "TRANSCRIBED", source: wall.thicknessSourceKeys[0] });
        expect(offer.selectors, "the thickness selects the item (R-TO-032)").toEqual({ thickness: offer.bindings["t"] });
        expect(offer.omitted, "the height is read nowhere, and the row says so by name").toEqual([{ variable: "h", code: "WALL_HEIGHT_UNSTATED" }]);
        expect(offer.coverage).toBe("PARTIAL_DECLARED");
      }
    },
    BUDGET_MS,
  );

  test(
    "each opening in a wall is its plan's schedule row, one per placement, its area w × h in exact square metres",
    async () => {
      const { stores } = await staged();
      const seam = wallSetupsOf(stores);
      const typical = stores.walls.filter((wall) => wall.viewKey === typicalAddress(stores));
      const w1 = typical.flatMap((wall) => seam[wall.placementKey]?.openings ?? []).filter((opening) => opening.mark === "W1");
      expect(w1, "ten W1 on the typical plan, each counted once").toHaveLength(10);
      for (const opening of w1) {
        // 3'-4" × 4'-0" = 40 in × 48 in = 1920 in² = 1.2387072 m², by the canon's own inch.
        expect(opening.area).toMatchObject({ value: "1.2387072", unit: "m2", basis: "TRANSCRIBED" });
        expect(opening.count).toMatchObject({ value: "1", unit: "pcs", basis: "MEASURED" });
        expect(opening.floors, "the row claims the floors its caption states (s-schedules I-506)").toEqual({ from: "1ST", to: "6TH" });
      }
      const ld = typical.flatMap((wall) => seam[wall.placementKey]?.openings ?? []).filter((opening) => opening.mark === "LD");
      expect(ld.map((opening) => opening.area), "LD's `900 X 2100` states no unit, so no area is carried").toEqual([null]);
    },
    BUDGET_MS,
  );

  test(
    "T-OPENING-NOS and the lintels: a wall a D2 stands in, and a wall any opening stands in, is refused by name",
    async () => {
      const { stores } = await staged();
      const seam = wallSetupsOf(stores);
      const typical = stores.walls.filter((wall) => wall.viewKey === typicalAddress(stores));
      const withD2 = typical.filter((wall) => (seam[wall.placementKey]?.openings ?? []).some((opening) => opening.mark === "D2"));
      expect(withD2.length, "the typical plan's D2 stand in its walls").toBeGreaterThan(0);
      const batch = brickworkRail({ campaignId: "c", setRevisionId: REVISION, kind: "masonry.brickwork", objects: withD2.map(rowOf), setup: setupOf(withD2, seam) });
      expect(batch.offers, "no wall a D2 stands in is offered").toEqual([]);
      const codes = new Set(batch.observations.map((observation) => observation.code));
      expect(codes.has("OPENING_QUANTITY_DISAGREES"), "the schedule's declared disagreement stops it").toBe(true);
      expect(codes.has("WALL_LINTEL_UNDEDUCTED"), "and the lintel over the door, deducted nowhere").toBe(true);
      expect(codes.has("OPENING_UNPLACED"), "and nothing else: every row of the typical schedule is placed").toBe(false);
    },
    BUDGET_MS,
  );

  test(
    "a schedule row the plan places fewer of than it prints stops EVERY wall of that plan (L-MEA-02 with L-QTY-04)",
    async () => {
      const { stores } = await staged();
      const address = typicalAddress(stores);
      const oneW1 = stores.openings.find((opening) => opening.viewKey === address && opening.mark === "W1") as StoredWallOpening;
      const short = { ...stores, openings: stores.openings.filter((opening) => opening !== oneW1) };
      const seam = wallSetupsOf(short);
      for (const wall of short.walls) {
        const stopped = (seam[wall.placementKey]?.blocked ?? []).map((stop) => stop.code);
        expect(stopped.includes("OPENING_UNPLACED"), `${wall.placementKey} ${wall.viewKey === address ? "stands on" : "is off"} the short plan`).toBe(wall.viewKey === address);
      }
      const typical = short.walls.filter((wall) => wall.viewKey === address);
      const batch = brickworkRail({ campaignId: "c", setRevisionId: REVISION, kind: "masonry.brickwork", objects: typical.map(rowOf), setup: setupOf(typical, seam) });
      expect(batch.offers, "not one wall of the short plan is offered").toEqual([]);
      expect(new Set(batch.observations.map((observation) => observation.objectKey)).size, "and every one of them says why").toBe(typical.length);
    },
    BUDGET_MS,
  );

  test(
    "an opening no row of its plan's schedule states stops the wall it stands in",
    async () => {
      const { stores } = await staged();
      const address = typicalAddress(stores);
      const unscheduled = { ...stores, families: stores.families.filter((family) => family.family !== "V2") };
      const seam = wallSetupsOf(unscheduled);
      const host = stores.openings.find((opening) => opening.viewKey === address && opening.mark === "V2") as StoredWallOpening;
      expect((seam[host.hostPlacementKey]?.blocked ?? []).map((stop) => stop.code)).toContain("OPENING_UNSCHEDULED");
    },
    BUDGET_MS,
  );
});
