/**
 * S1: the markless key (src/core/manual/identity.ts, I-378) and the double-count guards between hand
 * measurements (src/core/manual/overlap.ts, I-380, I-381).
 *
 * The key is a pure function of what was traced, under which class and kinds, in which space, and
 * what it succeeds — and of nothing a person may correct: the same trace re-derives the same key,
 * whatever point it started at or way it turned, so a second identical measurement is refused at the
 * register's own key. The guards read the exact points, never the key's lattice.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import { instanceKey, placementKey, levelSegment } from "../../../src/core/identity";
import { canonicalRings, manualIdentityOf, manualMark, manualViewRef, placementPointOf, type MarkContent } from "../../../src/core/manual/identity";
import type { JudgedPoint, MeasuredGeometry } from "../../../src/core/manual/law";
import { collisionOf, sharesGround, type Footprint } from "../../../src/core/manual/overlap";

const at = (x: string, y: string, sources: readonly string[] = []): JudgedPoint => ({ x, y, basis: "MEASURED", sources });

const SLAB_81D = [at("-125", "-400125"), at("20546.6", "-400125"), at("20546.6", "-384025.4"), at("2691.423304703363", "-384025.4"), at("-125", "-386841.82330470334")];
const PIT_830 = [at("8714.2", "-391285.8"), at("11707.4", "-391285.8"), at("11707.4", "-388597.4"), at("8714.2", "-388597.4")];

const square = (x: number, y: number, side: number): JudgedPoint[] => [
  at(String(x), String(y)),
  at(String(x + side), String(y)),
  at(String(x + side), String(y + side)),
  at(String(x), String(y + side)),
];

const polygon = (outer: readonly JudgedPoint[], cutouts: readonly (readonly JudgedPoint[])[] = []): MeasuredGeometry => ({
  geometry: "POLYGON",
  outer,
  cutouts: cutouts.map((ring) => ({ role: "OPENING" as const, ring })),
});

/** The blinding J-000 measures under the SOG (I-393): slab · pcc.blinding, in model space. */
const blinding = (geometry: MeasuredGeometry, over: Partial<MarkContent> = {}): MarkContent => ({
  elementClass: "slab",
  kinds: ["pcc.blinding"],
  geometry,
  space: "model",
  supersedes: null,
  ...over,
});

const PLAN = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:2073" };
const GF = { levelId: "6eaf4fa7-0000-4000-8000-000000000001" };

