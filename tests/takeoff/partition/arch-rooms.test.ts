// @vitest-environment node
/**
 * The rooms an architect's plan encloses, read, named and registered (ARCH-5; s-takeoff I-643…d).
 *
 * Two grounds, each graded against what was AUTHORED, never against what the product said before
 * (AM-01):
 *   · synthetic plans built here, whose rooms are known to the square millimetre — every area EXACT;
 *     a wall stopped 60 mm short of the one it should meet (T-UNCLOSED-WALL) leaves its room
 *     SURFACE_NOT_CLOSED, never bounding-boxed; a column the walls stop at stands INSIDE the outline;
 *     the corner two walls meet at leaves no notch of floor; a curved wall flattened too coarsely to
 *     carry its arc refuses ROOM_AREA_DISAGREES (L-FRM-01's 0.5 %, the stored-versus-own check);
 *     the edition's outline band drops what is outside it, listed;
 *   · F-ARCH read by the SHIPPED `cad/` CLI through the partition's own stages, against the
 *     generator's model: every room of each plan, by name and by area, the guard room's unclosed wall,
 *     the voids, the label drawn outside its toilet (T-LABEL-OUTSIDE) and the nominal size
 *     (T-ROOM-SIZE-NOMINAL) — and the surfaces each room registers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { viewKey as viewKeyOf } from "@/core/identity";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { convert } from "@/core/units/canon";
import type { GridAxisRow } from "@/modules/takeoff/partition/grid/detect";
import type { WallRow } from "@/modules/takeoff/partition/placement/rows";
import { PARTITION_STAGES } from "@/modules/takeoff/partition/rebuild";
import type { PartitionedView } from "@/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import { detectRooms, NO_ROOMS, type OutlineBand, type RoomEvidence, type RoomRow } from "@/modules/takeoff/partition/rooms/detect";
import { holds } from "@/modules/takeoff/partition/rooms/labels";
import "@/modules/takeoff/partition/notation";
import { goldenRows } from "../../golden/support/golden-fixture";
import { archStages } from "./support/arch-stages";
import { SEED_SHARES } from "./support/bnbc-stages";

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

type Pt = readonly [number, number];

/** The edition's finish outline band, carried into square metres by the canon (L-MEA-01). */
function seedBand(): OutlineBand {
  const end = (name: string): string => {
    const stated = SEED_EDITION_CONTENT.parameters[name];
    if (stated === undefined) throw new Error(`the platform edition states no ${name}`);
    const carried = convert(stated.value, stated.unit, "m2");
    if (!carried.ok) throw new Error(`${name} is stated in no unit of area`);
    return carried.value;
  };
  return { min: end("finishMinOutlineArea"), max: end("finishMaxOutlineArea") };
}

// ---------------------------------------------------------------------------------------------
// Synthetic plans
// ---------------------------------------------------------------------------------------------

const CAPTION = "DXF_HANDLE:CAP";
const PLAN_VIEW: PartitionedView = { viewKey: `LAYOUT_PLAN:${CAPTION}`, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "GROUND FLOOR PLAN", anchorKey: CAPTION };
const PLAN_KEY = viewKeyOf({ viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: CAPTION });

/** A plan as the stages hand it to the rooms stage: its entities, its walls, its grid. */
type Plan = { entities: Record<string, unknown>[]; walls: WallRow[] };

