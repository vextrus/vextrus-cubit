/*
 * Ticket 16's viewer (the orchestrator's ruling: `<SheetViewer buffer={ArrayBuffer} label={string} />`,
 * "one sheet; zoom, pan, fit by keyboard and pointer"; paging across sheets is 22's, not 16's).
 *
 * m0-screens 4.6 and 2.2 (the key map), verbatim:
 * - "Opening a sheet: fitted to the working view box, else the whole paper with a 2% margin ...
 *   A sheet never opens as a speck: if the paper would fill less than 40% of the canvas width, it
 *   fits the paper's used extents instead."
 * - `F` (region: canvas) "Fit the whole sheet"; `Shift F` "Back to the working view (the fit the sheet
 *   opened with)"; `+` `−` (region: canvas) "Zoom in / out about the centre (the wheel zooms about
 *   the pointer; drag with the left or middle button pans)".
 * - Fit is an icon-only button with an accessible name (U7).
 * - "Fixed left to right: the canvas ... carry `dir="ltr"`" (1.8; §8 item 10).
 * - "Could not be drawn | ErrorBar in the canvas: "S-04 could not be drawn. The other sheets are not
 *   affected." [Try again]".
 * - §8 item 2: the key map is sound (testing.ts: "For each screen's tests (03, 16, ...)").
 *
 * What the viewer shows is read from its canvases' pixels (every canvas under the viewer, composited
 * on white); the tiny sheet's outermost ink is its frame, drawn on the paper's edge, so the ink's box
 * is the paper's place on screen.
 *
 * Chosen by the acceptance writer: the module entry `@/sheet`; the viewer fills its parent; its
 * toolbar items reach the frame through the slots (`toolbar.start`, `toolbar.end`; app/slots.tsx);
 * the canvas region is reached by Tab.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { KeyMap } from '@/ui/keys/registry'
import { expectKeyMapSound } from '@/ui/keys/testing'
import { SheetViewer } from '@/sheet'
import { fixtureBuffer, inkBox, snapshot, type InkBox } from './sheet.fixture'

const WIDTH = 1000
const HEIGHT = 700

async function open(buffer?: ArrayBuffer, label = 'S-04') {
  const keyMap = new KeyMap({ strict: true })
  const data = buffer ?? (await fixtureBuffer('tiny-sheet'))
  render(
    <UiProviders keyMap={keyMap}>
      <SlotsProvider>
        <KeyScope level="screen" name="sheet">
          <div data-testid="toolbar">
            <SlotOutlet name="toolbar.start" />
            <SlotOutlet name="toolbar.end" />
          </div>
          <div data-testid="stage" style={{ width: WIDTH, height: HEIGHT, position: 'relative' }}>
            <SheetViewer buffer={data} label={label} />
          </div>
          <SlotOutlet name="status.start" />
        </KeyScope>
      </SlotsProvider>
    </UiProviders>,
  )
  return { keyMap, stage: screen.getByTestId('stage') }
}

function paperBox(stage: Element): InkBox | null {
  return inkBox(snapshot(stage))
}

async function opened(stage: Element): Promise<InkBox> {
  await expect.poll(() => paperBox(stage), { timeout: 10_000 }).not.toBeNull()
  // Settled: two reads in a row agree.
  let last = paperBox(stage)
  await expect
    .poll(() => {
      const now = paperBox(stage)
      const same = JSON.stringify(now) === JSON.stringify(last)
      last = now
      return same
    })
    .toBe(true)
  return last!
}

/** Waits until the picture changes from `before`, then until it settles; returns the new box. */
async function changed(stage: Element, before: InkBox): Promise<InkBox> {
  await expect.poll(() => JSON.stringify(paperBox(stage)), { timeout: 10_000 }).not.toBe(JSON.stringify(before))
  return opened(stage)
}

function near(a: InkBox, b: InkBox, px = 1.5) {
  return (['x0', 'y0', 'x1', 'y1'] as const).every((k) => Math.abs(a[k] - b[k]) <= px)
}

