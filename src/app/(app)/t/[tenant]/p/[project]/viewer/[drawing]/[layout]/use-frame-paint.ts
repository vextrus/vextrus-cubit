"use client";
// Where the views/grid region and the measure region file their paint, so every sheet frame paints
// them again at the camera the sheet was drawn at (I-112, § 4). Both regions are composed after the
// camera this draw publishes, so the frame reaches them through refs and not dependencies (PB-3).
import { useCallback, useRef, type MutableRefObject } from "react";
import type { Camera } from "@/modules/takeoff/viewer";
import type { Painter } from "@/modules/takeoff/viewer/painter";

type Paint = MutableRefObject<((at: Camera) => void) | null>;

/** The frame's one draw — the sheet, then the views/grid overlay, then the measure region — and the two slots it reads. */
export function useFramePaint<S>(painterRef: MutableRefObject<Painter | null>, stateRef: MutableRefObject<S>): { draw: (at: Camera) => void; overlayPaint: Paint; measurePaint: Paint } {
  const overlayPaint: Paint = useRef(null);
  const measurePaint: Paint = useRef(null);
  const draw = useCallback(
    (at: Camera): void => {
      painterRef.current?.draw(at, stateRef.current as Parameters<Painter["draw"]>[1]);
      overlayPaint.current?.(at);
      measurePaint.current?.(at);
    },
    [painterRef, stateRef],
  );
  return { draw, overlayPaint, measurePaint };
}
