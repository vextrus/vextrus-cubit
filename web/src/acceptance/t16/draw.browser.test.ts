/*
 * Ticket 16's pixel test (docs/plans/M0.md, "16 Sheet viewer": "a pixel test in headless Chromium:
 * `tiny-sheet.bin` and 11's lineweight ramp drawn ..., compared with the engine raster's committed
 * images"; m0-screens 4.6: "a pixel test in headless Chromium that draws `tiny-sheet.bin` and a
 * lineweight ramp (0.09 mm to 1.0 mm at fit and at 4x) and compares them with the engine's raster of
 * the same buffers"). The orchestrator's ruling names the drawer:
 * `drawSheet(ctx: CanvasRenderingContext2D, sheet: DecodedSheet, view: ViewTransform): void`.
 * Ticket 18 must keep this test green.
 *
 * Ruling 2 (m0-screens 4.6, "Lineweight to width and alpha"): a line's width on screen is its
 * lineweight x the device pixels per plotted mm; at 1.5 px or wider it draws at that width, opaque;
 * thinner, as a 1-px line whose alpha is that width x 1.1, never below 0.42 and never above 1.
 * Paper: "every colour prints black (#000) on white".
 *
 * The engine raster's pixel convention (engine/render/raster.py): the image's first row is the
 * sheet's top; pixel (column, row)'s centre is at x = (column + 0.5) / px_per_mm,
 * y = height - (row + 0.5) / px_per_mm in paper millimetres.
 *
 * Chosen by the acceptance writer (not in the authority): `ViewTransform` is `{ scale, x, y }`, the
 * canvas pixel of paper point (X, Y) mm being (x + X * scale, y - Y * scale): `scale` is device px
 * per plotted mm. And the tolerances below, measured on the engine raster against itself: a
 * 0.7 px Gaussian blur (antialiasing drawn differently) passes them; a blank canvas, a sheet drawn
 * upside down or shifted by a pixel, or every line at one weight, fails.
 */
import { describe, expect, it } from 'vitest'
import { decodeSheet, drawSheet } from '@/sheet'
import {
  bandInk,
  blocks,
  engineRaster,
  fixtureBuffer,
  greyOfCanvas,
  totalInk,
  type FixtureName,
  type Grey,
  type RasterName,
} from './sheet.fixture'

const PAPER_HEIGHT_MM = 148
const RAMP_LINEWEIGHTS = [0.09, 0.13, 0.15, 0.18, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.53, 0.6, 0.7, 0.8, 0.9, 1.0]

async function drawn(name: FixtureName, pxPerMm: number): Promise<Grey> {
  const sheet = decodeSheet(await fixtureBuffer(name))
  const canvas = document.createElement('canvas')
  canvas.width = 210 * pxPerMm
  canvas.height = PAPER_HEIGHT_MM * pxPerMm
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  drawSheet(ctx, sheet, { scale: pxPerMm, x: 0, y: canvas.height })
  return greyOfCanvas(canvas)
}

function compare(ours: Grey, engine: Grey, pxPerMm: number) {
  const a = blocks(ours, pxPerMm)
  const b = blocks(engine, pxPerMm)
  const diffs = Array.from(a, (v, i) => Math.abs(v - b[i]!)).sort((x, y) => x - y)
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length
  const p99 = diffs[Math.floor(diffs.length * 0.99)]!
  return { mean, p99, inkRatio: totalInk(ours) / totalInk(engine) }
}

describe('drawSheet draws a sheet as the engine raster does, on Paper', () => {
  it.each([
    ['tiny-sheet', 4],
    ['tiny-sheet', 8],
  ] as const)('draws %s at %i px/mm as the engine raster does', async (name, pxPerMm) => {
    const ours = await drawn(name, pxPerMm)
    const engine = await engineRaster(`${name}@${pxPerMm}` as RasterName)
    expect([ours.width, ours.height]).toEqual([engine.width, engine.height])
    const { mean, p99, inkRatio } = compare(ours, engine, pxPerMm)
    // Per millimetre of paper: the mean grey difference, the 99th percentile, and the ink overall.
    expect(mean, 'mean grey difference per mm²').toBeLessThanOrEqual(2.5)
    expect(p99, '99th percentile grey difference per mm²').toBeLessThanOrEqual(40)
    expect(inkRatio, 'our ink / the engine raster’s').toBeGreaterThan(0.9)
    expect(inkRatio, 'our ink / the engine raster’s').toBeLessThan(1.1)
  })

  it.each([
    ['at fit (4 px/mm)', 4],
    ['at 4x (16 px/mm)', 16],
  ] as const)('draws the lineweight ramp %s as the engine raster does', async (_, pxPerMm) => {
    const ours = await drawn('lineweight-ramp', pxPerMm)
    const engine = await engineRaster(`lineweight-ramp@${pxPerMm}` as RasterName)
    const { mean, p99 } = compare(ours, engine, pxPerMm)
    expect(mean, 'mean grey difference per mm²').toBeLessThanOrEqual(2.5)
    expect(p99, '99th percentile grey difference per mm²').toBeLessThanOrEqual(40)
  })

  it.each([
    ['at fit (4 px/mm)', 4],
    ['at 4x (16 px/mm)', 16],
  ] as const)('draws each lineweight of the ramp %s as plotted: fine lines faint, heavy lines wide (ruling 2)', async (_, pxPerMm) => {
    const ours = await drawn('lineweight-ramp', pxPerMm)
    const found: string[] = []
    const wanted: string[] = []
    RAMP_LINEWEIGHTS.forEach((weight, i) => {
      const row = (PAPER_HEIGHT_MM - (134 - 8 * i)) * pxPerMm
      const mid = ours.width / 2
      // The ink across the line, per column along its middle: its width x its alpha, in px of black.
      const ink = bandInk(ours, row - 3 * pxPerMm, row + 3 * pxPerMm, mid - 50, mid + 50)
      const width = weight * pxPerMm
      const expected = width >= 1.5 ? width : Math.min(1, Math.max(0.42, width * 1.1))
      found.push(`${weight} mm: ${Math.abs(ink - expected) <= Math.max(0.08, expected * 0.12) ? 'ok' : ink.toFixed(2)}`)
      wanted.push(`${weight} mm: ok`)
    })
    expect(found).toEqual(wanted)
  })

  it('draws a 0.13 mm line faint and a 0.5 mm line solid black at fit (4 px/mm)', async () => {
    const ours = await drawn('lineweight-ramp', 4)
    const darkest = (weight: number) => {
      const i = RAMP_LINEWEIGHTS.indexOf(weight)
      const row = (PAPER_HEIGHT_MM - (134 - 8 * i)) * 4
      let min = 255
      for (let y = row - 4; y < row + 4; y++) min = Math.min(min, ours.pixels[y * ours.width + ours.width / 2]!)
      return min
    }
    expect(darkest(0.13), '0.13 mm: faint grey').toBeGreaterThan(80)
    expect(darkest(0.5), '0.5 mm: solid black').toBeLessThan(20)
  })
})