describe("S1: the markless key (I-378)", () => {
  test("the mark is ~m. and sixteen hex of the content's digest — no drawn mark can be one", () => {
    expect(manualMark(blinding(polygon(SLAB_81D, [PIT_830])))).toMatch(/^~m\.[0-9a-f]{16}$/u);
  });

  test("the same trace re-derives the same key, whatever point it started at, whichever way it turned, with or without a closing repeat", () => {
    const base = manualMark(blinding(polygon(SLAB_81D, [PIT_830])));
    const rotated = [...SLAB_81D.slice(3), ...SLAB_81D.slice(0, 3)];
    const reversed = [...SLAB_81D].reverse();
    const closed = [...SLAB_81D, SLAB_81D[0] as JudgedPoint];
    for (const outer of [rotated, reversed, closed]) expect(manualMark(blinding(polygon(outer, [[...PIT_830].reverse()])))).toBe(base);
    expect(manualMark(blinding(polygon(SLAB_81D, [PIT_830]), { kinds: ["pcc.blinding", "pcc.blinding"] })), "a kind named twice is one kind").toBe(base);
  });

  test("the class, the kinds, the space and what it supersedes each enter the key; nothing else does", () => {
    const base = manualMark(blinding(polygon(SLAB_81D)));
    expect(manualMark(blinding(polygon(SLAB_81D), { kinds: ["rcc.concrete"] })), "SOG concrete over the same ring is another scope (I-378)").not.toBe(base);
    expect(manualMark(blinding(polygon(SLAB_81D), { elementClass: "footing" }))).not.toBe(base);
    expect(manualMark(blinding(polygon(SLAB_81D), { space: "SHEET A1" }))).not.toBe(base);
    expect(manualMark(blinding(polygon(SLAB_81D), { supersedes: "v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.0000000000000000|-125.0,-400125.0@x" })), "an edit has a key of its own (I-379)").not.toBe(base);
    expect(manualMark(blinding(polygon(SLAB_81D, [PIT_830]))), "a cut-out changes the scope traced").not.toBe(base);
    const kinds = manualMark(blinding(polygon(SLAB_81D), { kinds: ["rcc.concrete", "pcc.blinding"] }));
    expect(manualMark(blinding(polygon(SLAB_81D), { kinds: ["pcc.blinding", "rcc.concrete"] })), "kinds are code-point sorted").toBe(kinds);
  });

  test("a point's basis never enters the key: a demoted point is the same scope on the same lattice point", () => {
    const entered = SLAB_81D.map((point, index) => (index === 2 ? { ...point, basis: "ENTERED" as const, sources: [] } : point));
    expect(manualMark(blinding(polygon(entered)))).toBe(manualMark(blinding(polygon(SLAB_81D))));
  });

  test("J-000's ring keys at 81D's least point, and the object key is the placement key and one level segment — the store's CHECK holds", () => {
    const identity = manualIdentityOf(blinding(polygon(SLAB_81D, [PIT_830])), PLAN, GF);
    expect(placementPointOf(polygon(SLAB_81D))).toEqual(at("-125", "-400125"));
    expect(identity.objectKey).toMatch(/^v:LAYOUT_PLAN:DXF_HANDLE:2073\|~m\.[0-9a-f]{16}\|-125\.0,-400125\.0@6eaf4fa7-0000-4000-8000-000000000001$/u);
    const placement = placementKey({ view: PLAN, mark: identity.mark, x: identity.x, y: identity.y });
    expect(identity.objectKey, "object_key = placement_key ‖ level segment (register_objects_level_stated_once)").toBe(`${placement}${levelSegment(GF)}`);
    expect(identity.objectKey).toBe(instanceKey({ placement: { view: PLAN, mark: identity.mark, x: identity.x, y: identity.y }, level: GF }));
  });

  test("the anchorless view is keyed by the drawing revision's own bytes, never by the bare name two drawings share", () => {
    expect(manualViewRef({ viewClass: "UNASSIGNED", anchorKey: null }, "ab".repeat(32))).toEqual({ viewClass: "UNASSIGNED", captionAnchorSourceKey: `FILE:${"ab".repeat(32)}` });
    expect(manualViewRef({ viewClass: "LAYOUT_PLAN", anchorKey: "DXF_HANDLE:2073" }, "ab".repeat(32))).toEqual(PLAN);
  });

  test("a run starts at its lesser end, and a set of points is sorted", () => {
    const run: MeasuredGeometry = { geometry: "POLYLINE", run: [at("10", "0"), at("5", "5"), at("0", "0")] };
    expect(canonicalRings(run)).toEqual([[["0.0", "0.0"], ["5.0", "5.0"], ["10.0", "0.0"]]]);
    const points: MeasuredGeometry = { geometry: "POINT_SET", points: [at("3", "1"), at("1", "2"), at("1", "1")] };
    expect(canonicalRings(points)).toEqual([[["1.0", "1.0"], ["1.0", "2.0"], ["3.0", "1.0"]]]);
  });
});