function entity(key: string, type: string, points: readonly Pt[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { key, type, space: "model", layer: "0", colour: { rgb: [0, 0, 0], source: "bylayer" }, points: points.map((p) => [p[0], p[1]]), ...extra };
}

/** One wall run as the wall lane answers one: its axis, its WALL TYPES thickness, a face line cited. */
function wall(plan: Plan, from: Pt, to: Pt, thickness: 250 | 125 = 250): void {
  const index = plan.walls.length;
  plan.walls.push({
    placementKey: `${PLAN_KEY}|w${index}`,
    viewKey: PLAN_KEY,
    family: `BW${thickness}`,
    sheet: null,
    from,
    to,
    thickness: { value: String(thickness), unit: "mm", sourceKeys: ["DXF_HANDLE:TYPE"] },
    length: { value: "0", unit: "mm", basis: "MEASURED", sourceKeys: [`DXF_HANDLE:F${index}`] },
  });
}

/** A room label: its name over its size, as an MTEXT's two paragraphs. */
function label(plan: Plan, key: string, name: string, size: string | null, at: Pt): void {
  plan.entities.push(entity(key, "MTEXT", [at], { text: size === null ? name : `${name}\\P${size}` }));
}

/** A closed ring — a column, a core piece, a rug. */
function ring(plan: Plan, key: string, points: readonly Pt[]): void {
  plan.entities.push(entity(key, "LWPOLYLINE", points, { closed: true }));
}

/** The grid a plan is scaled by: two axes each way, 3 m apart at the least. */
const AXES: GridAxisRow[] = [
  { viewKey: PLAN_VIEW.viewKey, family: "numeral", label: "1", axis: "x", position: 0, bubbleKey: "DXF_HANDLE:B1", labelKey: "DXF_HANDLE:L1", minSpacing: 3000 },
  { viewKey: PLAN_VIEW.viewKey, family: "numeral", label: "2", axis: "x", position: 8000, bubbleKey: "DXF_HANDLE:B2", labelKey: "DXF_HANDLE:L2", minSpacing: 3000 },
  { viewKey: PLAN_VIEW.viewKey, family: "letter", label: "A", axis: "y", position: 0, bubbleKey: "DXF_HANDLE:BA", labelKey: "DXF_HANDLE:LA", minSpacing: 3000 },
  { viewKey: PLAN_VIEW.viewKey, family: "letter", label: "B", axis: "y", position: 5000, bubbleKey: "DXF_HANDLE:BB", labelKey: "DXF_HANDLE:LB", minSpacing: 3000 },
];

function evidenceOf(plan: Plan, band: OutlineBand = seedBand()): RoomEvidence {
  const caption = entity(CAPTION, "TEXT", [[0, -1000]], { text: "GROUND FLOOR PLAN" });
  const entities = [caption, ...plan.entities];
  return {
    graph: { entities } as unknown as EntityGraph,
    views: [PLAN_VIEW],
    assignments: new Map(entities.map((one) => [String(one["key"]), PLAN_VIEW.viewKey])),
    grid: { views: 1, axes: AXES, deferrals: [] },
    shares: SEED_SHARES,
    families: [],
    walls: plan.walls,
    band,
  };
}

/**
 * Two rooms under one roof: a 250 shell on the axes (0,0)–(8000,5000), walls meeting at their axes'
 * corners as the wall lane runs them, and a 125 partition at x = 3000 stopping at the shell's faces.
 * The rooms are 2812.5 × 4750 and 4812.5 × 4750 between the faces: 13.359375 m² and 22.859375 m².
 */
function twoRooms(): Plan {
  const plan: Plan = { entities: [], walls: [] };
  wall(plan, [0, 0], [8000, 0]);
  wall(plan, [8000, 0], [8000, 5000]);
  wall(plan, [8000, 5000], [0, 5000]);
  wall(plan, [0, 5000], [0, 0]);
  wall(plan, [3000, 125], [3000, 4875], 125);
  label(plan, "DXF_HANDLE:BED", "BED-01", `9'-3" x 15'-7"`, [1500, 2500]);
  label(plan, "DXF_HANDLE:LIV", "LIVING", `15'-9" x 15'-7"`, [5500, 2500]);
  return plan;
}

function byName(rooms: readonly RoomRow[], name: string): RoomRow {
  const found = rooms.find((room) => room.name === name);
  if (found === undefined) throw new Error(`no room is named ${name}: ${rooms.map((room) => `${room.name}:${room.status}`).join(", ")}`);
  return found;
}

describe("synthetic plans: rooms are the regions between the walls' faces, named by their labels (I-643, b)", () => {
  test("two rooms: counted, named and measured EXACTLY, each registering its floor, ceiling and walls", () => {
    const read = detectRooms(evidenceOf(twoRooms()));
    expect(read.rooms.map((room) => [room.name, room.status, room.areaM2])).toEqual(
      expect.arrayContaining([
        ["BED-01", "CLOSED", "13.359375"],
        ["LIVING", "CLOSED", "22.859375"],
      ]),
    );
    expect(read.rooms, "nothing else is read: no sliver, no world round the plan").toHaveLength(2);
    expect(byName(read.rooms, "BED-01").labels.map((one) => one.agrees), "the printed size agrees with the outline").toEqual([true]);
    expect(read.placements.map((row) => row.elementType)).toEqual(Array(6).fill("surface"));
    expect(new Set(read.placements.map((row) => row.placementKey)).size, "three faces of two rooms, six identities").toBe(6);
    expect(read.placements.every((row) => row.mark.startsWith("~m.")), "each under the markless identity (I-378)").toBe(true);
    expect(byName(read.rooms, "LIVING").faces.map((face) => face.face)).toEqual(["FLOOR", "CEILING", "WALLS"]);
  });

  test("T-UNCLOSED-WALL: a wall stopped 60 mm short of the wall it meets leaves its room SURFACE_NOT_CLOSED, never bounding-boxed", () => {
    const plan: Plan = { entities: [], walls: [] };
    wall(plan, [0, 0], [8000, 0]);
    // The east wall stops 60 mm short of the top wall's inner face (4875).
    wall(plan, [8000, 0], [8000, 4815]);
    wall(plan, [8000, 5000], [0, 5000]);
    wall(plan, [0, 5000], [0, 0]);
    wall(plan, [3000, 125], [3000, 4875], 125);
    label(plan, "DXF_HANDLE:BED", "BED-01", `9'-3" x 15'-7"`, [1500, 2500]);
    label(plan, "DXF_HANDLE:LIV", "LIVING", `15'-9" x 15'-7"`, [5500, 2500]);
    const read = detectRooms(evidenceOf(plan));
    const open = byName(read.rooms, "LIVING");
    expect([open.status, open.reason, open.outline, open.areaM2], "no outline, no area, and the reason named").toEqual(["NOT_CLOSED", "SURFACE_NOT_CLOSED", null, null]);
    expect(open.faces, "and it registers no surface").toEqual([]);
    expect(byName(read.rooms, "BED-01").areaM2, "its neighbour, closed, is measured as ever").toBe("13.359375");
    expect(read.placements).toHaveLength(3);
  });

  test("a column the walls stop at stands INSIDE the rooms' outline: the outline runs on along the walls' faces (F-ARCH A-14)", () => {
    const plan: Plan = { entities: [], walls: [] };
    // 400 × 400 columns at the south-west corner and where the partition meets the south wall; the
    // walls stop at their faces, as an architect draws them, and the columns stand 75 proud of the faces.
    ring(plan, "DXF_HANDLE:C1", [[-200, -200], [200, -200], [200, 200], [-200, 200]]);
    ring(plan, "DXF_HANDLE:C2", [[2800, -200], [3200, -200], [3200, 200], [2800, 200]]);
    wall(plan, [200, 0], [2800, 0]);
    wall(plan, [3200, 0], [8000, 0]);
    wall(plan, [8000, 0], [8000, 5000]);
    wall(plan, [8000, 5000], [0, 5000]);
    wall(plan, [0, 5000], [0, 200]);
    wall(plan, [3000, 200], [3000, 4875], 125);
    label(plan, "DXF_HANDLE:BED", "BED-01", `9'-3" x 15'-7"`, [1500, 2500]);
    label(plan, "DXF_HANDLE:LIV", "LIVING", `15'-9" x 15'-7"`, [5500, 2500]);
    const read = detectRooms(evidenceOf(plan));
    expect(byName(read.rooms, "BED-01").areaM2, "no notch round either column").toBe("13.359375");
    expect(byName(read.rooms, "LIVING").areaM2).toBe("22.859375");
  });

  test("a duct's L-corner leaves no square of floor in the room wrapped round it, and a DUCT is a void", () => {
    const plan = twoRooms();
    // A duct in the living room's north-east corner: two 125 walls meeting at their axes' corner.
    wall(plan, [6500, 4875], [6500, 4000], 125);
    wall(plan, [6500, 4000], [7875, 4000], 125);
    label(plan, "DXF_HANDLE:DUCT", "DUCT", null, [7200, 4500]);
    const read = detectRooms(evidenceOf(plan));
    // 22,859,375 less the duct's footprint to its walls' outer faces, 1437.5 × 937.5 = 1,347,656.25 mm².
    expect(byName(read.rooms, "LIVING").areaM2).toBe("21.51171875");
    expect([byName(read.rooms, "DUCT").status, byName(read.rooms, "DUCT").faces]).toEqual(["VOID", []]);
  });

  test("a curved wall carries its arc; flattened too coarsely for its own shoelace it refuses ROOM_AREA_DISAGREES (L-FRM-01)", () => {
    const curved = (points: number): Plan => {
      const plan: Plan = { entities: [], walls: [] };
      wall(plan, [4000, 0], [0, 0]);
      wall(plan, [0, 0], [0, 3000]);
      wall(plan, [0, 3000], [4000, 3000]);
      // Two arcs on one centre, 250 apart, closing the east end: the inner face r 1375 meets the walls' inner faces.
      for (const [key, r] of [["DXF_HANDLE:ARC-IN", 1375], ["DXF_HANDLE:ARC-OUT", 1625]] as const) {
        const arc: Pt[] = Array.from({ length: points }, (_, index) => {
          const theta = -Math.PI / 2 + (Math.PI * index) / (points - 1);
          return [4000 + r * Math.cos(theta), 1500 + r * Math.sin(theta)];
        });
        plan.entities.push(entity(key, "ARC", arc));
      }
      // A door's swing — one arc, no partner — is no wall.
      plan.entities.push(entity("DXF_HANDLE:SWING", "ARC", Array.from({ length: 9 }, (_, i) => [1000 + 800 * Math.cos((Math.PI * i) / 16), 125 + 800 * Math.sin((Math.PI * i) / 16)] as Pt)));
      label(plan, "DXF_HANDLE:HALL", "HALL", `17'-2" x 9'-0"`, [2000, 1500]);
      return plan;
    };
    // 3875 × 2750 and half a disc of 1375 (the inner arc's face).
    const analytic = (3875 * 2750 + (Math.PI * 1375 * 1375) / 2) / 1e6;
    const fine = byName(detectRooms(evidenceOf(curved(257))).rooms, "HALL");
    expect(fine.status).toBe("CLOSED");
    expect(Math.abs(Number(fine.areaM2) - analytic), "the arc carried as an arc, not as its chords").toBeLessThan(1e-6);
    const coarse = byName(detectRooms(evidenceOf(curved(3))).rooms, "HALL");
    expect([coarse.status, coarse.reason, coarse.faces]).toEqual(["DROPPED", "ROOM_AREA_DISAGREES", []]);
  });

  test("the edition's outline band drops what is outside it, listed by name; a region no label names is listed ROOM_UNNAMED", () => {
    const plan = twoRooms();
    plan.entities = plan.entities.filter((one) => one["key"] !== "DXF_HANDLE:LIV");
    const read = detectRooms(evidenceOf(plan, { min: "15", max: seedBand().max }));
    const small = byName(read.rooms, "BED-01");
    expect([small.status, small.reason, small.faces]).toEqual(["DROPPED", "ROOM_OUTLINE_OUT_OF_BAND", []]);
    const unnamed = read.rooms.find((room) => room.name === null);
    expect([unnamed?.status, unnamed?.reason, unnamed?.areaM2]).toEqual(["DROPPED", "ROOM_UNNAMED", "22.859375"]);
    expect(read.placements, "neither registers a surface").toEqual([]);
  });

  test("a plan the wall lane placed no wall on reads no room — F-RCC6-BNBC's path, whose partition is the partition it was", () => {
    expect(detectRooms({ ...evidenceOf(twoRooms()), walls: [] })).toBe(NO_ROOMS);
    expect(PARTITION_STAGES.indexOf("rooms"), "the rooms stage runs after placement").toBeGreaterThan(PARTITION_STAGES.indexOf("placement"));
    expect(PARTITION_STAGES.indexOf("rooms"), "and before the expansion that stands its surfaces on their storeys").toBeLessThan(PARTITION_STAGES.indexOf("expansion"));
  });
});

// ---------------------------------------------------------------------------------------------
// F-ARCH against its generator's model
// ---------------------------------------------------------------------------------------------

type AuthoredRoom = {
  readonly id: string;
  readonly kind: "ROOM" | "VOID" | "VERANDAH";
  readonly labels: readonly { readonly text: string; readonly at: readonly [string, string] }[];
  readonly polygon: readonly (readonly [string, string])[] | null;
};

type AuthoredLevel = { readonly rooms: readonly AuthoredRoom[]; readonly columns: readonly { readonly poly: readonly (readonly [string, string])[] }[] };

function archLevels(): Record<string, AuthoredLevel> {
  return (JSON.parse(readFileSync(join(process.cwd(), "fixtures/arch/model.json"), "utf8")) as { levels: Record<string, AuthoredLevel> }).levels;
}

/** The two plans F-ARCH draws, the level each is authored on, and the sheet it is captioned on (A-04). */
const PLANS = Object.freeze([
  { caption: "GROUND FLOOR PLAN", level: "GF", sheet: "A-01 GROUND FLOOR PLAN" },
  { caption: "TYPICAL FLOOR PLAN (1ST TO 6TH)", level: "1F", sheet: "A-02 TYPICAL FLOOR PLAN (1ST TO 6TH)" },
] as const);

/** The shoelace of an authored polygon, in square metres. */
function authoredArea(polygon: readonly (readonly [string, string])[]): number {
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const p = polygon[index] as readonly [string, string];
    const q = polygon[(index + 1) % polygon.length] as readonly [string, string];
    sum += Number(p[0]) * Number(q[1]) - Number(q[0]) * Number(p[1]);
  }
  return Math.abs(sum) / 2 / 1e6;
}

