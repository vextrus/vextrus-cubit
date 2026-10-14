/*
 * A frame drawn a part at a time (issue #828): the parts give the picture one draw gives, pixel for
 * pixel, in every palette (marks blend by minimum or maximum, so order and cuts do not show); a new
 * frame ends the one being drawn; and a part's size follows how long the frame before it took.
 */
import { describe, expect, it } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { decodeSheet } from './decode'
import { SheetGlError, SheetRenderer, type Palette } from './gl'

async function tinySheet() {
  return decodeSheet(await (await fetch(tinySheetUrl)).arrayBuffer())
}

function pixels(r: SheetRenderer): Uint8Array {
  const gl = r.gl
  const out = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out)
  return out
}

function renderer() {
  const c = document.createElement('canvas')
  c.width = 840
  c.height = 592
  return new SheetRenderer(c)
}

const VIEW = { scale: 4, x: 0, y: 592 }

describe('a frame drawn in parts', () => {
  for (const palette of ['paper', 'dark', 'compare', 'compare-dark'] as Palette[]) {
    it(`gives the picture of one draw, on ${palette}, in parts of 1, 7, 50 and 2.5 records (a part is whole records)`, async () => {
      const sheet = await tinySheet()
      const whole = renderer()
      whole.draw(sheet, VIEW, { palette, greekBelowPx: 8 })
      const expected = pixels(whole)
      expect(new Set(Array.from({ length: expected.length / 4 }, (_, i) => expected.slice(i * 4, i * 4 + 4).join())).size, 'the tiny sheet draws marks on its paper').toBeGreaterThan(10)
      for (const size of [1, 7, 50, 2.5]) {
        const r = renderer()
        const job = r.begin(sheet, VIEW, { palette, greekBelowPx: 8 })!
        let parts = 0
        while (job.step(size)) parts++
        expect(parts).toBeGreaterThan(0)
        const got = pixels(r)
        let differ = 0
        for (let i = 0; i < got.length; i++) if (got[i] !== expected[i]) differ++
        expect(differ, `bytes unlike one draw's, in parts of ${size}`).toBe(0)
      }
    })
  }

  it('refuses a frame at a scale whose work overflows, as the count refuses it, never drawing it on a bound that is not a number', async () => {
    const sheet = await tinySheet()
    expect(() => renderer().begin(sheet, { scale: 1e160, x: 0, y: 592 })).toThrow(SheetGlError)
  })

  it('ends the frame being drawn when a new one begins', async () => {
    const sheet = await tinySheet()
    const r = renderer()
    const first = r.begin(sheet, VIEW)!
    expect(first.step(1)).toBe(true)
    const second = r.begin(sheet, { ...VIEW, x: 10 })!
    expect(first.step(1)).toBe(false)
    expect(second.step(1)).toBe(true)
  })

  it('sizes the next part by how long the last frame took: smaller after a slow one, larger after a quick one', () => {
    const before = SheetRenderer.partRecords
    SheetRenderer.paced(1000)
    const slow = SheetRenderer.partRecords
    expect(slow).toBeLessThan(before)
    SheetRenderer.paced(16)
    expect(SheetRenderer.partRecords).toBeGreaterThan(slow)
    for (let i = 0; i < 40; i++) SheetRenderer.paced(100_000)
    expect(SheetRenderer.partRecords, 'never below its floor').toBeGreaterThanOrEqual(1024)
    for (let i = 0; i < 40; i++) SheetRenderer.paced(1)
    expect(SheetRenderer.partRecords, 'a fast GPU draws a densest sheet in one part').toBeGreaterThan(2_000_000)
  })
})