describe(`S1: two hand measurements never measure the same ground (I-380) — ${REFUSALS.MANUAL_OVERLAP.code}`, () => {
  test("two outlines that overlap share ground; two that only meet along an edge or at a corner share none", () => {
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(square(5, 5, 10)))).toBe(true);
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(square(10, 0, 10))), "a shared edge").toBe(false);
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(square(10, 10, 10))), "a shared corner").toBe(false);
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(square(0, 0, 10))), "the same ring twice").toBe(true);
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(square(2, 2, 3))), "one inside the other").toBe(true);
  });

  test("two runs whose boxes never meet share no ground, and two that run along each other do", () => {
    const run = (points: readonly (readonly [string, string])[]): MeasuredGeometry => ({ geometry: "POLYLINE", run: points.map(([x, y]) => at(x, y)) });
    expect(sharesGround(run([["0", "0"], ["10", "0"]]), run([["20", "0"], ["30", "0"]])), "apart along one line").toBe(false);
    expect(sharesGround(run([["0", "0"], ["10", "0"]]), run([["5", "0"], ["15", "0"]])), "overlapping along one line").toBe(true);
    expect(sharesGround(run([["0", "0"], ["10", "0"]]), run([["10", "0"], ["20", "0"]])), "meeting end to end").toBe(false);
  });

  test("the guard reads the exact points: a sliver narrower than one lattice step is shared ground", () => {
    const sliver = [at("9.99", "0"), at("20", "0"), at("20", "10"), at("9.99", "10")];
    expect(sharesGround(polygon(square(0, 0, 10)), polygon(sliver))).toBe(true);
  });

  test("an outline inside another's cut-out shares none of its ground", () => {
    expect(sharesGround(polygon(square(0, 0, 10), [square(2, 2, 4)]), polygon(square(3, 3, 2)))).toBe(false);
    expect(sharesGround(polygon(SLAB_81D, [PIT_830]), polygon(square(9000, -391000, 1000))), "the lift pit, measured apart from the blinding it is cut out of").toBe(false);
    expect(sharesGround(polygon(SLAB_81D, [PIT_830]), polygon(square(0, -400000, 1000)))).toBe(true);
  });

  test("two runs share ground only along a positive length; two sets of points at a point or a counted symbol", () => {
    const run = (points: readonly JudgedPoint[]): MeasuredGeometry => ({ geometry: "POLYLINE", run: points });
    expect(sharesGround(run([at("0", "0"), at("10", "0")]), run([at("5", "0"), at("20", "0")]))).toBe(true);
    expect(sharesGround(run([at("0", "0"), at("10", "0")]), run([at("10", "0"), at("20", "0")])), "end to end").toBe(false);
    expect(sharesGround(run([at("0", "0"), at("10", "0")]), run([at("5", "-5"), at("5", "5")])), "crossing").toBe(false);
    const points = (list: readonly JudgedPoint[]): MeasuredGeometry => ({ geometry: "POINT_SET", points: list });
    expect(sharesGround(points([at("1", "1")]), points([at("1.0", "1")]))).toBe(true);
    expect(sharesGround(points([at("1", "1", ["DXF_HANDLE:9"])]), points([at("2", "2", ["DXF_HANDLE:9"])])), "one counted symbol").toBe(true);
    expect(sharesGround(points([at("1", "1")]), points([at("2", "2")]))).toBe(false);
  });
});

describe(`S1: one cell is measured on one view (I-381) — ${REFUSALS.MANUAL_CELL_OTHER_VIEW.code}`, () => {
  const footprint = (objectKey: string, over: Partial<Footprint> = {}): Footprint => ({
    objectKey,
    elementClass: "slab",
    kinds: ["pcc.blinding"],
    level: "@GF",
    viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
    space: "model",
    geometry: polygon(square(0, 0, 10)),
    ...over,
  });

  test("another view in the same cell refuses, whatever the ground", () => {
    const other = footprint("b", { viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:3000", geometry: polygon(square(500, 500, 10)) });
    expect(collisionOf(footprint("a"), [other])).toEqual({ collision: "other-view", other });
  });

  test("the same view: overlapping ground refuses, disjoint ground stands", () => {
    const over = footprint("b", { geometry: polygon(square(5, 5, 10)) });
    expect(collisionOf(footprint("a"), [over])).toEqual({ collision: "overlap", other: over });
    expect(collisionOf(footprint("a"), [footprint("c", { geometry: polygon(square(10, 0, 10)) })])).toBeNull();
  });

  test("another cell — another kind, class or level — is not this cell's business, and a measurement never collides with itself", () => {
    expect(collisionOf(footprint("a"), [footprint("b", { kinds: ["rcc.concrete"] })])).toBeNull();
    expect(collisionOf(footprint("a"), [footprint("b", { level: "@1F" })])).toBeNull();
    expect(collisionOf(footprint("a"), [footprint("a")])).toBeNull();
  });
});