async function focusCanvas(stage: HTMLElement) {
  const canvasArea = stage.querySelector('[data-ltr-canvas]') ?? stage
  for (let i = 0; i < 30 && !canvasArea.contains(document.activeElement); i++) await userEvent.tab()
  expect(canvasArea.contains(document.activeElement), 'Tab reaches the canvas region').toBe(true)
}

function wheel(stage: HTMLElement, x: number, y: number, deltaY: number) {
  const box = stage.getBoundingClientRect()
  const clientX = box.left + x
  const clientY = box.top + y
  const target = document.elementFromPoint(clientX, clientY) ?? stage
  target.dispatchEvent(new WheelEvent('wheel', { deltaY, clientX, clientY, bubbles: true, cancelable: true }))
}

async function drag(stage: HTMLElement, button: 'MouseLeft' | 'MouseMiddle', from: [number, number], by: [number, number]) {
  const box = stage.getBoundingClientRect()
  const start = { clientX: box.left + from[0], clientY: box.top + from[1] }
  const target = document.elementFromPoint(start.clientX, start.clientY) ?? stage
  const steps = [1, 2, 3, 4].map((k) => ({
    coords: { clientX: start.clientX + (by[0] * k) / 4, clientY: start.clientY + (by[1] * k) / 4 },
  }))
  await userEvent.pointer([{ keys: `[${button}>]`, target, coords: start }, ...steps, { keys: `[/${button}]` }])
}

