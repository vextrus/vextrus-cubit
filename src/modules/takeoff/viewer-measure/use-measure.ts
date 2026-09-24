"use client";
/**
 * S-Measure's armed tools as one concern (s-measure §2, I-371, I-372): the shape in progress, the
 * point a click places, the live point the running figure is measured to, and the paint of it all on
 * the measure canvas.
 *
 * The grammar is `./gesture.ts`, the figure `./figure.ts`, the scene `./scene.ts` and the paint
 * `./paint.ts`; what is here is the state a QS changes and the wiring to the sheet the screen already
 * holds. Under ARCH-01 this module holds no import of `src/ui`: every element and every sentence of
 * the region is the route's (`measure-region.tsx`), and this hook answers data — including the basis
 * glyphs it paints, which the route hands in from R-UI-002's one table.
 *
 * A pointer move is not a render (PB-3). The live point reaches this hook through the snapping
 * region's sink, off the render loop; the canvas is painted and the route's label and reticle are
 * written straight onto their elements, and React state is set only when what the status SAYS
 * changes — a point placed, a note, the view under the pointer turning unscaled.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { quantise } from "@/core/identity/keys";
import { weakestBasis, type QuantityBasis } from "@/core/offers/law";
import { parseSourceKey, type SourceScheme } from "@/core/sources";
import { panCamera } from "@/modules/takeoff/viewer/client";
import type { Camera } from "@/modules/takeoff/viewer/types";
import { screenAt } from "@/modules/takeoff/viewer-partition-overlay/scene";
import type { SnapPoint, SnapResult } from "@/modules/takeoff/viewer-snap/types";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { figureOf, type MeasureFigure } from "./figure";
import { NO_DRAFT, anchorOf, busy, isMeasureTool, pointsOf, step, type GestureInput, type GestureNote, type MeasureDraft, type MeasurePoint, type MeasureTool, type PointBasis } from "./gesture";
import { drawMeasureScene, type MeasurePalette } from "./paint";
import { measureScene, type MeasureAt } from "./scene";

/** The most a backing store is scaled by, whatever the display claims — the viewer's own cap (I-112). */
const DEVICE_PIXEL_CAP = 2;

/** The source-key scheme of a traced raster primitive (M4P): a point met on one is INTERPRETED (L-QTY-01). */
const RASTER_SCHEME: SourceScheme = "RASTER_TRACE";

/** A view of the sheet as the partition stands it: its key and its box, where it has one. */
export type MeasureView = { readonly viewKey: string; readonly box: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } | null };

/** Why a click places nothing where the pointer stands (s-measure §3, reason 7). */
export type MeasureRefusal = "unscaled";

/** A note the region words: the grammar's own, and the two a click earns before the grammar is asked. */
export type MeasureNote = GestureNote | { readonly kind: "pick-in-select" } | { readonly kind: "unscaled" };

/** What the route is told as the live point moves: where it stands, what the shape measures with it, and why a click would place nothing. */
export type MeasureLive = { readonly at: MeasureAt; readonly figure: MeasureFigure | null; readonly refusal: MeasureRefusal | null };

export type UseMeasureOptions = {
  /** The pointer's mode; a measure tool is armed where it is one (I-371). */
  tool: string;
  /** The snapping region: the live point, its anchor and Shift, one home for all three (I-372). */
  snap: UseSnap;
  cameraRef: RefObject<Camera | null>;
  /** The stage the canvas stands in: its tokens are read from it, and the keyboard cursor stays inside it. */
  stageRef: RefObject<HTMLElement | null>;
  /** The partition's views, and which of them no scale of record measures — the scale door's one answer (I-160). */
  views: readonly MeasureView[];
  unscaled: ReadonlyMap<string, string>;
  /** R-UI-002's glyph per basis, handed in by the route that holds the one table (ARCH-01, B-17). */
  glyphs: Readonly<Record<PointBasis, string>>;
  /** Where the route writes the running figure's label and the reticle, straight onto their elements (PB-3). */
  onLive?: (live: MeasureLive | null) => void;
  /** A placed segment's length in the route's words, lettered at its midpoint (Linear, §2.1). */
  letter?: (from: readonly [number, number], to: readonly [number, number]) => string | null;
  moveCamera?: (move: (held: Camera) => Camera, live: boolean) => void;
  /** Escape with nothing in progress: the host returns to Select (I-372). */
  onLeave?: () => void;
  /** Whether finishing opens the card: a condition is picked, so what is finished may be recorded (S6, I-497). */
  card?: boolean;
};

