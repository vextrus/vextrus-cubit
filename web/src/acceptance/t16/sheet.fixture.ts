/*
 * Ticket 16's acceptance helpers: the committed buffer fixtures and their engine rasters
 * (engine/render/fixtures/, made from invented drawings by `python -m engine.render.fixtures.make`),
 * and reading what a canvas shows as grey on white paper.
 *
 * The fixtures are served from outside web/, so `web/vite.config.ts` must allow
 * `engine/render/fixtures/` in `server.fs.allow` (the orchestrator's ruling for 16: its first change).
 */
import tinySheetUrl from '../../../../engine/render/fixtures/tiny-sheet.bin?url'
import rampUrl from '../../../../engine/render/fixtures/lineweight-ramp.bin?url'
import tinySheet4Url from '../../../../engine/render/fixtures/tiny-sheet@4.png?url'
import tinySheet8Url from '../../../../engine/render/fixtures/tiny-sheet@8.png?url'
import ramp4Url from '../../../../engine/render/fixtures/lineweight-ramp@4.png?url'
import ramp16Url from '../../../../engine/render/fixtures/lineweight-ramp@16.png?url'

const BUFFERS = { 'tiny-sheet': tinySheetUrl, 'lineweight-ramp': rampUrl } as const
const RASTERS = {
  'tiny-sheet@4': tinySheet4Url,
  'tiny-sheet@8': tinySheet8Url,
  'lineweight-ramp@4': ramp4Url,
  'lineweight-ramp@16': ramp16Url,
} as const

export type FixtureName = keyof typeof BUFFERS
export type RasterName = keyof typeof RASTERS

/** A fresh copy of a committed buffer (tests may change their copy). */
export async function fixtureBuffer(name: FixtureName): Promise<ArrayBuffer> {
  const response = await fetch(BUFFERS[name])
  if (!response.ok) throw new Error(`fixture ${name}: HTTP ${response.status} (is engine/render/fixtures/ in server.fs.allow?)`)
  return await response.arrayBuffer()
}

/** Grey pixels, rows from the top: 255 is white paper, 0 black ink. */
export interface Grey {
  width: number
  height: number
  pixels: Uint8ClampedArray
}

function greyOf(data: ImageData): Grey {
  const out = new Uint8ClampedArray(data.width * data.height)
  const d = data.data
  for (let i = 0; i < out.length; i++) {
    const a = d[4 * i + 3]! / 255
    const lum = 0.299 * d[4 * i]! + 0.587 * d[4 * i + 1]! + 0.114 * d[4 * i + 2]!
    out[i] = Math.round(lum * a + 255 * (1 - a)) // composited on white
  }
  return { width: data.width, height: data.height, pixels: out }
}

/** The engine's committed raster of a fixture. */
export async function engineRaster(name: RasterName): Promise<Grey> {
  const image = new Image()
  image.src = RASTERS[name]
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  return greyOf(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

/** What a 2D canvas holds, as grey on white. */
export function greyOfCanvas(canvas: HTMLCanvasElement): Grey {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return greyOf(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

/**
 * What the viewer shows inside `root`, in CSS pixels from root's top-left: every canvas under it
 * composited in document order at its place on the page, over white.
 */
export function snapshot(root: Element): Grey & { left: number; top: number } {
  const box = root.getBoundingClientRect()
  const width = Math.round(box.width)
  const height = Math.round(box.height)
  const scratch = document.createElement('canvas')
  scratch.width = width
  scratch.height = height
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  for (const canvas of root.querySelectorAll('canvas')) {
    const r = canvas.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || canvas.width === 0 || canvas.height === 0) continue
    ctx.drawImage(canvas, r.left - box.left, r.top - box.top, r.width, r.height)
  }
  return { ...greyOf(ctx.getImageData(0, 0, width, height)), left: box.left, top: box.top }
}

export interface InkBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The box around every pixel darker than `below` (null when there is no ink). */
export function inkBox(grey: Grey, below = 200): InkBox | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let y = 0; y < grey.height; y++) {
    for (let x = 0; x < grey.width; x++) {
      if (grey.pixels[y * grey.width + x]! < below) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

/** Mean of each `block` x `block` square (a millimetre at `block` px/mm): tolerant of antialiasing. */
export function blocks(grey: Grey, block: number): Float64Array {
  const bw = Math.floor(grey.width / block)
  const bh = Math.floor(grey.height / block)
  const out = new Float64Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0
      for (let y = by * block; y < (by + 1) * block; y++) {
        for (let x = bx * block; x < (bx + 1) * block; x++) sum += grey.pixels[y * grey.width + x]!
      }
      out[by * bw + bx] = sum / (block * block)
    }
  }
  return out
}

export function totalInk(grey: Grey): number {
  let ink = 0
  for (const p of grey.pixels) ink += 255 - p
  return ink / 255
}

/** The ink across a horizontal band (rows y0..y1), per column, averaged over columns x0..x1, in px of black. */
export function bandInk(grey: Grey, y0: number, y1: number, x0: number, x1: number): number {
  let ink = 0
  for (let x = x0; x < x1; x++) {
    for (let y = Math.max(0, y0); y < Math.min(grey.height, y1); y++) ink += 255 - grey.pixels[y * grey.width + x]!
  }
  return ink / 255 / (x1 - x0)
}

// --- The buffer format, version 1 (engine/render/buffers.py's docstring), for crafting bad buffers.

export const HEADER_SIZE = 56
export const SECTION_SIZE = 16

export interface Section {
  fourcc: string
  offset: number
  length: number
  count: number
  /** Where this section's table entry is in the buffer. */
  entry: number
}

export function sections(buffer: ArrayBuffer): Section[] {
  const view = new DataView(buffer)
  const count = view.getUint32(32, true)
  const out: Section[] = []
  for (let i = 0; i < count; i++) {
    const entry = HEADER_SIZE + i * SECTION_SIZE
    const fourcc = String.fromCharCode(...new Uint8Array(buffer, entry, 4))
    out.push({
      fourcc,
      offset: view.getUint32(entry + 4, true),
      length: view.getUint32(entry + 8, true),
      count: view.getUint32(entry + 12, true),
      entry,
    })
  }
  return out
}

export function section(buffer: ArrayBuffer, fourcc: string): Section {
  const found = sections(buffer).find((s) => s.fourcc === fourcc)
  if (!found) throw new Error(`no ${fourcc} section`)
  return found
}
