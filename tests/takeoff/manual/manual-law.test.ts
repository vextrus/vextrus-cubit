/**
 * S1: the one home of a hand measurement's geometry (src/core/manual/law.ts, I-385) and the basis
 * each traced point is re-derived to (src/core/manual/snaps.ts, I-387, I-375).
 *
 * The figure is exact and computed from the points' own spellings: J-000's ring on S-08 (the slab
 * outline 81D, the lift pit 830) must give exactly the readings the Decision's I-393 table states,
 * which the Decision's own test recomputes from the committed DXF. So the law and the fixture are held
 * to one number from both sides.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import {
  MANUAL_BOUNDS,
  degenerateReason,
  exactSpellingOf,
  figureOf,
  figureUnitOf,
  geometryBasis,
  pointCountOf,
  type JudgedPoint,
  type MeasuredGeometry,
} from "../../../src/core/manual/law";
import { extentOf, judgePoint, type DrawingFacts } from "../../../src/core/manual/snaps";
import { drawnUnitOf, snapReachOf } from "../../../src/core/manual/units";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");

/** A MEASURED point at an exact spelling. */
const at = (x: string, y: string): JudgedPoint => ({ x, y, basis: "MEASURED", sources: [] });

/** S-08's slab outline 81D and lift pit 830, as the DXF spells their vertices. */
const SLAB_81D = [at("-125", "-400125"), at("20546.6", "-400125"), at("20546.6", "-384025.4"), at("2691.423304703363", "-384025.4"), at("-125", "-386841.82330470334")];
const PIT_830 = [at("8714.2", "-391285.8"), at("11707.4", "-391285.8"), at("11707.4", "-388597.4"), at("8714.2", "-388597.4")];

/** A square of side `side` with its least corner at (x, y). */
const square = (x: number, y: number, side: number): JudgedPoint[] => [
  at(String(x), String(y)),
  at(String(x + side), String(y)),
  at(String(x + side), String(y + side)),
  at(String(x), String(y + side)),
];

/** The value of one row of I-393's ring-readings table. */
function decisionReading(label: string): string {
  const text = readFileSync(join(ROOT, "docs/design/s-measure.md"), "utf8");
  const row = text.split("\n").find((line) => line.trim().startsWith(`| ${label} |`));
  expect(row, `the Decision's I-393 table states "${label}"`).toBeDefined();
  return (row ?? "").split("|")[2]?.trim() ?? "";
}

describe("S1: a hand measurement's figure is exact (I-385)", () => {
  test("J-000's ring on S-08: 81D's area and the lift pit's are the Decision's readings, digit for digit", () => {
    const figure = figureOf({ geometry: "POLYGON", outer: SLAB_81D, cutouts: [{ role: "OPENING", ring: PIT_830 }] });
    expect(figure.measure).toBe("AREA");
    if (figure.measure !== "AREA") return;
    expect(figure.gross, "the shoelace of 81D's five vertex spellings, never quantised").toBe(decisionReading("slab outline 81D, mm²"));
    expect(figure.cutouts, "the pit is stated with its role, never netted here — which cut-outs deduct is the method's").toEqual([{ role: "OPENING", area: decisionReading("lift pit 830, mm²") }]);
  });

  test("the figure does not depend on where the ring starts, which way it turns or a closing repeat", () => {
    const reversed = [...SLAB_81D].reverse();
    const closed = [...SLAB_81D, SLAB_81D[0] as JudgedPoint];
    for (const outer of [reversed, closed, [...SLAB_81D.slice(2), ...SLAB_81D.slice(0, 2)]]) {
      expect(figureOf({ geometry: "POLYGON", outer, cutouts: [] })).toEqual(figureOf({ geometry: "POLYGON", outer: SLAB_81D, cutouts: [] }));
    }
  });

  test("a run's length and a count", () => {
    expect(figureOf({ geometry: "POLYLINE", run: [at("0", "0"), at("3", "4"), at("3", "10")] })).toEqual({ measure: "LENGTH", gross: "11" });
    expect(figureOf({ geometry: "POINT_SET", points: [at("0", "0"), at("1", "1")] })).toEqual({ measure: "COUNT", gross: "2" });
  });

  test("a coordinate is spelled exactly as the drawing's double reads, plain and without a negative zero", () => {
    expect(exactSpellingOf(-386841.82330470334)).toBe("-386841.82330470334");
    expect(exactSpellingOf(-0)).toBe("0");
    expect(exactSpellingOf(1e21)).toBe("1000000000000000000000");
  });

  test("the geometry's basis is the weakest of its points (L-QTY-01)", () => {
    const ring = [...square(0, 0, 10)];
    ring[2] = { ...(ring[2] as JudgedPoint), basis: "ENTERED" };
    expect(geometryBasis({ geometry: "POLYGON", outer: square(0, 0, 10), cutouts: [] })).toBe("MEASURED");
    expect(geometryBasis({ geometry: "POLYGON", outer: ring, cutouts: [] })).toBe("ENTERED");
  });
});

