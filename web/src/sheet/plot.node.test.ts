/*
 * The Plot's registration (m0-screens 4.6, "The Plot"): the matrix that draws the page's picture under
 * the sheet inverts 18's transform (engine/plot/ink.py `carried`: q = k R p + o) at every turn.
 */
import { describe, expect, it } from 'vitest'
import { plotMatrix, readPlotTransform, type PlotTransform } from './plot'
import type { ViewTransform } from './view'

const view: ViewTransform = { scale: 3.5, x: 40, y: 900 }
const picture = { pxPerPt: 2, heightPt: 842 }

/** Sheet mm to page points, as the engine carries a sheet pixel's centre. */
function forward(t: PlotTransform, [x, y]: [number, number]): [number, number] {
  const turns: Record<number, [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }
  const [c, s] = turns[t.rotation]!
  return [t.scale * (c * x - s * y) + t.offset[0], t.scale * (s * x + c * y) + t.offset[1]]
}

describe('plotMatrix', () => {
  it.each([0, 90, 180, 270])('puts each sheet point’s page pixel at the sheet point’s canvas pixel, turned %i°', (rotation) => {
    const t: PlotTransform = { scale: 2.834646, rotation, offset: [612.5, 101.25] }
    const [a, b, c, d, e, f] = plotMatrix(view, t, picture)
    for (const p of [[0, 0], [210, 148], [37.5, 120.25]] as [number, number][]) {
      const [qx, qy] = forward(t, p)
      // The page point's pixel in the picture: from the top-left, y down.
      const u = qx * picture.pxPerPt
      const v = (picture.heightPt - qy) * picture.pxPerPt
      expect(a * u + c * v + e).toBeCloseTo(view.x + p[0] * view.scale, 6)
      expect(b * u + d * v + f).toBeCloseTo(view.y - p[1] * view.scale, 6)
    }
  })
})

describe('readPlotTransform', () => {
  it('reads the API’s decimal strings', () => {
    expect(readPlotTransform({ scale: '2.834646', rotation: 90, offset: ['1.5', '-2'] })).toEqual({ scale: 2.834646, rotation: 90, offset: [1.5, -2] })
  })
  it.each([[null], [{}], [{ scale: '0', rotation: 0, offset: ['0', '0'] }], [{ scale: '1', rotation: 45, offset: ['0', '0'] }], [{ scale: '1', rotation: 0, offset: ['x', '0'] }], [{ scale: '1', rotation: 0, offset: ['0'] }]])(
    'refuses %j',
    (raw) => expect(readPlotTransform(raw)).toBeNull(),
  )
})
