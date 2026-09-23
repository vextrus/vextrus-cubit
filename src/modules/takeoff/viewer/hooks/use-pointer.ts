/**
 * The pointer over the sheet (Decision § 5): pan, wheel zoom, hover, click, and the Shift rectangle —
 * and, with a measure tool armed, the plain click that places a point while selection is suspended
 * (s-measure I-371, I-372).
 *
 * A gesture is not a render. The pan moves the camera on its ref and the rectangle is written
 * straight onto its element, because sixty pointer events a second are otherwise sixty React renders
 * of the panel and the readout on the painter's own thread (PB-3). What is under the pointer is
 * asked of the index one question at a time, so a moving pointer never queues.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { panCamera, worldAt, zoomCameraAt } from "../client";
import type { HoverFact } from "../../viewer-inspector/inspector-panel";
import { isMeasureTool, type MeasureTool } from "../../viewer-measure/gesture";
import type { SpatialAsk } from "../spatial.worker";
import type { Camera, ViewerHead } from "../types";
import type { SheetFacts } from "./facts";
import { useHandedRef } from "./use-handed-ref";

/** The wheel's own units into a zoom factor — one notch a small step, a trackpad flick a large one. */
const WHEEL_ZOOM_RATE = 0.0015;

/** How far a pointer may travel and still be a click rather than a pan (Decision § 5's px set). */
const CLICK_TRAVEL_PX = 3;

/**
 * How far a press in an armed measure tool may travel and still place a point (s-measure §7's closed
 * px set, I-372's "press-and-drag > 4 px"). Past it the press is a pan and places nothing; short of it
 * the sheet does not move at all, so a hand's tremble never shifts the drawing under a point.
 */
const MEASURE_DRAG_PX = 4;

/** What a drag on the sheet does: select, pan, or — a measure tool armed — place points (I-371). */
export type PointerTool = "select" | "pan" | MeasureTool;

/** The rectangle in stage pixels, as it is written onto the element. */
export type MarqueeBox = { left: number; top: number; width: number; height: number };

export type UsePointerOptions = {
  head: ViewerHead | null;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  cameraRef?: RefObject<Camera | null>;
  facts?: SheetFacts;
  tool?: PointerTool;
  keysUnder: (world: [number, number], takeable?: boolean) => Promise<string[]>;
  ask: (request: SpatialAsk) => Promise<string[]>;
  openLayers: () => string[];
  hold: (keys: string[] | ((held: string[]) => string[])) => void;
  toggleKey: (key: string) => void;
  moveCamera?: (move: (held: Camera) => Camera, live: boolean) => void;
  /** Where the pointer stands in the drawing, and whether Shift is held, for the region that snaps to it (R-TO-012). */
  onHoverWorld?: (world: [number, number], modifiers: { shift: boolean }) => void;
  /** The pointer left the sheet, so there is nothing under it to snap to. */
  onLeaveWorld?: () => void;
  /** A pick taken where the snap stands (I-145: Alt+click, never the plain click that is selection). */
  onPick?: () => void;
  /**
   * A plain click inside an armed measure tool (s-measure I-371): the region places a point where the
   * snap stands. `count` is the click's own count — a double-click's second click finishes the shape
   * and places nothing (I-372).
   */
  onMeasureClick?: (count: number) => void;
  /** Alt+click inside an armed measure tool: it places and picks nothing, and the region says why (I-371). */
  onMeasureAlt?: () => void;
};

export type UsePointer = {
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  /** The click that follows a press of no travel — where an armed measure tool places its point. */
  onClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  /** The pointer left the sheet, so nothing is under it. */
  clearHover: () => void;
  hovered: HoverFact | null;
  marqueeOn: boolean;
  marqueeRef: RefObject<HTMLDivElement | null>;
  marqueeBox: MarqueeBox;
};

