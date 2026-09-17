/**
 * AC-1(d): the rule `detectGrid` reads a bubble by, stated (debt-src-modules-w7ymiu, L-CAD-07).
 *
 * The tolerance is the product's own — imported, never spelled here — and each ring is drawn to a
 * spread stated as a share of it: half of it for the ring that must read as a bubble, four times it
 * for the one that must not. A tolerance loosened or tightened later moves the rings with it, which
 * is what makes this a statement of the rule rather than of today's number (B-19).
 */
import { describe, expect, test } from "vitest";
import { LAYER, MODULE, VIEW, assignedTo, graphOf, handle, polygon, productModule, ring, text, view, type Entity, type Point } from "./support/sweep-stage";

/** One georeferenced bubble, as the grid stage answers one. */
type AxisRow = { label: string; family: string; bubbleKey: string; labelKey: string };

type Detected = { views: number; axes: readonly AxisRow[]; deferrals: readonly { viewKey: string; reason: string }[] };

type Detector = (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string>; profile: unknown }) => Detected;

const VIEW_KEY = "PLAN:1";

/** The profile that gives this drawing's one layer a role — without one, nothing is a candidate. */
const PROFILE = { roles: { linework: [LAYER], outlines: [LAYER], text: [LAYER], dimensions: [LAYER] }, captionGrammars: [], deferrals: [] };

/** The grid stage's door, with the constant the criterion asks it to publish. */
async function gridDoor(): Promise<{ detectGrid: Detector; tolerance: number }> {
  const door = await productModule<Record<string, unknown>>(MODULE.detect);
  expect(typeof door["detectGrid"], `${MODULE.detect} publishes \`detectGrid\``).toBe("function");
  const tolerance = door["ROUNDNESS_TOLERANCE"];
  expect(typeof tolerance, `${MODULE.detect} EXPORTS \`ROUNDNESS_TOLERANCE\` — the rule a bubble is read by, stated where a reader and a test can both see it (interfaces)`).toBe("number");
  expect(tolerance as number, "and it is a share of a radius, so it stands above nothing and below everything").toBeGreaterThan(0);
  return { detectGrid: door["detectGrid"] as Detector, tolerance: tolerance as number };
}

/** A ring of six vertices about a centre, whose radii spread by `spread` of their own mean. */
function ringSpreading(key: string, centre: Point, radius: number, spread: number): Entity {
  const radii = [0, 1, 2, 3, 4, 5].map((index) => radius * (1 + (index % 2 === 0 ? spread / 2 : -spread / 2)));
  return ring(key, polygon(centre, radii), { area: Math.PI * radius * radius });
}

/** A rectangle drawn through its corners AND its edge midpoints — eight vertices, and no circle. */
function rectangle(key: string, centre: Point, half: number): Entity {
  const points: Point[] = [
    [centre[0] - half, centre[1] - half],
    [centre[0], centre[1] - half],
    [centre[0] + half, centre[1] - half],
    [centre[0] + half, centre[1]],
    [centre[0] + half, centre[1] + half],
    [centre[0], centre[1] + half],
    [centre[0] - half, centre[1] + half],
    [centre[0] - half, centre[1]],
  ];
  return ring(key, points, { area: 4 * half * half });
}

describe("AC-1: what `detectGrid` reads as a bubble, and what it does not", () => {
  test("AC-1: a ring whose vertices stand an equal radius apart is a bubble; one spreading past the tolerance, and a rectangle, are not", async () => {
    const { detectGrid, tolerance } = await gridDoor();

    // Two round rings, so the family spreads and the view georeferences at all; one ring spreading
    // four tolerances, and one true rectangle, each drawn about a label of the same family.
    const labels: { label: string; at: Point; reads: boolean }[] = [
      { label: "A", at: [0, 0], reads: true },
      { label: "B", at: [1000, 0], reads: true },
      { label: "C", at: [2000, 0], reads: false },
      { label: "D", at: [3000, 0], reads: false },
    ];
    const entities: Entity[] = [];
    labels.forEach((one, index) => {
      entities.push(text(handle(0x10 + index), one.label, one.at));
      if (one.label === "D") entities.push(rectangle(handle(0x20 + index), one.at, 50));
      else entities.push(ringSpreading(handle(0x20 + index), one.at, 50, one.label === "C" ? tolerance * 4 : tolerance / 2));
    });

    const answer = detectGrid({
      graph: graphOf(entities),
      views: [view({ viewKey: VIEW_KEY, type: VIEW.LAYOUT_PLAN, caption: "GROUND FLOOR PLAN", anchorKey: null })],
      assignments: assignedTo(VIEW_KEY, entities),
      profile: PROFILE,
    });

    expect(
      [...answer.axes].map((row) => row.label).sort(),
      `a ring reads as a bubble exactly where its vertex radii spread by LESS than ROUNDNESS_TOLERANCE (${String(tolerance)}) of their own mean: the two rings drawn half a tolerance apart are bubbles, the one drawn four tolerances apart is not, and a rectangle — whose corners stand a sixth further out than its edges — is not (L-CAD-07 asks for a circle)`,
    ).toEqual(labels.filter((one) => one.reads).map((one) => one.label));
  });
});
