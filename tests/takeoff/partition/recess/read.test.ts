/**
 * The recess cast into a member, read off the set's own section of it (I-546, I-598): the void
 * an open outline cuts into the top of the member's section ring, its length and depth as the
 * dimensions standing on it write them, and its breadth as the other side of a size pair beside a note
 * naming the recess. A recess drawn or named but not stated every way is said so, side by side — never
 * dropped, never guessed.
 *
 * The synthetic sections are drawn the way F-RCC6-BNBC Rev C's S-07 draws PC5's: a 3500 × 1295.4 ring,
 * the void cut 914.4 into its top over 2493.2, a dimension across the mouth, one down to the floor, and
 * `LIFT PIT RECESS (SEE S-23)` over `2493x2188`. The last case reads the Rev C corpus itself.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { recessStatementsOf, recessesByMark, type RecessInput } from "@/modules/takeoff/partition/recess/read";
import { BNBC_DXF, stagesOver } from "../support/bnbc-stages";

type Drawn = { key: string; type: string; layer?: string; text?: string; points?: [number, number][]; closed?: boolean };
type Paint = { src: string; type: string; layer: string; text?: string; points?: [number, number][] };

const VIEW = "MEMBER_SECTION:S";

/** The cap's section ring: 3500 wide, its top at y = 0, 1295.4 deep. */
const RING: Drawn = { key: "RING", type: "LWPOLYLINE", closed: true, points: [[0, -1295.4], [3500, -1295.4], [3500, 0], [0, 0]] };

/** The void cut into the top: 2493.2 wide, centred, 914.4 deep — open, its ends on the ring's top. */
const VOID: Drawn = { key: "VOID", type: "LWPOLYLINE", closed: false, points: [[503.4, 0], [503.4, -914.4], [2996.6, -914.4], [2996.6, 0]] };

/** A linear dimension: the entity, and its paint — the definition points and the one text it writes. */
function dimension(key: string, points: [number, number][], text: string): { entity: Drawn; paint: Paint[] } {
  return {
    entity: { key, type: "DIMENSION", layer: "Dimension" },
    paint: [
      ...points.map((point): Paint => ({ src: key, type: "POINT", layer: "Defpoints", points: [point] })),
      { src: key, type: "MTEXT", layer: "Dimension", text, points: [points[0] as [number, number]] },
    ],
  };
}

/** Across the mouth, as S-07's `22BA` stands: the dimension line 250 above the floor, the origins on it. */
const ACROSS = dimension("DIM-L", [[503.4, -664.4], [503.4, -914.4], [2996.6, -914.4]], "2493");
/** Down to the floor, as `22C9` stands: the origins on the top and the floor, 250 inside the side. */
const DOWN = dimension("DIM-D", [[2746.6, 0], [2996.6, 0], [2996.6, -914.4]], "914");

const NOTE: Drawn = { key: "NOTE", type: "TEXT", text: "LIFT PIT RECESS (SEE S-23)", points: [[100, -3045]] };
const PAIR: Drawn = { key: "PAIR", type: "TEXT", text: "2493x2188", points: [[100, -3245]] };

/** One drawing: the entities of the section, its dimensions' paint, and every entity in the one view. */
function input(options: { entities?: Drawn[]; dimensions?: { entity: Drawn; paint: Paint[] }[]; caption?: string; declaredUnit?: "mm" | "in" | null; marks?: string[]; views?: { viewKey: string; caption: string; entities: Drawn[]; paint?: Paint[] }[] } = {}): RecessInput {
  const dims = options.dimensions ?? [ACROSS, DOWN];
  const own = [...(options.entities ?? [RING, VOID, NOTE, PAIR]), ...dims.map((one) => one.entity)];
  const others = options.views ?? [];
  const entities = [...own, ...others.flatMap((view) => view.entities)];
  const assignments = new Map<string, string>([...own.map((one) => [one.key, VIEW] as const), ...others.flatMap((view) => view.entities.map((one) => [one.key, view.viewKey] as const))]);
  const graph = { entities, derived: [...dims.flatMap((one) => one.paint), ...others.flatMap((view) => view.paint ?? [])] } as unknown as EntityGraph;
  return {
    graph,
    views: [{ viewKey: VIEW, caption: options.caption ?? "PC5 SECTION  SCALE 1:25" }, ...others.map((view) => ({ viewKey: view.viewKey, caption: view.caption }))],
    assignments,
    declaredUnit: options.declaredUnit === undefined ? "mm" : options.declaredUnit,
    marks: options.marks ?? ["PC1", "PC5"],
  };
}

const LENGTH = { value: "2493", unit: "mm", source: "DIM-L" };
const BREADTH = { value: "2188", unit: "mm", source: "PAIR" };
const DEPTH = { value: "914", unit: "mm", source: "DIM-D" };

