/**
 * The running figure (s-measure §2.4, I-385, I-146): S-08's outline and pit, in square metres from the
 * view's affirmed 0.001 m per unit, exactly — the figures I-393's table states, at the three places a
 * reader sees; drawing units where no scale of record holds the shape; componentwise on an anisotropic
 * view; and the live point carried into the ring in progress.
 */
import { describe, expect, test } from "vitest";
import { figureOf, sheetMeasuringAll } from "@/modules/takeoff/viewer-measure/figure";
import { NO_DRAFT, type MeasureDraft, type MeasurePoint } from "@/modules/takeoff/viewer-measure/gesture";
import { S08_PIT, S08_SOG, S08_VIEW, s08Calibration, s08Paper } from "./support/s08";

const point = (at: readonly [number, number]): MeasurePoint => ({ at, basis: "MEASURED", sourceKeys: ["DXF_HANDLE:81D"] });
const ring = (points: readonly (readonly [number, number])[]): MeasurePoint[] => points.map(point);
const draft = (o: Partial<MeasureDraft>): MeasureDraft => ({ ...NO_DRAFT, ...o });

describe("§2.4: Area, S-08's SOG outline less the lift pit, in m² from the view's scale of record", () => {
  test("81D closed reads 328.838 m² (I-393: 328 838 371.244… mm²), and 320.791 m² with 830 cut out", () => {
    const closed = draft({ phase: "draft", outer: ring(S08_SOG) });
    const gross = figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration: s08Calibration() });
    expect(gross).toEqual({ tool: "area", value: "328.838", unit: "m2", si: "calibrated", segment: null, viewKey: S08_VIEW, via: null });

    const net = figureOf({ tool: "area", rectangle: false, draft: { ...closed, cutouts: [ring(S08_PIT)] }, live: null, calibration: s08Calibration() });
    expect(net?.value, "(328 838 371.244… − 8 046 918.88) mm², half-even to three places").toBe("320.791");
  });

  test("with no scale of record over the shape, the figure is the drawing's own square units", () => {
    const closed = draft({ phase: "draft", outer: ring(S08_PIT) });
    expect(figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration: null })).toMatchObject({ value: "8046918.9", unit: "du2", si: "uncalibrated", viewKey: null });
  });

  test("an anisotropic view scales an area by factorX × factorY, never by a mean", () => {
    const calibration = s08Calibration();
    const view = { ...(calibration.views[0] as (typeof calibration.views)[number]), factorX: "0.002000000000", factorY: "0.001000000000" };
    const closed = draft({ phase: "draft", outer: ring(S08_PIT) });
    expect(figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration: { ...calibration, views: [view] } })?.value, "8 046 918.88 × 0.002 × 0.001").toBe("16.094");
  });

  test("while drawing, the ring closes through the live point once three points stand counting it; before that the live segment is the figure", () => {
    const [a, b, c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number]];
    const two = draft({ phase: "drawing", outer: ring([a, b]) });
    const through = figureOf({ tool: "area", rectangle: false, draft: two, live: c, calibration: s08Calibration() });
    expect(through?.unit).toBe("m2");
    expect(through?.value, "half the pit: the triangle a, b and the live corner").toBe("4.023");
    const one = figureOf({ tool: "area", rectangle: false, draft: draft({ phase: "drawing", outer: ring([a]) }), live: b, calibration: s08Calibration() });
    expect([one?.value, one?.unit], "2 993.2 units along the pit's edge").toEqual(["2.993", "m"]);
  });

  test("Rectangle: one corner and the live point span the whole pit", () => {
    const [a, , c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number]];
    expect(figureOf({ tool: "area", rectangle: true, draft: draft({ phase: "drawing", outer: ring([a]) }), live: c, calibration: s08Calibration() })?.value).toBe("8.047");
  });
});

