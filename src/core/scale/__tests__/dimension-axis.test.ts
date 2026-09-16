/**
 * AC-2(f) [debt-src-core-6ipllq] — a dimension that reaches equally far along both axes measures
 * neither.
 *
 * L-MEA-05 has the machine propose a factor per axis, each from its own evidence, and a rank whose
 * evidence covers only one axis is ABSENT rather than resolved (fail-closed, L-QTY-04). The
 * measurement axis of a DIMENSION is "the one its non-text paint reaches further along" — and where
 * the paint reaches exactly as far along both, there is no further. `extent.x >= extent.y` answers
 * AXIS_X anyway, so a square-extent dimension is silently filed as an x measurement and a factor is
 * proposed off evidence that names no axis at all.
 *
 * Driven at the shipped reader over a handmade graph: a DIMENSION original carries no points of its
 * own, its paint arrives as derived records naming it as `src`, and one of those records is the
 * measurement text (L-CAD-03). Three graphs differing only in how far the paint reaches, so the
 * extent is the one thing each case is about.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "../../entitygraph/schema";
import { readDimensions } from "../proposals";

/** The colour every record of these graphs carries — a fact about paint, and the same for all of them. */
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "LAYER" };

/** The one entity type this reader is about, spelled as `cad/` emits it (L-CAD-03). */
const DIMENSION = "DIMENSION";

/** The key of the dimension every case reads, and the number its one measurement text states. */
const DIMENSION_KEY = "DXF_HANDLE:2A0";
const STATED = "3000";

/**
 * A graph holding one DIMENSION original, its measurement text, and a run of geometry reaching
 * `reachX` along x and `reachY` along y. `readDimensions` reads `entities` and `derived` and nothing
 * else of the artifact, so the rest of the envelope is not built.
 */
function graphWithExtent(reachX: number, reachY: number): EntityGraph {
  const paint = { type: "LINE", space: "Model", layer: "DIM", colour: COLOUR };
  return {
    entities: [{ key: DIMENSION_KEY, type: DIMENSION, space: "Model", layer: "DIM", colour: COLOUR }],
    derived: [
      { src: DIMENSION_KEY, ...paint, points: [[0, 0] as [number, number], [reachX, reachY] as [number, number]] },
      { src: DIMENSION_KEY, ...paint, type: "MTEXT", text: STATED, height: 2.5, points: [[reachX / 2, reachY / 2] as [number, number]] },
    ],
  } as unknown as EntityGraph;
}

/** Nothing is assigned: which view a dimension measures in is not what this criterion is about. */
const NO_ASSIGNMENTS: ReadonlyMap<string, string> = new Map();

describe("a dimension states a measurement only along the axis its paint reaches further", () => {
  test("AC-2(f): paint reaching equally far along both axes yields no reading at all", () => {
    expect(
      readDimensions(graphWithExtent(400, 400), NO_ASSIGNMENTS),
      "a square extent names no axis, and a reading filed under an axis it does not measure proposes a factor off evidence that says nothing (L-MEA-05, L-QTY-04)",
    ).toEqual([]);
  });

  test("AC-2(f): a wider-than-tall extent still reads along x", () => {
    const readings = readDimensions(graphWithExtent(400, 100), NO_ASSIGNMENTS);
    expect(readings.length, "paint that reaches further along x measures along x").toBe(1);
    expect(readings[0]?.axis).toBe("x");
    expect(readings[0]?.span, "the span is the raw extent of the paint along the axis it measures").toBe(400);
    expect(readings[0]?.stated, "and the number it states is the one measurement text it carries").toBe(STATED);
  });

  test("AC-2(f): a taller-than-wide extent still reads along y", () => {
    const readings = readDimensions(graphWithExtent(100, 400), NO_ASSIGNMENTS);
    expect(readings.length, "paint that reaches further along y measures along y").toBe(1);
    expect(readings[0]?.axis).toBe("y");
    expect(readings[0]?.span).toBe(400);
  });
});