describe("I-598: a recess stated every way", () => {
  test("the void, its length and depth as the dimensions on it write them, its breadth the other side of the pair — each cited", () => {
    expect(recessStatementsOf(input())).toEqual([{ mark: "PC5", viewKey: VIEW, outlineKey: "VOID", length: LENGTH, breadth: BREADTH, depth: DEPTH }]);
    expect(recessesByMark(recessStatementsOf(input())).get("PC5")).toEqual({ length: LENGTH, breadth: BREADTH, depth: DEPTH });
  });

  test("the figure is the one the dimension WRITES — a figured dimension governs the drawn span (2493, not 2493.2)", () => {
    const [read] = recessStatementsOf(input());
    expect([read?.length?.value, read?.depth?.value]).toEqual(["2493", "914"]);
  });

  test("a pair written breadth first is read by the side that is the length", () => {
    const [read] = recessStatementsOf(input({ entities: [RING, VOID, NOTE, { ...PAIR, text: "2188 X 2493" }] }));
    expect(read?.breadth).toEqual(BREADTH);
  });

  test("a figure in feet and inches is carried in inches; a bare figure is in the unit the drawing declares", () => {
    const inches = recessStatementsOf(input({ dimensions: [ACROSS, dimension("DIM-D", [[2746.6, 0], [2996.6, 0], [2996.6, -914.4]], "3'-0\"")] }))[0];
    expect(inches?.depth).toEqual({ value: "36", unit: "in", source: "DIM-D" });
    const undeclared = recessStatementsOf(input({ declaredUnit: null }))[0];
    expect([undeclared?.length, undeclared?.breadth, undeclared?.depth], "a bare figure on a drawing that declares no unit states nothing (L-MEA-01)").toEqual([null, null, null]);
  });
});

describe("I-598: a recess drawn or named, stated only some ways — said so, side by side", () => {
  test("no pair: the length and the depth, the breadth null — a recess read in one direction only", () => {
    const [read] = recessStatementsOf(input({ entities: [RING, VOID, NOTE] }));
    expect([read?.length, read?.breadth, read?.depth]).toEqual([LENGTH, null, DEPTH]);
  });

  test("a pair none of whose sides is the stated length says nothing of this void", () => {
    const [read] = recessStatementsOf(input({ entities: [RING, VOID, NOTE, { ...PAIR, text: "3500x3500" }] }));
    expect(read?.breadth).toBeNull();
  });

  test("a pair in a view whose words never name the recess is not the recess's plan", () => {
    const [read] = recessStatementsOf(input({ entities: [RING, VOID, PAIR] }));
    expect(read?.breadth).toBeNull();
  });

  test("no dimension across the mouth: the length null, and the breadth with it — the pair cannot be tied to the void", () => {
    const [read] = recessStatementsOf(input({ dimensions: [DOWN] }));
    expect([read?.length, read?.breadth, read?.depth]).toEqual([null, null, DEPTH]);
  });

  test("no dimension to the floor: the depth null", () => {
    const [read] = recessStatementsOf(input({ dimensions: [ACROSS] }));
    expect([read?.length, read?.breadth, read?.depth]).toEqual([LENGTH, BREADTH, null]);
  });

  test("a dimension whose definition points stand elsewhere — the cap's own width — states no side of the void", () => {
    const [read] = recessStatementsOf(input({ dimensions: [dimension("DIM-CAP", [[0, -1500], [0, -1295.4], [3500, -1295.4]], "3500"), DOWN] }));
    expect(read?.length).toBeNull();
  });

  test("two voids in one section are two recesses the sentences cannot net as one: drawn, every side null", () => {
    const second: Drawn = { key: "VOID-2", type: "LWPOLYLINE", closed: false, points: [[3100, 0], [3100, -300], [3400, -300], [3400, 0]] };
    const first: Drawn = { ...VOID, points: [[100, 0], [100, -914.4], [2593.2, -914.4], [2593.2, 0]] };
    expect(recessStatementsOf(input({ entities: [RING, first, second, NOTE, PAIR] }))).toEqual([{ mark: "PC5", viewKey: VIEW, outlineKey: "VOID", length: null, breadth: null, depth: null }]);
  });

  test("a note naming the cap beside the word RECESS states a recess is there, stated no way", () => {
    const plan = { viewKey: "LAYOUT_PLAN:P", caption: "PILE CAP LAYOUT  SCALE 1:100", entities: [{ key: "SAYS", type: "TEXT", text: "PC5: LIFT PIT RECESS, SEE S-07", points: [[0, 0]] as [number, number][] }] };
    const statements = recessStatementsOf(input({ entities: [], dimensions: [], caption: "PC1 SECTION", views: [plan] }));
    expect(statements).toEqual([{ mark: "PC5", viewKey: "LAYOUT_PLAN:P", outlineKey: null, length: null, breadth: null, depth: null }]);
    expect(recessesByMark(statements).get("PC5"), "named, and nothing states by how much").toEqual({ length: null, breadth: null, depth: null });
  });

  test("named beside a section that states it: the section's figures stand", () => {
    const pit = { viewKey: "MEMBER_SECTION:PIT", caption: "LIFT PIT SECTION (RECESS IN PILE CAP PC5, SEE S-07)", entities: [] as Drawn[] };
    expect(recessesByMark(recessStatementsOf(input({ views: [pit] }))).get("PC5")).toEqual({ length: LENGTH, breadth: BREADTH, depth: DEPTH });
  });

  test("two sections of one mark that disagree state that side as nothing (L-REG-03)", () => {
    const across = dimension("DIM-L2", [[503.4, -664.4], [503.4, -914.4], [2996.6, -914.4]], "2493");
    const other = {
      viewKey: "MEMBER_SECTION:T",
      caption: "PC5 SECTION B",
      entities: [{ ...RING, key: "RING-2" }, { ...VOID, key: "VOID-2" }, { ...NOTE, key: "NOTE-2" }, { ...PAIR, key: "PAIR-2", text: "2493x2000" }, across.entity],
      paint: across.paint,
    };
    const recess = recessesByMark(recessStatementsOf(input({ views: [other] }))).get("PC5");
    expect(recess?.breadth, "2188 against 2000").toBeNull();
    expect(recess?.length, "the length both state stands").toEqual(LENGTH);
  });
});

