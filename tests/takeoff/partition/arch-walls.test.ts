// @vitest-environment node
/**
 * F-ARCH's walls and openings as a QS reads them off the architect's plans (ARCH-4; s-takeoff
 * I-590…d): the drawing read by the SHIPPED `cad/` CLI and put through the partition's pure stages
 * exactly as the rebuild runs them, and graded against the generator's own model — wall by wall, never
 * against what the product said before (AM-01).
 *
 * What is graded:
 *   · every wall placed stands on a wall the generator authored, of its type, and on no more of it than
 *     that wall's clear brickwork — never a wall nobody drew, never a stretch a column owns (L-QTY-04);
 *   · per plan and per wall type, the length read is the authored clear length to within 3 % UNDER
 *     (L-QTY-06's band): what the reader leaves is named — the toilets' corners where a stub meets
 *     them, the chamfer's ends on the typical floors, the guard room's short wall (T-UNCLOSED-WALL);
 *   · every opening the generator places is placed, in the gap of the wall it was authored in, off its
 *     tag, at the width its plan's schedule states (L-MEA-02);
 *   · the traps: an archway's dashed pair (T-ARCHWAY), a grid line down a wall's axis, a flight's
 *     treads, a face drawn twice (T-DOUBLE-LINE) and the lift core's 250 mm rings (T-CORE-RING-250)
 *     are no wall — and F-RCC6-BNBC's 28 closed core rings are never read as BW250, even asked.
 */
import { describe, expect, test } from "vitest";
import { manualMark } from "@/core/manual/identity";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { drawnUnitOf } from "@/modules/takeoff/partition/placement/runs";
import type { PlacementEvidence, WallRow } from "@/modules/takeoff/partition/placement/rows";
import { detectWalls, type DetectedWalls } from "@/modules/takeoff/partition/walls/pairs";
import { resolveExpansion } from "@/modules/takeoff/partition/expansion/resolve";
import "@/modules/takeoff/partition/notation";
import { archStages, trapKey } from "./support/arch-stages";
import { archLevels, clearWallsOf, coveredLength } from "./support/arch-walls";
import { BNBC_DXF, stagesOver } from "./support/bnbc-stages";

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** The two plans F-ARCH draws, the level the model authors each on, and its caption (DECISIONS.md A-04). */
const PLANS = Object.freeze([
  { caption: "GROUND FLOOR PLAN", level: "GF" },
  { caption: "TYPICAL FLOOR PLAN (1ST TO 6TH)", level: "1F" },
] as const);

type Pt = readonly [number, number];

/** The view key a plan's caption titles. */
function planKeyOf(views: PlacementEvidence["views"], caption: string): string {
  const view = views.find((one) => one.caption.startsWith(`${caption}  SCALE`));
  if (view === undefined) throw new Error(`F-ARCH draws no plan captioned ${caption}`);
  return view.viewKey;
}

/**
 * How far a plan is drawn from the model's own origin: the generator lays each sheet's scene out in
 * model space, so the offset is read off the plan itself — its column rings' least corner against the
 * model's least authored column corner.
 */
function offsetOf(graph: EntityGraph, assignments: ReadonlyMap<string, string>, viewKey: string, level: string): Pt {
  const rings = graph.entities.filter((entity) => assignments.get(entity.key) === viewKey && entity.layer === "A-COLS" && entity.closed === true);
  const drawn = rings.flatMap((entity) => entity.points ?? []);
  const authored = (archLevels()[level]?.columns ?? []).flatMap((column) => column.poly.map((p) => [Number(p[0]), Number(p[1])] as const));
  return [Math.min(...drawn.map((p) => p[0] ?? 0)) - Math.min(...authored.map((p) => p[0])), Math.min(...drawn.map((p) => p[1] ?? 0)) - Math.min(...authored.map((p) => p[1]))];
}

/**
 * The walls the placement stage reads off F-ARCH — the stage's own answer, composed as the rebuild runs
 * it (`detectPlacements` → the wall lane), read once per suite.
 */
async function archWalls(): Promise<{ read: Awaited<ReturnType<typeof archStages>>; walls: DetectedWalls }> {
  const read = await archStages();
  const placements = read.placed.placements.filter((row) => row.elementType === "brick_wall" || row.elementType === "opening");
  return { read, walls: { placements, walls: read.placed.walls ?? [], openings: read.placed.wallOpenings ?? [] } };
}

