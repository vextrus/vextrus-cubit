/**
 * I-295b — a dimension's span is what it MEASURES, not what it paints (L-MEA-05 rank 3, "the style
 * factor divided out").
 *
 * `cad/` emits a dimension as an original carrying no points, whose paint names it as `src`
 * (L-CAD-03): the extension lines, the arrowheads, the dimension line, the measurement text — and
 * the definition points the draughtsman picked, as POINT records on the reserved layer. The paint
 * OVERSHOOTS what the dimension measures by a fixed amount of style (the extension-line offset and
 * the arrowhead run), so the ratio a raw paint extent leaves falls with the length measured, and two
 * true readings of one drawing disagree by a per cent or more purely because one dimension is
 * shorter than the other. The definition points do not: they are the two points the length was
 * measured between.
 *
 * A dimension whose paint carries no definition points is read exactly as it always was, off the raw
 * extent of its paint — this engine measures what the drawing gives it and invents nothing where the
 * drawing gave less.
 *
 * Driven at the shipped reader and the shipped `proposalsFor` over handmade graphs shaped like
 * F-RCC6-BNBC's own dimensions (a 450-unit dimension painted from -18 to 468, its definition points
 * at 0 and 450). Pure: no store, no drawing on disk.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "../../entitygraph/schema";
import { proposalsFor, readDimensions, type ScaleEvidence, type StatedLength } from "../proposals";

/** The colour every record of these graphs carries — a fact about paint, and the same for all of them. */
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "LAYER" };

/** The layer a dimension's definition points are drawn on, in the two spellings a file writes it. */
const DEFPOINTS = "Defpoints";
const DEFPOINTS_SHOUTED = "DEFPOINTS";

/** The view every case asks about, and the dimensions it is drawn with. */
const VIEW = "LAYOUT_PLAN:DXF_HANDLE:1A";
const ACROSS = "DXF_HANDLE:2A0";
const DOWN = "DXF_HANDLE:2A1";

/** The seed edition's own ratios, so a case is judged the way a project would judge it (L-MEA-01). */
const TOLERANCES = { verification: "0.01", anisotropy: "0.01" };

/** One millimetre per drawing unit, as the engine renders a factor (L-MEA-05: 12 places, half-even). */
const ONE_MM = "0.001000000000";

/**
 * How far a dimension's style reaches past each end of what it measures, on this drawing: 66 units
 * of extension line and arrowhead at either end, which is F-RCC6-BNBC's own 132 units end to end.
 */
const OVERSHOOT = 66;

/** One dimension of a case: where it measures from and to, what it says, and how it is drawn. */
type Dimension = {
  readonly key: string;
  readonly axis: "x" | "y";
  readonly from: number;
  readonly to: number;
  readonly text: string;
  /** The layer its definition points stand on, or null where the drawing carries none at all. */
  readonly defpoints: string | null;
};

/**
 * A graph of the given dimensions, each drawn as a real one is: two extension lines and a dimension
 * line reaching `OVERSHOOT` past both ends of what it measures, the measurement text, and — where
 * the drawing carries them — the definition points at the two ends themselves, plus the dimension
 * line's own location point offset to one side (which is what makes a raw extent of the definition
 * points reach along the OTHER axis too).
 */
function graphOf(unit: string | null, dimensions: readonly Dimension[]): EntityGraph {
  const paint = { space: "Model", layer: "DIM", colour: COLOUR };
  return {
    insunits: { code: unit === "mm" ? 4 : 0, unit, unmapped: false },
    entities: dimensions.map((dimension) => ({ key: dimension.key, type: "DIMENSION", ...paint, points: [[0, 0] as [number, number]] })),
    derived: dimensions.flatMap((dimension) => {
      const at = (along: number, across: number): [number, number] => (dimension.axis === "x" ? [along, across] : [across, along]);
      const offset = -300;
      const records: Record<string, unknown>[] = [
        { src: dimension.key, type: "LINE", ...paint, points: [at(dimension.from - OVERSHOOT, 0), at(dimension.from - OVERSHOOT, offset)] },
        { src: dimension.key, type: "LINE", ...paint, points: [at(dimension.to + OVERSHOOT, 0), at(dimension.to + OVERSHOOT, offset)] },
        { src: dimension.key, type: "LINE", ...paint, points: [at(dimension.from - OVERSHOOT, offset), at(dimension.to + OVERSHOOT, offset)] },
        { src: dimension.key, type: "MTEXT", ...paint, text: dimension.text, height: 2.5, points: [at((dimension.from + dimension.to) / 2, offset)] },
      ];
      if (dimension.defpoints !== null) {
        for (const point of [at(dimension.from, 0), at(dimension.to, 0), at(dimension.from, offset)]) {
          records.push({ src: dimension.key, type: "POINT", space: "Model", layer: dimension.defpoints, colour: COLOUR, points: [point] });
        }
      }
      return records;
    }),
  } as unknown as EntityGraph;
}

/** Every dimension of a case stands in the one view, so a proposal has a view to stand on. */
function evidenceOf(unit: string | null, dimensions: readonly Dimension[], stated: ReadonlyMap<string, StatedLength>): ScaleEvidence {
  return {
    graph: graphOf(unit, dimensions),
    viewKeys: [VIEW],
    assignments: new Map(dimensions.map((dimension) => [dimension.key, VIEW])),
    grid: [],
    unit,
    statedMetres: stated,
    tolerances: TOLERANCES,
  };
}

