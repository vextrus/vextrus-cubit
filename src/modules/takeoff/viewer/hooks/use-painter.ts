/**
 * The sheet on the paper (R-UI-040, PB-2, PB-3): the WebGL painter's whole life — the context, the
 * layers tessellated into it as they arrive, the extents frame, the tokens the canvas cannot
 * inherit, the frame ledger published on the readout, and the moment a reader first sees geometry.
 *
 * A browser that offers no context is not an error and not a blank sheet: nothing is claimed until
 * the browser has been asked, and after that the screen says so in words (I-82).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPainter, type CanvasPalette, type Painter } from "../painter";
import type { Camera, RenderLayer, ViewerHead } from "../types";
import type { ViewerState } from "../client";

/** The canvas colours and the face text is lettered in, resolved from the tokens (Decision § 5). */
export function paletteOf(element: Element): CanvasPalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    paper: token("--canvas-paper"),
    ink: token("--canvas-ink"),
    grid: token("--canvas-grid"),
    mono: token("--font-mono"),
    selection: token("--canvas-selection"),
    hover: token("--canvas-hover"),
    pulse: token("--canvas-pulse"),
  };
}

export interface PainterOptions {
  head: ViewerHead | null;
  canvasRef: { current: HTMLCanvasElement | null };
  stageRef: { current: HTMLElement | null };
  statusRef: { current: HTMLElement | null };
  stateRef: { current: ViewerState };
  cameraRef: { current: Camera | null };
  /** Whether the feed refused: nothing to paint has shown everything it has (PB-2). */
  refused: boolean;
}

export interface PaintedSheet {
  /** The painter itself, for the marks a selection and a hover paint above the sheet. */
  painterRef: { current: Painter | null };
  renderer: "webgl" | "unavailable";
  /** Whether the browser has been asked for a context yet — before that, nothing is claimed (I-82). */
  probed: boolean;
  firstPaint: boolean;
  /** One arrived layer, tessellated into the batch it is drawn from thereafter. */
  take: (layer: RenderLayer) => void;
  /** A frame at this camera, with the posture as it stands. */
  draw: (camera: Camera) => void;
  /** Strike what is held in the pulse colour — a fly-to's arrival (Decision § 4). */
  pulse: (durationMs: number) => void;
}

export function usePainter({ head, canvasRef, stageRef, statusRef, stateRef, cameraRef, refused }: PainterOptions): PaintedSheet {
  const [renderer, setRenderer] = useState<"webgl" | "unavailable">("unavailable");
  const [probed, setProbed] = useState(false);
  const [firstPaint, setFirstPaint] = useState(false);

  const painterRef = useRef<Painter | null>(null);
  /** Every layer whose geometry has arrived, by name — what a re-made painter is rebuilt from. */
  const arrivedRef = useRef<Map<string, RenderLayer>>(new Map());
  const uploadedRef = useRef<Set<string>>(new Set());

  const draw = useCallback(
    (camera: Camera): void => {
      painterRef.current?.draw(camera, stateRef.current);
    },
    [stateRef],
  );

  /** Everything that has arrived and is not on the paper yet, then the frame that shows it. */
  const flush = useCallback(() => {
    const painter = painterRef.current;
    if (painter === null) return;
    for (const [name, layer] of arrivedRef.current) {
      if (uploadedRef.current.has(name)) continue;
      painter.upload(layer);
      uploadedRef.current.add(name);
    }
    const at = cameraRef.current;
    if (at !== null) painter.draw(at, stateRef.current);
  }, []);

  const take = useCallback(
    (layer: RenderLayer): void => {
      arrivedRef.current.set(layer.name, layer);
      flush();
    },
    [flush],
  );

  const pulse = useCallback((durationMs: number): void => {
    painterRef.current?.pulse(durationMs);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (canvas === null || stage === null) return;

    const painter = createPainter(canvas, paletteOf(stage));
    painterRef.current = painter;
    setRenderer(painter === null ? "unavailable" : "webgl");
    setProbed(true);
    if (painter === null) return;

    painter.setFrameListener(() => {
      const status = statusRef.current;
      const stats = painter.frameStats();
      status?.setAttribute("data-frame-median-ms", String(stats.medianMs));
      status?.setAttribute("data-frame-p95-ms", String(stats.p95Ms));
      // First paint is the first geometry on the paper, never the paper alone: a blank sheet drawn
      // before any layer arrived would answer PB-2 with a picture of nothing.
      if (uploadedRef.current.size > 0) setFirstPaint(true);
    });
    flush();

    return () => {
      painter.dispose();
      painterRef.current = null;
      uploadedRef.current.clear();
    };
  }, [flush, head]);

  useEffect(() => {
    const painter = painterRef.current;
    if (painter === null || head?.kind !== "manifest") return;
    painter.setExtents(head.manifest.extents);
  }, [head, renderer]);

  // Nothing to paint is painted at once: a refusal, an absence and a browser with no WebGL are all
  // on screen the moment the head answers, and first paint is what a reader can see (PB-2).
  useEffect(() => {
    if (refused || (head !== null && head.kind !== "manifest")) setFirstPaint(true);
    // A browser that offers no context, and a sheet whose roster is empty, have both shown
    // everything they have the moment they are asked — but only once they have been asked (I-82).
    if (probed && head?.kind === "manifest" && (renderer === "unavailable" || head.manifest.layers.length === 0)) setFirstPaint(true);
  }, [head, probed, refused, renderer]);

  // Decision § 6: the canvas cannot inherit a variable, so the three values are read again whenever
  // the document's theme changes and the same sheet is repainted — no refetch, no camera change.
  // `head` is in the deps because the stage only stands once a sheet does: an observer bound before
  // the head answered would be bound to nothing at all for the rest of the screen's life.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      painterRef.current?.setPalette(paletteOf(stage));
      const at = cameraRef.current;
      if (at !== null) draw(at);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [draw, head]);

  return { painterRef, renderer, probed, firstPaint, take, draw, pulse };
}