export function usePointer({ head, canvasRef, cameraRef, facts, tool = "pan", keysUnder, ask, openLayers, hold, toggleKey, moveCamera, onHoverWorld, onLeaveWorld, onPick, onMeasureClick, onMeasureAlt }: UsePointerOptions): UsePointer {
  const [hovered, setHovered] = useState<HoverFact | null>(null);
  const [marqueeOn, setMarqueeOn] = useState(false);
  const sheet = useHandedRef(canvasRef, null);
  const cameraAt = useHandedRef(cameraRef, null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  /** An armed tool's press, until it travels past the drag tolerance and becomes a pan (I-372). */
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  /** Whether the press just released was a click of an armed tool — the click event that follows places. */
  const placingRef = useRef(false);
  const armed = isMeasureTool(tool);
  /** Where the gesture began, in client pixels, and whether it began a rectangle rather than a pan. */
  const gestureRef = useRef<{ x: number; y: number; marquee: boolean } | null>(null);
  /** The rectangle in stage pixels, written straight onto the element: a marquee is not a render. */
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const marqueeBoxRef = useRef<MarqueeBox>({ left: 0, top: 0, width: 0, height: 0 });
  /** Whether a hover question is already in flight — one at a time, so a moving pointer never queues. */
  const hoveringRef = useRef(false);

  const factOf = useCallback((key: string) => facts?.get(key), [facts]);

  /** Where a client point stands on the canvas, and where that is in the drawing. */
  const pointOn = useCallback(
    (canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }): { px: { x: number; y: number }; world: [number, number] } | null => {
      const at = cameraAt.current;
      if (at === null) return null;
      const box = canvas.getBoundingClientRect();
      const px = { x: event.clientX - box.left, y: event.clientY - box.top };
      return { px, world: worldAt(at, px) };
    },
    [cameraAt],
  );

  /** The marquee's rectangle, in stage pixels, written where the pointer left it. */
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

  // The wheel is bound by hand because a zoom must be able to refuse the page's own scroll, and a
  // React wheel handler is passive.
  useEffect(() => {
    const canvas = sheet.current;
    if (canvas === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      moveCamera?.(
        (held) => zoomCameraAt(held, Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), { x: event.clientX - box.left, y: event.clientY - box.top }),
        true,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [head, moveCamera, sheet]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const on = pointOn(event.currentTarget, event);
      placingRef.current = false;
      // A pick is Alt+click and returns at once (I-145): it never enters the select, pan or marquee
      // path, so plain click, Shift+click and the marquee behave exactly as they did. The point it is
      // taken at is resolved first, so a pick lands where the pointer stands rather than where it was.
      // Inside an armed measure tool the pick is Select's, so Alt+click places and picks nothing and
      // the region says where the pick lives (s-measure I-371).
      if (event.altKey) {
        if (armed) {
          onMeasureAlt?.();
          return;
        }
        if (on !== null) onHoverWorld?.(on.world, { shift: event.shiftKey });
        onPick?.();
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const isMiddle = event.button === 1;
      // An armed tool's press is a point until it travels past the drag tolerance, and a pan after:
      // the plain click belongs to the tool, and selection is suspended (I-371). Where it lands is
      // resolved now, so a point is placed where the pointer stands rather than where it last moved.
      if (armed && !isMiddle) {
        if (on !== null) onHoverWorld?.(on.world, { shift: event.shiftKey });
        gestureRef.current = { x: event.clientX, y: event.clientY, marquee: false };
        pressRef.current = { x: event.clientX, y: event.clientY };
        return;
      }
      const isPan = isMiddle || (tool === "pan" && !event.shiftKey);
      const isMarquee = !isPan && (tool === "select" || event.shiftKey);

      gestureRef.current = { x: event.clientX, y: event.clientY, marquee: isMarquee };
      if (isMarquee && on !== null) {
        drawMarquee(on.px, on.px);
        setMarqueeOn(true);
        return;
      }
      dragRef.current = { x: event.clientX, y: event.clientY };
    },
    [armed, drawMarquee, onHoverWorld, onMeasureAlt, onPick, pointOn, tool],
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

      // An armed tool's press stays a point until it has travelled past the tolerance; from there it
      // is a pan, and the pan starts from the press so the sheet catches up with the whole drag.
      const press = pressRef.current;
      if (press !== null) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= MEASURE_DRAG_PX) return;
        pressRef.current = null;
        dragRef.current = press;
      }

      const from = dragRef.current;
      if (from !== null) {
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        dragRef.current = { x: event.clientX, y: event.clientY };
        moveCamera?.((held) => panCamera(held, -dx, -dy), true);
        return;
      }

      // Nothing is being dragged, so the pointer is reading: what is under it is asked of the index
      // one question at a time, and a pointer over bare paper reads nothing rather than the last
      // thing it read.
      const on = pointOn(event.currentTarget, event);
      if (on === null) return;
      // What the pointer meets on the drawing is resolved here, on the main thread and in the same
      // frame: the glyph must stand under the hand rather than a round trip behind it (R-TO-012).
      onHoverWorld?.(on.world, { shift: event.shiftKey });
      if (hoveringRef.current) return;
      hoveringRef.current = true;
      void keysUnder(on.world)
        .then((keys) => {
          const key = keys[0];
          const fact = key === undefined ? undefined : factOf(key);
          setHovered(key === undefined || fact === undefined ? null : { key, type: fact.type, layer: fact.layer });
        })
        .finally(() => {
          hoveringRef.current = false;
        });
    },
    [drawMarquee, factOf, keysUnder, moveCamera, onHoverWorld, pointOn],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const gesture = gestureRef.current;
      const dragging = dragRef.current !== null;
      const pressed = pressRef.current !== null;
      gestureRef.current = null;
      dragRef.current = null;
      pressRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (gesture === null) return;

      // An armed tool selects nothing (I-371): a press that never became a pan is a click, placed by
      // the click event that follows it — the one that carries the click's own count — and a pan's
      // camera is published where the pan left it.
      if (armed) {
        if (pressed) placingRef.current = true;
        else if (dragging) moveCamera?.((held) => held, false);
        return;
      }

      const travelled = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      const on = pointOn(event.currentTarget, event);

      if (gesture.marquee) {
        setMarqueeOn(false);
        // A rectangle that never moved is a Shift+click, and toggles what is under it: a reader who
        // pressed Shift on one entity meant to add it, not to select an area of no extent (I-87).
        if (travelled > CLICK_TRAVEL_PX && on !== null) {
          const at = cameraAt.current;
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
          }).then((keys) => hold(keys.filter((key) => factOf(key) !== undefined)));
          return;
        }
        // With Shift held it toggles what is under it and leaves bare paper alone. Without Shift
        // it is the plain click below, whichever tool drew the rectangle: the select tool's click
        // selects the topmost hit and, on bare paper, lets go of what was held (Decision § 5's
        // "click", J-011's AC-1) — a select tool whose click could not let go would hold a selection
        // until the reader found the one place that releases it.
        if (event.shiftKey) {
          if (on !== null) void keysUnder(on.world).then((keys) => (keys[0] === undefined ? undefined : toggleKey(keys[0])));
          return;
        }
      }

      // The gesture is over: where it left the camera is published now rather than on the settle.
      if (travelled > CLICK_TRAVEL_PX) {
        if (dragging) moveCamera?.((held) => held, false);
        return;
      }
      // A click of no travel selects the topmost hit; a click on bare paper lets go of what was held.
      if (on === null) return;
      void keysUnder(on.world).then(async (keys) => {
        const key = keys[0];
        if (key !== undefined) {
          if (event.shiftKey) toggleKey(key);
          else hold([key]);
          return;
        }
        // Nothing here may be taken — but a locked layer is painted, so the reader may have pressed
        // on geometry they can see and may not select. Letting go of what is held would then punish
        // a press on the sheet's own ink: only bare paper clears (Decision § 1, I-87).
        if ((await keysUnder(on.world, false)).length === 0) hold([]);
      });
    },
    [armed, ask, cameraAt, factOf, hold, keysUnder, moveCamera, openLayers, pointOn, toggleKey],
  );

  /**
   * The click an armed tool's point is placed on. It is the browser's own click, not the pointer-up,
   * because only the click carries the click's count: the second click of a double-click finishes the
   * shape and places nothing (I-372), which a pointer-up cannot tell from a slow second click.
   */
  const onClick = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>): void => {
      if (!armed || !placingRef.current) return;
      placingRef.current = false;
      onMeasureClick?.(Math.max(1, event.detail));
    },
    [armed, onMeasureClick],
  );

  const clearHover = useCallback((): void => {
    setHovered(null);
    onLeaveWorld?.();
  }, [onLeaveWorld]);

  return { onPointerDown, onPointerMove, onPointerUp, onClick, clearHover, hovered, marqueeOn, marqueeRef, marqueeBox: marqueeBoxRef.current };
}
