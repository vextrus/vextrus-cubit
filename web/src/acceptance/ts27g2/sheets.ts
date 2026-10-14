/*
 * S27-G2's helpers: a synthetic densest sheet and reading whether the viewer drew it.
 *
 * The densest sheet is the committed invented fixture (engine/render/fixtures/tiny-sheet.bin) with its
 * LINE, TRIS and GLYF sections replaced by their own records repeated to about 30 MB, the size of the
 * densest sheet the walk measured (issue #828: 30,534,769 bytes). Every record is one the decoder already accepts, so the
 * buffer is valid by construction. Built with the sheet's own section helper (src/sheet/buffer.fixture.ts).
 */
import tinySheetUrl from '../../../../engine/render/fixtures/tiny-sheet.bin?url'
import { entry, withSection } from '@/sheet/buffer.fixture'

/** About the densest sheet the walk measured (issue #828). */
export const DENSEST_BYTES = 30_500_000

/** A fresh copy of the committed tiny sheet. */
export async function tinySheet(): Promise<ArrayBuffer> {
  const response = await fetch(tinySheetUrl)
  if (!response.ok) throw new Error(`tiny-sheet.bin: HTTP ${response.status}`)
  return await response.arrayBuffer()
}

/** Each repeated section's record size, and its words that are x and y on the paper (mm). */
const REPEATED = {
  LINE: { size: 28, xs: [0, 2], ys: [1, 3], axes: [] },
  TRIS: { size: 32, xs: [0, 2, 4], ys: [1, 3, 5], axes: [] },
  GLYF: { size: 36, xs: [1], ys: [2], axes: [3, 4, 5, 6] },
} as const

/**
 * The tiny sheet's lines, fills and text repeated until the buffer is at least `bytes` long, each copy
 * shrunk into its own cell of a grid over the paper, as a dense sheet spreads its ink (one spot drawn
 * over a million times is refused as too much work, gl.ts `frameWork`). `extra` more copies make each
 * such sheet a distinct one.
 */
export async function denseSheet(bytes = DENSEST_BYTES, extra = 0): Promise<ArrayBuffer> {
  let sheet = await tinySheet()
  const header = new DataView(sheet)
  const width = header.getFloat32(16, true)
  const height = header.getFloat32(20, true)
  const kinds = Object.keys(REPEATED) as (keyof typeof REPEATED)[]
  const sections = kinds.map((fourcc) => {
    const e = entry(sheet, fourcc)
    return { fourcc, records: new Uint8Array(sheet.slice(e.offset, e.offset + e.length)), count: e.count }
  })
  const once = sections.reduce((sum, s) => sum + s.records.byteLength, 0)
  const times = Math.ceil(bytes / once) + extra
  const side = Math.ceil(Math.sqrt(times))
  for (const { fourcc, records, count } of sections) {
    const { size, xs, ys, axes } = REPEATED[fourcc]
    const payload = new Uint8Array(records.byteLength * times)
    const f32 = new Float32Array(payload.buffer)
    for (let i = 0; i < times; i++) {
      payload.set(records, i * records.byteLength)
      const dx = (i % side) * (width / side)
      const dy = Math.floor(i / side) * (height / side)
      for (let r = 0; r < count; r++) {
        const o = (i * records.byteLength + r * size) / 4
        for (const w of xs) f32[o + w] = f32[o + w]! / side + dx
        for (const w of ys) f32[o + w] = f32[o + w]! / side + dy
        for (const w of axes) f32[o + w] = f32[o + w]! / side
      }
    }
    sheet = withSection(sheet, fourcc, payload, count * times)
  }
  return sheet
}

/** The darkest pixel on the viewer's canvases, composited on white (255: nothing drawn). */
export function darkest(): number {
  let min = 255
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-ltr-canvas] canvas')) {
    if (canvas.width === 0 || canvas.height === 0) continue
    const scratch = document.createElement('canvas')
    scratch.width = canvas.width
    scratch.height = canvas.height
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, scratch.width, scratch.height)
    ctx.drawImage(canvas, 0, 0)
    const d = ctx.getImageData(0, 0, scratch.width, scratch.height).data
    for (let i = 0; i < d.length; i += 4) min = Math.min(min, d[i]!)
  }
  return min
}