/** A placed wall carried back into the model's own coordinates. */
function inModel(wall: WallRow, offset: Pt): { from: Pt; to: Pt } {
  return { from: [wall.from[0] - offset[0], wall.from[1] - offset[1]], to: [wall.to[0] - offset[0], wall.to[1] - offset[1]] };
}

describe("F-ARCH: the walls are read off their faces at the WALL TYPES thicknesses (I-593)", () => {
  test(
    "every wall placed stands on an authored wall of its type, and on no more than its clear brickwork — never over",
    async () => {
      const { read, walls } = await archWalls();
      expect(walls.walls.length, "both plans place walls").toBeGreaterThan(0);
      for (const plan of PLANS) {
        const key = planKeyOf(read.evidence.views, plan.caption);
        const offset = offsetOf(read.graph, read.evidence.assignments, key, plan.level);
        const authored = clearWallsOf(archLevels()[plan.level] ?? { walls: [], openings: [], columns: [], core: [], archways: [] });
        const placed = walls.walls.filter((wall) => wall.viewKey === `v:${key}`);
        expect(placed.length, `${plan.caption} places walls`).toBeGreaterThan(0);
        for (const wall of placed) {
          const { from, to } = inModel(wall, offset);
          const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
          expect(Number(wall.length.value), `the wall's stated length is its axis's (${wall.placementKey})`).toBeCloseTo(length, 0);
          expect(coveredLength(from, to, wall.family, authored), `${wall.family} at ${from.join(",")}→${to.join(",")} on ${plan.caption} stands wholly on authored clear brickwork`).toBeGreaterThanOrEqual(length - 1);
        }
      }
    },
    BUDGET_MS,
  );

  test(
    "per plan and wall type, the length read is the authored clear length to within 3 % under (L-QTY-06)",
    async () => {
      const { read, walls } = await archWalls();
      for (const plan of PLANS) {
        const key = planKeyOf(read.evidence.views, plan.caption);
        const authored = clearWallsOf(archLevels()[plan.level] ?? { walls: [], openings: [], columns: [], core: [], archways: [] });
        for (const type of ["BW250", "BW125"]) {
          const expected = authored.filter((wall) => wall.type === type).reduce((sum, wall) => sum + wall.clear.reduce((inner, [a, b]) => inner + (b - a), 0), 0);
          const got = walls.walls.filter((wall) => wall.viewKey === `v:${key}` && wall.family === type).reduce((sum, wall) => sum + Number(wall.length.value), 0);
          expect(got / expected, `${type} on ${plan.caption}: ${got.toFixed(1)} read against ${expected.toFixed(1)} authored`).toBeLessThanOrEqual(1 + 1e-6);
          expect(got / expected, `${type} on ${plan.caption}: ${got.toFixed(1)} read against ${expected.toFixed(1)} authored`).toBeGreaterThanOrEqual(0.97);
        }
      }
    },
    BUDGET_MS,
  );

  test(
    "each wall carries its WALL TYPES row's thickness, cited to the cell, and a markless identity over its own axis (I-378)",
    async () => {
      const { read, walls } = await archWalls();
      const bw250 = read.registered.families.find((family) => family.family === "BW250");
      const cell = bw250?.variants[0]?.dimensions?.find((one) => one.dimension === "thickness");
      for (const wall of walls.walls.filter((one) => one.family === "BW250")) {
        expect(wall.thickness).toEqual({ value: "250", unit: "mm", sourceKeys: cell?.sourceKeys });
      }
      for (const row of walls.placements.filter((one) => one.elementType === "brick_wall")) {
        const wall = walls.walls.find((one) => one.placementKey === row.placementKey) as WallRow;
        const sources = [...new Set(wall.length.sourceKeys)].sort();
        const judged = (p: Pt) => ({ x: String(p[0]), y: String(p[1]), basis: "MEASURED" as const, sources });
        expect(row.mark, "the mark is the markless identity of the wall's own axis").toBe(
          manualMark({ elementClass: "brick_wall", kinds: ["masonry.brickwork"], geometry: { geometry: "POLYLINE", run: [judged(wall.from), judged(wall.to)] }, space: "model", supersedes: null }),
        );
        expect(row.memberFamily).toBe(wall.family);
        expect(row.sheet, "a wall names the sheet its plan was captioned on").toMatch(/^A-0[12] /u);
      }
      const header = drawnUnitOf(read.graph);
      const again = detectWalls(read.evidence, header === null ? null : { unit: header, sourceKey: null });
      expect(again.placements.map((row) => row.placementKey), "one drawing places one way every time (L-REG-04)").toEqual(walls.placements.map((row) => row.placementKey));
    },
    BUDGET_MS,
  );
});