export type UseMeasure = {
  /** The armed tool, or null in Select and Pan. */
  armed: MeasureTool | null;
  /** Area only: each ring is a rectangle spanned by two corners (the M menu's Rectangle). */
  rectangle: boolean;
  setRectangle: (on: boolean) => void;
  draft: MeasureDraft;
  /** Is a shape in progress — what a tool key, a tool button or a click on the draft must not cost. */
  busy: boolean;
  /** The weakest basis over every placed point, or null with nothing placed (I-387's roll-up). */
  basis: QuantityBasis | null;
  /** What the placed shape measures, with no live point: the status cell's figure. */
  figure: MeasureFigure | null;
  /** The last note and a serial, so the same note said twice is said twice. */
  note: { readonly note: MeasureNote; readonly serial: number } | null;
  /** Why a click where the pointer stands would place nothing, or null. */
  refusal: MeasureRefusal | null;
  /** Whether the browser is online (§3's offline cell: the reader may draw; only Confirm waits). */
  online: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** One input of the grammar, from a key or a control. */
  input: (input: GestureInput) => void;
  /** A plain click of the armed tool: a point where the snap stands, or — a second click — finish. */
  click: (count: number) => void;
  /** Alt+click in an armed tool: nothing is placed, and the status says where the pick lives (I-371). */
  alt: () => void;
  /** The keyboard cursor moved by whole screen pixels (R-UI-060, §2.2). */
  nudge: (dx: number, dy: number) => void;
  /** One frame of the measure canvas at the camera the sheet was drawn at (the screen's draw calls it). */
  paint: (at: Camera) => void;
  /** The shape was recorded (the card's Confirm, S6): nothing is in progress any more, and the tool stays armed. */
  settle: () => void;
};

/** The browser's own answer to "am I online", asked where it is used and re-asked when it changes. */
const ONLINE = {
  subscribe: (onChange: () => void): (() => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  },
  here: (): boolean => typeof navigator === "undefined" || navigator.onLine !== false,
  there: (): boolean => true,
} as const;

/** The view a world point stands in: the innermost box that holds it, or null where none does. */
export function viewAt(views: readonly MeasureView[], point: SnapPoint): MeasureView | null {
  let found: MeasureView | null = null;
  let area = Number.POSITIVE_INFINITY;
  for (const view of views) {
    const box = view.box;
    if (box === null) continue;
    if (point[0] < box.min[0] || point[0] > box.max[0] || point[1] < box.min[1] || point[1] > box.max[1]) continue;
    const size = (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]);
    if (size < area) {
      found = view;
      area = size;
    }
  }
  return found;
}

/** A point met on the drawing, as a placed point wears it: MEASURED on vector geometry, INTERPRETED on raster (I-387). */
function metPoint(met: SnapResult): MeasurePoint {
  const raster = met.sourceKeys.some((key) => parseSourceKey(key)?.startsWith(`${RASTER_SCHEME}:`) === true);
  return { at: [met.point[0], met.point[1]], basis: raster ? "INTERPRETED" : "MEASURED", sourceKeys: [...met.sourceKeys] };
}

