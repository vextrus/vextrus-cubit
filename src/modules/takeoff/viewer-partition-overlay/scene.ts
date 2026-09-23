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

/** One view's box as a screen rectangle: the two corners mapped, then read as an origin and a size. */
function rectOf(camera: Camera, box: OverlayBox): OverlayOutline["rect"] {
  const [left, bottom] = screenAt(camera, box.min);
  const [right, top] = screenAt(camera, box.max);
  return { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) };
}

/**
 * Where an axis stands on THIS sheet, along the world axis it georeferences (Decision I-318).
 *
 * The stored position was read off the ring's own centre on the sheet the grid was read from — model
 * space, the only reading the store holds (§8) — so where this sheet shows that ring, the ring's
 * centre as this sheet shows it IS the position, in this sheet's own coordinates: on model space the
 * two are one number, and on a paper sheet that shows the plan through a window the stored figure is
 * a model coordinate the paper does not have (F-RCC6-BNBC S-10: stored 1,200,000, shown at 175.9).
 * Where this sheet shows no ring of the axis, the stored position is all there is.
 */
function positionOn(axis: PartitionOverlay["axes"][number]): number {
  if (axis.bubble === null) return axis.position;
  return axis.axis === "x" ? axis.bubble.centre[0] : axis.bubble.centre[1];
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
  const position = positionOn(axis);
  const at = (value: number): readonly [number, number] => (axis.axis === "x" ? [position, value] : [value, position]);
  return { from: screenAt(camera, at(low)), to: screenAt(camera, at(high)) };
}

/**
 * The whole overlay, mapped onto the sheet as it stands right now.
 *
 * Each switch gates its own paint and nothing else: `views: false` answers no outline and leaves
 * every axis where it was, `grid: false` the other way round. A view standing on no box of this
 * sheet is outlined nowhere — it keeps its row in the panel instead, which is where R-UI-050 puts a
 * partial answer — and its axes are drawn nowhere either (I-318): a georeference is a fact about the
 * sheet its view stands on, and on a paper sheet the stored position of a view shown on another
 * sheet is a model coordinate this sheet does not have, which painted it as stray centre lines
 * across the whole canvas (S-10: 66 of its 77 axes).
 *
 * `labels` is the word each stored type is read by, handed in by the screen that holds the one rule
 * for it (R-UI-082); a type it does not name is labelled with its own spelling. It is a lookup, not a
 * computation: a frame pays one map read per outline, exactly what reading the type cost (PB-3).
 */
export function overlayScene(
  overlay: PartitionOverlay,
  toggles: OverlayToggles,
  camera: Camera,
  scaleAbsence?: ReadonlyMap<string, string>,
  labels?: ReadonlyMap<string, string>,
): OverlayScene {
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
            label: labels?.get(view.type) ?? view.type,
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
    ? overlay.axes.flatMap((axis) => {
        const box = boxes.get(axis.viewKey) ?? null;
        if (box === null) return [];
        const segment = segmentOf(camera, axis, box);
        return [
          {
            viewKey: axis.viewKey,
            label: axis.label,
            family: axis.family,
            from: segment.from,
            to: segment.to,
            bubble:
              axis.bubble === null
                ? null
                : { centre: screenAt(camera, axis.bubble.centre), radius: axis.bubble.radius * camera.scale },
          },
        ];
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
