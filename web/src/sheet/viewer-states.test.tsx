/*
 * The viewer's states around the decode (S27-G2 fix round 1, the design gate on #842):
 * - paging into a sheet that cannot be drawn keeps the focus in the canvas region (it fell to the page
 *   when the canvas gave way to the error), and Tab reaches Try again;
 * - a sheet opened for the first time shows its paper's outline and "Opening S-04 for the first time…"
 *   while it decodes (m0-screens 4.6); a sheet kept decoded shows neither; a sheet this session opened
 *   before, its buffer fetched again, shows the outline alone (fix round 2: "Opened before: … no line").
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import type { DecodedSheet } from './decode'
import { decodedSheets, openDecodedSheet } from './decoded'
import { SheetViewer } from './SheetViewer'

vi.mock('./decoded', { spy: true })

function mount(buffer: ArrayBuffer, sheetId?: string) {
  return render(tree(buffer, sheetId))
}

function tree(buffer: ArrayBuffer, sheetId?: string) {
  return (
    <UiProviders>
      <SlotsProvider>
        <KeyScope level="screen" name="sheet">
          <div style={{ width: 800, height: 600, position: 'relative' }}>
            <SheetViewer buffer={buffer} label="S-04" sheetId={sheetId} />
          </div>
        </KeyScope>
      </SlotsProvider>
    </UiProviders>
  )
}

const tiny = async () => (await fetch(tinySheetUrl)).arrayBuffer()
const clean = (text: string | null | undefined) => (text ?? '').replace(/[⁦-⁩]/g, '')

afterEach(() => {
  cleanup()
  vi.mocked(openDecodedSheet).mockReset()
  decodedSheets.clear()
})

describe('the canvas region and the focus', () => {
  it('paging into a sheet that cannot be drawn keeps focus in the canvas region, and Tab reaches Try again', async () => {
    const garbage = new Uint8Array(4096).fill(0x5a).buffer
    let refuse: (error: Error) => void = () => {}
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>((_, reject) => (refuse = reject)))
    mount(garbage)
    // Paged in by a key: the canvas takes the focus while the sheet decodes, as Step 1 gives it.
    await userEvent.keyboard('{Shift}')
    const canvas = await screen.findByRole('group', { name: /S-04/ })
    canvas.focus()
    expect(document.activeElement).toBe(canvas)
    refuse(new Error('not a sheet'))
    const alert = await screen.findByRole('alert')
    expect(clean(alert.textContent)).toContain('S-04 could not be drawn. The other sheets are not affected.')
    expect(document.activeElement, 'the focus fell to the page').not.toBe(document.body)
    expect(alert.closest('[tabindex="-1"]')?.contains(document.activeElement) || alert.closest('[tabindex="-1"]') === document.activeElement, 'focus in the canvas region').toBe(true)
    // And its ring shows (m0-screens 8.7): focus-inset's outline, never cancelled.
    expect(getComputedStyle(document.activeElement!).outlineStyle, 'the focused region shows no ring').not.toBe('none')
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }))
  })
})

describe('the first open of a sheet (4.6)', () => {
  it('shows the paper outline and "Opening S-04 for the first time…" while the sheet decodes', async () => {
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>(() => {}))
    mount(await tiny())
    const line = await screen.findByText((_, el) => el?.getAttribute('role') === 'status' && clean(el.textContent) === 'Opening S-04 for the first time…')
    expect(line).toBeVisible()
    const outline = document.querySelector<HTMLElement>('[data-first-open]')
    expect(outline, 'the paper outline').not.toBeNull()
    const box = outline!.getBoundingClientRect()
    // The tiny sheet's paper is A5 landscape (210 x 148): the outline keeps its proportions.
    expect(box.width / box.height).toBeCloseTo(210 / 148, 1)
  })

  it('shows neither for a sheet kept decoded', async () => {
    const buffer = await tiny()
    await openDecodedSheet(buffer)
    mount(buffer)
    await screen.findByRole('group', { name: /S-04/ })
    expect(document.querySelector('[data-first-open]')).toBeNull()
    expect(screen.queryByText(/for the first time/)).toBeNull()
  })

  it('takes the outline and the line away once the sheet is drawn', async () => {
    mount(await tiny())
    await screen.findByRole('group', { name: /S-04/ })
    await expect.poll(() => document.querySelector('[data-first-open]'), { timeout: 30_000 }).toBeNull()
    expect(screen.queryByText(/for the first time/)).toBeNull()
  })

  it('says "for the first time" only once a session: a sheet opened before, its buffer fetched again, shows the outline alone', async () => {
    // Opened and drawn once.
    const first = mount(await tiny(), 'sheet-opened-before')
    await screen.findByRole('group', { name: /S-04/ })
    await expect.poll(() => document.querySelector('[data-first-open]'), { timeout: 30_000 }).toBeNull()
    first.unmount()
    // Its decoded sheet dropped, and its buffer fetched again: a new ArrayBuffer, decoding held.
    decodedSheets.clear()
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>(() => {}))
    mount(await tiny(), 'sheet-opened-before')
    await screen.findByRole('group', { name: /S-04/ })
    await expect.poll(() => document.querySelector('[data-first-open]'), { timeout: 10_000 }).not.toBeNull()
    expect(screen.queryByText(/for the first time/)).toBeNull()
  })

  it('says it for a sheet this session has not opened, whatever the label', async () => {
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>(() => {}))
    mount(await tiny(), 'sheet-never-opened')
    expect(await screen.findByText(/for the first time/)).toBeVisible()
  })

  it('says it once for a sheet given a new buffer by Try again in the same viewer', async () => {
    const view = mount(await tiny(), 'sheet-tried-again')
    await screen.findByRole('group', { name: /S-04/ })
    await expect.poll(() => document.querySelector('[data-first-open]'), { timeout: 30_000 }).toBeNull()
    // Try again fetched the sheet again: the same viewer, a new buffer, its decode held.
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>(() => {}))
    view.rerender(tree(await tiny(), 'sheet-tried-again'))
    await expect.poll(() => document.querySelector('[data-first-open]'), { timeout: 10_000 }).not.toBeNull()
    expect(screen.queryByText(/for the first time/)).toBeNull()
  })
})
