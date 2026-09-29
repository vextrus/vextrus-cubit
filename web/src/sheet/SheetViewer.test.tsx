/*
 * The viewer's words and its life on a page (m0-screens 1.8 and 4.6; the words gate on 16): the
 * sheet number is notation, left to right wherever it goes; the Fit button's tooltip names both of
 * its keys; and it draws under React's StrictMode, which the app runs in development (a remount on
 * the same canvas once lost its WebGL context and drew nothing).
 */
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { SheetViewer } from './SheetViewer'

function mount(buffer: ArrayBuffer) {
  render(
    <StrictMode>
      <UiProviders>
        <SlotsProvider>
          <KeyScope level="screen" name="sheet">
            <SlotOutlet name="toolbar.start" />
            <SlotOutlet name="toolbar.end" />
            <div style={{ width: 800, height: 600, position: 'relative' }}>
              <SheetViewer buffer={buffer} label="S-04" />
            </div>
          </KeyScope>
        </SlotsProvider>
      </UiProviders>
    </StrictMode>,
  )
}

async function tiny() {
  return (await fetch(tinySheetUrl)).arrayBuffer()
}

/** The darkest pixel on the viewer's canvas, composited on white (255: nothing drawn). */
function darkest(): number {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-ltr-canvas] canvas')
  if (!canvas || canvas.width === 0) return 255
  const scratch = document.createElement('canvas')
  scratch.width = canvas.width
  scratch.height = canvas.height
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, scratch.width, scratch.height)
  ctx.drawImage(canvas, 0, 0)
  const d = ctx.getImageData(0, 0, scratch.width, scratch.height).data
  let min = 255
  for (let i = 0; i < d.length; i += 4) min = Math.min(min, d[i]!)
  return min
}

describe('<SheetViewer> under StrictMode', () => {
  it('draws the sheet after a remount on the same canvas', async () => {
    mount(await tiny())
    await expect.poll(darkest, { timeout: 10_000 }).toBeLessThan(50)
  })
})

describe('<SheetViewer> focus (m0-screens §8 item 7)', () => {
  it('keeps its focus ring above the drawing when zoomed in', async () => {
    mount(await tiny())
    await expect.poll(darkest, { timeout: 10_000 }).toBeLessThan(50)
    const region = screen.getByRole('group')
    for (let i = 0; i < 20 && document.activeElement !== region; i++) await userEvent.tab()
    expect(document.activeElement).toBe(region)
    await userEvent.keyboard('+')
    await userEvent.keyboard('+')
    const ring = region.querySelector<HTMLElement>('[data-focus-ring]')
    expect(ring, 'a ring layer').not.toBeNull()
    // Painted after the canvas, over it, with the focus colour's outline.
    expect(ring!.compareDocumentPosition(region.querySelector('canvas')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    const style = getComputedStyle(ring!)
    expect([style.position, style.outlineStyle, style.outlineWidth, style.pointerEvents]).toEqual(['absolute', 'solid', '2px', 'none'])
  })
})

describe('<SheetViewer> words', () => {
  it('shows the sheet number as notation, left to right, and names the canvas by it', async () => {
    mount(await tiny())
    const label = await screen.findByText('S-04')
    expect(label.closest('[data-notation]')?.getAttribute('dir')).toBe('ltr')
    expect(screen.getByRole('group').getAttribute('aria-label'), 'isolated once').toBe('Sheet \u2068S-04\u2069')
  })

  it('marks the sheet number as notation, left to right, in "could not be drawn"', async () => {
    mount(new ArrayBuffer(8))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('[data-notation="sheet-number"]')?.getAttribute('dir')).toBe('ltr')
    expect(alert.textContent?.replace(/[⁦-⁩]/g, '')).toContain('S-04 could not be drawn. The other sheets are not affected.')
  })

  it('names both of Fit’s keys in its tooltip (4.6), and is named "Fit"', async () => {
    mount(await tiny())
    const fit = await screen.findByRole('button', { name: 'Fit' })
    await userEvent.hover(fit)
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent?.replace(/\s+/g, ' ')).toMatch(/Fit the whole sheet.*F.*·.*Back to the working view.*Shift.*F/)
  })
})
