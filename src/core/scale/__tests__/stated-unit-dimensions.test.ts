/**
 * I-295 — a dimension whose measurement text states its OWN unit is evidence of the ratio whether or
 * not the header names one (L-MEA-05's rank 3 on `$INSUNITS = 0`, T-INSUNITS-0).
 *
 * The strict unit lane says "unknown or unmapped unit ⇒ null, never a guessed scale". A text reading
 * `15'-0"` guesses nothing: it STATES fifteen feet, and fifteen feet over the span the paint covers
 * is metres per drawing unit — the same arithmetic rank 3 always did, with the text carrying the
 * unit the header withheld. A bare `4572` on the same header still states no length at all and must
 * still propose nothing, and a mapped header must read exactly as it read before.
 *
 * Driven at the shipped `proposalsFor` over handmade graphs: a DIMENSION original whose paint
 * arrives as derived records naming it as `src` (L-CAD-03), one of them the measurement text. The
 * metres a text states are handed in already parsed, because the notation grammar that reads
 * `15'-0"` is a module's and core may not reach one (ARCH-01) — `statedLengthsOf` is proved against
 * the same words in `tests/takeoff/scale/stated-lengths.test.ts`.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "../../entitygraph/schema";
import { proposalsFor, type GridReading, type ScaleEvidence, type StatedLength } from "../proposals";

/** The colour every record of these graphs carries — a fact about paint, and the same for all of them. */
const COLOUR = { rgb: [0, 0, 0] as [number, number, number], source: "LAYER" };

/** The one view every case asks about, and the two dimensions it is drawn with. */
const VIEW = "LAYOUT_PLAN:DXF_HANDLE:1A";
const ACROSS = "DXF_HANDLE:2A0";
const DOWN = "DXF_HANDLE:2A1";

/** The seed edition's own ratios, so a case is judged the way a project would judge it (L-MEA-01). */
const TOLERANCES = { verification: "0.01", anisotropy: "0.01" };

/** Fifteen feet and nine feet, in metres and in the drawing's own units at 1 unit = 1 mm. */
const FIFTEEN_FEET = { text: `15'-0"`, metres: "4.572" } satisfies StatedLength;
const NINE_FEET = { text: `9'-0"`, metres: "2.7432" } satisfies StatedLength;
const ACROSS_SPAN = 4572;
const DOWN_SPAN = 2743.2;

/** One millimetre per drawing unit, as the engine renders a factor (L-MEA-05: 12 places, half-even). */
const ONE_MM = "0.001000000000";

/** One dimension of a case: which entity, along which axis, how far its paint reaches, what it says. */
type Dimension = { readonly key: string; readonly axis: "x" | "y"; readonly span: number; readonly text: string };

/**
 * A graph holding the given dimensions, each an original standing at the origin of its own row with
 * its paint — one run of geometry along its axis and one measurement text — naming it as `src`.
 */
function graphOf(unit: string | null, dimensions: readonly Dimension[]): EntityGraph {
  const paint = { type: "LINE", space: "Model", layer: "DIM", colour: COLOUR };
  return {
    insunits: { code: unit === "mm" ? 4 : 0, unit, unmapped: false },
    entities: dimensions.map((dimension) => ({ key: dimension.key, type: "DIMENSION", space: "Model", layer: "DIM", colour: COLOUR, points: [[0, 0] as [number, number]] })),
    derived: dimensions.flatMap((dimension) => {
      const reach: [number, number] = dimension.axis === "x" ? [dimension.span, 0] : [0, dimension.span];
      return [
        { src: dimension.key, ...paint, points: [[0, 0] as [number, number], reach] },
        { src: dimension.key, ...paint, type: "MTEXT", text: dimension.text, height: 2.5, points: [[reach[0] / 2, reach[1] / 2] as [number, number]] },
      ];
    }),
  } as unknown as EntityGraph;
}

/** The evidence of one such drawing: every dimension assigned to the one view, and what its texts state. */
function evidenceOf(unit: string | null, dimensions: readonly Dimension[], stated: ReadonlyMap<string, StatedLength>, grid: readonly GridReading[] = []): ScaleEvidence {
  return {
    graph: graphOf(unit, dimensions),
    viewKeys: [VIEW],
    assignments: new Map(dimensions.map((dimension) => [dimension.key, VIEW])),
    grid,
    unit,
    statedMetres: stated,
    tolerances: TOLERANCES,
  };
}

