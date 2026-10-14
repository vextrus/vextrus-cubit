/*
 * The work grid's bound (issue #828): the renderer skips counting every record when the bound is
 * within the budget, so the bound must never be below the count, for any sheet and any view; and it
 * must be near the count at fit, or the count would run every frame anyway.
 */
import { describe, expect, it } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { withSection } from './buffer.fixture'
import { decodeSheet, type DecodedSheet } from './decode'
import { frameWork } from './gl'
import { prepareSheet, workBound } from './prepare'
import { fitPaper, type ViewTransform } from './view'

async function tiny(): Promise<ArrayBuffer> {
  return (await fetch(tinySheetUrl)).arrayBuffer()
}

/** `n` lines and triangles scattered over an A1, of every lineweight, some long, most short (a seeded walk). */
async function scattered(n: number): Promise<ArrayBuffer> {
  let seed = 7
  const next = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
    return seed / 2 ** 31
  }
  const lines = new Float32Array(n * 7)
  for (let i = 0; i < n; i++) {
    const x = next() * 841
    const y = next() * 594
    const long = next() < 0.05
    const reach = long ? 400 : 2
    lines.set([x, y, x + (next() - 0.5) * reach, y + (next() - 0.5) * reach, next() * 2.11], i * 7)
  }
  const tris = new Float32Array(n * 8)
  for (let i = 0; i < n; i++) {
    const x = next() * 841
    const y = next() * 594
    const size = next() < 0.02 ? 300 : 3
    tris.set([x, y, x + next() * size, y, x, y + next() * size], i * 8)
  }
  let b = withSection(await tiny(), 'LINE', new Uint8Array(lines.buffer), n)
  b = withSection(b, 'TRIS', new Uint8Array(tris.buffer), n)
  const v = new DataView(b)
  v.setFloat32(16, 841, true)
  v.setFloat32(20, 594, true)
  return b
}

function views(sheet: DecodedSheet, width: number, height: number): ViewTransform[] {
  const fit = fitPaper(sheet.paper, null, { width, height, top: 44, bottom: 72 })
  const out: ViewTransform[] = [fit]
  for (const zoom of [0.1, 0.5, 2, 8, 40, 300]) {
    for (const [fx, fy] of [
      [0, 0],
      [0.3, 0.7],
      [0.9, 0.1],
      [-2, 3],
    ] as const) {
      const scale = fit.scale * zoom
      out.push({ scale, x: width / 2 - (fx * sheet.paper.widthMm + 100) * scale, y: height / 2 + (fy * sheet.paper.heightMm + 50) * scale })
    }
  }
  return out
}

describe('workBound', () => {
  it('is never below frameWork, over many views of the tiny sheet and of a scattered A1', async () => {
    for (const buffer of [await tiny(), await scattered(20_000)]) {
      const sheet = decodeSheet(buffer)
      const { work } = prepareSheet(sheet)
      for (const [width, height] of [
        [1440, 760],
        [300, 200],
      ] as const) {
        for (const view of views(sheet, width, height)) {
          const exact = frameWork(sheet, view, width, height)
          expect(workBound(work, view, width, height), `scale ${view.scale}`).toBeGreaterThanOrEqual(exact)
        }
      }
    }
  })

  it('is within a quarter of frameWork at fit, where the whole sheet is on the canvas', async () => {
    const sheet = decodeSheet(await scattered(20_000))
    const view = fitPaper(sheet.paper, null, { width: 1440, height: 760, top: 44, bottom: 72 })
    const exact = frameWork(sheet, view, 1440, 760)
    expect(workBound(prepareSheet(sheet).work, view, 1440, 760)).toBeLessThan(exact * 1.25)
  })

  it('is small when the view is zoomed far into one corner', async () => {
    const sheet = decodeSheet(await scattered(20_000))
    const fit = fitPaper(sheet.paper, null, { width: 1440, height: 760, top: 44, bottom: 72 })
    const all = workBound(prepareSheet(sheet).work, { ...fit, scale: fit.scale * 50 }, 1e9, 1e9)
    const corner = workBound(prepareSheet(sheet).work, { scale: fit.scale * 50, x: 0, y: 760 }, 1440, 760)
    expect(corner).toBeLessThan(all / 20)
  })
})
