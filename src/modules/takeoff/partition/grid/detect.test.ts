// The rule `detectGrid` reads a bubble by, stated (L-CAD-07: a grid bubble is a circle about a bare
// label) — drawn the two ways a drawing draws it: as a ring and a text standing in model space, and
// as ONE block instance whose paint is the ring and whose attribute is the label (L-CAD-03).
//
// Every ring is drawn to a spread stated as a share of the product's own tolerance, so a tolerance
// moved later moves the rings with it: what is graded is the rule, never today's number (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { ConventionProfile } from "@/core/rulesets/methods/conventions/resolve";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { ROUNDNESS_TOLERANCE, detectGrid } from "./detect";

const VIEW_KEY = "PLAN:1";
const LAYER = "S-GRID";
const MODEL_SPACE = "Model";
const PAPER_SPACE = "S-13";

/** The profile that gives this drawing's one layer a role — without one, nothing is a candidate. */
const PROFILE = { roles: { linework: [LAYER], outlines: [LAYER], text: [LAYER], dimensions: [LAYER] }, captionGrammars: [], deferrals: [] } as unknown as ConventionProfile;

const CHANNELS = { rgb: [0, 0, 0], source: "explicit" };

/** One label of the drawing, drawn at the centre of the ring that rings it. */
function label(key: string, said: string, x: number): Record<string, unknown> {
  return { key, type: "TEXT", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, text: said, height: 1, points: [[x, 0]] };
}

/** Six vertices about a centre, whose radii spread by `spread` of their own mean. */
function roundPoints(x: number, radius: number, spread: number): number[][] {
  return [0, 1, 2, 3, 4, 5].map((index) => {
    const angle = (2 * Math.PI * index) / 6;
    const own = radius * (1 + (index % 2 === 0 ? spread / 2 : -spread / 2));
    return [x + own * Math.cos(angle), own * Math.sin(angle)];
  });
}

/** A closed ring of six vertices about a centre, whose radii spread by `spread` of their own mean. */
function ringSpreading(key: string, x: number, radius: number, spread: number): Record<string, unknown> {
  const points = roundPoints(x, radius, spread);
  return { key, type: "LWPOLYLINE", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, points, closed: true, area: Math.PI * radius * radius };
}

/**
 * A block instance: an original that carries no geometry of its own, because what it draws is its
 * paint and what it says is its attributes (L-CAD-03).
 */
function instance(key: string, space: string = MODEL_SPACE): Record<string, unknown> {
  return { key, type: "INSERT", space, layer: LAYER, colour: CHANNELS };
}

/** A closed round ring an instance painted, carried by the instance it came out of. */
function paintedRing(src: string, x: number, radius: number, space: string = MODEL_SPACE): Record<string, unknown> {
  const points = roundPoints(x, radius, 0);
  return { src, type: "CIRCLE", space, layer: LAYER, colour: CHANNELS, points, closed: true, area: Math.PI * radius * radius };
}

/** A text an instance PAINTED — block geometry, which is a picture of a label and not one. */
function paintedText(src: string, said: string, x: number): Record<string, unknown> {
  return { src, type: "TEXT", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, text: said, height: 1, points: [[x, 0]] };
}

/** One attribute row an instance carries: the slot it was said in, and what it says. */
function attribute(src: string, tag: string, said: string): Record<string, unknown> {
  return { src, tag, text: said, height: 1 };
}

/** A rectangle drawn through its corners AND its edge midpoints — eight vertices, and no circle. */
function rectangle(key: string, x: number, half: number): Record<string, unknown> {
  const points = [
    [x - half, -half],
    [x, -half],
    [x + half, -half],
    [x + half, 0],
    [x + half, half],
    [x, half],
    [x - half, half],
    [x - half, 0],
  ];
  return { key, type: "LWPOLYLINE", space: "Model", layer: LAYER, colour: CHANNELS, points, closed: true, area: 4 * half * half };
}

/** What an artifact carries beside its originals: what they painted, and what they say (L-CAD-03). */
type Block = { derived?: readonly Record<string, unknown>[]; attributes?: readonly Record<string, unknown>[] };

/**
 * The grid stage's reading of a drawing whose model space holds these records. Only the MODEL-space
 * originals are assigned to the view, because L-CAD-06 partitions model space and a paper layout's
 * furniture is assigned to nothing — which is the only thing that stands between this stage and a
 * key plan drawn on a title sheet.
 */
function detected(entities: readonly Record<string, unknown>[], block: Block = {}): ReturnType<typeof detectGrid> {
  return detectGrid({
    graph: { entities, derived: block.derived ?? [], block_attributes: block.attributes ?? [] } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "GROUND FLOOR PLAN", anchorKey: null } as PartitionedView],
    assignments: new Map(entities.filter((entity) => entity["space"] === MODEL_SPACE).map((entity) => [entity["key"] as string, VIEW_KEY])),
    profile: PROFILE,
  });
}

/** The labels the grid stage georeferenced out of these entities. */
function labelsOf(entities: readonly Record<string, unknown>[], block: Block = {}): string[] {
  return detected(entities, block)
    .axes.map((row) => row.label)
    .sort();
}

