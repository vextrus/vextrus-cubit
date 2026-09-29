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
import { SheetGlError, WORK_PER_PIXEL, drawSheet, frameWork } from './gl'

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
