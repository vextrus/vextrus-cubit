/*
 * The drawer's time bound (the refuter's finding on 16): a small valid buffer whose triangles each
 * cover the whole paper drew one frame for minutes. A frame that would shade its canvas more than
 * WORK_PER_PIXEL times over is refused at once, as the engine raster refuses it, and the viewer says
 * the sheet could not be drawn.
 */
import { describe, expect, it } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { decodeSheet } from './decode'
import { withSection } from './buffer.fixture'
import { SheetGlError, SheetRenderer, WORK_PER_PIXEL, drawSheet, frameWork, runHeights } from './gl'
import { fitPaper } from './view'

async function coveredBy(n: number): Promise<ArrayBuffer> {
  const b = await (await fetch(tinySheetUrl)).arrayBuffer()
  const records = new ArrayBuffer(n * 32)
  const f = new Float32Array(records)
  for (let i = 0; i < n; i++) f.set([-1, -1, 700, -1, -1, 500], i * 8) // past an A5's corners; colour and primitive 0
  return withSection(b, 'TRIS', new Uint8Array(records), n)
}

function canvas() {
  const c = document.createElement('canvas')
  c.width = 1600
  c.height = 1200
  return c.getContext('2d')!
}

describe('the drawer refuses a frame that draws over itself too often', () => {
  it('refuses 40,000 triangles over the whole paper at once, not after minutes', async () => {
    const sheet = decodeSheet(await coveredBy(40_000))
    const view = { scale: 7, x: 30, y: 1100 }
    expect(frameWork(sheet, view, 1600, 1200)).toBeGreaterThan(WORK_PER_PIXEL * 1600 * 1200)
    const start = performance.now()
    expect(() => drawSheet(canvas(), sheet, view)).toThrow(SheetGlError)
    expect(performance.now() - start).toBeLessThan(2000)
  })

  it('still draws a sheet with a few such triangles', async () => {
    const sheet = decodeSheet(await coveredBy(10))
    expect(() => drawSheet(canvas(), sheet, { scale: 7, x: 30, y: 1100 })).not.toThrow()
  })

  it('counts only what lands on the canvas: zoomed far in, the tiny sheet is cheap', async () => {
    const sheet = decodeSheet(await (await fetch(tinySheetUrl)).arrayBuffer())
    expect(frameWork(sheet, { scale: 400, x: -20_000, y: 40_000 }, 1000, 700)).toBeLessThan(WORK_PER_PIXEL * 1000 * 700)
  })
})

/** An A1 sheet whose whole paper is hatched at 45°, 2 mm apart (0.18 mm lines): a real drawing's density. */
async function hatchedA1(): Promise<ArrayBuffer> {
  const [w, h] = [841, 594]
  const lines: number[][] = []
  for (let c = -h; c < w; c += 2 * Math.SQRT2) {
    // x - y = c, cut to the paper.
    const x0 = Math.max(0, c)
    const x1 = Math.min(w, h + c)
    if (x1 > x0) lines.push([x0, x0 - c, x1, x1 - c])
  }
  const records = new ArrayBuffer(lines.length * 28)
  const f = new Float32Array(records)
  lines.forEach((l, i) => f.set([...l, 0.18], i * 7)) // colour and primitive 0
  const b = withSection(await (await fetch(tinySheetUrl)).arrayBuffer(), 'LINE', new Uint8Array(records), lines.length)
  const v = new DataView(b)
  v.setFloat32(16, w, true)
  v.setFloat32(20, h, true)
  return b
}

describe('the drawer charges a line what it shades (the review on 16: diagonal hatching was refused)', () => {
  it('draws a whole A1 of 45° hatching at fit', async () => {
    const sheet = decodeSheet(await hatchedA1())
    const view = fitPaper(sheet.paper, null, { width: 1600, height: 1200, top: 44, bottom: 72 })
    expect(frameWork(sheet, view, 1600, 1200)).toBeLessThan(WORK_PER_PIXEL * 1600 * 1200)
    expect(() => drawSheet(canvas(), sheet, view)).not.toThrow()
  })
})

describe('greeking decides by run, not by glyph (m0-screens 4.6: a run below 6 px draws as a grey bar)', () => {
  it("gives every glyph its run's height: the tallest text height of its primitive", async () => {
    const sheet = decodeSheet(await (await fetch(tinySheetUrl)).arrayBuffer())
    const runs = runHeights(sheet)
    const byPrim = new Map<number, Set<number>>()
    for (let i = 0; i < sheet.glyphs.count; i++) {
      const prim = sheet.glyphs.u32[i * sheet.glyphs.stride + 8]!
      byPrim.set(prim, (byPrim.get(prim) ?? new Set()).add(runs[i]!))
    }
    for (const heights of byPrim.values()) expect(heights.size).toBe(1)
  })

  it('draws a run all as bars or all as letters, whatever its glyphs’ own heights', async () => {
    // The tiny sheet's first text run: text 5 mm high, glyph boxes from 6.7 mm to 8.1 mm. At 4 px/mm and
    // bars below 29.6 px, a glyph-by-glyph rule greeks some of its letters and not others.
    const sheet = decodeSheet(await (await fetch(tinySheetUrl)).arrayBuffer())
    const g = sheet.glyphs
    const prims = Array.from({ length: g.count }, (_, i) => g.u32[i * g.stride + 8]!)
    const run = prims[0]!
    const scale = 4
    const c = document.createElement('canvas')
    c.width = 210 * scale
    c.height = 148 * scale
    const renderer = new SheetRenderer(c)
    renderer.draw(sheet, { scale, x: 0, y: c.height }, { greekBelowPx: 7.4 * scale, greekInk: 0.3 })
    const flat = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    flat.canvas.width = c.width
    flat.canvas.height = c.height
    flat.drawImage(c, 0, 0)
    const lettered: boolean[] = []
    for (let i = 0; i < g.count; i++) {
      if (prims[i] !== run) continue
      const o = i * g.stride
      // Around the glyph's origin, 3 mm each way: letters are black; bars are 30% grey.
      const px = g.f32[o + 1]! * scale
      const py = c.height - g.f32[o + 2]! * scale
      const d = flat.getImageData(Math.max(0, px), Math.max(0, py - 12), 12, 12).data
      let dark = false
      for (let k = 0; k < d.length; k += 4) if (d[k + 3]! > 200 && d[k]! < 100) dark = true
      lettered.push(dark)
    }
    expect(lettered.length).toBeGreaterThan(3)
    expect(new Set(lettered).size, `letters per glyph: ${lettered.join(' ')}`).toBe(1)
    renderer.dispose()
  })
})