describe("F-ARCH: the openings are placed off their tags, in their walls' gaps (I-591, L-MEA-02)", () => {
  test(
    "every opening the generator authors is placed on its plan — the schedule's width set against the gap",
    async () => {
      const { read, walls } = await archWalls();
      for (const plan of PLANS) {
        const key = planKeyOf(read.evidence.views, plan.caption);
        const authored = new Map<string, number>();
        for (const opening of archLevels()[plan.level]?.openings ?? []) authored.set(opening.mark, (authored.get(opening.mark) ?? 0) + 1);
        const placed = new Map<string, number>();
        for (const opening of walls.openings.filter((one) => one.viewKey === `v:${key}`)) placed.set(opening.mark, (placed.get(opening.mark) ?? 0) + 1);
        expect(Object.fromEntries([...placed].sort()), `${plan.caption}: the openings placed per mark`).toEqual(Object.fromEntries([...authored].sort()));
        // Every opening whose schedule states a unit was checked against its gap; LD's `900 X 2100` states none.
        for (const opening of walls.openings.filter((one) => one.viewKey === `v:${key}`)) expect(opening.checked, `${opening.mark}'s width was checked`).toBe(opening.mark !== "LD");
      }
    },
    BUDGET_MS,
  );

  test(
    "each opening stands in the wall the generator authored it in",
    async () => {
      const { read, walls } = await archWalls();
      for (const plan of PLANS) {
        const key = planKeyOf(read.evidence.views, plan.caption);
        const offset = offsetOf(read.graph, read.evidence.assignments, key, plan.level);
        const level = archLevels()[plan.level];
        const authored = clearWallsOf(level ?? { walls: [], openings: [], columns: [], core: [], archways: [] });
        const byMarkHosts = new Map<string, Set<string>>();
        for (const opening of level?.openings ?? []) byMarkHosts.set(opening.mark, new Set([...(byMarkHosts.get(opening.mark) ?? []), opening.host]));
        for (const opening of walls.openings.filter((one) => one.viewKey === `v:${key}`)) {
          const host = walls.walls.find((wall) => wall.placementKey === opening.hostPlacementKey) as WallRow;
          const { from, to } = inModel(host, offset);
          const hosts = authored.filter((wall) => (byMarkHosts.get(opening.mark) ?? new Set()).has(wall.id));
          const onAHost = hosts.some((wall) => coveredLength(from, to, wall.type, [wall]) > 0);
          expect(onAHost, `${opening.mark} on ${plan.caption} stands in a wall the model hosts a ${opening.mark} in`).toBe(true);
        }
      }
    },
    BUDGET_MS,
  );

  test(
    "each opening stands on every storey its plan is typical of — a door two schedules state stands on the floors of both (I-591)",
    async () => {
      const { read } = await archWalls();
      const levels = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"].map((label, ordinal) => ({ levelId: `L-${label}`, label, ordinal }));
      const resolved = resolveExpansion({
        placements: read.placed.placements,
        views: read.evidence.views.flatMap((view) => (view.anchorKey === null ? [] : [{ caption: view.caption, view: { viewClass: view.type, captionAnchorSourceKey: view.anchorKey } }])),
        levels,
        ranges: [],
        families: read.registered.families.map((family) => ({ family: family.family, bands: family.variants.map((variant) => ({ from: variant.bandFrom, to: variant.bandTo })) })),
      });
      const perLevel = new Map<string, number>();
      for (const row of resolved.rows.filter((one) => one.placement.elementType === "opening")) {
        const level = "levelId" in row.level ? row.level.levelId : "none";
        perLevel.set(level, (perLevel.get(level) ?? 0) + 1);
      }
      const authored = (level: string): number => (archLevels()[level]?.openings ?? []).length;
      // D2 is scheduled twice — GF's schedule and the typical floors' — and stands on the floors of both.
      expect(Object.fromEntries(perLevel)).toEqual({ "L-GF": authored("GF"), ...Object.fromEntries(["1F", "2F", "3F", "4F", "5F", "6F"].map((label) => [`L-${label}`, authored("1F")])) });
    },
    BUDGET_MS,
  );

  test(
    "T-OPENING-NOS: nine D2 are placed on the typical plan against the eight its schedule prints",
    async () => {
      const { read, walls } = await archWalls();
      const key = planKeyOf(read.evidence.views, "TYPICAL FLOOR PLAN (1ST TO 6TH)");
      expect(walls.openings.filter((one) => one.viewKey === `v:${key}` && one.mark === "D2")).toHaveLength(9);
    },
    BUDGET_MS,
  );
});

