"use client";
// Where the overlay regions and the measure region file their paint, so every sheet frame paints them
// again at the camera the sheet was drawn at (I-112, § 4). The regions are composed after the camera
// this draw publishes, so the frame reaches them through refs and not dependencies (PB-3).
//
// The overlays are a LIST, painted in its order (viewer.md Part 6, I-635): the quantity fills first,
// so the views/grid outlines read over them, never under. A region joins the frame by taking its slot
// here; the draw names no region.
import { useCallback, useRef, type MutableRefObject } from "react";
import type { Camera } from "@/modules/takeoff/viewer";
import type { Painter } from "@/modules/takeoff/viewer/painter";

type Paint = MutableRefObject<((at: Camera) => void) | null>;

/** The overlay slots, in the order a frame paints them: bottom first. */
export const OVERLAY_SLOTS = ["quantities", "partition"] as const;
export type OverlaySlot = (typeof OVERLAY_SLOTS)[number];

/** The frame's one draw — the sheet, then every overlay in its slot's order, then the measure region — and the slots it reads. */
export function useFramePaint<S>(
  painterRef: MutableRefObject<Painter | null>,
  stateRef: MutableRefObject<S>,
): { draw: (at: Camera) => void; overlayPaints: Readonly<Record<OverlaySlot, Paint>>; measurePaint: Paint } {
  const quantities: Paint = useRef(null);
  const partition: Paint = useRef(null);
  const measurePaint: Paint = useRef(null);
  const overlayPaints = useRef<Readonly<Record<OverlaySlot, Paint>>>({ quantities, partition }).current;
  const draw = useCallback(
    (at: Camera): void => {
      painterRef.current?.draw(at, stateRef.current as Parameters<Painter["draw"]>[1]);
      for (const slot of OVERLAY_SLOTS) overlayPaints[slot].current?.(at);
      measurePaint.current?.(at);
    },
    [overlayPaints, painterRef, stateRef],
  );
  return { draw, overlayPaints, measurePaint };
}