describe(`S1: a geometry that encloses, runs or counts nothing billable is ${REFUSALS.MANUAL_GEOMETRY_DEGENERATE.code}'s`, () => {
  const lawful: readonly MeasuredGeometry[] = [
    { geometry: "POLYGON", outer: SLAB_81D, cutouts: [{ role: "OPENING", ring: PIT_830 }] },
    { geometry: "POLYGON", outer: square(0, 0, 10), cutouts: [{ role: "MEMBER", ring: square(0, 0, 2) }, { role: "OPENING", ring: square(2, 0, 2) }] },
    { geometry: "POLYLINE", run: [at("0", "0"), at("10", "0"), at("10", "10"), at("0", "0.5")] },
    { geometry: "POINT_SET", points: [at("0", "0"), at("0.01", "0")] },
  ];
  for (const geometry of lawful) {
    test(`a lawful ${geometry.geometry} stands`, () => {
      expect(degenerateReason(geometry)).toBeNull();
    });
  }

  const degenerate: readonly [string, MeasuredGeometry][] = [
    ["an outline of two distinct points", { geometry: "POLYGON", outer: [at("0", "0"), at("1", "0"), at("1", "0")], cutouts: [] }],
    ["a bow-tie outline", { geometry: "POLYGON", outer: [at("0", "0"), at("10", "10"), at("10", "0"), at("0", "10")], cutouts: [] }],
    ["an outline that doubles back", { geometry: "POLYGON", outer: [at("0", "0"), at("10", "0"), at("5", "0")], cutouts: [] }],
    ["a cut-out standing partly outside", { geometry: "POLYGON", outer: square(0, 0, 10), cutouts: [{ role: "OPENING", ring: square(8, 8, 4) }] }],
    ["two cut-outs over each other", { geometry: "POLYGON", outer: square(0, 0, 10), cutouts: [{ role: "OPENING", ring: square(1, 1, 4) }, { role: "OPENING", ring: square(3, 3, 4) }] }],
    ["a run of one point", { geometry: "POLYLINE", run: [at("1", "1"), at("1", "1")] }],
    ["a run doubling back along itself", { geometry: "POLYLINE", run: [at("0", "0"), at("10", "0"), at("4", "0")] }],
    ["a point counted twice", { geometry: "POINT_SET", points: [at("1", "1"), at("1.0", "1")] }],
  ];
  for (const [what, geometry] of degenerate) {
    test(`${what} is degenerate`, () => {
      expect(degenerateReason(geometry), `${what} is refused ${REFUSALS.MANUAL_GEOMETRY_DEGENERATE.code}`).not.toBeNull();
    });
  }
});

describe("S1: the unit a hand reading is carried in is the one the view is drawn full size in (I-386)", () => {
  test("a view affirmed at a unit's own metres is drawn in that unit, within the verification tolerance", () => {
    expect(drawnUnitOf({ factorX: "0.001000000000", factorY: "0.001000000000" }, "0.01")).toBe("mm");
    expect(drawnUnitOf({ factorX: "0.304800000000", factorY: "0.304800000000" }, "0.01")).toBe("ft");
    expect(drawnUnitOf({ factorX: "0.000995000000", factorY: "0.001004000000" }, "0.01")).toBe("mm");
  });

  test(`a view drawn at 1:100, in centimetres or in points converts to nothing the bill carries — ${REFUSALS.MANUAL_UNIT_NOT_CONVERTIBLE.code}`, () => {
    expect(drawnUnitOf({ factorX: "0.100000000000", factorY: "0.100000000000" }, "0.01")).toBeNull();
    expect(drawnUnitOf({ factorX: "0.010000000000", factorY: "0.010000000000" }, "0.01")).toBeNull();
    expect(drawnUnitOf({ factorX: "0.000352777778", factorY: "0.000352777778" }, "0.01")).toBeNull();
    expect(drawnUnitOf({ factorX: "0.001000000000", factorY: "0.304800000000" }, "0.01"), "an axis each way is no one unit").toBeNull();
  });

  test("an area is carried in the square of the drawn unit, and a unit with no square carries none", () => {
    expect(figureUnitOf("POLYGON", "mm")).toBe("mm2");
    expect(figureUnitOf("POLYGON", "ft")).toBe("sft");
    expect(figureUnitOf("POLYGON", "in")).toBeNull();
    expect(figureUnitOf("POLYLINE", "mm")).toBe("mm");
    expect(figureUnitOf("POINT_SET", "mm")).toBe("pcs");
  });
});