describe('<SheetViewer>: one sheet, fitted, zoomed, panned and fitted again', () => {
  it('opens fitted: the whole paper in view, filling at least 40% of the canvas width, never a speck', async () => {
    const { stage } = await open()
    const box = await opened(stage)
    expect(box.x0).toBeGreaterThan(0)
    expect(box.y0).toBeGreaterThan(0)
    expect(box.x1).toBeLessThan(WIDTH - 1)
    expect(box.y1).toBeLessThan(HEIGHT - 1)
    expect(box.x1 - box.x0).toBeGreaterThanOrEqual(0.4 * WIDTH)
  })

  it('shows its label', async () => {
    await open(undefined, 'S-04')
    expect(await screen.findByText('S-04')).toBeVisible()
  })

  it('carries the canvas left to right: dir="ltr", never mirrored', async () => {
    const { stage } = await open()
    await opened(stage)
    for (const canvas of stage.querySelectorAll('canvas')) expect(canvas.closest('[dir]')?.getAttribute('dir')).toBe('ltr')
  })

  it('registers its keys soundly in the key map (m0-screens §8, item 2)', async () => {
    const { keyMap, stage } = await open()
    await opened(stage)
    expectKeyMapSound(keyMap)
  })

  it('zooms in on + (the sheet shows larger)', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    await focusCanvas(stage)
    await userEvent.keyboard('+')
    const after = await changed(stage, before)
    const wider = after.x1 - after.x0 > before.x1 - before.x0 || (after.x0 <= 0 && after.x1 >= WIDTH - 1)
    const taller = after.y1 - after.y0 > before.y1 - before.y0 || (after.y0 <= 0 && after.y1 >= HEIGHT - 1)
    expect({ wider, taller }).toEqual({ wider: true, taller: true })
  })

  it('zooms out on − about the centre of the canvas', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    await focusCanvas(stage)
    await userEvent.keyboard('-')
    const after = await changed(stage, before)
    const k = (after.x1 - after.x0) / (before.x1 - before.x0)
    expect(k).toBeLessThan(0.97)
    // Zoom about the centre C: every point p goes to C + k (p - C).
    const cx = WIDTH / 2
    const cy = HEIGHT / 2
    expect(Math.abs(after.x0 - (cx + k * (before.x0 - cx)))).toBeLessThanOrEqual(2)
    expect(Math.abs(after.y0 - (cy + k * (before.y0 - cy)))).toBeLessThanOrEqual(2)
    expect(Math.abs(after.y1 - after.y0 - k * (before.y1 - before.y0))).toBeLessThanOrEqual(2)
  })

  it('returns to the same view on + then −', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    await focusCanvas(stage)
    await userEvent.keyboard('+')
    const zoomed = await changed(stage, before)
    await userEvent.keyboard('-')
    const back = await changed(stage, zoomed)
    expect(near(back, before), `${JSON.stringify(back)} ≈ ${JSON.stringify(before)}`).toBe(true)
  })

  it('zooms about the pointer on the wheel: the point under the pointer stays put', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    const px = before.x0 + 40
    const py = before.y0 + 30
    wheel(stage, px, py, -120)
    const after = await changed(stage, before)
    // About the pointer P, the frame's corner c goes to P + k (c - P), the same k across and down.
    const kx = (after.x0 - px) / (before.x0 - px)
    const ky = (after.y0 - py) / (before.y0 - py)
    expect(Math.abs(kx - 1), 'the wheel zooms').toBeGreaterThan(0.05)
    expect(Math.abs(kx - ky), `the same zoom across (${kx}) and down (${ky}): about the pointer`).toBeLessThan(0.06)
  })

  it('pans on a drag with the left button, by the distance dragged', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    await drag(stage, 'MouseLeft', [WIDTH / 2, HEIGHT / 2], [60, 40])
    const after = await changed(stage, before)
    expect(near(after, { x0: before.x0 + 60, y0: before.y0 + 40, x1: before.x1 + 60, y1: before.y1 + 40 }, 2)).toBe(true)
  })

  it('pans on a drag with the middle button', async () => {
    const { stage } = await open()
    const before = await opened(stage)
    await drag(stage, 'MouseMiddle', [WIDTH / 2, HEIGHT / 2], [-50, 30])
    const after = await changed(stage, before)
    expect(near(after, { x0: before.x0 - 50, y0: before.y0 + 30, x1: before.x1 - 50, y1: before.y1 + 30 }, 2)).toBe(true)
  })

  it('fits the whole sheet again on F', async () => {
    const { stage } = await open()
    const fitted = await opened(stage)
    await drag(stage, 'MouseLeft', [WIDTH / 2, HEIGHT / 2], [80, -50])
    const moved = await changed(stage, fitted)
    await focusCanvas(stage)
    await userEvent.keyboard('f')
    const back = await changed(stage, moved)
    expect(near(back, fitted), `${JSON.stringify(back)} ≈ ${JSON.stringify(fitted)}`).toBe(true)
  })

  it('goes back to the view it opened with on Shift F', async () => {
    const { stage } = await open()
    const fitted = await opened(stage)
    await focusCanvas(stage)
    await userEvent.keyboard('+')
    const zoomed = await changed(stage, fitted)
    await userEvent.keyboard('{Shift>}F{/Shift}')
    const back = await changed(stage, zoomed)
    expect(near(back, fitted), `${JSON.stringify(back)} ≈ ${JSON.stringify(fitted)}`).toBe(true)
  })

  it('fits the whole sheet again from the icon-only "Fit" button', async () => {
    const { stage } = await open()
    const fitted = await opened(stage)
    await drag(stage, 'MouseLeft', [WIDTH / 2, HEIGHT / 2], [-70, 45])
    const moved = await changed(stage, fitted)
    await userEvent.click(screen.getByRole('button', { name: 'Fit' }))
    const back = await changed(stage, moved)
    expect(near(back, fitted), `${JSON.stringify(back)} ≈ ${JSON.stringify(fitted)}`).toBe(true)
  })
})

describe('<SheetViewer>: a buffer it cannot draw', () => {
  it('shows "S-04 could not be drawn. The other sheets are not affected." with Try again', async () => {
    const bad = await fixtureBuffer('tiny-sheet')
    new DataView(bad).setUint16(4, 2, true) // an unknown version
    await open(bad, 'S-04')
    expect(await screen.findByText('S-04 could not be drawn. The other sheets are not affected.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
