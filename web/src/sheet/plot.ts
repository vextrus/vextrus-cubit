/*
 * The Plot beneath the sheet (m0-screens 4.6, "The Plot"): the consultant's PDF page drawn by pdf.js
 * (loaded only when a Plot is first shown), registered to the sheet by 18's transform, sheet
 * millimetres to page points (engine/recognise/types.py `PlotTransform`: T(p) = k R p + o, R a turn in
 * 90° steps), in the page's space as the engine reads it (engine/read/pdf/walk.py: points from the
 * page's lower-left corner, y up, the page as displayed, its /Rotate applied).
 *
 *   const picture = await drawPlotPage(bytes, 18)
 *   ctx.setTransform(...plotMatrix(view, transform, picture))
 *   ctx.drawImage(picture.image, 0, 0)
 */
import type { ViewTransform } from './view'

/** 18's transform, sheet millimetres to page points. */
export interface PlotTransform {
  scale: number
  /** 0, 90, 180 or 270, anticlockwise. */
  rotation: number
  offset: readonly [number, number]
}

/** A PDF page drawn to pixels: its picture, how many pixels to a point, and its height in points. */
export interface PlotPicture {
  image: HTMLCanvasElement
  pxPerPt: number
  heightPt: number
}

/** The longest side of a page's picture, in pixels: an A1 page at about 4 px to the millimetre. */
export const PLOT_MAX_PX = 3200

/** The transform as the API sends it (decimal strings), or null when it is not one. */
export function readPlotTransform(raw: unknown): PlotTransform | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as { scale?: unknown; rotation?: unknown; offset?: unknown }
  const scale = Number(t.scale)
  const rotation = Number(t.rotation)
  const offset = Array.isArray(t.offset) ? t.offset.map(Number) : []
  if (!(scale > 0) || !Number.isFinite(scale) || ![0, 90, 180, 270].includes(rotation)) return null
  if (offset.length !== 2 || !offset.every(Number.isFinite)) return null
  return { scale, rotation, offset: [offset[0]!, offset[1]!] }
}

const TURN: Record<number, readonly [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }

/**
 * The 2D canvas matrix [a, b, c, d, e, f] that puts the page's picture under the sheet at `view`
 * (device pixels): picture pixel (u, v) is page point (u / d, H − v / d), which is sheet point
 * R⁻¹ (q − o) / k, which is canvas pixel (x + X s, y − Y s).
 */
export function plotMatrix(view: ViewTransform, t: PlotTransform, picture: { pxPerPt: number; heightPt: number }): [number, number, number, number, number, number] {
  const [c, s] = TURN[t.rotation] ?? [1, 0]
  const k = t.scale
  const m = view.scale / (k * picture.pxPerPt)
  const wx = -t.offset[0] / k
  const wy = (picture.heightPt - t.offset[1]) / k
  return [m * c, m * s, -m * s, m * c, view.x + view.scale * (c * wx + s * wy), view.y - view.scale * (-s * wx + c * wy)]
}

type PdfJs = typeof import('pdfjs-dist')
let pdfjs: Promise<PdfJs> | null = null

/** pdf.js and its worker, on first use only (it is large and most sheets are opened without a Plot). */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjs
}

/** Draws page `page` (from 1) of the PDF `bytes` as the page is displayed, its longer side `maxPx` pixels at most. */
export async function drawPlotPage(bytes: ArrayBuffer, page: number, maxPx = PLOT_MAX_PX): Promise<PlotPicture> {
  const lib = await loadPdfJs()
  // pdf.js takes the bytes over to its worker: hand it a copy, so the cached response stays whole.
  const task = lib.getDocument({ data: new Uint8Array(bytes.slice(0)) })
  try {
    const doc = await task.promise
    const p = await doc.getPage(page)
    const unit = p.getViewport({ scale: 1 })
    const pxPerPt = Math.min(maxPx / Math.max(unit.width, unit.height), 8)
    const viewport = p.getViewport({ scale: pxPerPt })
    const image = document.createElement('canvas')
    image.width = Math.max(1, Math.floor(viewport.width))
    image.height = Math.max(1, Math.floor(viewport.height))
    const ctx = image.getContext('2d')
    if (!ctx) throw new Error('no 2D canvas')
    await p.render({ canvas: image, canvasContext: ctx, viewport, background: '#ffffff' }).promise
    return { image, pxPerPt, heightPt: unit.height }
  } finally {
    void task.destroy()
  }
}
