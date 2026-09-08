"use client";
/**
 * The overlay as one concern: asking the sheet feed for `?part=partition` once the head is a
 * manifest, and painting the scene onto the second canvas at every frame the sheet draws.
 *
 * Two questions, two hooks, and neither reaches the string table or the shell — under ARCH-01 this
 * module holds no import of `src/ui`, so the register's codes, the evidence a reader can act on and
 * the chrome are all the screen's to supply. What is here is the feed, the palette, the backing
 * store and the frame.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Camera } from "@/modules/takeoff/viewer/types";
import { drawOverlayScene } from "./paint";
import { overlayScene } from "./scene";
import type { OverlayPalette, OverlayToggles, PartitionOverlay } from "./types";

/** The most a backing store is scaled by, whatever the display claims — s-viewer's own cap (I-112). */
const DEVICE_PIXEL_CAP = 2;

/** The two doors a feed refuses a reader at. They are the SCREEN's to render, through its one home. */
const REFUSED: readonly number[] = [401, 403];

/** What the panel is showing, as its own `data-state` publishes it (R-UI-050). */
export type PartitionOverlayPhase = "loading" | "ready" | "empty" | "failed";

export type UsePartitionOverlay = {
  phase: PartitionOverlayPhase;
  /** The partition read, or null while it is in flight, absent, or unreadable. */
  overlay: PartitionOverlay | null;
  /** The id a fault answer carried, so a reader can quote it (R-UI-050's error leg). */
  faultId: string | null;
  /** Ask again, in place. The sheet is never torn down for it. */
  retry: () => void;
};

export type UsePartitionOverlayOptions = {
  /** The address one part of this sheet is asked at. The screen owns the route (ARCH-01). */
  feed: (query: string) => string;
  /** Whether there is a sheet to overlay yet: a head that is not a manifest is asked nothing. */
  enabled: boolean;
  /** A door that would not answer this reader, by its status — the screen names the register's code. */
  onDenied?: (status: number) => void;
};

/** What the feed answers under `?part=partition` (the route's own shape). */
type PartitionAnswer = { overlay: PartitionOverlay | null; faultId?: string };

export function usePartitionOverlay({ feed, enabled, onDenied }: UsePartitionOverlayOptions): UsePartitionOverlay {
  const [phase, setPhase] = useState<PartitionOverlayPhase>("loading");
  const [overlay, setOverlay] = useState<PartitionOverlay | null>(null);
  const [faultId, setFaultId] = useState<string | null>(null);
  /** Bumped by a retry: the effect below is what asks, so asking again is asking the same way (B-17). */
  const [asked, setAsked] = useState(0);

  // The sink is read off a ref rather than depended on, so a screen that writes its callback inline
  // does not re-ask the feed on every render.
  const sink = useRef(onDenied);
  sink.current = onDenied;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    const open = async (): Promise<void> => {
      setPhase("loading");
      setFaultId(null);
      const answer = await fetch(feed("part=partition"), { signal: controller.signal });
      if (REFUSED.includes(answer.status)) {
        // A refusal is the screen's one RefusalState with the evidence it can act on, never a
        // sentence of this panel's own (R-UI-020, ARCH-03).
        sink.current?.(answer.status);
        setPhase("failed");
        return;
      }
      const body = (await answer.json()) as PartitionAnswer | null;
      if (!answer.ok || body === null || !("overlay" in body)) {
        setFaultId(typeof body?.faultId === "string" ? body.faultId : null);
        setPhase("failed");
        return;
      }
      setOverlay(body.overlay);
      setPhase(body.overlay === null ? "empty" : "ready");
    };

    // Every way the partition can fail to arrive is this region's own error cell, never the sheet's:
    // a partition that cannot be read costs the reader the overlay, not the drawing (Decision § 2).
    void open().catch(() => {
      if (controller.signal.aborted) return;
      setPhase("failed");
    });

    return () => controller.abort();
  }, [asked, enabled, feed]);

  const retry = useCallback((): void => {
    setOverlay(null);
    setAsked((held) => held + 1);
  }, []);

  return { phase, overlay, faultId, retry };
}

export type UseOverlayPaintOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The box the sheet is drawn into: the overlay's own size, and where its tokens are read from. */
  stageRef: RefObject<HTMLElement | null>;
  /** Where the camera stands right now, off the render loop — a frame is not a render (PB-3). */
  cameraRef: RefObject<Camera | null>;
  overlay: PartitionOverlay | null;
  toggles: OverlayToggles;
};

export type UseOverlayPaint = {
  /** Paint this camera now. The screen's own draw callback calls it at every sheet frame (I-112). */
  paintOverlay: (at: Camera) => void;
};

/**
 * The palette the overlay paints with, read from the stage's computed style exactly as s-viewer
 * hands its painter the `--canvas-*` values (I-115). A canvas cannot inherit a variable, so the
 * values are read again whenever the document's theme changes and the same scene is repainted.
 */
function paletteOf(element: Element): OverlayPalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  const size = (name: string): number => Number.parseFloat(token(name));
  return {
    ink: token("--canvas-ink"),
    warn: token("--warn"),
    paper: token("--canvas-paper"),
    // Lettering on the sheet is the sheet's own ink: a second hue for the same mark would be the
    // colour-only channel R-UI-060 forbids, and the chip it stands in is already the paper's.
    label: token("--canvas-ink"),
    mono: token("--font-mono"),
    typeSizePx: size("--text-12"),
    labelSizePx: size("--text-12"),
  };
}

export function useOverlayPaint({ canvasRef, stageRef, cameraRef, overlay, toggles }: UseOverlayPaintOptions): UseOverlayPaint {
  // What is painted, read off a ref: sixty frames a second must not depend on a fresh closure, and
  // the paint callback the screen wires into its draw is written once (PB-3).
  const shown = useRef({ overlay, toggles });
  shown.current = { overlay, toggles };

  const paintOverlay = useCallback(
    (at: Camera): void => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (canvas === null || stage === null) return;
      const context = canvas.getContext("2d");
      if (context === null) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, DEVICE_PIXEL_CAP);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const held = shown.current.overlay;
      const scene = held === null ? { outlines: [], axes: [] } : overlayScene(held, shown.current.toggles, { ...at, viewport: { width, height } });
      drawOverlayScene(context, scene, paletteOf(stage), { width, height });
    },
    [canvasRef, stageRef],
  );

  /** The same frame again, at the camera held — what a switch, a theme and an arrival all ask for. */
  const repaint = useCallback((): void => {
    const at = cameraRef.current;
    if (at !== null) paintOverlay(at);
  }, [cameraRef, paintOverlay]);

  // A switch flipped, or a partition that has just arrived, lands on the next frame: the overlay
  // never tweens, because an outline is data and fading it in would read as uncertainty (§ 4).
  useEffect(() => {
    repaint();
  }, [overlay, repaint, toggles]);

  // Decision § 6: the canvas cannot inherit a variable, so the palette is read again whenever the
  // document's theme changes and the same scene is repainted — no refetch, no camera change.
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => repaint());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [repaint]);

  return { paintOverlay };
}
