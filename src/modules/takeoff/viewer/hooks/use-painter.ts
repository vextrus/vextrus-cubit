/**
 * The painted sheet (R-UI-040, Decision § 5/§ 6): the WebGL context, the batches each arrived layer
 * is tessellated into, the marks for what is held and what is under the pointer, the extents frame,
 * the canvas palette, and the frame ledger the readout publishes.
 *
 * What is held and what is hovered are painted from their own buffers, so a selection of a whole
 * sheet costs no re-tessellation of a single layer batch (PB-3). Only what is drawn is marked: a
 * selected entity whose layer is then hidden, isolated away or failed stays listed and stays in `s`
 * — the address is the state — but it is not painted, because a mark on a layer that is not there
 * would be paint claiming to sit on geometry nobody can see (Decision § 2's partial).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPainter, type CanvasPalette, type Painter } from "../painter";
import type { HoverFact } from "../../viewer-inspector/inspector-panel";
import type { ViewerState } from "../client";
import type { Camera, RenderLayer, ViewerHead } from "../types";
import { createSheetFacts, type SheetFacts } from "./facts";
import { useHandedRef } from "./use-handed-ref";

/** A sheet nobody has learned anything about yet — nothing is marked, because nothing is known. */
const EMPTY_FACTS: SheetFacts = createSheetFacts();

/** The canvas colours and the face text is lettered in, resolved from the tokens (Decision § 5). */
function paletteOf(element: Element): CanvasPalette {
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

export type UsePainterOptions = {
  head: ViewerHead | null;
  /** Whether a door refused this reader: nothing to paint is on screen the moment it is known. */
  refused?: boolean;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  stageRef?: RefObject<HTMLElement | null>;
  statusRef?: RefObject<HTMLElement | null>;
  /** The painter itself, held by the screen so every concern reaches the same one (B-17). */
  painterRef?: RefObject<Painter | null>;
  stateRef?: RefObject<ViewerState | null>;
  cameraRef?: RefObject<Camera | null>;
  /** Every layer whose geometry has arrived, by name — what is tessellated and drawn. */
  layers?: RefObject<Map<string, RenderLayer>>;
  facts?: SheetFacts;
  loadedLayers?: number;
  /** The layers being painted right now, as one value an effect can be keyed on. */
  drawnLayers?: string;
  selection?: readonly string[];
  hovered?: HoverFact | null;
};

export type UsePainter = {
  renderer: "webgl" | "unavailable";
  /** Whether the browser has been asked for a context yet — before that, nothing is claimed (I-82). */
  probed: boolean;
  firstPaint: boolean;
};

export function usePainter(options: UsePainterOptions): UsePainter {
  const { head, refused = false, canvasRef, stageRef, statusRef, painterRef, stateRef, cameraRef, layers } = options;
  const { facts = EMPTY_FACTS, loadedLayers = 0, drawnLayers = "", selection = [], hovered = null } = options;

  const [renderer, setRenderer] = useState<"webgl" | "unavailable">("unavailable");
  const [probed, setProbed] = useState(false);
  const [firstPaint, setFirstPaint] = useState(false);
  const uploadedRef = useRef<Set<string>>(new Set());
  const canvas = useHandedRef(canvasRef, null);
  const stage = useHandedRef(stageRef, null);
  const status = useHandedRef(statusRef, null);
  const brush = useHandedRef(painterRef, null);
  const posture = useHandedRef(stateRef, null);
  const cameraAt = useHandedRef(cameraRef, null);
  const sheet = useHandedRef<Map<string, RenderLayer> | null>(layers, null);

  /** A frame at the camera held, drawn through the posture the panel is showing. */
  const paint = useCallback(
    (painter: Painter): void => {
      const at = cameraAt.current;
      const state = posture.current;
      if (at !== null && state !== null) painter.draw(at, state);
    },
    [cameraAt, posture],
  );

  /** Every layer that has arrived and is not in a batch yet, then a frame at the camera held. */
  const flush = useCallback((): void => {
    const painter = brush.current;
    if (painter === null) return;
    for (const [name, layer] of sheet.current ?? []) {
      if (uploadedRef.current.has(name)) continue;
      painter.upload(layer);
      uploadedRef.current.add(name);
    }
    paint(painter);
  }, [brush, paint, sheet]);

  useEffect(() => {
    const element = canvas.current;
    const box = stage.current;
    if (element === null || box === null) return;

    const painter = createPainter(element, paletteOf(box));
    brush.current = painter;
    setRenderer(painter === null ? "unavailable" : "webgl");
    setProbed(true);
    if (painter === null) return;

    painter.setFrameListener(() => {
      const readout = status.current;
      const stats = painter.frameStats();
      readout?.setAttribute("data-frame-median-ms", String(stats.medianMs));
      readout?.setAttribute("data-frame-p95-ms", String(stats.p95Ms));
      // First paint is the first geometry on the paper, never the paper alone: a blank sheet drawn
      // before any layer arrived would answer PB-2 with a picture of nothing.
      if (uploadedRef.current.size > 0) setFirstPaint(true);
    });
    flush();

    return () => {
      painter.dispose();
      brush.current = null;
      uploadedRef.current.clear();
    };
  }, [brush, canvas, flush, head, stage, status]);

  // One more layer on the paper: it is tessellated and drawn as it arrives, never in one lump at the
  // end, so first paint is the first layer of a heavy sheet (R-UI-043, PB-2).
  useEffect(() => {
    flush();
  }, [flush, loadedLayers]);

  useEffect(() => {
    if (head?.kind !== "manifest") return;
    brush.current?.setExtents(head.manifest.extents);
  }, [brush, head, renderer]);

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
  useEffect(() => {
    const box = stage.current;
    if (box === null || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      const painter = brush.current;
      if (painter === null) return;
      painter.setPalette(paletteOf(box));
      paint(painter);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [brush, head, paint, stage]);

  useEffect(() => {
    const painter = brush.current;
    if (painter === null) return;
    const painted = new Set(drawnLayers === "" ? [] : drawnLayers.split("\n"));
    painter.setSelection(
      selection.flatMap((key) => {
        const fact = facts.get(key);
        return fact === undefined || !painted.has(fact.layer) ? [] : fact.records;
      }),
    );
    paint(painter);
  }, [brush, drawnLayers, facts, head, loadedLayers, paint, selection]);

  useEffect(() => {
    const painter = brush.current;
    if (painter === null) return;
    painter.setHover(hovered === null ? null : (facts.get(hovered.key)?.records[0] ?? null));
    paint(painter);
  }, [brush, facts, head, hovered, paint]);

  return { renderer, probed, firstPaint };
}
