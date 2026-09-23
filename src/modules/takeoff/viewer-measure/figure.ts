// The running figure (s-measure §2.4, I-385): what a shape in progress measures, in metres from the
// view's affirmed calibration where one view's scale of record holds every point, and in the
// drawing's own units where none does (I-146, R-UI-041). On a paper sheet the points stand in paper
// coordinates and a view's factor is per model unit: the figure is carried through the one window
// the shape stands in, and stays in the sheet's units, saying why, where no one window holds it or
// the factor's space is not recorded (I-501) — the snapping region's `sheetMeasuring` answers which.
//
// Exact from end to end: the areas are the shoelace of the points' own decimal spellings on one
// integer lattice (`./rings.ts`), carried into square metres by the two factors componentwise
// (an anisotropic view scales an area by factorX × factorY, never by a mean); the lengths are the
// snapping region's own componentwise segment (`segmentMetres`), summed before anything is rounded.
// Through a window, the window's own ratio of model units to sheet units is the one quotient taken,
// in the canon's 40-digit decimal (`modelUnitsPerSheetUnit`); an area is scaled by its square.
// The figure is rounded once, half-even, by this caller — the format seam groups what it is handed.
//
// This is a display of the arithmetic, never the figure a line is billed at: the card's figure is the
// gate's and it governs (I-373).
import type Decimal from "decimal.js";
import { exact } from "@/core/units/canon";
import { modelUnitsPerSheetUnit, segmentMetres, sheetMeasuring, type SheetFactors, type SheetMeasuring } from "@/modules/takeoff/viewer-snap/snap";
import type { SnapCalibration, SnapPoint } from "@/modules/takeoff/viewer-snap/types";
import type { MeasureDraft, MeasureTool } from "./gesture";
import { latticeOf, type RingPoint } from "./rings";

/** How many decimals a figure in metres is stated to (§2.4), and one in drawing units (viewer.md §5). */
export const SI_DECIMALS = 3;
export const UNIT_DECIMALS = 1;

/** The unit a figure is published in: SI where a scale of record measures the shape, else drawing units. */
export type FigureUnit = "m" | "m2" | "du" | "du2" | "count";

/**
 * Whether a scale of record carried the figure into metres, and why not where it did not — the
 * snapping region's own answer (`SheetMeasuring`'s kinds; `measured` published as `calibrated`).
 */
export type FigureSi = "calibrated" | "uncalibrated" | "windowed" | "unrecorded";

/** What a shape measures right now, as the label, the status cell and a journey read it. */
export type MeasureFigure = {
  readonly tool: MeasureTool;
  /** The figure, rounded half-even to its places, as a plain decimal. */
  readonly value: string;
  readonly unit: FigureUnit;
  /**
   * Whether a scale of record carried the figure into metres, and why not where it did not
   * (`windowed`, `unrecorded`: I-501); null for a count.
   */
  readonly si: FigureSi | null;
  /** Linear only: the live segment, from the last point to the pointer, in the same unit. */
  readonly segment: string | null;
  /** The view whose affirmed scale carried the figure into metres, named only when one did. */
  readonly viewKey: string | null;
  /** The window the figure was carried through, on a paper sheet, named only when one was. */
  readonly via: string | null;
};

/** Twice a ring's area on the lattice, and the lattice's scale — the exact shoelace (I-385). */
function ringArea(ring: readonly RingPoint[]): Decimal {
  if (ring.length < 3) return exact(0);
  const { rings, scale } = latticeOf([ring]);
  const held = rings[0] ?? [];
  let twice = BigInt(0);
  for (let at = 0; at < held.length; at += 1) {
    const a = held[at] as { x: bigint; y: bigint };
    const b = held[(at + 1) % held.length] as { x: bigint; y: bigint };
    twice += a.x * b.y - b.x * a.y;
  }
  if (twice < BigInt(0)) twice = -twice;
  // The lattice is the world × 10^scale × 6 on each axis, so an area is scaled by (6 · 10^scale)².
  return exact(twice.toString()).dividedBy(2).dividedBy(exact(36)).dividedBy(exact(10).pow(2 * scale));
}

/** The corners of the box every point stands in: the view that holds both corners holds every point. */
function boxOf(points: readonly SnapPoint[]): readonly [SnapPoint, SnapPoint] | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * How every point of a shape is carried into metres, or why not (I-146, I-501). Views and windows are
 * boxes, so one holds every point exactly when it holds the two corners of their box — the snapping
 * region's own `sheetMeasuring` answers that, and no second reading of "which view measures this" or
 * "which window shows it" is written here (B-17).
 */
export function sheetMeasuringAll(calibration: SnapCalibration | null, points: readonly SnapPoint[]): SheetMeasuring {
  const box = boxOf(points);
  return box === null ? { kind: "uncalibrated", view: null, through: null } : sheetMeasuring(calibration, box[0], box[1]);
}

/** What a reading carries a shape by: its view's factors and the window it is seen through, or none. */
function factorsOf(measuring: SheetMeasuring): SheetFactors | null {
  return measuring.kind === "measured" ? { factorX: measuring.view.factorX, factorY: measuring.view.factorY, through: measuring.through } : null;
}

/** The reading's kind as a figure publishes it. */
function siOf(measuring: SheetMeasuring): FigureSi {
  return measuring.kind === "measured" ? "calibrated" : measuring.kind;
}

/** The four corners of the rectangle two opposite corners span, in drawing order. */
export function rectangleCorners(from: RingPoint, to: RingPoint): RingPoint[] {
  return [
    [from[0], from[1]],
    [to[0], from[1]],
    [to[0], to[1]],
    [from[0], to[1]],
  ];
}

