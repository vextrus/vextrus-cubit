/*
 * S27-G2 (issue #828): a sheet already opened re-opens without decoding again, the decoded sheets kept
 * are bounded, least recently opened dropped first, and the viewer does not wait on a decode to mount.
 *
 * docs/specs/M0.md "Measured items": "A cached sheet interactive, densest sheet, reference setup:
 * ≤ 1,500 ms (ADR 0022)". The triage (f-2): "The query cache keeps the ArrayBuffer but not the decoded
 * or uploaded result, so a 'cached' sheet pays the decode again on every open."
 *
 * Chosen by the acceptance writer (the brief names no seam; nothing across a thread is observable
 * without one), and only this, so a Worker, its protocol and the upload stay the builder's:
 *
 *   import { openDecodedSheet, decodedSheets } from '@/sheet/decoded'
 *   openDecodedSheet(buffer: ArrayBuffer): Promise<DecodedSheet>   // the viewer's one way to decode; off the
 *                                                                  // main thread; the same ArrayBuffer again
 *                                                                  // gives the same DecodedSheet, undecoded
 *   decodedSheets.size / .capacity / .clear()                      // the decoded sheets kept: at most capacity
 *
 * The buffer may be transferred (and so detached) by the first open: a second open of the same
 * ArrayBuffer must still find its decoded sheet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { SheetViewer } from '@/sheet'
import { decodeSheet, type DecodedSheet } from '@/sheet/decode'
import { decodedSheets, openDecodedSheet } from '@/sheet/decoded'
import { darkest, denseSheet, tinySheet } from './sheets'

vi.mock('@/sheet/decoded', { spy: true })

function mount(buffer: ArrayBuffer, label: string) {
  return render(
    <UiProviders>
      <SlotsProvider>
        <KeyScope level="screen" name="sheet">
          <SlotOutlet name="toolbar.start" />
          <SlotOutlet name="toolbar.end" />
          <div style={{ width: 800, height: 600, position: 'relative' }}>
            <SheetViewer buffer={buffer} label={label} />
          </div>
        </KeyScope>
      </SlotsProvider>
    </UiProviders>,
  )
}

beforeEach(() => {
  decodedSheets.clear()
})

afterEach(() => {
  cleanup()
  vi.mocked(openDecodedSheet).mockReset()
  decodedSheets.clear()
})

describe('openDecodedSheet: a sheet already opened', () => {
  it('gives the same decoded sheet for a second open of the same buffer', { timeout: 120_000 }, async () => {
    const buffer = await denseSheet()
    const first = await openDecodedSheet(buffer)
    const again = await openDecodedSheet(buffer)
    expect(again === first, 'decoded again').toBe(true)
    expect(first.lines.count).toBeGreaterThan(500_000)
    expect(decodedSheets.size).toBe(1)
  })
})

describe('openDecodedSheet: the decoded sheets kept', () => {
  it('keeps at most its capacity, of two or more sheets', { timeout: 60_000 }, async () => {
    expect(decodedSheets.capacity).toBeGreaterThanOrEqual(2)
    for (let i = 0; i <= decodedSheets.capacity; i++) await openDecodedSheet(await tinySheet())
    expect(decodedSheets.size).toBe(decodedSheets.capacity)
  })

  it('drops the sheet least recently opened first', { timeout: 60_000 }, async () => {
    const capacity = decodedSheets.capacity
    const kept = await tinySheet()
    const dropped = await tinySheet()
    const keptSheet = await openDecodedSheet(kept)
    const droppedSheet = await openDecodedSheet(dropped)
    for (let i = 2; i < capacity; i++) await openDecodedSheet(await tinySheet())
    // Opened again: now the most recent. The next new sheet pushes out `dropped`, not `kept`.
    expect((await openDecodedSheet(kept)) === keptSheet, 'a sheet in the cache decoded again').toBe(true)
    await openDecodedSheet(await tinySheet())
    expect(decodedSheets.size).toBe(capacity)
    expect((await openDecodedSheet(kept)) === keptSheet, 'the sheet opened most recently was dropped').toBe(true)
    expect((await openDecodedSheet(dropped)) === droppedSheet, 'the sheet opened least recently was kept').toBe(false)
  })
})

describe('openDecodedSheet: a crafted buffer', () => {
  it('refuses a 30 MB buffer that is not a sheet, and the next sheet still opens', { timeout: 60_000 }, async () => {
    const garbage = new Uint8Array(30_500_000)
    garbage.fill(0x5a)
    // Settled to a word, so a wrong success never prints 30 MB of arrays.
    const outcome = await openDecodedSheet(garbage.buffer).then(
      () => 'opened',
      () => 'refused',
    )
    expect(outcome).toBe('refused')
    const sheet = await openDecodedSheet(await tinySheet())
    expect(sheet.lines.count).toBeGreaterThan(0)
  })
})

describe('<SheetViewer> and the decode', () => {
  it('opens through openDecodedSheet, and mounts while the decode is still running', { timeout: 60_000 }, async () => {
    const buffer = await tinySheet()
    const decoded = decodeSheet(await tinySheet())
    let finish: (sheet: DecodedSheet) => void = () => {}
    const running = new Promise<DecodedSheet>((resolve) => {
      finish = resolve
    })
    vi.mocked(openDecodedSheet).mockImplementation(() => running)
    mount(buffer, 'S-10')
    // While the decode runs: the viewer is on the page, its label in the toolbar, nothing failed.
    expect(await screen.findByText('S-10')).toBeVisible()
    expect(vi.mocked(openDecodedSheet).mock.calls.some(([b]) => b === buffer), 'the viewer did not open its buffer through openDecodedSheet').toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(darkest(), 'drawn before its decode finished').toBe(255)
    finish(decoded)
    await expect.poll(darkest, { timeout: 30_000 }).toBeLessThan(50)
  })

  it('shows "S-10 could not be drawn. The other sheets are not affected." for a 30 MB buffer that is not a sheet', { timeout: 60_000 }, async () => {
    const garbage = new Uint8Array(30_500_000)
    garbage.fill(0x5a)
    mount(garbage.buffer, 'S-10')
    const alert = await screen.findByRole('alert', {}, { timeout: 30_000 })
    expect(alert.textContent?.replace(/[⁦-⁩]/g, '')).toContain('S-10 could not be drawn. The other sheets are not affected.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