describe("§2.4: Linear and Count", () => {
  test("a run's total and the live segment, each in metres", () => {
    const [a, b, c] = S08_SOG as [readonly [number, number], readonly [number, number], readonly [number, number]];
    const run = figureOf({ tool: "linear", rectangle: false, draft: draft({ phase: "drawing", outer: ring([a, b]) }), live: c, calibration: s08Calibration() });
    expect(run).toMatchObject({ value: "36.771", segment: "16.100", unit: "m", si: "calibrated" });
  });

  test("a count is how many points stand, and needs no scale", () => {
    expect(figureOf({ tool: "count", rectangle: false, draft: draft({ phase: "drawing", outer: ring(S08_PIT) }), live: null, calibration: null })).toMatchObject({ value: "4", unit: "count", si: null });
  });

  test("nothing in progress measures nothing", () => {
    expect(figureOf({ tool: "area", rectangle: false, draft: NO_DRAFT, live: [0, 0], calibration: s08Calibration() })).toBeNull();
  });
});

describe("I-146: one view's scale of record must hold every point", () => {
  test("the view is the snapping region's own answer over the box of every point", () => {
    expect(sheetMeasuringAll(s08Calibration(), S08_SOG).view?.viewKey).toBe(S08_VIEW);
    expect(sheetMeasuringAll(s08Calibration(), [...S08_SOG, [50000, 0]]).kind, "a point outside the view carries nothing into metres").toBe("uncalibrated");
  });
});

describe("I-501: S-08 as the product draws it — paper, through viewport 2077 at 1:100 — reads metres through its window", () => {
  const paperRing = (points: readonly (readonly [number, number])[] | undefined): MeasurePoint[] => ring(points ?? []);

  test("81D in paper coordinates reads 328.838 m², and 320.791 m² with 830 cut out — the model factor carried through the window, never onto paper", () => {
    const { sog, pit, calibration } = s08Paper();
    expect(sog.via, "the rings are the manifest's own: projected through window 2077").toBe("2077");
    const closed = draft({ phase: "draft", outer: paperRing(sog.points) });
    const gross = figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration });
    expect(gross, "0.001 m per model unit × 100 model units per paper unit, squared over the paper's own shoelace").toEqual({
      tool: "area",
      value: "328.838",
      unit: "m2",
      si: "calibrated",
      segment: null,
      viewKey: S08_VIEW,
      via: "2077",
    });
    const net = figureOf({ tool: "area", rectangle: false, draft: { ...closed, cutouts: [paperRing(pit.points)] }, live: null, calibration });
    expect(net?.value).toBe("320.791");
  });

  test("a run on paper reads the same metres as the same run on model space", () => {
    const { sog, calibration } = s08Paper();
    const [a, b, c] = (sog.points ?? []) as [readonly [number, number], readonly [number, number], readonly [number, number]];
    const run = figureOf({ tool: "linear", rectangle: false, draft: draft({ phase: "drawing", outer: ring([a, b]) }), live: c, calibration });
    expect(run).toMatchObject({ value: "36.771", segment: "16.100", unit: "m", si: "calibrated", via: "2077" });
  });

  test("a QS two-point scale, whose sheet the store does not record, keeps the paper figure in sheet units and says why", () => {
    const { pit, calibration } = s08Paper({ space: "unrecorded" });
    const closed = draft({ phase: "draft", outer: paperRing(pit.points) });
    expect(figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration })).toMatchObject({ unit: "du2", si: "unrecorded", viewKey: null, via: null });
  });

  test("a shape that leaves the window it started in keeps sheet units and says why", () => {
    const { pit, calibration } = s08Paper();
    const frame = calibration.windows[0]?.frame;
    // The view is widened past the frame, so the one reason left is the window (I-501).
    const wide = { ...calibration, views: calibration.views.map((view) => ({ ...view, box: { min: [0, 0] as [number, number], max: [1000, 1000] as [number, number] } })) };
    const outside: readonly [number, number] = [(frame?.max[0] ?? 0) + 10, frame?.max[1] ?? 0];
    const closed = draft({ phase: "draft", outer: ring([...(pit.points ?? []).slice(0, 2), outside]) });
    expect(figureOf({ tool: "area", rectangle: false, draft: closed, live: null, calibration: wide })).toMatchObject({ unit: "du2", si: "windowed", via: null });
  });
});