/** The two dimensions a plan of this drawing is dimensioned with, in feet and inches. */
const FEET_AND_INCHES: readonly Dimension[] = [
  { key: ACROSS, axis: "x", span: ACROSS_SPAN, text: FIFTEEN_FEET.text },
  { key: DOWN, axis: "y", span: DOWN_SPAN, text: NINE_FEET.text },
];

/** The same two dimensions with the same lengths written as bare numbers, stating no unit at all. */
const BARE_NUMBERS: readonly Dimension[] = [
  { key: ACROSS, axis: "x", span: ACROSS_SPAN, text: String(ACROSS_SPAN) },
  { key: DOWN, axis: "y", span: DOWN_SPAN, text: String(DOWN_SPAN) },
];

/** What those texts state, as the drawing's own notation grammar reads them. */
const STATED: ReadonlyMap<string, StatedLength> = new Map([
  [ACROSS, FIFTEEN_FEET],
  [DOWN, NINE_FEET],
]);

describe("I-295: a text that states its own unit is read on a header that states none", () => {
  test("two feet-and-inches dimensions on a unitless header propose DIMENSION_RATIO at one millimetre per unit, citing both", () => {
    const offered = proposalsFor(evidenceOf("unitless", FEET_AND_INCHES, STATED)).get(VIEW) ?? [];

    expect(
      offered.map((proposal) => proposal.rank),
      "the drawing's own words carry rank 3; the header carries nothing, so rank 4 is still absent and no unit is invented for the file",
    ).toEqual(["DIMENSION_RATIO"]);
    const ratio = offered[0];
    expect(ratio?.factorX, "fifteen feet over 4572 drawn units is a millimetre a unit, whatever $INSUNITS said").toBe(ONE_MM);
    expect(ratio?.factorY, "and nine feet over 2743.2 says the same along y, derived independently").toBe(ONE_MM);
    expect(ratio?.evidence, "the disclosure is the proposal's own evidence: the dimensions it was read off (L-CAD-03)").toEqual([ACROSS, DOWN]);
    expect(ratio?.placeable, "one millimetre along both axes is isotropic").toBe(true);
  });

  test("a grid gap matching such a dimension carries GRID_SPACING too, ahead of it in precedence", () => {
    const grid: readonly GridReading[] = [
      { viewKey: VIEW, axis: "x", position: 0, bubbleKey: "DXF_HANDLE:3A0" },
      { viewKey: VIEW, axis: "x", position: ACROSS_SPAN, bubbleKey: "DXF_HANDLE:3A1" },
      { viewKey: VIEW, axis: "y", position: 0, bubbleKey: "DXF_HANDLE:3B0" },
      { viewKey: VIEW, axis: "y", position: DOWN_SPAN, bubbleKey: "DXF_HANDLE:3B1" },
    ];
    const offered = proposalsFor(evidenceOf("unitless", FEET_AND_INCHES, STATED, grid)).get(VIEW) ?? [];

    expect(offered.map((proposal) => proposal.rank), "a gap the drawing dimensioned is the stronger rank, and the list is in the law's precedence").toEqual(["GRID_SPACING", "DIMENSION_RATIO"]);
    expect(offered[0]?.factorX, "the matched dimension is read the same way at either rank").toBe(ONE_MM);
    expect(offered[0]?.factorY).toBe(ONE_MM);
    expect(offered[0]?.evidence, "and rank 2 cites the bubbles at both ends of each gap as well as the dimension").toEqual(["DXF_HANDLE:3A0", "DXF_HANDLE:3A1", ACROSS, "DXF_HANDLE:3B0", "DXF_HANDLE:3B1", DOWN]);
  });

  test("bare-number dimensions on a unitless header propose nothing at all", () => {
    expect(
      [...proposalsFor(evidenceOf("unitless", BARE_NUMBERS, new Map())).values()],
      "4572 of something unnamed is not a length, and reading it as millimetres would be guessing the unit the drawing withheld",
    ).toEqual([[]]);
  });

  test("a mapped header reads exactly as it read before, both ranks and both factors", () => {
    const offered = proposalsFor(evidenceOf("mm", BARE_NUMBERS, new Map())).get(VIEW) ?? [];

    expect(offered.map((proposal) => proposal.rank), "the header carries the numbers into metres, and rank 4 stands on the header itself").toEqual(["DIMENSION_RATIO", "FILE_UNITS"]);
    expect([offered[0]?.factorX, offered[0]?.factorY], "4572 millimetres over 4572 units is a millimetre a unit").toEqual([ONE_MM, ONE_MM]);
    expect([offered[1]?.factorX, offered[1]?.factorY], "and the header says the same on its own").toEqual([ONE_MM, ONE_MM]);
  });

  test("one printed override does not silence the four dimensions that agree: the majority stands, and the overridden one is named", () => {
    // S-10's column plan, as F-RCC6-BNBC draws it (T-DIM-OVERRIDE): four dimensions whose words and
    // whose geometry say the same thing, and one that prints 14'-2" over a span authored at 14'-0".
    const OVERRIDDEN = "DXF_HANDLE:926";
    const FOURTEEN_FEET = { text: `14'-0"`, metres: "4.2672" } satisfies StatedLength;
    const PRINTED = { text: `14'-2"`, metres: "4.3180" } satisfies StatedLength;
    const drawn: readonly Dimension[] = [
      { key: ACROSS, axis: "x", span: ACROSS_SPAN, text: FIFTEEN_FEET.text },
      { key: "DXF_HANDLE:2A3", axis: "x", span: 4267.2, text: FOURTEEN_FEET.text },
      { key: "DXF_HANDLE:2A4", axis: "x", span: 4267.2, text: FOURTEEN_FEET.text },
      { key: OVERRIDDEN, axis: "x", span: 4267.2, text: PRINTED.text },
      { key: DOWN, axis: "y", span: DOWN_SPAN, text: NINE_FEET.text },
    ];
    const stated: ReadonlyMap<string, StatedLength> = new Map([
      [ACROSS, FIFTEEN_FEET],
      ["DXF_HANDLE:2A3", FOURTEEN_FEET],
      ["DXF_HANDLE:2A4", FOURTEEN_FEET],
      [OVERRIDDEN, PRINTED],
      [DOWN, NINE_FEET],
    ]);

    const offered = proposalsFor(evidenceOf("unitless", drawn, stated)).get(VIEW) ?? [];

    expect(offered.map((proposal) => proposal.rank), "an axis that disagrees with one of its own readings is not a refused axis").toEqual(["DIMENSION_RATIO"]);
    expect([offered[0]?.factorX, offered[0]?.factorY], "the three that agree are what x measures at; the printed override is not averaged into them").toEqual([ONE_MM, ONE_MM]);
    expect(offered[0]?.overridden, "and the dimension the drawing printed over its own geometry is named, not silently dropped (T-DIM-OVERRIDE)").toEqual([
      // 4.318 metres over the 4267.2 units it is drawn across — what that one dimension alone would
      // have made the axis, had the three that agree not overruled it.
      { observation: "DIMENSION_OVERRIDE", axis: "x", sourceKey: OVERRIDDEN, stated: PRINTED.text, factor: "0.001011904762" },
    ]);
    expect(offered[0]?.evidence, "it is still evidence this proposal was read off — evidence is what was measured, overruled or not (L-CAD-03)").toContain(OVERRIDDEN);
  });

  test("two readings that disagree are two halves of a drawing, and which of them is right is not this engine's to decide", () => {
    const drawn: readonly Dimension[] = [
      { key: ACROSS, axis: "x", span: ACROSS_SPAN, text: FIFTEEN_FEET.text },
      { key: "DXF_HANDLE:2A3", axis: "x", span: 4267.2, text: NINE_FEET.text },
      { key: DOWN, axis: "y", span: DOWN_SPAN, text: NINE_FEET.text },
    ];
    const stated = new Map([...STATED, ["DXF_HANDLE:2A3", NINE_FEET]]);

    expect(
      [...proposalsFor(evidenceOf("unitless", drawn, stated)).values()],
      "no majority stands where two readings are all there is and they disagree — absent rather than resolved (fail-closed, L-QTY-04)",
    ).toEqual([[]]);
  });

  test("stated-unit readings that disagree beyond the verification tolerance carry no rank", () => {
    const stretched: readonly Dimension[] = [
      { key: ACROSS, axis: "x", span: ACROSS_SPAN, text: FIFTEEN_FEET.text },
      { key: "DXF_HANDLE:2A2", axis: "x", span: 2875.2, text: NINE_FEET.text },
      { key: DOWN, axis: "y", span: DOWN_SPAN, text: NINE_FEET.text },
    ];
    const stated = new Map([...STATED, ["DXF_HANDLE:2A2", NINE_FEET]]);

    expect(
      [...proposalsFor(evidenceOf("unitless", stretched, stated)).values()],
      "nine feet over 2875.2 units is 4.6 per cent away from fifteen feet over 4572, and an axis whose readings disagree is absent rather than resolved (L-QTY-04)",
    ).toEqual([[]]);
  });
});
