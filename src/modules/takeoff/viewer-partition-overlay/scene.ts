// R-TO-014's "toggling shows what the machine sees", as a pure value: the stored partition mapped
// through the sheet's own camera into the screen quantities the overlay paints.
//
// Nothing here touches a canvas, a context or the DOM. A scene is a function of the overlay, the two
// switches and the camera — so what the sheet shows can be judged without drawing anything, and a
// frame is a redraw of this answer rather than a second reading of the store (PB-3).
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import type { Camera } from "@/modules/takeoff/viewer/types";
import type { OverlayBox, OverlayDrawnAxis, OverlayOutline, OverlayScene, OverlayToggles, PartitionOverlay } from "./types";

/**
 * How far past its view's box an axis runs at each end (Decision § 5's first stated ratio: no token
 * measures drawing units, so the overrun is a proportion of the span it crosses).
 */
const AXIS_OVERRUN = 0.04;

/**
 * Where a world point stands on the screen, under a given camera — the inverse of the viewer's own
 * `worldAt`, and the one home for it (B-17). Screen y grows downward and world y upward, so the
 * second axis is negated once, here, exactly as `worldAt` negates it once on the way back.
 */
export function screenAt(camera: Camera, world: readonly [number, number]): [number, number] {
  return [
    (world[0] - camera.centre[0]) * camera.scale + camera.viewport.width / 2,
    (camera.centre[1] - world[1]) * camera.scale + camera.viewport.height / 2,
  ];
}

/** The world box the camera is showing right now — what an axis crosses when its view has no box. */
function visibleBox(camera: Camera): OverlayBox {
  const halfWidth = camera.viewport.width / 2 / camera.scale;
  const halfHeight = camera.viewport.height / 2 / camera.scale;
  return {
    min: [camera.centre[0] - halfWidth, camera.centre[1] - halfHeight],
    max: [camera.centre[0] + halfWidth, camera.centre[1] + halfHeight],
  };
}

/** One view's box as a screen rectangle: the two corners mapped, then read as an origin and a size. */
function rectOf(camera: Camera, box: OverlayBox): OverlayOutline["rect"] {
  const [left, bottom] = screenAt(camera, box.min);
  const [right, top] = screenAt(camera, box.max);
  return { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) };
}

/**
 * One stored axis as a screen segment. An axis of the `x` family georeferences at a world x and so
 * runs along y; one of the `y` family the other way round. It runs THROUGH the view it stands in —
 * the whole of that view's box, overrun at both ends — because a grid line that stopped inside the
 * plan it georeferences would read as a measurement rather than as the backbone it is (L-CAD-07).
 */
function segmentOf(camera: Camera, axis: PartitionOverlay["axes"][number], box: OverlayBox): { from: [number, number]; to: [number, number] } {
  const across = axis.axis === "x" ? 1 : 0;
  const span = box.max[across] - box.min[across];
  const low = box.min[across] - span * AXIS_OVERRUN;
  const high = box.max[across] + span * AXIS_OVERRUN;
  const at = (value: number): readonly [number, number] => (axis.axis === "x" ? [axis.position, value] : [value, axis.position]);
  return { from: screenAt(camera, at(low)), to: screenAt(camera, at(high)) };
}

/**
 * The whole overlay, mapped onto the sheet as it stands right now.
 *
 * Each switch gates its own paint and nothing else: `views: false` answers no outline and leaves
 * every axis where it was, `grid: false` the other way round. A view standing on no box of this
 * sheet is outlined nowhere — it keeps its row in the panel instead, which is where R-UI-050 puts a
 * partial answer — while an axis is always drawn, because a georeference is a fact about the
 * drawing rather than about what happens to be under the camera.
 */
export function overlayScene(overlay: PartitionOverlay, toggles: OverlayToggles, camera: Camera, scaleAbsence?: ReadonlyMap<string, string>): OverlayScene {
  const outlines: OverlayOutline[] = toggles.views
    ? overlay.views.flatMap((view) => {
        if (view.box === null) return [];
        const hatched = view.type === VIEW_TYPE.UNTYPED;
        // R-TO-021: a view no affirmation act names measures nothing, and the sheet says so where
        // the view stands. Read from the scale door's own answer — this module derives no absence of
        // its own (I-160, B-17) — and kept apart from the untyped hatch it shares a pattern with.
        return [
          {
            viewKey: view.viewKey,
            type: view.type,
            rect: rectOf(camera, view.box),
            hatched,
            reason: hatched ? view.reason : null,
            scaleRefusal: scaleAbsence?.get(view.viewKey) ?? null,
          },
        ];
      })
    : [];

  const boxes = new Map(overlay.views.map((view) => [view.viewKey, view.box]));
  const axes: OverlayDrawnAxis[] = toggles.grid
    ? overlay.axes.map((axis) => {
        const segment = segmentOf(camera, axis, boxes.get(axis.viewKey) ?? visibleBox(camera));
        return {
          viewKey: axis.viewKey,
          label: axis.label,
          family: axis.family,
          from: segment.from,
          to: segment.to,
          bubble:
            axis.bubble === null
              ? null
              : { centre: screenAt(camera, axis.bubble.centre), radius: axis.bubble.radius * camera.scale },
        };
      })
    : [];

  return { outlines, axes };
}

/** What one scene amounts to, as the overlay canvas publishes it after a frame (Decision § 1). */
export type SceneCounts = {
  readonly outlines: number;
  readonly hatched: number;
  /** How many outlines are hatched because no affirmation act names them (R-TO-021, I-160). */
  readonly scaleHatched: number;
  readonly axes: number;
  readonly bubbles: number;
};

/**
 * The counts the canvas wears. They are read off the scene rather than off the paint: a count that
 * waited on a 2D context would be a count no reader, and no journey, could rely on.
 */
export function sceneCounts(scene: OverlayScene): SceneCounts {
  return {
    outlines: scene.outlines.length,
    hatched: scene.outlines.filter((outline) => outline.hatched).length,
    scaleHatched: scene.outlines.filter((outline) => outline.scaleRefusal !== null).length,
    axes: scene.axes.length,
    bubbles: scene.axes.filter((axis) => axis.bubble !== null).length,
  };
}