/** Fifteen feet and nine feet as the drawing's own grammar reads them (tests/takeoff/scale/stated-lengths.test.ts). */
const FIFTEEN_FEET = { text: `15'-0"`, metres: "4.572" } satisfies StatedLength;
const NINE_FEET = { text: `9'-0"`, metres: "2.7432" } satisfies StatedLength;

describe("I-295b: the span a factor is divided by is the span the dimension measures", () => {
  test("a dimension carrying definition points spans between THEM, not between the ends of its paint", () => {
    const readings = readDimensions(graphOf("mm", [{ key: ACROSS, axis: "x", from: 0, to: 450, text: "450", defpoints: DEFPOINTS }]), new Map([[ACROSS, VIEW]]));

    expect(readings.length, "the dimension states a number over a span, so it is read").toBe(1);
    expect(readings[0]?.axis, "and its paint reaches further along x, so x is what it measures along").toBe("x");
    expect(readings[0]?.span, "450 units between the definition points — not the 582 its extension lines and arrowheads paint").toBe(450);
    expect(readings[0]?.ratio, "so what the number leaves over the span is exactly one, and the header is what carries it into metres").toBe("1");
  });

  test("the reserved layer is read however the file spells it", () => {
    const readings = readDimensions(graphOf("mm", [{ key: ACROSS, axis: "x", from: 0, to: 450, text: "450", defpoints: DEFPOINTS_SHOUTED }]), new Map([[ACROSS, VIEW]]));

    expect(readings[0]?.span, "which of two spellings of the reserved layer a draughtsman's file carries says nothing about what the dimension measures").toBe(450);
  });

  test("a dimension carrying none is read off its paint, exactly as it always was", () => {
    const readings = readDimensions(graphOf("mm", [{ key: ACROSS, axis: "x", from: 0, to: 450, text: "450", defpoints: null }]), new Map([[ACROSS, VIEW]]));

    expect(readings[0]?.span, "582 units end to end of its paint: this engine measures what the drawing gives it and invents nothing where the drawing gave less").toBe(582);
  });

  test("two feet-and-inches dimensions of different lengths agree exactly once each is measured between its own definition points", () => {
    const drawn: readonly Dimension[] = [
      { key: ACROSS, axis: "x", from: 0, to: 4572, text: FIFTEEN_FEET.text, defpoints: DEFPOINTS },
      { key: DOWN, axis: "y", from: 0, to: 2743.2, text: NINE_FEET.text, defpoints: DEFPOINTS },
    ];
    const stated: ReadonlyMap<string, StatedLength> = new Map([
      [ACROSS, FIFTEEN_FEET],
      [DOWN, NINE_FEET],
    ]);

    const offered = proposalsFor(evidenceOf("unitless", drawn, stated)).get(VIEW) ?? [];

    expect(offered.map((proposal) => proposal.rank), "the drawing's own words carry rank 3 on a header that names no unit (I-295)").toEqual(["DIMENSION_RATIO"]);
    expect([offered[0]?.factorX, offered[0]?.factorY], "fifteen feet over 4572 and nine feet over 2743.2 are one millimetre a unit — the style they are painted with is not measurement").toEqual([
      ONE_MM,
      ONE_MM,
    ]);

    // The same drawing with no definition points anywhere, and a second dimension along x: the style
    // rides in each span, so the two x readings fall apart with their lengths — 4.572 over 4704 is
    // 0.000971938776 and 2.7432 over 2875.2 is 0.000954089857, the very figures F-RCC6-BNBC reads —
    // and the axis is absent for want of agreement. This is the reading I-295b replaced, kept here so
    // the reason for it is provable rather than asserted.
    const painted: readonly Dimension[] = [
      { key: ACROSS, axis: "x", from: 0, to: 4572, text: FIFTEEN_FEET.text, defpoints: null },
      { key: "DXF_HANDLE:2A2", axis: "x", from: 0, to: 2743.2, text: NINE_FEET.text, defpoints: null },
      { key: DOWN, axis: "y", from: 0, to: 2743.2, text: NINE_FEET.text, defpoints: null },
    ];
    const statedPainted: ReadonlyMap<string, StatedLength> = new Map([
      [ACROSS, FIFTEEN_FEET],
      ["DXF_HANDLE:2A2", NINE_FEET],
      [DOWN, NINE_FEET],
    ]);
    const readings = readDimensions(graphOf("unitless", painted), new Map(painted.map((dimension) => [dimension.key, VIEW])), statedPainted);
    expect(readings.map((reading) => reading.span), "each span carries its dimension's style: 132 units of it, whatever the length measured").toEqual([4704, 2875.2, 2875.2]);
    expect(
      proposalsFor(evidenceOf("unitless", painted, statedPainted)).get(VIEW) ?? [],
      "1.836 per cent apart on x, with y standing perfectly well: an axis whose only two readings disagree is absent rather than resolved (L-QTY-04)",
    ).toEqual([]);
  });
});
