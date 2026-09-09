// What the snap overlay stands on the sheet, as a pure value: the live glyph, the picks taken and the
// band between them, mapped through the sheet's own camera into stage pixels.
//
// Nothing here touches the DOM. A scene is a function of what was met, what was picked and where the
// camera stands — so what a reader sees can be judged without mounting anything, and a pointer move
// is a redraw of this answer rather than a second reading of the drawing (PB-3).
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import type { Camera } from "@/modules/takeoff/viewer";
import type { SnapKind, SnapPick, SnapPoint, SnapResult } from "./types";

/** Where a mark stands on the stage, in CSS pixels. */
export type SnapAt = { readonly x: number; readonly y: number };

/** The live glyph: what was met, what it was met on, and where it stands. */
export type SnapGlyphMark = {
  readonly kind: SnapKind;
  readonly sourceKeys: readonly string[];
  readonly at: SnapAt;
};

/** One taken pick's mark: which of the two it is, what it was taken on, and where it stands. */
export type SnapPickMark = SnapPick & { readonly at: SnapAt };

/** The band from the first pick to the live point: where it starts, how long it is and its bearing. */
export type SnapBandMark = {
  readonly at: SnapAt;
  readonly lengthPx: number;
  readonly angleDeg: number;
};

/** Everything the overlay stack draws, and no stage needed to grade it. */
export type SnapScene = {
  readonly glyph: SnapGlyphMark | null;
  readonly picks: readonly SnapPickMark[];
  readonly band: SnapBandMark | null;
};

/** What the scene is drawn from: the camera, and what the region is holding right now. */
export type SnapSceneInput = {
  readonly camera: Camera | null;
  /** Whether snapping is on: with it off the sheet draws no glyph at all (AC-2). */
  readonly enabled: boolean;
  readonly snap: SnapResult | null;
  readonly picks: readonly SnapPick[];
  /** Where the live (constrained) point stands, or null where the pointer is off the sheet. */
  readonly live: SnapPoint | null;
};

/** One world point as a stage position. */
function atOf(camera: Camera, world: SnapPoint): SnapAt {
  const [x, y] = screenAt(camera, world);
  return { x, y };
}

/**
 * The overlay's whole scene. A sheet with no camera has nothing to draw over yet; snapping turned off
 * draws no glyph, though the picks a reader has already taken stand where they were taken — turning
 * the aid off does not throw away the measurement.
 */
export function snapScene(input: SnapSceneInput): SnapScene {
  const camera = input.camera;
  if (camera === null) return { glyph: null, picks: [], band: null };

  const glyph =
    !input.enabled || input.snap === null
      ? null
      : { kind: input.snap.kind, sourceKeys: input.snap.sourceKeys, at: atOf(camera, input.snap.point) };

  const picks = input.picks.map((pick) => ({ ...pick, at: atOf(camera, pick.point) }));

  // The band runs from the first pick to the point the figure is being read to: the second pick once
  // one stands, and the live point until then — which is what makes ortho and the angle lock visible
  // on the sheet rather than only in the readout (§ 1).
  const first = input.picks[0];
  const end = input.picks[1]?.point ?? input.live;
  if (first === undefined || end === undefined || end === null) return { glyph, picks, band: null };

  const from = atOf(camera, first.point);
  const to = atOf(camera, end);
  return {
    glyph,
    picks,
    band: {
      at: from,
      lengthPx: Math.hypot(to.x - from.x, to.y - from.y),
      angleDeg: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    },
  };
}