/**
 * The point a click places (I-385, I-387). Where the live point is exactly the point the snap met,
 * it is that drawn point, at the drawing's own coordinate. Anywhere else it is free: the pointer's
 * world point carried onto the register's 0.1 lattice — except a coordinate a constraint copied
 * exactly from the anchor, which stays the anchor's own, so an ortho segment stays exactly square
 * (I-499).
 */
export function placedPoint(live: { readonly point: SnapPoint; readonly met: SnapResult | null }, anchor: readonly [number, number] | null): MeasurePoint {
  const { point, met } = live;
  if (met !== null && met.point[0] === point[0] && met.point[1] === point[1]) return metPoint(met);
  const x = anchor !== null && point[0] === anchor[0] ? anchor[0] : Number(quantise(point[0]));
  const y = anchor !== null && point[1] === anchor[1] ? anchor[1] : Number(quantise(point[1]));
  return { at: [x, y], basis: "ENTERED", sourceKeys: [] };
}

/** The draft and the tool it was drawn with: a draft of another tool is nothing in progress. */
type Held = { readonly tool: MeasureTool | null; readonly draft: MeasureDraft };

/** The palette the canvas paints with, read from the stage's computed tokens (I-115's idiom). */
function paletteOf(element: Element, glyphs: Readonly<Record<PointBasis, string>>): MeasurePalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  const size = (name: string, fallback: number): number => {
    const read = Number.parseFloat(token(name));
    return Number.isFinite(read) ? read : fallback;
  };
  return {
    measure: token("--canvas-measure"),
    paper: token("--canvas-paper"),
    basis: { MEASURED: token("--basis-measured"), ENTERED: token("--basis-entered"), INTERPRETED: token("--basis-interpreted") },
    glyphs,
    font: token("--font-mono"),
    // §7's closed px set: 10 px basis glyphs on placed points; the lengths at the caption's 12.
    glyphPx: 10,
    labelPx: size("--text-12", 12),
  };
}

