/*
 * The per-pixel check of text and fills (pixels.fixture.ts) at its floor: any one glyph or one fill
 * triangle dropped fails it, and so does text drawn faint, while antialiasing moved by a pixel does not
 * (ticket 122; the refuter found six single glyphs passing the first tolerances).
 */
import { describe, expect, it } from 'vitest'
import { drawSheet, type DecodedSheet } from '@/sheet'
import type { Records } from '@/sheet/decode'
import { decodeSheet } from '@/sheet/decode'
import { checkTextAndFills } from '@/sheet/pixels.fixture'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'

type Drawer = typeof drawSheet

/** `records` without the one at `index` (as it is when the check drew the other part: none). */
function without(records: Records, index: number): Records {
  if (index >= records.count) return records
  const u32 = new Uint32Array(Math.max(1, (records.count - 1) * records.stride))
  u32.set(records.u32.subarray(0, index * records.stride))
  u32.set(records.u32.subarray((index + 1) * records.stride, records.count * records.stride), index * records.stride)
  return { count: records.count - 1, stride: records.stride, u32, f32: new Float32Array(u32.buffer) }
}

const droppingOne =
  (part: 'glyphs' | 'triangles', index: number): Drawer =>
  (ctx, sheet: DecodedSheet, view) =>
    drawSheet(ctx, { ...sheet, [part]: without(sheet[part], index) }, view)

describe('the text-and-fills pixel check at its floor', () => {
  it('fails a drawer that drops a single glyph, naming the text', async () => {
    await expect(checkTextAndFills(droppingOne('glyphs', 5))).rejects.toThrow(/text: \d+ wrong pixels/)
  })

  it('fails a drawer that drops a single fill triangle, naming the fills', async () => {
    await expect(checkTextAndFills(droppingOne('triangles', 0))).rejects.toThrow(/fills: \d+ wrong pixels/)
  })

  it('fails a drawer that drops any one glyph, or any one fill triangle, whichever it is', async () => {
    const sheet = decodeSheet(await (await fetch(tinySheetUrl)).arrayBuffer())
    const passed: string[] = []
    for (const part of ['glyphs', 'triangles'] as const) {
      for (let i = 0; i < sheet[part].count; i++) {
        const failed = await checkTextAndFills(droppingOne(part, i)).then(() => false, () => true)
        if (!failed) passed.push(`${part} ${i}`)
      }
    }
    expect(passed, 'dropped alone, yet the check passed').toEqual([])
  })

  it('fails text drawn at 80 % alpha', async () => {
    const faint: Drawer = (ctx, sheet, view) => {
      ctx.globalAlpha = 0.8
      drawSheet(ctx, sheet, view)
    }
    await expect(checkTextAndFills(faint)).rejects.toThrow(/text: \d+ wrong pixels/)
  })

  it('passes the viewer’s drawer moved by one pixel: the 1 px dilation', async () => {
    await expect(checkTextAndFills((ctx, sheet, view) => drawSheet(ctx, sheet, { ...view, x: view.x + 1 }))).resolves.toBeUndefined()
  })

  it('fails the viewer’s drawer moved by two pixels', async () => {
    await expect(checkTextAndFills((ctx, sheet, view) => drawSheet(ctx, sheet, { ...view, x: view.x + 2 }))).rejects.toThrow(/text.*fills/)
  })
})
