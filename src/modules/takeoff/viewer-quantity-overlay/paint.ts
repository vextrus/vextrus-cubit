// R-TO-015's paint: one quantity scene onto the third canvas, in CSS pixels, over the sheet and under
// the views/grid overlay.
//
// It is paint and nothing else — no hit-test, no camera, no selection, no address. The canvas lies
// above `viewer-canvas` with `pointer-events: none` (I-112's rule, extended).
//
// Every distinction is carried twice (R-UI-060, R-UI-002): a measured member is filled in its
// condition's colour with the condition's own hatch over it, and outlined in its BASIS colour with the
// basis GLYPH at its centre — so the basis survives greyscale by its glyph and the condition by its
// hatch. A member seen and not billed is never filled: it wears the warn token's hatch and a dashed
// outline, which is the partition overlay's untyped-view idiom — "this measures nothing" says itself
// one way on the sheet (I-160). No colour is spelled here: every one arrives resolved from a token.
import { LEGIBLE_TEXT_PX } from "@/modules/takeoff/viewer/client";
import type { ConditionHatch } from "@/core/manual/law";
import type { QuantityFill, QuantityPalette, QuantityScene } from "./types";

/** How strongly a fill tints the sheet under it: enough to read the condition, never enough to hide the linework. */
const FILL_ALPHA = 0.3;

/** A basis outline's weight, and the unmeasured outline's dash. */
const BASIS_STROKE_PX = 1.5;
const UNMEASURED_DASH: readonly number[] = [4, 3];

/** The pitch every hatch is drawn at, and the smallest a member is painted at so a tiny one still reads. */
const HATCH_PITCH_PX = 6;
const MIN_MARK_PX = 6;

/** Padding around a basis glyph's paper chip. */
const GLYPH_PAD_PX = 2;

/** The member's shape as a path: its own rings where its outline carries them, else its box. */
function trace(context: CanvasRenderingContext2D, fill: QuantityFill): void {
  context.beginPath();
  if (fill.rings.length > 0) {
    for (const ring of fill.rings) {
      ring.forEach((point, at) => (at === 0 ? context.moveTo(point[0], point[1]) : context.lineTo(point[0], point[1])));
      context.closePath();
    }
    return;
  }
  const width = Math.max(fill.rect.width, MIN_MARK_PX);
  const height = Math.max(fill.rect.height, MIN_MARK_PX);
  context.rect(fill.rect.x + (fill.rect.width - width) / 2, fill.rect.y + (fill.rect.height - height) / 2, width, height);
}

/** One family of parallel lines across the member's box, at this angle — the building block of every hatch. */
function lines(context: CanvasRenderingContext2D, rect: QuantityFill["rect"], direction: "diagonal" | "back" | "horizontal" | "vertical"): void {
  const { x, y, width, height } = rect;
  const segment = (from: readonly [number, number], to: readonly [number, number]): void => {
    context.moveTo(from[0], from[1]);
    context.lineTo(to[0], to[1]);
  };
  if (direction === "horizontal") {
    for (let at = y; at <= y + height; at += HATCH_PITCH_PX) segment([x, at], [x + width, at]);
  } else if (direction === "vertical") {
    for (let at = x; at <= x + width; at += HATCH_PITCH_PX) segment([at, y], [at, y + height]);
  } else if (direction === "diagonal") {
    for (let at = -height; at <= width; at += HATCH_PITCH_PX) segment([x + at, y + height], [x + at + height, y]);
  } else {
    for (let at = -height; at <= width; at += HATCH_PITCH_PX) segment([x + at, y], [x + at + height, y + height]);
  }
}

