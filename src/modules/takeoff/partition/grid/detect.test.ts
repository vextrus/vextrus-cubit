// The rule `detectGrid` reads a bubble by, stated (L-CAD-07: a grid bubble is a circle about a bare
// label).
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

/** The profile that gives this drawing's one layer a role — without one, nothing is a candidate. */
const PROFILE = { roles: { linework: [LAYER], outlines: [LAYER], text: [LAYER], dimensions: [LAYER] }, captionGrammars: [], deferrals: [] } as unknown as ConventionProfile;

const CHANNELS = { rgb: [0, 0, 0], source: "explicit" };

/** One label of the drawing, drawn at the centre of the ring that rings it. */
function label(key: string, said: string, x: number): Record<string, unknown> {
  return { key, type: "TEXT", space: "Model", layer: LAYER, colour: CHANNELS, text: said, height: 1, points: [[x, 0]] };
}

/** A closed ring of six vertices about a centre, whose radii spread by `spread` of their own mean. */
function ringSpreading(key: string, x: number, radius: number, spread: number): Record<string, unknown> {
  const points = [0, 1, 2, 3, 4, 5].map((index) => {
    const angle = (2 * Math.PI * index) / 6;
    const own = radius * (1 + (index % 2 === 0 ? spread / 2 : -spread / 2));
    return [x + own * Math.cos(angle), own * Math.sin(angle)];
  });
  return { key, type: "LWPOLYLINE", space: "Model", layer: LAYER, colour: CHANNELS, points, closed: true, area: Math.PI * radius * radius };
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

/** The labels the grid stage georeferenced out of these entities. */
function labelsOf(entities: readonly Record<string, unknown>[]): string[] {
  const answer = detectGrid({
    graph: { entities } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "GROUND FLOOR PLAN", anchorKey: null } as PartitionedView],
    assignments: new Map(entities.map((entity) => [entity["key"] as string, VIEW_KEY])),
    profile: PROFILE,
  });
  return answer.axes.map((row) => row.label).sort();
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