/** F-ARCH's rooms as the rooms stage reads them — the stage's own answer over the shipped reading. */
async function archRooms() {
  const read = await archStages();
  const rooms = detectRooms({ ...read.evidence, walls: read.placed.walls ?? [], band: seedBand() });
  return { read, rooms };
}

/** How far a plan is drawn from the model's origin: its column rings' least corner against the model's. */
function offsetOf(read: Awaited<ReturnType<typeof archStages>>, viewKey: string, level: string): Pt {
  const drawn = read.graph.entities.filter((entity) => read.evidence.assignments.get(entity.key) === viewKey && entity.layer === "A-COLS" && entity.closed === true).flatMap((entity) => entity.points ?? []);
  const authored = (archLevels()[level]?.columns ?? []).flatMap((column) => column.poly.map((p) => [Number(p[0]), Number(p[1])] as const));
  return [Math.min(...drawn.map((p) => p[0] ?? 0)) - Math.min(...authored.map((p) => p[0])), Math.min(...drawn.map((p) => p[1] ?? 0)) - Math.min(...authored.map((p) => p[1]))];
}

describe("F-ARCH: every room of each plan is outlined, named and measured as the generator authored it (I-643…d)", () => {
  test(
    "room by room: the region standing under each authored room's label is that room — by name, by status, by area",
    async () => {
      const { read, rooms } = await archRooms();
      const levels = archLevels();
      for (const plan of PLANS) {
        const view = read.evidence.views.find((one) => one.caption.startsWith(`${plan.caption}  SCALE`));
        if (view === undefined) throw new Error(`F-ARCH draws no plan captioned ${plan.caption}`);
        const key = `v:${view.viewKey}`;
        const offset = offsetOf(read, view.viewKey, plan.level);
        const onPlan = rooms.rooms.filter((room) => room.viewKey === key);
        for (const authored of levels[plan.level]?.rooms ?? []) {
          const at: Pt = [Number(authored.labels[0]?.at[0]) + offset[0], Number(authored.labels[0]?.at[1]) + offset[1]];
          const names = new Set(authored.labels.map((one) => one.text));
          if (authored.id === "GUARD") {
            // T-UNCLOSED-WALL: the rear wall stops 60 mm short; the room is not closed as drawn.
            const guard = onPlan.find((room) => room.name === "GUARD ROOM");
            expect([guard?.status, guard?.reason, guard?.outline, guard?.faces], `${plan.level} ${authored.id}`).toEqual(["NOT_CLOSED", "SURFACE_NOT_CLOSED", null, []]);
            continue;
          }
          const found = onPlan.find((room) => room.outline !== null && holds(room.outline, at));
          expect(found, `${plan.level} ${authored.id}: a region stands under its label`).toBeTruthy();
          const room = found as RoomRow;
          expect(new Set((room.name ?? "").split(" / ")), `${plan.level} ${authored.id}: named by its labels`).toEqual(names);
          if (authored.kind === "VOID") {
            expect(room.status, `${plan.level} ${authored.id} is a void`).toBe("VOID");
            continue;
          }
          expect(room.status, `${plan.level} ${authored.id} is a room`).toBe("CLOSED");
          expect(room.faces.map((face) => face.face), `${plan.level} ${authored.id}: its faces`).toEqual(authored.kind === "VERANDAH" ? ["FLOOR"] : ["FLOOR", "CEILING", "WALLS"]);
          if (authored.polygon !== null) {
            expect(Math.abs(Number(room.areaM2) - authoredArea(authored.polygon)), `${plan.level} ${authored.id}: its area is the authored polygon's, to the square millimetre`).toBeLessThanOrEqual(1e-6);
          } else {
            // The east verandah's curved end (A-15): the golden carries it analytically, to three places.
            const golden = goldenRows("arch").find((row) => row.level === plan.level && row.component === "FLOOR" && (row as { room?: string }).room === authored.id);
            expect(golden, `${authored.id} has a golden floor`).toBeTruthy();
            expect(Math.abs(Number(room.areaM2) - Number(golden?.quantity)), `${plan.level} ${authored.id}: the arc carried as an arc`).toBeLessThanOrEqual(0.0005);
          }
        }
        // Nothing else is read on the plan: every region is an authored room or void.
        const authoredCount = (levels[plan.level]?.rooms ?? []).length;
        expect(onPlan.length, `${plan.level}: one region per authored room and void, and nothing dropped`).toBe(authoredCount);
        expect(onPlan.filter((room) => room.status === "DROPPED")).toEqual([]);
      }
    },
    BUDGET_MS,
  );

  test(
    "T-LABEL-OUTSIDE names the toilet it points at; T-ROOM-SIZE-NOMINAL is flagged on its room, never believed",
    async () => {
      const { rooms } = await archRooms();
      const toilet = rooms.rooms.find((room) => room.name === "TOILET-02");
      expect(toilet?.status, "the toilet the label stands beside is named by it").toBe("CLOSED");
      const living = rooms.rooms.filter((room) => room.name === "F.LIVING");
      expect(living.flatMap((room) => room.labels.map((one) => one.name)), "and the family living room it stands in carries only its own name").toEqual(["F.LIVING", "F.LIVING"]);
      const nominal = rooms.rooms.filter((room) => room.name === "BED-01" && room.labels.some((one) => one.agrees === false));
      expect(nominal.map((room) => room.labels[0]?.size), "the 18'-0\" x 14'-0\" label does not bear out its clear 17'-10\" x 14'-2\"").toEqual([`18'-0" x 14'-0"`]);
    },
    BUDGET_MS,
  );

  test(
    "each closed room registers its surfaces on the sheet its plan is captioned on: GF 4 rooms × 3, the typical plan 16 × 3 and two verandahs' floors",
    async () => {
      const { read, rooms } = await archRooms();
      for (const [plan, expected] of [
        [PLANS[0], 12],
        [PLANS[1], 50],
      ] as const) {
        const view = read.evidence.views.find((one) => one.caption.startsWith(`${plan.caption}  SCALE`));
        const surfaces = rooms.placements.filter((row) => row.viewKey === `v:${view?.viewKey}`);
        expect(surfaces.length, plan.caption).toBe(expected);
        expect(new Set(surfaces.map((row) => row.sheet)), "sighted under the sheet a person confirms (I-592)").toEqual(new Set([plan.sheet]));
        expect(new Set(surfaces.map((row) => row.placementKey)).size, "each an identity of its own").toBe(expected);
      }
    },
    BUDGET_MS,
  );
});
