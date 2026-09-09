// The shapes S-Viewer's snapping region agrees on (R-TO-012, R-UI-041): what may be snapped to, what
// a resolved snap is, what a taken pick is, and what an affirmed scale looks like once it has reached
// the client. They live apart from the math, the hook and the scene so the pure half can name them
// without a camera and the server half without a DOM (ARCH-01, B-17).
import type { RenderRecord } from "@/modules/takeoff/viewer";

/** A world point, as every seam of the sheet states one. */
export type SnapPoint = readonly [number, number];

/**
 * The six kinds R-TO-012 names, in the order the readout and the stylesheet are written against. The
 * roster is closed: a kind that is not one of these is not a snap the product can draw or name.
 */
export const SNAP_KINDS = ["endpoint", "midpoint", "intersection", "perpendicular", "grid", "nearest"] as const;

/** One kind of snap, drawn from the closed roster above. */
export type SnapKind = (typeof SNAP_KINDS)[number];

/**
 * The order a snap is decided in when several kinds stand within reach at once (I-147): priority,
 * never proximity — at a vertex, proximity flickers the glyph between endpoint and nearest as the
 * hand trembles, and a snap that changes its mind is worse than no snap.
 */
export const SNAP_PRIORITY: readonly SnapKind[] = Object.freeze(["endpoint", "intersection", "midpoint", "perpendicular", "grid", "nearest"]);

/**
 * One candidate the screen hands the resolver: a drawn record of the sheet, exactly as the manifest
 * and the spatial index hold one. The screen narrows the sheet to the records near the pointer and
 * hands them over whole — their geometry is what the six kinds are computed from.
 */
export type SnapCandidate = RenderRecord;

/** One crossing of the stored grid: where it stands, the two bubbles that georeferenced it, and whose view it is. */
export type GridIntersection = {
  readonly point: SnapPoint;
  readonly sourceKeys: readonly [string, string];
  readonly viewKey: string;
};

/**
 * One resolved snap: what was met, where it stands in the drawing, the source key(s) it was met on,
 * and that point carried onto the register's one lattice (L-REG-04).
 */
export type SnapResult = {
  readonly kind: SnapKind;
  readonly point: readonly [number, number];
  readonly sourceKeys: readonly string[];
  readonly keyPoint: readonly [string, string];
};

/** What the resolver is asked: where the pointer stands, how far it reaches, and what is in reach. */
export type SnapInput = {
  readonly cursor: SnapPoint;
  /** How far a snap reaches, in DRAWING units — the screen derives it as SNAP_TOLERANCE_PX / scale. */
  readonly tolerance: number;
  readonly candidates: readonly SnapCandidate[];
  readonly grid: readonly GridIntersection[];
  /** The first pick, where one stands: the anchor a perpendicular is dropped from (I-148). */
  readonly firstPick: SnapPoint | null;
};

/** One pick a reader has taken: which of the two it is, where it stands, and what it was taken on. */
export type SnapPick = {
  readonly index: 1 | 2;
  readonly point: readonly [number, number];
  readonly sourceKeys: readonly string[];
  readonly keyPoint: readonly [string, string];
};

/** A world box, as the stored partition states one. */
export type SnapBox = { readonly min: SnapPoint; readonly max: SnapPoint };

/** One view of this sheet that a scale of record measures: where it stands, and by how much. */
export type SnapCalibrationView = {
  readonly viewKey: string;
  readonly box: SnapBox | null;
  /** The stored 12-place factors, carried whole rather than re-derived (B-07, L-MEA-05). */
  readonly factorX: string;
  readonly factorY: string;
};

/** What the calibration door and `?part=calibration` answer: one reading of one record, onto one sheet. */
export type SnapCalibration = {
  readonly ingestId: string;
  readonly views: readonly SnapCalibrationView[];
};
