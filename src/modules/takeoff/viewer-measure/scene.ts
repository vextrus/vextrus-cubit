// What a measure tool stands on the sheet, as a pure value (s-measure §2.3, §2.4): the draft's rings,
// its placed points with their basis, the live segment to the pointer, and where the running figure's
// label goes — mapped through the sheet's own camera into stage pixels.
//
// Nothing here touches the DOM or a canvas. A scene is a function of the shape, the live point and
// the camera, so what a QS sees can be judged without mounting anything, and a frame is a redraw of
// this answer rather than a second reading of the shape (PB-3). `./paint.ts` draws it.
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import type { Camera } from "@/modules/takeoff/viewer/types";
import type { MeasureDraft, MeasureTool, PointBasis } from "./gesture";
import { rectangleCorners } from "./figure";

/** Where a mark stands on the stage, in CSS pixels. */
export type MeasureAt = { readonly x: number; readonly y: number };

/** One ring as the stage shows it: its points, whether it is closed, and whether it is a cut-out. */
export type MeasureRingMark = { readonly points: readonly MeasureAt[]; readonly closed: boolean; readonly cutout: boolean };

/** One placed point: where it stands and the basis glyph it wears (I-387). */
export type MeasurePointMark = { readonly at: MeasureAt; readonly basis: PointBasis };

/** Everything the measure layer draws, and no stage needed to grade it. */
export type MeasureScene = {
  /** The outline or run first, then each cut-out, then the ring being cut. */
  readonly rings: readonly MeasureRingMark[];
  /** Area only: the region the figure states — the outline, less its closed cut-outs (at 12 %, §2.3). */
  readonly fill: { readonly ring: readonly MeasureAt[]; readonly holes: readonly (readonly MeasureAt[])[] } | null;
  readonly points: readonly MeasurePointMark[];
  /** The 1 px dashed segment from the last point to the live point, while a ring is drawn. */
  readonly live: { readonly from: MeasureAt; readonly to: MeasureAt } | null;
  /** Linear only: each placed segment's midpoint, where its length is lettered (§2.1). */
  readonly segments: readonly { readonly at: MeasureAt; readonly from: readonly [number, number]; readonly to: readonly [number, number] }[];
};

export type MeasureSceneInput = {
  readonly tool: MeasureTool;
  readonly rectangle: boolean;
  readonly draft: MeasureDraft;
  /** The live point, in the drawing, or null where the pointer is off the sheet. */
  readonly live: readonly [number, number] | null;
  readonly camera: Camera | null;
};

/** The empty scene: nothing is drawn with nothing in progress. */
export const NO_SCENE: MeasureScene = Object.freeze({ rings: Object.freeze([]), fill: null, points: Object.freeze([]), live: null, segments: Object.freeze([]) });

function atOf(camera: Camera, world: readonly [number, number]): MeasureAt {
  const [x, y] = screenAt(camera, world);
  return { x, y };
}

/**
 * The layer's whole scene. The ring being drawn runs to the live point; a rectangle's first corner
 * spans to it; a finished shape draws closed with no live segment, because nothing more is being
 * placed until the QS asks (I-372).
 */
export function measureScene({ tool, rectangle, draft, live, camera }: MeasureSceneInput): MeasureScene {
  if (camera === null || draft.phase === "idle") return NO_SCENE;
  const drawing = draft.phase === "drawing";
  const cutting = draft.phase === "cutting";
  const map = (ring: readonly (readonly [number, number])[]): MeasureAt[] => ring.map((point) => atOf(camera, point));
  const worldOf = (ring: MeasureDraft["outer"]): (readonly [number, number])[] => ring.map((point) => point.at);

  /** The ring in progress as it stands with the live point: a rectangle spans from its first corner. */
  const spanned = (ring: readonly (readonly [number, number])[]): { ring: readonly (readonly [number, number])[]; spans: boolean } => {
    const first = ring[0];
    if (rectangle && ring.length === 1 && first !== undefined && live !== null) return { ring: rectangleCorners(first, live), spans: true };
    return { ring, spans: false };
  };

  const rings: MeasureRingMark[] = [];
  let fill: MeasureScene["fill"] = null;
  if (tool !== "count") {
    const outer = worldOf(draft.outer);
    const span = drawing ? spanned(outer) : { ring: outer, spans: false };
    rings.push({ points: map(span.ring), closed: (tool === "area" && !drawing) || span.spans, cutout: false });
    for (const cut of draft.cutouts) rings.push({ points: map(worldOf(cut)), closed: true, cutout: true });
    if (cutting) {
      const cut = spanned(worldOf(draft.cutting));
      rings.push({ points: map(cut.ring), closed: cut.spans, cutout: true });
    }
    // The fill is the area the figure states: the outline closed through the live point while it is
    // drawn, less every cut-out already closed (§2.3's 12 %, knocked out where a cut-out stands).
    if (tool === "area") {
      const through = drawing && !span.spans && live !== null ? [...outer, live] : span.ring;
      if (through.length >= 3) fill = { ring: map(through), holes: draft.cutouts.map((cut) => map(worldOf(cut))) };
    }
  }

  const placed = [...draft.outer, ...draft.cutouts.flat(), ...draft.cutting];
  const points = placed.map((point) => ({ at: atOf(camera, point.at), basis: point.basis }));

  // The live segment runs from the last point of the ring being drawn, while one is drawn; a count
  // has no segments, and a rectangle spanning to the pointer already shows where it will close.
  const drawn = drawing ? draft.outer : cutting ? draft.cutting : [];
  const last = drawn[drawn.length - 1];
  const spanning = rectangle && drawn.length === 1;
  const liveSegment = tool === "count" || spanning || last === undefined || live === null || !(drawing || cutting) ? null : { from: atOf(camera, last.at), to: atOf(camera, live) };

  const segments =
    tool !== "linear"
      ? []
      : draft.outer.slice(1).map((point, at) => {
          const from = (draft.outer[at] as (typeof draft.outer)[number]).at;
          return { at: atOf(camera, [(from[0] + point.at[0]) / 2, (from[1] + point.at[1]) / 2]), from, to: point.at };
        });

  return { rings, fill, points, live: liveSegment, segments };
}

/** Where the running figure's label stands: 12 px right of and below the live point, clamped inside the stage (§2.4). */
export function labelAt(live: MeasureAt, label: { width: number; height: number }, stage: { width: number; height: number }, inset: number): MeasureAt {
  const OFFSET = 12;
  const x = Math.min(Math.max(live.x + OFFSET, inset), Math.max(inset, stage.width - label.width - inset));
  const y = Math.min(Math.max(live.y + OFFSET, inset), Math.max(inset, stage.height - label.height - inset));
  return { x, y };
}
