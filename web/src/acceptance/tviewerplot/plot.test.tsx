/*
 * Ticket viewerplot's acceptance tests: Step 1's sheet mode offers Paper, CAD-dark, the Plot and
 * Compare (docs/specs/M0.md finish line 6: "The owner pages through every sheet with the arrow keys,
 * in Paper, then spot-checks sheets in CAD-dark and with the Plot"; docs/design/m0-screens.md §2.2's
 * `D` and `P`, §4.6 "The Plot" and its colours, §6.13 "No Plot, and why", §6.14, §6.15). The review
 * of main (session 11, D6) found `P` doing nothing and no CAD-dark, Plot or Compare in Step 1.
 *
 * At /p/KR-01/takeoff/1?sheet=… through 22's Step 1 fake, with the sheet's Plot served as 14 serves it
 * (plot.fixture.ts). What the eye sees is read from a screenshot of the sheet's area (less 4.6's 44 px
 * legend strip and 72 px bar): the page beneath
 * is half black, so the Plot shows as ink where the read sheet has little.
 *
 * Chosen by the acceptance writer (not in the authority): the segments are found by their words
 * ("As read", "Plot", "Compare") as radios, buttons or tabs, chosen when checked, pressed, selected or
 * `data-state="on"`; the CAD-dark toggle by its accessible name "CAD-dark" and `aria-pressed`; a
 * disabled segment by `disabled` or `aria-disabled`; the pixel thresholds below.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { step1SheetPath } from '@/takeoff/paths'
import { FakeStep1, msg } from '../t22/step1.fixture'
import { FakePlot, PLOT_PDF } from './plot.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

function kr01(): { api: FakeApi; step1: FakeStep1; plot: FakePlot } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  return { api, step1, plot: new FakePlot(api, step1) }
}

const sheetName = (number: string) => new RegExp(`^Sheet\\s*⁨?${number}⁩?$`)

/** Step 1 in sheet mode on `number`, its sheet drawn. */
async function openSheet(api: FakeApi, plot: FakePlot, number = 'S-02') {
  await mountApp(step1SheetPath('KR-01', plot.sheetId(number)), { as: PEOPLE.qs, api })
  await screen.findByRole('group', { name: sheetName(number) })
  await frames()
}

const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** A segment of "As read | Plot | Compare", by its words. */
function segment(name: 'As read' | 'Plot' | 'Compare'): HTMLElement {
  const found = (['radio', 'button', 'tab'] as const).flatMap((role) => screen.queryAllByRole(role, { name }))
  expect(found, `one "${name}" segment`).toHaveLength(1)
  return found[0]!
}

const isOn = (el: HTMLElement) =>
  el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'on'
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true'

async function chosen(name: 'As read' | 'Plot' | 'Compare') {
  await waitFor(() => {
    for (const other of ['As read', 'Plot', 'Compare'] as const) expect(isOn(segment(other)), `${other} chosen`).toBe(other === name)
  })
}

const cadDark = () => screen.getByRole('button', { name: 'CAD-dark' })

/** The colours of the sheet's area as the screen shows it, by kind of pixel, as fractions of the area. */
async function looks(number = 'S-02') {
  await frames()
  const area = screen.getByRole('group', { name: sheetName(number) }).getBoundingClientRect()
  // The drawing's part of the canvas: 4.6's fit keeps 44 px at the top (the legend) and 72 px at the foot (the bar).
  const box = { left: area.left, top: area.top + 44, width: area.width, height: area.height - 44 - 72 }
  const base64 = await page.screenshot({ save: false })
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
  const k = image.width / window.innerWidth
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(box.width * k)
  canvas.height = Math.round(box.height * k)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, box.left * k, box.top * k, box.width * k, box.height * k, 0, 0, canvas.width, canvas.height)
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let white = 0
  let dark = 0
  let ground = 0
  let red = 0
  const n = px.length / 4
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = [px[i]!, px[i + 1]!, px[i + 2]!]
    if (r > 248 && g > 248 && b > 248) white++
    if (r < 70 && g < 70 && b < 70) dark++
    if (Math.abs(r - 0x10) <= 8 && Math.abs(g - 0x13) <= 8 && Math.abs(b - 0x18) <= 8) ground++
    if (r > 90 && r - g > 50 && r - b > 50) red++
  }
  return { white: white / n, dark: dark / n, ground: ground / n, red: red / n }
}

describe('the switches in Step 1’s sheet mode (§4.6, §6.14)', () => {
  it('offers "As read | Plot | Compare" and opens a sheet on "As read"', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    await chosen('As read')
  })

  it('cycles As read → Plot → Compare → As read on P', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    await userEvent.keyboard('p')
    await chosen('Plot')
    await userEvent.keyboard('p')
    await chosen('Compare')
    await userEvent.keyboard('p')
    await chosen('As read')
  })

  it('chooses Plot, Compare and As read by clicking their segments', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    await userEvent.click(segment('Plot'))
    await chosen('Plot')
    await userEvent.click(segment('Compare'))
    await chosen('Compare')
    await userEvent.click(segment('As read'))
    await chosen('As read')
  })

  it('offers the icon-only "CAD-dark" toggle, unpressed on Paper, and D presses it and lets it go', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    expect(cadDark()).toHaveAttribute('aria-pressed', 'false')
    expect(clean(cadDark().textContent), 'icon-only').toBe('')
    await userEvent.keyboard('d')
    await waitFor(() => expect(cadDark()).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.keyboard('d')
    await waitFor(() => expect(cadDark()).toHaveAttribute('aria-pressed', 'false'))
  })

  it('turns CAD-dark on and off by a click', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    await userEvent.click(cadDark())
    await waitFor(() => expect(cadDark()).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(cadDark())
    await waitFor(() => expect(cadDark()).toHaveAttribute('aria-pressed', 'false'))
  })

  it('lists D and P in the keys overlay in sheet mode', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    await userEvent.keyboard('?')
    const keys = await screen.findByRole('dialog', { name: 'Keys' })
    const text = clean(keys.textContent)
    expect(text).toContain('CAD-dark')
    expect(text).toContain('Compare')
    const kbds = [...keys.querySelectorAll('kbd')].map((k) => clean(k.textContent))
    expect(kbds).toContain('D')
    expect(kbds).toContain('P')
  })
})