/** A hatch across the member, clipped to its shape (the caller has clipped), in one colour. */
function hatch(context: CanvasRenderingContext2D, fill: QuantityFill, pattern: ConditionHatch, colour: string): void {
  if (pattern === "solid") return;
  context.strokeStyle = colour;
  context.fillStyle = colour;
  context.lineWidth = 1;
  context.setLineDash([]);
  if (pattern === "dots") {
    for (let px = fill.rect.x; px <= fill.rect.x + fill.rect.width; px += HATCH_PITCH_PX)
      for (let py = fill.rect.y; py <= fill.rect.y + fill.rect.height; py += HATCH_PITCH_PX) context.fillRect(px, py, 1, 1);
    return;
  }
  context.beginPath();
  if (pattern === "cross") {
    lines(context, fill.rect, "diagonal");
    lines(context, fill.rect, "back");
  } else lines(context, fill.rect, pattern);
  context.stroke();
}

/** One measured member: the tint, the condition's hatch, the basis outline. */
function measured(context: CanvasRenderingContext2D, fill: QuantityFill, palette: QuantityPalette): void {
  if (fill.basis === null) return;
  const tint = palette.condition[fill.colour];
  context.save();
  trace(context, fill);
  context.globalAlpha = FILL_ALPHA;
  context.fillStyle = tint;
  context.fill("evenodd");
  context.globalAlpha = 1;
  context.clip("evenodd");
  hatch(context, fill, fill.hatch, tint);
  context.restore();

  context.save();
  trace(context, fill);
  context.strokeStyle = palette.basis[fill.basis];
  context.lineWidth = BASIS_STROKE_PX;
  context.setLineDash([]);
  context.stroke();
  context.restore();
}

/** One member seen and not billed: the warn hatch and a dashed warn outline, never a fill. */
function unmeasured(context: CanvasRenderingContext2D, fill: QuantityFill, palette: QuantityPalette): void {
  if (!fill.unmeasured) return;
  context.save();
  trace(context, fill);
  context.clip("evenodd");
  context.beginPath();
  context.strokeStyle = palette.warn;
  context.lineWidth = 1;
  lines(context, fill.rect, "back");
  context.stroke();
  context.restore();

  context.save();
  trace(context, fill);
  context.strokeStyle = palette.warn;
  context.lineWidth = 1;
  context.setLineDash([...UNMEASURED_DASH]);
  context.stroke();
  context.restore();
}

/**
 * The basis glyph at the member's centre, on a paper chip so the linework under it never crosses it.
 * A member drawn smaller than a legible glyph loses the glyph rather than wearing an illegible one; its
 * outline still says the basis in colour, and the legend keys it (the sheet's level of detail, I-363).
 */
function glyph(context: CanvasRenderingContext2D, fill: QuantityFill, palette: QuantityPalette): void {
  if (fill.basis === null) return;
  const size = palette.glyphSizePx;
  if (size < LEGIBLE_TEXT_PX || Math.min(fill.rect.width, fill.rect.height) < size + GLYPH_PAD_PX * 2) return;
  const centre: [number, number] = [fill.rect.x + fill.rect.width / 2, fill.rect.y + fill.rect.height / 2];
  const side = size + GLYPH_PAD_PX * 2;
  context.save();
  context.fillStyle = palette.paper;
  context.fillRect(centre[0] - side / 2, centre[1] - side / 2, side, side);
  context.font = `${size}px ${palette.mono}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.basis[fill.basis];
  context.fillText(palette.glyph[fill.basis], centre[0], centre[1]);
  context.restore();
}

/**
 * One frame: the canvas cleared, every measured member tinted and outlined, every unmeasured one
 * hatched over, then every glyph — last, so no hatch crosses a glyph. A scene whose switch is off
 * clears and draws nothing.
 */
export function drawQuantityScene(
  context: CanvasRenderingContext2D,
  scene: QuantityScene,
  palette: QuantityPalette,
  viewport?: { readonly width: number; readonly height: number },
): void {
  const box = viewport ?? { width: context.canvas.width, height: context.canvas.height };
  context.clearRect(0, 0, box.width, box.height);
  for (const fill of scene.fills) measured(context, fill, palette);
  for (const fill of scene.fills) unmeasured(context, fill, palette);
  for (const fill of scene.fills) glyph(context, fill, palette);
}
