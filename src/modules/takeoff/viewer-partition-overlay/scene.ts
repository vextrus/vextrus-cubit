// R-TO-014's "toggling shows what the machine sees", as a pure value: the stored partition mapped
// through the sheet's own camera into the screen quantities the overlay paints.
//
// Nothing here touches a canvas, a context or the DOM. A scene is a function of the overlay, the two
// switches and the camera — so what the sheet shows can be judged without drawing anything, and a
// frame is a redraw of this answer rather than a second reading of the store (PB-3).
import { formatUserFigure } from "@/core/format";
import { exact } from "@/core/units/canon";
import { VIEW_TYPE } from "@/modules/takeoff/partition/views/law";
import type { Camera } from "@/modules/takeoff/viewer/types";
import { PARTITION_COPY, fillCopy } from "./copy";
import type { OverlayBox, OverlayDrawnAxis, OverlayDrawnRoom, OverlayOutline, OverlayScene, OverlayToggles, PartitionOverlay, PartitionOverlayAxis, PartitionOverlayRoom } from "./types";

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

  // The rooms, where the overlay carries the rooms stage's reading at all: an overlay that predates it
  // answers the scene it always did.
  if (overlay.rooms === undefined) return { outlines, axes };
  const rooms = toggles.rooms === false ? [] : roomsOnSheet(overlay, camera);
  return { outlines, axes, rooms };
}

/** How many decimal places a room's area is said to on the sheet — the figure a QS reads a room by. */
const AREA_PLACES = 2;

/** A map from the model's coordinates onto this sheet's, one scale and offset per direction. */
type SheetFrame = (world: readonly [number, number]) => readonly [number, number];

/**
 * Where a view's MODEL coordinates stand on this sheet, read off its own grid (I-647): each axis
 * stores the model position it georeferences, and its bubble is drawn on this sheet at the position
 * the sheet shows it at, so two axes of a family fix that direction's scale and offset. On model
 * space the two readings are one number and the frame is the identity; on a paper sheet showing the
 * plan through a window it is the window's scale and its shift. A view with no bubble on this sheet
 * has no frame here, and its rooms are listed in the panel rather than painted somewhere they are not.
 */
export function sheetFrameOf(axes: readonly PartitionOverlayAxis[]): SheetFrame | null {
  const pairs = (family: "x" | "y"): (readonly [number, number])[] =>
    axes.flatMap((axis) => (axis.axis === family && axis.bubble !== null ? [[axis.position, family === "x" ? axis.bubble.centre[0] : axis.bubble.centre[1]] as const] : []));
  const fit = (held: readonly (readonly [number, number])[]): { scale: number; offset: number } | null => {
    if (held.length === 0) return null;
    const sorted = [...held].sort((left, right) => left[0] - right[0]);
    const low = sorted[0] as readonly [number, number];
    const high = sorted[sorted.length - 1] as readonly [number, number];
    if (high[0] - low[0] <= 0) return null;
    const scale = (high[1] - low[1]) / (high[0] - low[0]);
    return { scale, offset: low[1] - scale * low[0] };
  };
  const x = fit(pairs("x"));
  const y = fit(pairs("y"));
  // A direction with too few bubbles to fit borrows the other's scale — a window does not stretch —
  // and takes its own offset from the one bubble it has.
  const borrow = (own: (readonly [number, number])[], other: { scale: number } | null): { scale: number; offset: number } | null => {
    const one = own[0];
    return other === null || one === undefined ? null : { scale: other.scale, offset: one[1] - other.scale * one[0] };
  };
  const fx = x ?? borrow(pairs("x"), y);
  const fy = y ?? borrow(pairs("y"), x);
  if (fx === null || fy === null) return null;
  return (world) => [world[0] * fx.scale + fx.offset, world[1] * fy.scale + fy.offset];
}

/** The words a room's chip says: its name, then its area, or what it is where it is no room. */
function linesOf(room: PartitionOverlayRoom): string[] {
  const name = room.name ?? PARTITION_COPY.viewer_partition_room_unnamed;
  if (room.status === "VOID") return [name, PARTITION_COPY.viewer_partition_room_void];
  if (room.status === "NOT_CLOSED") return [name, PARTITION_COPY.viewer_partition_room_not_closed];
  if (room.areaM2 === null) return [name];
  return [name, fillCopy("viewer_partition_room_area", { area: formatUserFigure(exact(room.areaM2).toFixed(AREA_PLACES)) })];
}

/**
 * The rooms this sheet shows, in screen pixels. A region listed and not registered (DROPPED) is the
 * panel's to list and is not painted: a sliver or the world around a plan outlined on the sheet would
 * read as a room. The chip of a room stands inside its outline's top-left corner, clear of the label
 * the architect drew; a room whose walls do not close has no outline and its chip stands at its label.
 */
function roomsOnSheet(overlay: PartitionOverlay, camera: Camera): OverlayDrawnRoom[] {
  const frames = new Map<string, SheetFrame | null>();
  const frameOf = (viewKey: string): SheetFrame | null => {
    if (!frames.has(viewKey)) frames.set(viewKey, sheetFrameOf(overlay.axes.filter((axis) => axis.viewKey === viewKey)));
    return frames.get(viewKey) ?? null;
  };
  return (overlay.rooms ?? []).flatMap((room) => {
    if (room.status === "DROPPED") return [];
    const frame = frameOf(room.viewKey);
    if (frame === null) return [];
    const onScreen = (world: readonly [number, number]): readonly [number, number] => screenAt(camera, frame(world));
    const outer = room.outline === null ? [] : room.outline.outer.map(onScreen);
    const holes = room.outline === null ? [] : room.outline.holes.map((hole) => hole.map(onScreen));
    const corner: readonly [number, number] =
      outer.length === 0 ? onScreen(room.anchor) : [Math.min(...outer.map((point) => point[0])), Math.min(...outer.map((point) => point[1]))];
    return [{ roomKey: room.roomKey, status: room.status, outer, holes, anchor: corner, lines: linesOf(room) }];
  });
}

/** What one scene amounts to, as the overlay canvas publishes it after a frame (Decision § 1). */
export type SceneCounts = {
  readonly outlines: number;
  readonly hatched: number;
  /** How many outlines are hatched because no affirmation act names them (R-TO-021, I-160). */
  readonly scaleHatched: number;
  readonly axes: number;
  readonly bubbles: number;
  /** How many rooms are painted, and how many of them are rooms whose walls do not close. */
  readonly rooms: number;
  readonly unclosed: number;
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
    rooms: (scene.rooms ?? []).length,
    unclosed: (scene.rooms ?? []).filter((room) => room.status === "NOT_CLOSED").length,
  };
}