describe('what each mode draws (§4.6 "Colour", "The Plot")', () => {
  it('draws the sheet on white Paper, and on the #101318 ground in CAD-dark', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    const paper = await looks()
    expect(paper.ground, 'no CAD-dark ground on Paper').toBeLessThan(0.01)
    expect(paper.white, 'white paper').toBeGreaterThan(0.2)
    await userEvent.keyboard('d')
    await waitFor(async () => {
      const dark = await looks()
      expect(dark.ground, 'the CAD-dark ground').toBeGreaterThan(0.2)
      expect(dark.white, 'no white paper').toBeLessThan(paper.white / 4)
    })
  })

  it('shows the matched Plot page beneath with "Plot: KR-STR-R0.pdf page 2, registered to 0.3 mm"', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    const asRead = await looks()
    await userEvent.keyboard('p')
    await waitFor(() => expect(bodyText()).toContain('Plot: KR-STR-R0.pdf page 2, registered to 0.3 mm'))
    expect(plot.seen).toContain(`GET /drawings/files/${PLOT_PDF.id}/pdf`)
    await waitFor(async () => {
      const shown = await looks()
      // The page's black half lies beneath the sheet: far more ink than the read sheet has.
      expect(shown.dark, 'the Plot page drawn').toBeGreaterThan(asRead.dark + 0.15)
      expect(shown.red, 'nothing in red on Plot').toBeLessThan(0.001)
    })
  })

  it('shows Compare: "Compare: what was read in red over the Plot", the read lines in red over the page in black', async () => {
    const { api, plot } = kr01()
    await openSheet(api, plot)
    const asRead = await looks()
    expect(asRead.red, 'Paper prints every colour black').toBeLessThan(0.001)
    await userEvent.click(segment('Compare'))
    await waitFor(() => expect(bodyText()).toContain('Compare: what was read in red over the Plot'))
    await waitFor(async () => {
      const shown = await looks()
      expect(shown.red, 'what was read, in red').toBeGreaterThan(0.002)
      expect(shown.dark, 'the Plot, in black').toBeGreaterThan(asRead.dark + 0.15)
    })
  })

  it.each([
    ['no PDF', 'No Plot for this sheet: no PDF has been added for Structural.', msg('drawings.sheets.plot_no_pdf', { discipline: 'Structural' })],
    ['page not matched', 'No Plot for this sheet: no page of KR-STR-R0.pdf matched it.', msg('drawings.sheets.plot_no_page', { plot_file: 'KR-STR-R0.pdf' })],
    ['PDF refused', 'No Plot for this sheet: its PDF was a scan and was refused.', msg('drawings.sheets.plot_pdf_refused')],
  ])('with %s, disables Plot and Compare, and P says "%s" and stays on As read', async (_, words, none) => {
    const { api, plot } = kr01()
    plot.noPlot('S-03', none)
    await openSheet(api, plot, 'S-03')
    await waitFor(() => {
      expect(isDisabled(segment('Plot')), 'Plot disabled').toBe(true)
      expect(isDisabled(segment('Compare')), 'Compare disabled').toBe(true)
    })
    await userEvent.keyboard('p')
    await waitFor(() => expect(bodyText()).toContain(words.slice(0, -1)))
    await chosen('As read')
  })
})

describe('paging in every mode (§2.2 ↑ ↓, §6.15; finish line 6)', () => {
  const modes: [string, () => Promise<void>][] = [
    ['CAD-dark', async () => {
      await userEvent.keyboard('d')
      await waitFor(() => expect(cadDark()).toHaveAttribute('aria-pressed', 'true'))
    }],
    ['Plot', async () => {
      await userEvent.keyboard('p')
      await chosen('Plot')
    }],
    ['Compare', async () => {
      await userEvent.keyboard('pp')
      await chosen('Compare')
    }],
  ]

  it.each(modes)('pages to the next sheet with ↓ and back with ↑ in %s', async (_, enter) => {
    const { api, plot } = kr01()
    await openSheet(api, plot, 'S-02')
    await enter()
    await userEvent.keyboard('{ArrowDown}')
    await screen.findByRole('group', { name: sheetName('S-03') })
    await userEvent.keyboard('{ArrowUp}')
    await screen.findByRole('group', { name: sheetName('S-02') })
  })

  it('does nothing on D and P in list mode (§6.14)', async () => {
    const { api, plot } = kr01()
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('dp')
    expect(plot.seen.filter((c) => c.endsWith('/pdf'))).toEqual([])
    const rows = screen.getAllByRole('row').filter((r) => clean(r.textContent).includes('S-02'))
    await userEvent.click(within(rows.at(-1)!).getByText('S-02'))
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: sheetName('S-02') })
    await chosen('As read')
    expect(cadDark()).toHaveAttribute('aria-pressed', 'false')
  })
})
