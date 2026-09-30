/*
 * Ticket 122's acceptance tests, part 1 (issue #122): the sheet viewer's pixel test must notice
 * dropped text. With a drawer that drops every third glyph, or half of them, 16's committed pixel
 * test (src/acceptance/t16/draw.browser.test.ts) and all of src/sheet passed: glyphs are too small a
 * share of tiny-sheet's ink to move a 1 mm block mean. The issue asks for "a text-only and a fills-only
 * comparison (tiny-sheet with its lines removed), per pixel with a 1 px dilation and a small cap on
 * wrong pixels".
 *
 * These tests pin that check's strength, not its tolerances. They drive it through one seam the
 * builder makes (chosen by the acceptance writer; the issue names none):
 *
 *   import { checkTextAndFills } from '@/sheet/pixels.fixture'
 *   await checkTextAndFills(drawSheet)   // resolves: text and fills drawn as the engine raster does
 *
 * `checkTextAndFills(draw)` draws tiny-sheet with its lines removed through `draw` (the signature of
 * `drawSheet`), text-only and fills-only, and compares each per pixel with the engine's raster of the
 * same buffers; it rejects when either differs, its message naming the part: "text" or "fills".
 * A mutant renderer here is `drawSheet` handed a sheet missing some of its glyphs or triangles, which
 * is what a renderer that drops them draws.
 */
import { describe, expect, it } from 'vitest'
import { drawSheet, type DecodedSheet } from '@/sheet'
import type { Records } from '@/sheet/decode'
import { checkTextAndFills } from '@/sheet/pixels.fixture'

type Drawer = typeof drawSheet

/** A copy of `records` holding only the ones `keep` picks, in order. */
function only(records: Records, keep: (i: number) => boolean): Records {
  const picked: number[] = []
  for (let i = 0; i < records.count; i++) if (keep(i)) picked.push(i)
  const u32 = new Uint32Array(Math.max(1, picked.length * records.stride))
  picked.forEach((i, k) => u32.set(records.u32.subarray(i * records.stride, (i + 1) * records.stride), k * records.stride))
  return { count: picked.length, stride: records.stride, u32, f32: new Float32Array(u32.buffer) }
}

function dropping(part: 'glyphs' | 'triangles', drop: (i: number) => boolean): Drawer {
  return (ctx, sheet: DecodedSheet, view) => {
    // The check draws the text alone: a sheet with no glyphs left to drop is no evidence.
    const mutated = { ...sheet, [part]: only(sheet[part], (i) => !drop(i)) }
    drawSheet(ctx, mutated, view)
  }
}

describe('the sheet viewer’s pixel check notices dropped text and fills (#122)', () => {
  it('passes the viewer’s own drawer, text and fills drawn as the engine raster does', async () => {
    await expect(checkTextAndFills(drawSheet)).resolves.toBeUndefined()
  })

  it('fails a drawer that drops every third glyph, naming the text', async () => {
    await expect(checkTextAndFills(dropping('glyphs', (i) => i % 3 === 2))).rejects.toThrow(/text/i)
  })

  it('fails a drawer that drops half the glyphs, naming the text', async () => {
    await expect(checkTextAndFills(dropping('glyphs', (i) => i % 2 === 1))).rejects.toThrow(/text/i)
  })

  it('fails a drawer that drops every third fill triangle, naming the fills', async () => {
    await expect(checkTextAndFills(dropping('triangles', (i) => i % 3 === 2))).rejects.toThrow(/fills/i)
  })
})