describe("S1: each point's basis is re-derived from the drawing, and the view it stands in is proved (I-387, I-375)", () => {
  const PLAN = "LAYOUT_PLAN:DXF_HANDLE:A0";
  const OTHER = "DETAIL:DXF_HANDLE:B0";
  const facts: DrawingFacts = {
    shapes: new Map([
      ["DXF_HANDLE:1", { space: "model", paths: [{ points: [[0, 0], [100, 0], [100, 50], [0, 50]], closed: true }] }],
      ["DXF_HANDLE:2", { space: "model", paths: [{ points: [[500, 500], [600, 500]], closed: false }] }],
      ["DXF_HANDLE:3", { space: "SHEET A1", paths: [{ points: [[0, 0], [10, 0]], closed: false }] }],
      ["DXF_HANDLE:4", { space: "model", paths: [{ points: [[0.1, 0.2], [0.2, 0.4]], closed: false }] }],
    ]),
    assigned: new Map([
      ["DXF_HANDLE:1", PLAN],
      ["DXF_HANDLE:2", OTHER],
      ["DXF_HANDLE:4", PLAN],
    ]),
    axes: new Map([
      ["DXF_HANDLE:G1", { viewKey: PLAN, axis: "x", position: 25 }],
      ["DXF_HANDLE:G2", { viewKey: PLAN, axis: "y", position: 40 }],
    ]),
  };
  /** A millimetre drawing: the snap reach is one micrometre, 0.001 of a drawing unit. */
  const view = { viewKey: PLAN, space: "model", extent: extentOf(facts, { viewKey: PLAN, space: "model" }), reach: snapReachOf("mm") };

  test("the view's extent is what its own entities draw", () => {
    expect(view.extent).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
  });

  test("the snap reach is one micrometre of real length, in the unit the view is drawn in — never a lattice step", () => {
    expect(snapReachOf("mm")).toBe("0.001");
    expect(snapReachOf("m")).toBe("0.000001");
    expect(snapReachOf("ft").startsWith("0.00000328083989501312")).toBe(true);
    expect(snapReachOf("in").startsWith("0.0000393700787401574")).toBe(true);
  });

  test("an endpoint, a midpoint, a point on an edge and a grid crossing reproduce: MEASURED, citing what they stand on", () => {
    expect(judgePoint({ x: 100, y: 50, cites: ["DXF_HANDLE:1"] }, facts, view).judged).toEqual({ x: "100", y: "50", basis: "MEASURED", sources: ["DXF_HANDLE:1"] });
    expect(judgePoint({ x: 33.333333333333336, y: 50, cites: ["DXF_HANDLE:1"] }, facts, view).judged, "a nearest point on an edge keeps its own spelling").toEqual({
      x: "33.333333333333336",
      y: "50",
      basis: "MEASURED",
      sources: ["DXF_HANDLE:1"],
    });
    expect(judgePoint({ x: 25, y: 40, cites: ["DXF_HANDLE:G2", "DXF_HANDLE:G1"] }, facts, view).judged).toEqual({ x: "25", y: "40", basis: "MEASURED", sources: ["DXF_HANDLE:G1", "DXF_HANDLE:G2"] });
  });

  test("a point the drawing determines is stored as the drawing spells it, never as the viewer's float (I-385)", () => {
    // A viewer's midpoint of (0.1, 0.2)–(0.2, 0.4) in doubles is (0.15000000000000002, 0.30000000000000004).
    expect(judgePoint({ x: (0.1 + 0.2) / 2, y: (0.2 + 0.4) / 2, cites: ["DXF_HANDLE:4"] }, facts, view).judged, "the exact midpoint").toEqual({ x: "0.15", y: "0.3", basis: "MEASURED", sources: ["DXF_HANDLE:4"] });
    expect(judgePoint({ x: 100.0000000001, y: 49.9999999999, cites: ["DXF_HANDLE:1"] }, facts, view).judged, "the vertex itself").toEqual({ x: "100", y: "50", basis: "MEASURED", sources: ["DXF_HANDLE:1"] });
    expect(judgePoint({ x: 25.0000000001, y: 39.9999999999, cites: ["DXF_HANDLE:G1", "DXF_HANDLE:G2"] }, facts, view).judged, "the grid crossing itself").toEqual({
      x: "25",
      y: "40",
      basis: "MEASURED",
      sources: ["DXF_HANDLE:G1", "DXF_HANDLE:G2"],
    });
  });

  test("a point that does not stand on what it cites is demoted to free: ENTERED, on the lattice, citing nothing", () => {
    const off = judgePoint({ x: 50.26, y: 49.7, cites: ["DXF_HANDLE:1"] }, facts, view);
    expect(off.judged, "0.3 off the edge is not on it").toEqual({ x: "50.3", y: "49.7", basis: "ENTERED", sources: [] });
    expect(off.demoted).toBe(true);
    expect(judgePoint({ x: 33.3, y: 50.05, cites: ["DXF_HANDLE:1"] }, facts, view).judged, "nor is 0.05 off it: a lattice step is no snap reach").toEqual({ x: "33.3", y: "50.1", basis: "ENTERED", sources: [] });
    expect(judgePoint({ x: 100.002, y: 50, cites: ["DXF_HANDLE:1"] }, facts, view).judged?.basis, "two micrometres past a vertex is past it").toBe("ENTERED");
    expect(judgePoint({ x: 10, y: 10, cites: ["DXF_HANDLE:FFFF"] }, facts, view).judged?.basis, "a key the drawing does not hold proves nothing").toBe("ENTERED");
  });

  test(`a point standing on another view's or another space's entity is off the named view — ${REFUSALS.MANUAL_RING_OFF_VIEW.code}`, () => {
    expect(judgePoint({ x: 500, y: 500, cites: ["DXF_HANDLE:2"] }, facts, view).offView).toBeDefined();
    expect(judgePoint({ x: 10, y: 0, cites: ["DXF_HANDLE:3"] }, facts, view).offView).toBeDefined();
  });

  test("a free point stands in the view only inside what the view draws", () => {
    expect(judgePoint({ x: 12.34, y: 20.01, cites: [] }, facts, view).judged).toEqual({ x: "12.3", y: "20.0", basis: "ENTERED", sources: [] });
    expect(judgePoint({ x: 300, y: 20, cites: [] }, facts, view).offView).toBeDefined();
    expect(judgePoint({ x: 1, y: 1, cites: [] }, facts, { ...view, extent: null }).offView, "a view that draws nothing holds no free point").toBeDefined();
  });
});

