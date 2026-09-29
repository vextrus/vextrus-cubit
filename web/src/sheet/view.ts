/*
 * Where the paper sits on the canvas (m0-screens 4.6, "Opening a sheet" and "The fit"). Pure: the
 * viewer's zoom, pan and fits are this file's, tested without a canvas.
 *
 * A `ViewTransform` puts paper point (X, Y) mm at canvas pixel (x + X * scale, y - Y * scale): `scale`
 * is device pixels per plotted millimetre, and the paper's y runs up while the canvas's runs down.
 */

export interface ViewTransform {
  scale: number
  x: number
  y: number
}

/** A box on paper, in mm from the sheet's lower-left corner. */
export interface PaperBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The canvas in device pixels, less the strips kept clear at its top and foot. */
export interface Stage {
  width: number
  height: number
  top: number
  bottom: number
}

/** Kept clear for the legend (top) and the Confirmation bar (foot), in CSS pixels (4.6). */
export const LEGEND_PX = 44
export const BAR_PX = 72
/** The whole paper's margin, and a working view's (4.6). */
export const PAPER_MARGIN = 0.02
export const VIEW_MARGIN = 0.04
/** A sheet never opens as a speck: under this share of the canvas's width, it fits its used extents. */
export const MIN_PAPER_SHARE = 0.4
/** One press of + or − (and its inverse): + then − comes back to the same view. */
export const ZOOM_STEP = 1.25
export const MIN_SCALE = 0.01
export const MAX_SCALE = 400

/** The transform that shows `box` whole, centred in the stage's clear area with `margin` each side. */
export function fitBox(box: PaperBox, stage: Stage, margin: number): ViewTransform {
  const w = Math.max(box.x1 - box.x0, 1e-3)
  const h = Math.max(box.y1 - box.y0, 1e-3)
  // The strips take at most half a short canvas, shrunk in proportion.
  const strips = stage.top + stage.bottom
  const kept = Math.min(strips, stage.height / 2)
  const top = strips > 0 ? (stage.top * kept) / strips : 0
  const clearHeight = stage.height - kept
  const scale = clamp(Math.min((stage.width * (1 - 2 * margin)) / w, (clearHeight * (1 - 2 * margin)) / h), MIN_SCALE, MAX_SCALE)
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  return { scale, x: stage.width / 2 - cx * scale, y: top + clearHeight / 2 + cy * scale }
}

/**
 * The whole sheet: the paper with its 2% margin, or its used extents when the paper would fill less
 * than 40% of the canvas's width (never a speck).
 */
export function fitPaper(paper: { widthMm: number; heightMm: number }, used: PaperBox | null, stage: Stage): ViewTransform {
  const whole = fitBox({ x0: 0, y0: 0, x1: paper.widthMm, y1: paper.heightMm }, stage, PAPER_MARGIN)
  if (used && paper.widthMm * whole.scale < MIN_PAPER_SHARE * stage.width) return fitBox(used, stage, PAPER_MARGIN)
  return whole
}

/** Zooms by `factor` about canvas point (px, py): the paper point under it stays put. */
export function zoomAbout(view: ViewTransform, factor: number, px: number, py: number): ViewTransform {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE)
  const k = scale / view.scale
  return { scale, x: px + (view.x - px) * k, y: py + (view.y - py) * k }
}

export function panBy(view: ViewTransform, dx: number, dy: number): ViewTransform {
  return { ...view, x: view.x + dx, y: view.y + dy }
}

/** Canvas pixel to paper mm. */
export function toPaper(view: ViewTransform, px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.scale, y: (view.y - py) / view.scale }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