describe("L-CAD-07: what reads as a grid bubble", () => {
  test("a ring whose vertex radii spread by less than the tolerance is a bubble; one spreading past it is not", () => {
    expect(ROUNDNESS_TOLERANCE, "the tolerance is a share of a radius, so it stands above nothing and below everything").toBeGreaterThan(0);

    const entities = [
      label("t:1", "A", 0),
      ringSpreading("r:1", 0, 50, ROUNDNESS_TOLERANCE / 2),
      label("t:2", "B", 1000),
      ringSpreading("r:2", 1000, 50, ROUNDNESS_TOLERANCE / 2),
      label("t:3", "C", 2000),
      ringSpreading("r:3", 2000, 50, ROUNDNESS_TOLERANCE * 4),
    ];

    expect(
      labelsOf(entities),
      "a flattened circle crosses the seam as a polygon whose vertices stand a cosine apart from exact (L-CAD-02), and that is all the spread a bubble is allowed",
    ).toEqual(["A", "B"]);
  });

  test("a true rectangle is no bubble, however many vertices it carries", () => {
    const entities = [
      label("t:1", "A", 0),
      ringSpreading("r:1", 0, 50, ROUNDNESS_TOLERANCE / 2),
      label("t:2", "B", 1000),
      ringSpreading("r:2", 1000, 50, ROUNDNESS_TOLERANCE / 2),
      label("t:3", "C", 2000),
      rectangle("r:3", 2000, 50),
    ];

    expect(labelsOf(entities), "a rectangle's corners stand a sixth further out than its edge midpoints — two orders of magnitude clear of the tolerance").toEqual(["A", "B"]);
  });
});

/**
 * The two lawful block-drawn bubbles every case below is read beside: one instance, the one ring it
 * paints, the one attribute it carries. They stand 1000 apart, so the pair georeferences a spacing
 * and a third instance that reads as a bubble would be visible in the answer.
 *
 * The two carry DIFFERENT tags on purpose. A content signature is what a text says, and what a block
 * calls the slot it says it in is a name — the one thing L-CAD-07 forbids reading a grid off.
 */
const LAWFUL = {
  entities: [instance("i:1"), instance("i:2")],
  derived: [paintedRing("i:1", 0, 50), paintedRing("i:2", 1000, 50)],
  attributes: [attribute("i:1", "GRID", "1"), attribute("i:2", "MARK", "2")],
};

/** The lawful pair, with one more instance drawn beside it. */
function beside(entities: readonly Record<string, unknown>[], derived: readonly Record<string, unknown>[], attributes: readonly Record<string, unknown>[]): string[] {
  return labelsOf([...LAWFUL.entities, ...entities], { derived: [...LAWFUL.derived, ...derived], attributes: [...LAWFUL.attributes, ...attributes] });
}

describe("L-CAD-07, L-CAD-03: the bubble a drawing draws as one block", () => {
  test("an instance whose paint holds one round ring and whose attributes hold one bare label is a bubble, keyed by the instance", () => {
    const answer = detected(LAWFUL.entities, { derived: LAWFUL.derived, attributes: LAWFUL.attributes });

    expect(answer.axes.map((row) => row.label).sort(), "the ring came out of the instance and the label is the instance's own attribute — a tighter bond than standing inside a circle").toEqual([
      "1",
      "2",
    ]);
    expect(answer.deferrals, "a view that georeferenced is not also a view that deferred").toEqual([]);

    const first = answer.axes.find((row) => row.label === "1");
    expect(first?.bubbleKey, "L-CAD-03: an original entity is the only thing a source key names, and neither the paint nor the attribute row is one").toBe("i:1");
    expect(first?.labelKey, "the label was read off the instance itself, so the ring and the label cite the same atom").toBe("i:1");
    expect(first?.family).toBe("numeral");
    expect(first?.axis, "the two bubbles spread along x, so the numerals georeference along x").toBe("x");
    expect(first?.position ?? Number.NaN, "the bubble is centred on the ring its block painted, not on the instance's own (absent) geometry").toBeCloseTo(0, 6);
    expect(first?.minSpacing ?? Number.NaN, "the spacing is between the two painted ring centres").toBeCloseTo(1000, 6);
  });

  test("an attribute saying a paired mark is no grid label, whatever slot it was said in", () => {
    const labels = beside([instance("i:3")], [paintedRing("i:3", 2000, 50)], [attribute("i:3", "GRID", "C-4")]);

    expect(labels, "`C-4` normalises to neither a bare letter nor a bare numeral, and a tag called GRID does not make it one").toEqual(["1", "2"]);
  });

  test("a label the block PAINTS is a picture of a label, and georeferences nothing", () => {
    const labels = beside([instance("i:3")], [paintedRing("i:3", 2000, 50), paintedText("i:3", "3", 2000)], []);

    expect(labels, "a key plan paints its letters: a block whose only label is its own geometry has drawn a picture of a grid, and a picture is no evidence (L-QTY-04)").toEqual(["1", "2"]);
  });

  test("an instance standing in no view is no bubble", () => {
    const labels = beside([instance("i:3", PAPER_SPACE)], [paintedRing("i:3", 2000, 50, PAPER_SPACE)], [attribute("i:3", "GRID", "3")]);

    expect(labels, "L-CAD-06 partitions MODEL space, so a sheet's own furniture is assigned to nothing and is evidence for nothing").toEqual(["1", "2"]);
  });

  test("two attribute rows say two things, and choosing between them would be a guess", () => {
    const labels = beside([instance("i:3")], [paintedRing("i:3", 2000, 50)], [attribute("i:3", "GRID", "3"), attribute("i:3", "SUFFIX", "4")]);

    expect(labels, "the same `exactly one` the geometric reading asks of the texts inside a ring: a thing that says two labels names no axis").toEqual(["1", "2"]);
  });

  test("an instance painting two round rings is no bubble either", () => {
    const labels = beside([instance("i:3")], [paintedRing("i:3", 2000, 50), paintedRing("i:3", 2000, 90)], [attribute("i:3", "GRID", "3")]);

    expect(labels, "which of the two circles the letter is in is a choice the drawing did not make").toEqual(["1", "2"]);
  });
});
