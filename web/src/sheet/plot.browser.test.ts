/*
 * The Plot page drawn by pdf.js and registered under the sheet (m0-screens 4.6, "The Plot"): a page
 * whose left half is black lands where the transform puts it, at every turn.
 */
import { describe, expect, it } from 'vitest'
import { halfBlackPdf } from '@/acceptance/tviewerplot/plot.fixture'
import { drawPlotPage } from './plot'

const H = 419.53

describe('drawPlotPage', () => {
  it('draws the page as displayed, white with its black half', async () => {
    const picture = await drawPlotPage(halfBlackPdf().buffer, 1, { maxPx: 600 })
    expect(picture.image.width).toBe(600)
    expect(picture.heightPt).toBeCloseTo(H, 1)
    const ctx = picture.image.getContext('2d')!
    const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data]
    expect(at(100, 200)).toEqual([0, 0, 0, 255])
    expect(at(500, 200)).toEqual([255, 255, 255, 255])
  })

  it('stops when its signal aborts', async () => {
    const stop = new AbortController()
    stop.abort()
    await expect(drawPlotPage(halfBlackPdf().buffer, 1, { signal: stop.signal })).rejects.toThrow()
  })
})
