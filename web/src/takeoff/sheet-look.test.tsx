/*
 * Step 1's sheet look beyond the acceptance tests (m0-screens 4.6 "The Plot", 6.13, 6.14; the
 * orchestrator's rulings, session 11): the Plot drawn where 18's transform puts it; a Plot that fails
 * to draw falls back to As read and tries again when chosen (words gate M1); a page matched but never
 * lined up is a no-Plot reason, not a retry (words gate M2); CAD-dark and Plot kept while paging.
 */
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { step1SheetPath } from '@/takeoff/paths'
import { FakeStep1, msg } from '@/acceptance/t22/step1.fixture'
import { FakePlot } from '@/acceptance/tviewerplot/plot.fixture'

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

/** KR-01 with S-02's Plot on page 1 of the fake's PDF (each page's left half black). */
async function open(prepare?: (plot: FakePlot, api: FakeApi) => void, number = 'S-02') {
  await page.viewport(1440, 900)
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const plot = new FakePlot(api, step1)
  plot.matched('S-02', 1)
  prepare?.(plot, api)
  await mountApp(step1SheetPath('KR-01', plot.sheetId(number)), { as: PEOPLE.qs, api })
  await screen.findByRole('group', { name: new RegExp(`^Sheet\\s*⁨?${number}⁩?$`) })
  return { plot }
}

/** The Plot canvas's pixel at a share of its width and height. */
function plotPixel(x: number, y: number): number[] {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-plot]')!
  return [...canvas.getContext('2d')!.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data]
}

describe('the Plot beneath the sheet', () => {
  it('draws the registered page: its black half on the sheet’s left, its white half on the right', async () => {
    await open()
    await userEvent.keyboard('p')
    await waitFor(() => expect(bodyText()).toContain('Plot: KR-STR-R0.pdf page 1, registered to 0.3 mm'))
    // The sheet fits the canvas's middle; the page lies on it exactly (the fixture's transform).
    await waitFor(() => expect(plotPixel(0.35, 0.5)).toEqual([0, 0, 0, 255]), { timeout: 10_000 })
    expect(plotPixel(0.65, 0.5)).toEqual([255, 255, 255, 255])
    expect(pressed('Plot')).toBe('true')
  })

  it('on CAD-dark inverts the page onto the #101318 ground', async () => {
    await open()
    await userEvent.keyboard('dp')
    await waitFor(() => expect(plotPixel(0.65, 0.5)).toEqual([0x10, 0x13, 0x18, 255]), { timeout: 10_000 })
    expect(plotPixel(0.35, 0.5)).toEqual([255, 255, 255, 255])
  })

  it('falls back to As read when the page cannot be drawn, and tries again when Plot is chosen', async () => {
    // A page past the fake PDF's last (it has 16): pdf.js refuses it.
    const { plot } = await open((p) => p.matched('S-02', 99))
    await userEvent.keyboard('p')
    await waitFor(() => expect(bodyText()).toContain('The Plot could not be drawn, so the sheet is shown as read. Choose Plot or Compare to try again.'), { timeout: 15_000 })
    expect(pressed('As read')).toBe('true')
    expect(pressed('Plot')).toBe('false')
    const asked = plot.seen.filter((c) => c.endsWith('/plot')).length
    await userEvent.click(screen.getByRole('button', { name: 'Plot' }))
    // Trying again looks like the first load: Plot pressed, "Loading the Plot…", no failure note.
    await waitFor(() => expect(bodyText()).toContain('Loading the Plot…'))
    expect(pressed('Plot')).toBe('true')
    expect(bodyText()).not.toContain('The Plot could not be drawn')
    await waitFor(() => expect(plot.seen.filter((c) => c.endsWith('/plot')).length).toBeGreaterThan(asked))
    // And failing again says so again.
    await waitFor(() => expect(bodyText()).toContain('The Plot could not be drawn, so the sheet is shown as read.'), { timeout: 15_000 })
  }, 40_000)

  it('names a page matched but never lined up as the reason there is no Plot, and does not offer to try again', async () => {
    await open((_, api) => {
      const base = api.handle
      api.handle = async (request: Request) => {
        if (new URL(request.url, location.origin).pathname.endsWith('/plot')) {
          return new Response(JSON.stringify({ file_id: 'd1000000-0000-4000-8000-0000000000f1', page: 1, transform: null, residual: null, none: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return base(request)
      }
    })
    await userEvent.keyboard('p')
    const words = 'No Plot for this sheet: page 1 of KR-STR-R0.pdf matches it, but its drawing could not be lined up with the sheet.'
    await waitFor(() => expect(bodyText()).toContain(words))
    expect(bodyText()).not.toContain('try again')
    expect(screen.getByRole('button', { name: 'Plot' })).toHaveAttribute('aria-disabled', 'true')
    expect(clean(screen.getByRole('button', { name: 'Plot' }).title)).toBe(words)
    expect(pressed('As read')).toBe('true')
  })
})

describe('Compare before its Plot comes', () => {
  it('draws what was read in red at once, with "Loading the Plot…", while the PDF has not come', async () => {
    await open((_, api) => {
      const base = api.handle
      api.handle = async (request: Request) => {
        if (new URL(request.url, location.origin).pathname.endsWith('/pdf')) return new Promise<Response>(() => {})
        return base(request)
      }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }))
    await waitFor(() => expect(bodyText()).toContain('Loading the Plot…'))
    expect(pressed('Compare')).toBe('true')
    // The drawing's canvas, read back: its linework in #D0342C at 55 % on white.
    await waitFor(() => {
      const gl = document.querySelector<HTMLCanvasElement>('[role="group"][aria-label^="Sheet"] canvas:not([data-plot])')!
      const copy = document.createElement('canvas')
      copy.width = gl.width
      copy.height = gl.height
      const ctx = copy.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(gl, 0, 0)
      const px = ctx.getImageData(0, 0, copy.width, copy.height).data
      let red = 0
      for (let i = 0; i < px.length; i += 4) if (px[i + 3]! > 0 && px[i]! > 200 && px[i]! - px[i + 1]! > 50 && px[i]! - px[i + 2]! > 50) red++
      expect(red, 'red linework').toBeGreaterThan(50)
    })
  })
})

describe('the look while paging (the orchestrator’s rulings)', () => {
  it('keeps CAD-dark, and keeps Plot: As read with the no-Plot note on a sheet without one, Plot again after', async () => {
    await open((p) => {
      p.matched('S-04', 1)
      p.noPlot('S-03', msg('drawings.sheets.plot_no_page', { plot_file: 'KR-STR-R0.pdf' }))
    })
    await userEvent.keyboard('dp')
    await waitFor(() => expect(pressed('Plot')).toBe('true'))
    await userEvent.keyboard('{ArrowDown}')
    await screen.findByRole('group', { name: /S-03/ })
    expect(screen.getByRole('button', { name: 'CAD-dark' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(pressed('As read')).toBe('true'))
    expect(bodyText()).toContain('No Plot for this sheet: no page of KR-STR-R0.pdf matched it.')
    expect(screen.getByRole('button', { name: 'Plot' }).title).toContain('No Plot for this sheet: no page of')
    await userEvent.keyboard('{ArrowDown}')
    await screen.findByRole('group', { name: /S-04/ })
    await waitFor(() => expect(pressed('Plot')).toBe('true'))
    expect(screen.getByRole('button', { name: 'CAD-dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(bodyText()).not.toContain('No Plot for this sheet')
  })
})