describe("S1: a figure is never stronger than the drawing supports — a metre drawing, corners pushed outward (I-387)", () => {
  const PLAN = "LAYOUT_PLAN:DXF_HANDLE:A0";
  /** A 10 m × 10 m slab drawn in metres as four LINEs, anticlockwise from the origin. */
  const EDGES: readonly (readonly [string, readonly [number, number], readonly [number, number]])[] = [
    ["DXF_HANDLE:L1", [0, 0], [10, 0]],
    ["DXF_HANDLE:L2", [10, 0], [10, 10]],
    ["DXF_HANDLE:L3", [10, 10], [0, 10]],
    ["DXF_HANDLE:L4", [0, 10], [0, 0]],
  ];
  const facts: DrawingFacts = {
    shapes: new Map(EDGES.map(([key, from, to]) => [key, { space: "model", paths: [{ points: [from, to], closed: false }] }])),
    assigned: new Map(EDGES.map(([key]) => [key, PLAN])),
    axes: new Map(),
  };
  const view = { viewKey: PLAN, space: "model", extent: extentOf(facts, { viewKey: PLAN, space: "model" }), reach: snapReachOf("m") };

  /** Each corner, citing the two lines that meet there, moved by (dx, dy) per corner. */
  const corners = (push: number): { x: number; y: number; cites: string[] }[] => [
    { x: 0 - push, y: 0 - push, cites: ["DXF_HANDLE:L4", "DXF_HANDLE:L1"] },
    { x: 10 + push, y: 0 - push, cites: ["DXF_HANDLE:L1", "DXF_HANDLE:L2"] },
    { x: 10 + push, y: 10 + push, cites: ["DXF_HANDLE:L2", "DXF_HANDLE:L3"] },
    { x: 0 - push, y: 10 + push, cites: ["DXF_HANDLE:L3", "DXF_HANDLE:L4"] },
  ];

  /** The outline as the act judges it: each point, then the figure and the geometry's basis. */
  function judged(points: readonly { x: number; y: number; cites: string[] }[]): { points: JudgedPoint[]; demoted: number; gross: string; basis: string } {
    let demoted = 0;
    const outer = points.map((point) => {
      const verdict = judgePoint(point, facts, view);
      if (verdict.judged === undefined) throw new Error(`off the view: ${verdict.offView}`);
      if (verdict.demoted) demoted += 1;
      return verdict.judged;
    });
    const geometry: MeasuredGeometry = { geometry: "POLYGON", outer, cutouts: [] };
    const figure = figureOf(geometry);
    return { points: outer, demoted, gross: figure.gross, basis: geometryBasis(geometry) };
  }

  test("the honest trace is the drawing's own 100 m², MEASURED", () => {
    expect(judged(corners(0))).toMatchObject({ demoted: 0, gross: "100", basis: "MEASURED" });
  });

  test("corners pushed 0.07 m outward — inside the lattice step the reach once was — are demoted, never MEASURED", () => {
    const pushed = judged(corners(0.07));
    expect(pushed.demoted, "all four corners stand 99 mm off their lines").toBe(4);
    expect(pushed.points.every((point) => point.basis === "ENTERED" && point.sources.length === 0)).toBe(true);
    expect(pushed.basis, "the figure is a person's statement, never the drawing's").toBe("ENTERED");
  });

  test("corners stated with a viewer's float noise come back at the drawing's own vertices, and the figure is exactly 100", () => {
    const noisy = judged(corners(1e-12));
    expect(noisy.points.map((point) => `${point.x},${point.y}`)).toEqual(["0,0", "10,0", "10,10", "0,10"]);
    expect(noisy).toMatchObject({ demoted: 0, gross: "100", basis: "MEASURED" });
  });

  test("a point on an edge stands within one micrometre of it or is not on it — and no MEASURED figure exceeds the drawing by more than its perimeter × 1 µm", () => {
    const within = judgePoint({ x: 3, y: -0.0000005, cites: ["DXF_HANDLE:L1"] }, facts, view);
    expect(within.judged).toEqual({ x: "3", y: "-0.0000005", basis: "MEASURED", sources: ["DXF_HANDLE:L1"] });
    expect(judgePoint({ x: 5, y: -0.0000005, cites: ["DXF_HANDLE:L1"] }, facts, view).judged, "at the edge's midpoint, the midpoint itself").toEqual({ x: "5", y: "0", basis: "MEASURED", sources: ["DXF_HANDLE:L1"] });
    expect(judgePoint({ x: 3, y: -0.000002, cites: ["DXF_HANDLE:L1"] }, facts, view).judged?.basis, "two micrometres off the edge").toBe("ENTERED");
    const outline = judged([...corners(0).slice(0, 1), { x: 3, y: -0.0000005, cites: ["DXF_HANDLE:L1"] }, ...corners(0).slice(1)]);
    expect(outline.basis).toBe("MEASURED");
    // 100 m² and a sliver of half of 10 m × 0.5 µm: 0.0000025 m², below anything a bill prints.
    expect(outline.gross).toBe("100.0000025");
  });

  test("a foot drawing's reach is a micrometre too: 0.07 ft outward is demoted", () => {
    const feet = { ...view, reach: snapReachOf("ft") };
    const verdict = judgePoint({ x: 10.07, y: -0.07, cites: ["DXF_HANDLE:L1", "DXF_HANDLE:L2"] }, facts, feet);
    expect([verdict.judged?.basis, verdict.demoted]).toEqual(["ENTERED", true]);
  });
});

describe("S1: the bound on a statement (MANUAL_BOUNDS)", () => {
  test("counts every point of every ring together, since the guards' work grows with the product of the rings' sizes", () => {
    expect(pointCountOf({ geometry: "POLYGON", outer: square(0, 0, 10), cutouts: [{ role: "OPENING", ring: square(2, 2, 3) }] })).toBe(8);
    expect(pointCountOf({ geometry: "POINT_SET", points: square(0, 0, 1) })).toBe(4);
    expect(MANUAL_BOUNDS, "a thousand points, fifty cut-outs, eight cited keys a point").toEqual({ points: 1000, cutouts: 50, cites: 8 });
  });
});
