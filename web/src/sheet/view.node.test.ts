/*
 * The viewer's geometry (view.ts; m0-screens 4.6, "Opening a sheet" and "The fit").
 */
import { describe, expect, it } from 'vitest'
import { fitBox, fitPaper, panBy, toPaper, zoomAbout, MIN_PAPER_SHARE, type Stage } from './view'

const STAGE: Stage = { width: 1000, height: 700, top: 44, bottom: 72 }
const A5 = { widthMm: 210, heightMm: 148 }

function onScreen(view: { scale: number; x: number; y: number }, x: number, y: number) {
  return { x: view.x + x * view.scale, y: view.y - y * view.scale }
}

describe('fitBox', () => {
  it('centres the box in the canvas less the legend and the bar, with its margin', () => {
    const v = fitBox({ x0: 0, y0: 0, x1: 210, y1: 148 }, STAGE, 0.02)
    const tl = onScreen(v, 0, 148)
    const br = onScreen(v, 210, 0)
    expect(tl.y).toBeCloseTo(44 + (584 - 148 * v.scale) / 2, 6)
    expect(br.y).toBeCloseTo(700 - 72 - (584 - 148 * v.scale) / 2, 6)
    expect(148 * v.scale).toBeCloseTo(584 * 0.96, 6) // height-bound
    expect((tl.x + br.x) / 2).toBeCloseTo(500, 6)
  })

  it('never lets the strips take more than half of a short canvas', () => {
    const v = fitBox({ x0: 0, y0: 0, x1: 100, y1: 100 }, { width: 400, height: 100, top: 44, bottom: 72 }, 0)
    expect(100 * v.scale).toBeCloseTo(50, 6)
  })

  it('survives an empty box', () => {
    const v = fitBox({ x0: 5, y0: 5, x1: 5, y1: 5 }, STAGE, 0.02)
    expect(Number.isFinite(v.scale) && Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true)
  })
})

describe('fitPaper', () => {
  it('fits the whole paper when it fills at least 40% of the width', () => {
    expect(fitPaper(A5, { x0: 10, y0: 10, x1: 20, y1: 20 }, STAGE)).toEqual(fitBox({ x0: 0, y0: 0, x1: 210, y1: 148 }, STAGE, 0.02))
  })

  it('never opens as a speck: a paper too narrow for the canvas fits its used extents', () => {
    const ribbon = { widthMm: 100, heightMm: 5000 }
    const whole = fitBox({ x0: 0, y0: 0, x1: 100, y1: 5000 }, STAGE, 0.02)
    expect(100 * whole.scale).toBeLessThan(MIN_PAPER_SHARE * STAGE.width)
    const used = { x0: 0, y0: 4000, x1: 100, y1: 4200 }
    expect(fitPaper(ribbon, used, STAGE)).toEqual(fitBox(used, STAGE, 0.02))
    expect(fitPaper(ribbon, null, STAGE)).toEqual(whole)
  })
})

describe('zoom and pan', () => {
  it('zooms about a point: the paper point under it stays put', () => {
    const v = fitBox({ x0: 0, y0: 0, x1: 210, y1: 148 }, STAGE, 0.02)
    const before = toPaper(v, 321, 222)
    const after = toPaper(zoomAbout(v, 1.7, 321, 222), 321, 222)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
  })

  it('comes back to the same view on a zoom and its inverse', () => {
    const v = { scale: 3, x: 10, y: 600 }
    const back = zoomAbout(zoomAbout(v, 1.25, 500, 350), 1 / 1.25, 500, 350)
    expect(back.scale).toBeCloseTo(3, 9)
    expect(back.x).toBeCloseTo(10, 9)
    expect(back.y).toBeCloseTo(600, 9)
  })

  it('stops zooming at its limits, keeping the point put', () => {
    const v = { scale: 399, x: 0, y: 0 }
    const z = zoomAbout(v, 10, 100, 100)
    expect(z.scale).toBe(400)
    expect(toPaper(z, 100, 100).x).toBeCloseTo(toPaper(v, 100, 100).x, 9)
  })

  it('pans by the distance dragged', () => {
    expect(panBy({ scale: 2, x: 1, y: 2 }, 60, -40)).toEqual({ scale: 2, x: 61, y: -38 })
  })
})
