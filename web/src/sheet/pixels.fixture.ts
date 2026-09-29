/*
 * The sheet viewer's per-pixel check of text and fills (ticket 122, issue #122): tiny-sheet drawn with
 * its lines removed, text alone and fills alone, compared pixel by pixel with the engine's raster of
 * the same buffers (engine/render/fixtures/make.py, `PARTS`). Glyphs and fill triangles are too small
 * a share of the whole sheet's ink for 16's 1 mm block mean to see some dropped; alone, each shows.
 *
 *   await checkTextAndFills(drawSheet)   // resolves, or rejects naming "text" or "fills"
 *
 * A pixel is wrong when its grey differs by more than `TOLERANCE` from every engine pixel within
 * `DILATION` px of it, or an engine pixel differs so from every one of ours near it (both ways: ink
 * drawn where the engine has none, and ink the engine has that we dropped). Antialiasing drawn
 * differently moves ink by under a pixel; a dropped glyph or triangle leaves tens of wrong pixels.
 * Measured (ticket 122): the viewer's drawer and the same moved by 1 px pass; one glyph dropped gives
 * 161 wrong pixels, every tenth 462, every third 1898, half 3090; one fill triangle 1576, every third
 * 798; moved by 2 px, text 3408 and fills 547.
 */
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import textUrl from '../../../engine/render/fixtures/tiny-sheet-text@4.png?url'
import fillsUrl from '../../../engine/render/fixtures/tiny-sheet-fills@4.png?url'
import { decodeSheet, type DecodedSheet } from './decode'
import type { drawSheet } from './gl'

/** The engine rasters' density (make.py's `PART_DENSITY`). */
export const PX_PER_MM = 4
/** Grey levels (of 255) a pixel may differ by before it counts as wrong. */
export const TOLERANCE = 64
/** Pixels either image's ink may move before it counts as missing. */
export const DILATION = 1
/** Wrong pixels allowed per part. */
export const MAX_WRONG = 40

type Part = 'text' | 'fills'

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

async function engineRaster(url: string): Promise<Grey> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  return greyOf(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

function drawn(draw: typeof drawSheet, sheet: DecodedSheet): Grey {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sheet.paper.widthMm * PX_PER_MM)
  canvas.height = Math.round(sheet.paper.heightMm * PX_PER_MM)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  draw(ctx, sheet, { scale: PX_PER_MM, x: 0, y: canvas.height })
  return greyOf(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

/** How many pixels of `a` differ by more than TOLERANCE from every pixel of `b` within DILATION. */
function unmatched(a: Grey, b: Grey): number {
  let wrong = 0
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const p = a.pixels[y * a.width + x]!
      let matched = false
      for (let dy = -DILATION; dy <= DILATION && !matched; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= b.height) continue
        for (let dx = -DILATION; dx <= DILATION; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= b.width) continue
          if (Math.abs(p - b.pixels[yy * b.width + xx]!) <= TOLERANCE) {
            matched = true
            break
          }
        }
      }
      if (!matched) wrong++
    }
  }
  return wrong
}

/** Wrong pixels both ways: ink we drew that the engine has not, and ink the engine has that we did not. */
export function wrongPixels(ours: Grey, engine: Grey): number {
  return unmatched(ours, engine) + unmatched(engine, ours)
}

const empty = (records: DecodedSheet['lines']) => ({ ...records, count: 0 })

/** tiny-sheet with its lines removed, keeping only one part's records. */
function partOf(sheet: DecodedSheet, part: Part): DecodedSheet {
  return {
    ...sheet,
    lines: empty(sheet.lines),
    triangles: part === 'fills' ? sheet.triangles : empty(sheet.triangles),
    glyphs: part === 'text' ? sheet.glyphs : empty(sheet.glyphs),
  }
}

/**
 * Draws tiny-sheet's text alone and its fills alone through `draw` and compares each per pixel with
 * the engine raster of the same buffers. Resolves on a match; rejects naming the part that differs.
 */
export async function checkTextAndFills(draw: typeof drawSheet): Promise<void> {
  const response = await fetch(tinySheetUrl)
  if (!response.ok) throw new Error(`tiny-sheet.bin: HTTP ${response.status} (is engine/render/fixtures/ in server.fs.allow?)`)
  const sheet = decodeSheet(await response.arrayBuffer())
  const failures: string[] = []
  for (const [part, url] of [['text', textUrl], ['fills', fillsUrl]] as const) {
    const engine = await engineRaster(url)
    const ours = drawn(draw, partOf(sheet, part))
    if (ours.width !== engine.width || ours.height !== engine.height) {
      failures.push(`${part}: drawn ${ours.width}x${ours.height} px, the engine raster ${engine.width}x${engine.height}`)
      continue
    }
    if (!engine.pixels.some((p) => p < 128)) failures.push(`${part}: the engine raster has no ink`)
    const wrong = wrongPixels(ours, engine)
    if (wrong > MAX_WRONG) failures.push(`${part}: ${wrong} wrong pixels (at most ${MAX_WRONG})`)
  }
  if (failures.length) throw new Error(`tiny-sheet's ${failures.join('; ')}`)
}