/** The drawing's own units, as a pair of factors: a segment measured where no scale of record stands. */
const DRAWING_UNITS = Object.freeze({ factorX: "1", factorY: "1" });

/** A run's length: the snapping region's segment, summed, in metres or drawing units. */
function runLength(points: readonly SnapPoint[], factors: SheetFactors | null): Decimal {
  let total = exact(0);
  for (let at = 1; at < points.length; at += 1) total = total.plus(segmentMetres(points[at - 1] as SnapPoint, points[at] as SnapPoint, factors ?? DRAWING_UNITS));
  return total;
}

/** A figure at its places, half-even, as a plain decimal (the format seam groups it). */
function stated(value: Decimal, places: number): string {
  return value.toDecimalPlaces(places).toFixed(places);
}

/**
 * One placed segment's length, where a Linear run letters it at its midpoint (§2.1): metres where one
 * view's scale of record holds both ends (through their one window, on paper), the drawing's units
 * otherwise — the run's own arithmetic.
 */
export function segmentFigure(from: SnapPoint, to: SnapPoint, calibration: SnapCalibration | null): { readonly value: string; readonly si: FigureSi } {
  const measuring = sheetMeasuringAll(calibration, [from, to]);
  const factors = factorsOf(measuring);
  return { value: stated(runLength([from, to], factors), factors === null ? UNIT_DECIMALS : SI_DECIMALS), si: siOf(measuring) };
}

export type FigureInput = {
  readonly tool: MeasureTool;
  /** Area only: the outline is a rectangle spanned by two corners. */
  readonly rectangle: boolean;
  readonly draft: MeasureDraft;
  /** Where the next point would land, or null where the pointer is off the sheet. */
  readonly live: SnapPoint | null;
  /** The scale of record over this sheet, with the windows it shows model space through (I-501). */
  readonly calibration: SnapCalibration | null;
};

/**
 * What the shape measures, with the live point where one stands (§2.4):
 * - Linear: the run's total, and the live segment beside it while drawing;
 * - Area: the outline less every cut-out, the ring in progress closed through the live point, once
 *   three points stand counting that one; before that, the live segment;
 * - Count: how many points are placed.
 * Null while nothing is placed.
 */
export function figureOf({ tool, rectangle, draft, live, calibration }: FigureInput): MeasureFigure | null {
  if (draft.phase === "idle") return null;
  const outer = draft.outer.map((point) => point.at);
  if (tool === "count") return { tool, value: String(outer.length), unit: "count", si: null, segment: null, viewKey: null, via: null };

  const drawing = draft.phase === "drawing";
  const cutting = draft.phase === "cutting";
  const inProgress = drawing ? outer : cutting ? draft.cutting.map((point) => point.at) : [];
  const livePoint = (drawing || cutting) && live !== null ? live : null;
  const every: SnapPoint[] = [...outer, ...draft.cutouts.flatMap((ring) => ring.map((point) => point.at)), ...(cutting ? inProgress : []), ...(livePoint === null ? [] : [livePoint])];
  // One view's scale of record over every point — through the one window they stand in, on paper — or
  // the sheet's own units and the reason (I-146, I-501).
  const measuring = sheetMeasuringAll(calibration, every);
  const factors = factorsOf(measuring);
  const si = siOf(measuring);
  const places = factors === null ? UNIT_DECIMALS : SI_DECIMALS;
  const viewKey = measuring.view?.viewKey ?? null;
  const via = measuring.through?.via ?? null;

  if (tool === "linear") {
    const run = livePoint === null ? outer : [...outer, livePoint];
    const last = outer[outer.length - 1];
    const segment = drawing && livePoint !== null && last !== undefined ? stated(runLength([last, livePoint], factors), places) : null;
    return { tool, value: stated(runLength(run, factors), places), unit: factors === null ? "du" : "m", si, segment, viewKey, via };
  }

  /** A ring as it stands in progress: closed through the live point, and spanned where it is a rectangle. */
  const running = (ring: readonly SnapPoint[]): readonly SnapPoint[] => {
    const through = livePoint === null ? ring : [...ring, livePoint];
    const first = through[0];
    const second = through[1];
    return rectangle && through.length === 2 && first !== undefined && second !== undefined ? rectangleCorners(first, second) : through;
  };
  // An area is scaled by factorX × factorY, and through a window by the window's ratio squared.
  const across = modelUnitsPerSheetUnit(factors?.through);
  const factor = factors === null ? exact(1) : exact(factors.factorX).times(factors.factorY).times(across).times(across);
  const gross = drawing ? running(outer) : outer;
  if (gross.length < 3) {
    // Before a third point stands there is no area yet: the live segment is the figure (§2.4).
    const last = outer[outer.length - 1];
    const segment = livePoint !== null && last !== undefined ? stated(runLength([last, livePoint], factors), places) : null;
    return { tool, value: segment ?? stated(exact(0), places), unit: factors === null ? "du" : "m", si, segment, viewKey, via };
  }
  let net = ringArea(gross);
  for (const ring of draft.cutouts) net = net.minus(ringArea(ring.map((point) => point.at)));
  if (cutting) {
    const cut = running(inProgress);
    if (cut.length >= 3) net = net.minus(ringArea(cut));
  }
  return { tool, value: stated(net.times(factor), places), unit: factors === null ? "du2" : "m2", si, segment: null, viewKey, via };
}
