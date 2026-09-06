/**
 * The sheet under the pointer (Decision § 5, PB-3): the wheel, the pan, the marquee, the hover and
 * the click that takes what is under it.
 *
 * A gesture is written where it happens and not through a render: the rectangle goes straight onto
 * its element and the pan onto the camera the painter draws from, because sixty renders a second of
 * the panel and the readout is what a marquee must not cost.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { panCamera, worldAt, zoomCameraAt } from "../client";
import type { Painter } from "../painter";
import type { SpatialAsk } from "../spatial.worker";
import type { Camera, ViewerHead } from "../types";
import type { HoverFact } from "../../viewer-inspector/inspector-panel";
import type { SheetFacts } from "./use-selection";

/** The wheel's own units into a zoom factor — one notch is a small step, a trackpad flick a large one. */
const WHEEL_ZOOM_RATE = 0.0015;

/** How far a pointer may travel and still be a click rather than a pan (Decision § 5's px set). */
const CLICK_TRAVEL_PX = 3;

/** The marquee's rectangle, in stage pixels. */
export type MarqueeBox = { left: number; top: number; width: number; height: number };

export interface PointerOptions {
  head: ViewerHead | null;
  canvasRef: { current: HTMLCanvasElement | null };
  cameraRef: { current: Camera | null };
  painterRef: { current: Painter | null };
  facts: SheetFacts;
  moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
  draw: (camera: Camera) => void;
  ask: (request: SpatialAsk) => Promise<string[]>;
  keysUnder: (world: [number, number], takeable?: boolean) => Promise<string[]>;
  /** The layers a rectangle may take from: drawn, and not locked out of the hit-test. */
  openLayers: () => readonly string[];
  hold: (keys: string[] | ((held: string[]) => string[])) => void;
  toggleKey: (key: string) => void;
}

export interface PointerGestures {
  /** What is under the pointer right now, or null over bare paper. */
  hovered: HoverFact | null;
  marqueeOn: boolean;
  marqueeRef: { current: HTMLDivElement | null };
  /** Where the rectangle stands, for the frame that first mounts it. */
  marqueeBox: MarqueeBox;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
}