describe("I-598: what is no recess of a member", () => {
  test("an outline whose ends are not on the ring's top cuts no void", () => {
    const low: Drawn = { ...VOID, points: [[503.4, -100], [503.4, -914.4], [2996.6, -914.4], [2996.6, -100]] };
    expect(recessStatementsOf(input({ entities: [RING, low, NOTE, PAIR] }))).toEqual([]);
  });

  test("an outline reaching outside the ring cuts no void", () => {
    const through: Drawn = { ...VOID, points: [[503.4, 0], [503.4, -1500], [2996.6, -1500], [2996.6, 0]] };
    expect(recessStatementsOf(input({ entities: [RING, through, NOTE, PAIR] }))).toEqual([]);
  });

  test("a caption naming two members, or none, is no one member's section", () => {
    expect(recessStatementsOf(input({ caption: "PC1 & PC5 SECTION" }))).toEqual([]);
    expect(recessStatementsOf(input({ caption: "TYPICAL SECTION" }))).toEqual([]);
    expect(recessStatementsOf(input({ caption: "PC5 PLAN" })), "nor a caption that is no section").toEqual([]);
  });

  test("a mark is named whole: PC51's recess is not PC5's", () => {
    const plan = { viewKey: "LAYOUT_PLAN:P", caption: "PLAN", entities: [{ key: "SAYS", type: "TEXT", text: "PC51: RECESS 600 DEEP", points: [[0, 0]] as [number, number][] }] };
    expect(recessStatementsOf(input({ entities: [], dimensions: [], caption: "NOTES", views: [plan] }))).toEqual([]);
  });

  test("a drawing that speaks of no recess answers nothing", () => {
    expect(recessesByMark(recessStatementsOf(input({ entities: [RING], dimensions: [] }))).size).toBe(0);
  });
});

describe("I-598 over F-RCC6-BNBC Rev C, as the partition's stages read it", () => {
  test(
    "PC5's section on S-07 states its recess every way — 2493 × 2188 × 914 mm, cited to its two dimensions and its size pair; S-06's note and S-23's caption name it; no other cap",
    async () => {
      const stage = await stagesOver(BNBC_DXF);
      const marks = stage.placed.placements.filter((row) => row.elementType === "pile_cap").map((row) => row.mark);
      const statements = recessStatementsOf({
        graph: stage.graph,
        views: stage.evidence.views.map((view) => ({ viewKey: view.viewKey, caption: view.caption })),
        assignments: stage.evidence.assignments,
        declaredUnit: stage.evidence.declaredUnit?.unit ?? null,
        marks,
      });
      const captionOf = new Map(stage.evidence.views.map((view) => [view.viewKey, view.caption]));
      expect(statements.map((one) => [one.mark, captionOf.get(one.viewKey), one.outlineKey])).toEqual([
        ["PC5", "PILE CAP LAYOUT  SCALE 1:100", null],
        ["PC5", "PC5 SECTION  SCALE 1:25", "DXF_HANDLE:22B0"],
        ["PC5", "LIFT PIT SECTION (RECESS IN PILE CAP PC5, SEE S-07)  SCALE 1:50", null],
      ]);
      const recesses = recessesByMark(statements);
      expect([...recesses.keys()], "PC5 alone").toEqual(["PC5"]);
      expect(recesses.get("PC5")).toEqual({
        length: { value: "2493", unit: "mm", source: "DXF_HANDLE:22BA" },
        breadth: { value: "2188", unit: "mm", source: "DXF_HANDLE:22DD" },
        depth: { value: "914", unit: "mm", source: "DXF_HANDLE:22C9" },
      });
      expect(stage.graph.entities.find((one) => one.key === "DXF_HANDLE:22DD")?.text, "the pair S-07 writes under LIFT PIT RECESS").toBe("2493x2188");
    },
    240_000,
  );
});
