"use client";
/**
 * The quantity overlay as one concern: asking the sheet feed for `?part=quantities` the first time a
 * reader turns the overlay on, and painting the scene onto the third canvas at every frame the sheet
 * draws.
 *
 * It is asked LAZILY, where the partition is asked at the manifest: the overlay opens off, so a sheet
 * nobody turns it on for never pays for a reading of the campaign (R-UI-043, PB-3), and once read it
 * is held — turning the switch off and on again repaints what is held and asks nothing.
 *
 * Under ARCH-01 this module holds no import of `src/ui`: the glyphs, the words and the chrome are the
 * screen's to supply. What is here is the feed, the palette, the backing store and the frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { CONDITION_COLOURS, type ConditionColour } from "@/core/manual/law";
import { QUANTITY_BASES, type QuantityBasis } from "@/core/offers/law";
import type { Camera } from "@/modules/takeoff/viewer/types";
import { drawQuantityScene } from "./paint";
import { quantityScene } from "./scene";
import type { QuantityOverlay, QuantityPalette, QuantityToggles } from "./types";

/** The most a backing store is scaled by, whatever the display claims — s-viewer's own cap (I-112). */
const DEVICE_PIXEL_CAP = 2;

/** The two doors a feed refuses a reader at. They are the SCREEN's to render, through its one home. */
const REFUSED: readonly number[] = [401, 403];

/** What the legend is showing, as its own `data-state` publishes it (R-UI-050). */
export type QuantityOverlayPhase = "idle" | "loading" | "ready" | "empty" | "failed" | "refused";

export type UseQuantityOverlay = {
  phase: QuantityOverlayPhase;
  /** The campaign's quantities on this sheet, or null while unasked, in flight, absent or unreadable. */
  overlay: QuantityOverlay | null;
  /** The id a fault answer carried, so a reader can quote it. */
  faultId: string | null;
  /** The status a door refused THIS read at: the region's own answer, never the sheet's. */
  refusedStatus: number | null;
  retry: () => void;
};

export type UseQuantityOverlayOptions = {
  /** The address one part of this sheet is asked at. The screen owns the route (ARCH-01). */
  feed: (query: string) => string;
  /** Whether there is a drawn sheet AND the reader has turned the overlay on at least once. */
  enabled: boolean;
};

/** What the feed answers under `?part=quantities` (the route's own shape). */
type QuantitiesAnswer = { quantities: QuantityOverlay | null; faultId?: string };

export function useQuantityOverlay({ feed, enabled }: UseQuantityOverlayOptions): UseQuantityOverlay {
  const [phase, setPhase] = useState<QuantityOverlayPhase>("idle");
  const [overlay, setOverlay] = useState<QuantityOverlay | null>(null);
  const [faultId, setFaultId] = useState<string | null>(null);
  const [refusedStatus, setRefusedStatus] = useState<number | null>(null);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const open = async (): Promise<void> => {
      setPhase("loading");
      setFaultId(null);
      setRefusedStatus(null);
      const answer = await fetch(feed("part=quantities"), { signal: controller.signal });
      if (REFUSED.includes(answer.status)) {
        setRefusedStatus(answer.status);
        setPhase("refused");
        return;
      }
      const body = (await answer.json()) as QuantitiesAnswer | null;
      if (!answer.ok || body === null || !("quantities" in body)) {
        setFaultId(typeof body?.faultId === "string" ? body.faultId : null);
        setPhase("failed");
        return;
      }
      setOverlay(body.quantities);
      setPhase(body.quantities === null || (body.quantities.placements.length === 0 && body.quantities.elsewhere.length === 0) ? "empty" : "ready");
    };
    // Every way the quantities can fail to arrive is the legend's own error cell, never the sheet's.
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

  return { phase, overlay, faultId, refusedStatus, retry };
}

/** A basis as its palette token spells it: `MEASURED` → `--basis-measured`. */
function basisToken(basis: QuantityBasis): string {
  return `--basis-${basis.toLowerCase()}`;
}

/**
 * The palette the overlay paints with, read from the stage's computed style exactly as the partition
 * overlay reads its own (I-115): the element palette a condition's colour names (I-374), the basis
 * palette (R-UI-002), the warn token and the sheet's paper. The glyphs are handed in from their one home.
 */
function paletteOf(element: Element, glyphs: Readonly<Record<QuantityBasis, string>>): QuantityPalette {
  const style = getComputedStyle(element);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  return {
    condition: Object.fromEntries(CONDITION_COLOURS.map((colour) => [colour, token(`--element-${colour}`)])) as Record<ConditionColour, string>,
    basis: Object.fromEntries(QUANTITY_BASES.map((basis) => [basis, token(basisToken(basis))])) as Record<QuantityBasis, string>,
    glyph: glyphs,
    warn: token("--warn"),
    paper: token("--canvas-paper"),
    mono: token("--font-mono"),
    glyphSizePx: Number.parseFloat(token("--text-12")),
  };
}

export type UseQuantityPaintOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  cameraRef: RefObject<Camera | null>;
  overlay: QuantityOverlay | null;
  toggles: QuantityToggles;
  /** R-UI-002's glyph table, from its one home — handed in, because this module may not reach `src/ui`. */
  glyphs: Readonly<Record<QuantityBasis, string>>;
};

export function useQuantityPaint({ canvasRef, stageRef, cameraRef, overlay, toggles, glyphs }: UseQuantityPaintOptions): { paintQuantities: (at: Camera) => void } {
  const shown = useRef({ overlay, toggles, glyphs });
  shown.current = { overlay, toggles, glyphs };

  const paintQuantities = useCallback(
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
      // The sheet's own camera, box and all: the fills lie on the members the drawing drew (I-661).
      const scene = held === null ? { fills: [] } : quantityScene(held, shown.current.toggles, at);
      drawQuantityScene(context, scene, paletteOf(stage, shown.current.glyphs), { width, height });
    },
    [canvasRef, stageRef],
  );

  const repaint = useCallback((): void => {
    const at = cameraRef.current;
    if (at !== null) paintQuantities(at);
  }, [cameraRef, paintQuantities]);

  // A switch flipped or the quantities arriving land on the next frame, untweened: a fill is data (§ 4).
  useEffect(() => {
    repaint();
  }, [overlay, repaint, toggles]);

  // The canvas cannot inherit a variable, so the palette is read again whenever the theme changes.
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => repaint());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [repaint]);

  return useMemo(() => ({ paintQuantities }), [paintQuantities]);
}