describe("the traps: what a plan draws in pairs that is no wall (I-593)", () => {
  test(
    "T-ARCHWAY, T-DOUBLE-LINE and T-CORE-RING-250: no archway, no face drawn twice and no core ring stands as a wall",
    async () => {
      const { walls } = await archWalls();
      const cited = new Set(walls.walls.flatMap((wall) => wall.length.sourceKeys));
      expect(cited.has(trapKey("T-ARCHWAY")), "the archway's dashed pair is drawn beyond the cut").toBe(false);
      expect(cited.has(trapKey("T-CORE-RING-250")), "the lift core's ring is concrete, not a brick wall's face").toBe(false);
      // A face drawn twice is one face: no two walls of one plan overlap along one axis.
      for (const wall of walls.walls) {
        const twins = walls.walls.filter((other) => other !== wall && other.viewKey === wall.viewKey && Math.hypot(other.from[0] - wall.from[0], other.from[1] - wall.from[1]) < 1 && Math.hypot(other.to[0] - wall.to[0], other.to[1] - wall.to[1]) < 1);
        expect(twins, "no wall is read twice").toEqual([]);
      }
    },
    BUDGET_MS,
  );

  test(
    "a grid line down a wall's axis and a flight's treads are rungs of a ladder, never a wall's face",
    async () => {
      const { read, walls } = await archWalls();
      const gridLines = new Set(read.graph.entities.filter((entity) => entity.layer === "A-GRID" && (entity.points ?? []).length === 2).map((entity) => entity.key));
      const treads = new Set(read.graph.entities.filter((entity) => entity.layer === "A-STAIR").map((entity) => entity.key));
      for (const wall of walls.walls) {
        expect(wall.length.sourceKeys.filter((key) => gridLines.has(key)), "no grid line is a wall's face").toEqual([]);
        expect(wall.length.sourceKeys.filter((key) => treads.has(key)), "no tread is a wall's face").toEqual([]);
      }
    },
    BUDGET_MS,
  );

  test(
    "F-RCC6-BNBC states no WALL TYPES and places no wall — and asked at 250 mm, none of its closed core rings is read as one",
    async () => {
      const bnbc = await stagesOver(BNBC_DXF);
      expect(bnbc.placed.placements.filter((row) => row.elementType === "brick_wall" || row.elementType === "opening"), "a structural set places no wall and no opening").toEqual([]);
      expect(bnbc.placed.walls, "and carries no wall reading at all").toBeUndefined();
      // Asked the question anyway, as a thickness-only reader would: a BW250 row stated over BNBC.
      const asked: PlacementEvidence = {
        ...bnbc.evidence,
        families: [...bnbc.evidence.families, { family: "BW250", sourceKeys: ["TEST:BW250"], variants: [{ sectionWidth: null, sectionDepth: null, dimensions: [{ dimension: "thickness", text: "250", value: 250, unit: "mm", sourceKeys: ["TEST:250"] }] }] }],
      };
      const read = detectWalls(asked, { unit: "mm", sourceKey: null });
      const rings = new Set(bnbc.graph.entities.filter((entity) => entity.closed === true).map((entity) => entity.key));
      const cited = read.walls.flatMap((wall) => wall.length.sourceKeys).filter((key) => rings.has(key));
      expect(cited, "no closed ring — the lift core's 28 among them — is a wall's face").toEqual([]);
    },
    BUDGET_MS,
  );
});