export function useMeasure({ tool, snap, cameraRef, stageRef, views, unscaled, glyphs, onLive, letter, moveCamera, onLeave, card = false }: UseMeasureOptions): UseMeasure {
  const armed = isMeasureTool(tool) ? tool : null;
  const [rectangle, setRectangle] = useState(false);
  const [held, setHeld] = useState<Held>({ tool: null, draft: NO_DRAFT });
  const [note, setNote] = useState<{ note: MeasureNote; serial: number } | null>(null);
  const [refusal, setRefusal] = useState<MeasureRefusal | null>(null);
  const online = useSyncExternalStore(ONLINE.subscribe, ONLINE.here, ONLINE.there);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A draft belongs to the tool it was drawn with: arming another tool or leaving to Select is
  // nothing in progress, without an effect to clear it (the grammar never lets a tool change mid-shape).
  const draft = held.tool === armed ? held.draft : NO_DRAFT;

  /**
   * What a gesture reads between renders. A handler writes the draft it made into the ref as it makes
   * it, so two inputs inside one render — a double-click's place-then-finish — read one another;
   * the rest is the render's, carried over at every render (PB-3's idiom in `use-snap`).
   */
  const heldRef = useRef<Held>(held);
  const ownRef = useRef({ armed, rectangle, views, unscaled, glyphs, onLive, letter, moveCamera, onLeave, card, calibration: snap.calibration });
  // Offline, a finished shape opens no card: it stays a draft, and Enter opens it once the connection returns (§ 3).
  ownRef.current = { armed, rectangle, views, unscaled, glyphs, onLive, letter, moveCamera, onLeave, card: card && online, calibration: snap.calibration };
  const liveRef = useRef<{ point: SnapPoint; met: SnapResult | null } | null>(null);
  const refusalRef = useRef<MeasureRefusal | null>(null);
  const serial = useRef(0);

  const current = useCallback((): MeasureDraft => (heldRef.current.tool === ownRef.current.armed ? heldRef.current.draft : NO_DRAFT), []);

  /** Why a click at this point would place nothing: it stands in a view with no scale of record (§2.3). */
  const refusalAt = useCallback((point: SnapPoint): MeasureRefusal | null => {
    const view = viewAt(ownRef.current.views, point);
    return view !== null && ownRef.current.unscaled.has(view.viewKey) ? "unscaled" : null;
  }, []);

  /** The canvas, painted at a camera: the scene of the shape and the live point, or nothing. */
  const paintAt = useCallback(
    (at: Camera): void => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (canvas === null || stage === null) return;
      const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
      if (context === null) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, DEVICE_PIXEL_CAP);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const own = ownRef.current;
      const scene =
        own.armed === null ? null : measureScene({ tool: own.armed, rectangle: own.rectangle, draft: current(), live: liveRef.current?.point ?? null, camera: { ...at, viewport: { width, height } } });
      if (scene === null || (scene.rings.length === 0 && scene.points.length === 0)) {
        context.clearRect(0, 0, width, height);
        return;
      }
      drawMeasureScene(context, scene, paletteOf(stage, own.glyphs), { width, height }, own.letter);
    },
    [current, stageRef],
  );

  /** The route told where the live point stands, what the shape measures with it and why a click would place nothing. */
  const emit = useCallback(
    (at: Camera | null): void => {
      const own = ownRef.current;
      const live = liveRef.current;
      if (own.armed === null || at === null || live === null) {
        own.onLive?.(null);
        return;
      }
      const [x, y] = screenAt(at, live.point);
      const figure = figureOf({ tool: own.armed, rectangle: own.rectangle, draft: current(), live: live.point, calibration: own.calibration });
      own.onLive?.({ at: { x, y }, figure, refusal: refusalRef.current });
    },
    [current],
  );

  /** The live point moved (the snapping region's sink): repaint, re-emit, and say a refusal where it changed. */
  const onLiveMove = useCallback(
    (point: SnapPoint | null, met: SnapResult | null): void => {
      liveRef.current = point === null ? null : { point, met };
      if (ownRef.current.armed === null) return;
      const now = point === null ? null : refusalAt(point);
      if (now !== refusalRef.current) {
        refusalRef.current = now;
        setRefusal(now);
      }
      const at = cameraRef.current;
      emit(at);
      if (at !== null) paintAt(at);
    },
    [cameraRef, emit, paintAt, refusalAt],
  );

  // The sink is the snapping region's; this hook's listener is written into it for as long as it stands.
  useEffect(() => {
    const sink = snap.liveSink;
    sink.current = onLiveMove;
    return () => {
      if (sink.current === onLiveMove) sink.current = null;
    };
  }, [onLiveMove, snap.liveSink]);

  // The path's anchor follows the shape: Shift, Ortho and Angle constrain from its last point, and a
  // perpendicular drops from it (I-372). While a tool is armed a pick taken in Select anchors nothing
  // — before the first point there is no anchor at all; back in Select the anchor is pick 1's again.
  const setPathAnchor = snap.setPathAnchor;
  useEffect(() => {
    setPathAnchor(armed === null ? null : anchorOf(draft, armed), armed !== null);
  }, [armed, draft, setPathAnchor]);

  // A shape that changed, a tool armed or left, a rectangle chosen: the canvas and the label say so on
  // the next frame, whether or not the pointer moves.
  useEffect(() => {
    const at = cameraRef.current;
    emit(at);
    if (at !== null) paintAt(at);
  }, [armed, cameraRef, draft, emit, paintAt, rectangle]);

  const say = useCallback((said: MeasureNote): void => {
    serial.current += 1;
    setNote({ note: said, serial: serial.current });
  }, []);

  const input = useCallback(
    (given: GestureInput): void => {
      const own = ownRef.current;
      if (own.armed === null) return;
      const corner = (at: readonly [number, number]): MeasurePoint => {
        // A rectangle's derived corner is MEASURED only where the drawing has a point exactly there (I-500).
        const met = snap.snapAt(at);
        return met !== null && met.point[0] === at[0] && met.point[1] === at[1] ? metPoint(met) : { at, basis: "ENTERED", sourceKeys: [] };
      };
      const next = step(current(), given, { tool: own.armed, rectangle: own.rectangle, card: own.card, corner });
      heldRef.current = { tool: own.armed, draft: next.draft };
      setHeld(heldRef.current);
      if (next.note !== null) say(next.note);
      if (next.note?.kind === "leave") own.onLeave?.();
    },
    [current, say, snap],
  );

  const place = useCallback((): void => {
    const own = ownRef.current;
    if (own.armed === null) return;
    const live = snap.liveNow();
    if (live === null) return;
    // Over a view with no scale of record a click places nothing, and the status says why (§2.3).
    if (refusalAt(live.point) !== null) {
      say({ kind: "unscaled" });
      return;
    }
    input({ kind: "point", point: placedPoint(live, anchorOf(current(), own.armed)) });
  }, [current, input, refusalAt, say, snap]);

  const click = useCallback((count: number): void => (count >= 2 ? input({ kind: "finish" }) : place()), [input, place]);

  const alt = useCallback((): void => say({ kind: "pick-in-select" }), [say]);

  const settle = useCallback((): void => {
    heldRef.current = { tool: ownRef.current.armed, draft: NO_DRAFT };
    setHeld(heldRef.current);
  }, []);

  const nudge = useCallback(
    (dx: number, dy: number): void => {
      const at = cameraRef.current;
      if (ownRef.current.armed === null || at === null) return;
      const from = snap.liveNow()?.raw ?? at.centre;
      const world: SnapPoint = [from[0] + dx / at.scale, from[1] - dy / at.scale];
      snap.onHover(world);
      // The camera follows the keyboard cursor: it pans when the point comes within the stage's edge
      // band, so no pan chord is needed and none is invented (§2.2).
      const stage = stageRef.current;
      const edge = stage === null ? 0 : Number.parseFloat(getComputedStyle(stage).getPropertyValue("--space-5")) || 0;
      const [x, y] = screenAt(at, world);
      const panX = x < edge ? x - edge : x > at.viewport.width - edge ? x - (at.viewport.width - edge) : 0;
      const panY = y < edge ? y - edge : y > at.viewport.height - edge ? y - (at.viewport.height - edge) : 0;
      if (panX !== 0 || panY !== 0) {
        ownRef.current.moveCamera?.((held) => panCamera(held, panX, panY), false);
        emit(cameraRef.current);
      }
    },
    [cameraRef, emit, snap, stageRef],
  );

  const paint = useCallback(
    (at: Camera): void => {
      // The label and the reticle follow the sheet while it pans, as the paint does (PB-3).
      emit(at);
      paintAt(at);
    },
    [emit, paintAt],
  );

  // The calibration carries the sheet's windows, so the figure knows a paper sheet from the door's
  // answer, never from whichever records have streamed in so far (I-501).
  const figure = useMemo(() => (armed === null ? null : figureOf({ tool: armed, rectangle, draft, live: null, calibration: snap.calibration })), [armed, draft, rectangle, snap.calibration]);
  const basis = useMemo(() => {
    const placed = pointsOf(draft).map((entry) => entry.point.basis);
    return placed.length === 0 ? null : weakestBasis(placed);
  }, [draft]);

  // One answer per change, so the slots that show it are re-set only when what they show moved (PB-3).
  const shownRefusal = armed === null ? null : refusal;
  return useMemo(
    () => ({ armed, rectangle, setRectangle, draft, busy: busy(draft), basis, figure, note, refusal: shownRefusal, online, canvasRef, input, click, alt, nudge, paint, settle }),
    [alt, armed, basis, click, draft, figure, input, note, nudge, online, paint, rectangle, settle, shownRefusal],
  );
}