export function usePointer({
  head,
  canvasRef,
  cameraRef,
  painterRef,
  facts,
  moveCamera,
  draw,
  ask,
  keysUnder,
  openLayers,
  hold,
  toggleKey,
}: PointerOptions): PointerGestures {
  const [hovered, setHovered] = useState<HoverFact | null>(null);
  const [marqueeOn, setMarqueeOn] = useState(false);

  const dragRef = useRef<{ x: number; y: number } | null>(null);
  /** Where the gesture began, in client pixels, and whether it began a rectangle rather than a pan. */
  const gestureRef = useRef<{ x: number; y: number; marquee: boolean } | null>(null);
  /** The rectangle in stage pixels, written straight onto the element: a marquee is not a render. */
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const marqueeBoxRef = useRef<MarqueeBox>({ left: 0, top: 0, width: 0, height: 0 });
  /** Whether a hover question is already in flight — one at a time, so a moving pointer never queues. */
  const hoveringRef = useRef(false);

  /** Where a client point stands on the canvas, and where that is in the drawing. */
  const pointOn = useCallback(
    (canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }): { px: { x: number; y: number }; world: [number, number] } | null => {
      const at = cameraRef.current;
      if (at === null) return null;
      const box = canvas.getBoundingClientRect();
      const px = { x: event.clientX - box.left, y: event.clientY - box.top };
      return { px, world: worldAt(at, px) };
    },
    [cameraRef],
  );

  /** The marquee's rectangle written where the pointer left it. */
  const drawMarquee = useCallback((from: { x: number; y: number }, to: { x: number; y: number }): void => {
    const box = {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
    marqueeBoxRef.current = box;
    const element = marqueeRef.current;
    if (element === null) return;
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const on = pointOn(event.currentTarget, event);
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = { x: event.clientX, y: event.clientY, marquee: event.shiftKey };
      if (event.shiftKey && on !== null) {
        drawMarquee(on.px, on.px);
        setMarqueeOn(true);
        return;
      }
      dragRef.current = { x: event.clientX, y: event.clientY };
    },
    [drawMarquee, pointOn],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const gesture = gestureRef.current;
      if (gesture !== null && gesture.marquee) {
        const on = pointOn(event.currentTarget, event);
        const box = event.currentTarget.getBoundingClientRect();
        if (on !== null) drawMarquee({ x: gesture.x - box.left, y: gesture.y - box.top }, on.px);
        return;
      }

      const from = dragRef.current;
      if (from !== null) {
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        dragRef.current = { x: event.clientX, y: event.clientY };
        moveCamera((held) => panCamera(held, -dx, -dy), true);
        return;
      }

      // Nothing is being dragged, so the pointer is reading: what is under it is asked of the index
      // one question at a time, and a pointer over bare paper reads nothing rather than the last
      // thing it read (R-UI-040).
      if (hoveringRef.current) return;
      const on = pointOn(event.currentTarget, event);
      if (on === null) return;
      hoveringRef.current = true;
      void keysUnder(on.world)
        .then((keys) => {
          const key = keys[0];
          const met = key === undefined ? undefined : facts.get(key);
          setHovered(key === undefined || met === undefined ? null : { key, type: met.type, layer: met.layer });
        })
        .finally(() => {
          hoveringRef.current = false;
        });
    },
    [drawMarquee, facts, keysUnder, moveCamera, pointOn],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const gesture = gestureRef.current;
      const dragging = dragRef.current !== null;
      gestureRef.current = null;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (gesture === null) return;

      const travelled = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      const on = pointOn(event.currentTarget, event);

      if (gesture.marquee) {
        setMarqueeOn(false);
        // A rectangle that never moved is a Shift+click, and toggles what is under it: a reader who
        // pressed Shift on one entity meant to add it, not to select an area of no extent (I-87).
        if (travelled > CLICK_TRAVEL_PX && on !== null) {
          const at = cameraRef.current;
          const box = marqueeBoxRef.current;
          if (at === null) return;
          const first = worldAt(at, { x: box.left, y: box.top });
          const last = worldAt(at, { x: box.left + box.width, y: box.top + box.height });
          void ask({
            kind: "rect",
            bbox: {
              min: [Math.min(first[0], last[0]), Math.min(first[1], last[1])],
              max: [Math.max(first[0], last[0]), Math.max(first[1], last[1])],
            },
            layers: openLayers(),
          }).then((keys) => hold(keys.filter((key) => facts.has(key))));
          return;
        }
        if (on !== null) void keysUnder(on.world).then((keys) => (keys[0] === undefined ? undefined : toggleKey(keys[0])));
        return;
      }

      // The gesture is over: where it left the camera is published now rather than on the settle.
      if (travelled > CLICK_TRAVEL_PX) {
        if (dragging) moveCamera((held) => held, false);
        return;
      }
      // A click of no travel selects the topmost hit; a click on bare paper lets go of what was held.
      if (on === null) return;
      void keysUnder(on.world).then(async (keys) => {
        const key = keys[0];
        if (key !== undefined) {
          hold([key]);
          return;
        }
        // Nothing here may be taken — but a locked layer is painted, so the reader may have pressed
        // on geometry they can see and may not select. Letting go of what is held would then punish
        // a press on the sheet's own ink: only bare paper clears (Decision § 1, I-87).
        if ((await keysUnder(on.world, false)).length === 0) hold([]);
      });
    },
    [ask, cameraRef, facts, hold, keysUnder, moveCamera, openLayers, pointOn, toggleKey],
  );

  const onPointerLeave = useCallback((): void => setHovered(null), []);

  // The wheel is bound by hand because a passive listener may not stop the page scrolling under it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      moveCamera(
        (held) =>
          zoomCameraAt(held, Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), {
            x: event.clientX - box.left,
            y: event.clientY - box.top,
          }),
        true,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [head, moveCamera]);

  // What is under the pointer is painted from its own buffer, just as cheaply as what is held (PB-3).
  useEffect(() => {
    const painter = painterRef.current;
    if (painter === null) return;
    painter.setHover(hovered === null ? null : (facts.get(hovered.key)?.records[0] ?? null));
    const at = cameraRef.current;
    if (at !== null) draw(at);
  }, [draw, facts, head, hovered]);

  return { hovered, marqueeOn, marqueeRef, marqueeBox: marqueeBoxRef.current, onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
