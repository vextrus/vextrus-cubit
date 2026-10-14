/*
 * S27-G2 (issue #828): the densest sheet is decoded off the main thread, and once for two opens.
 *
 * docs/specs/M0.md "Measured items": "A cached sheet interactive, densest sheet, reference setup:
 * ≤ 1,500 ms (ADR 0022)". The walk measured 12.5–12.9 s main-thread stalls opening a 30,534,769-byte
 * sheet; the triage (f-2) found the viewer decoding the whole buffer (`decodeSheet`) on the main thread,
 * in render, on every mount, and "The query cache keeps the ArrayBuffer but not the decoded or uploaded
 * result, so a 'cached' sheet pays the decode again on every open." Its fix direction: "decode in a
 * Worker (transfer the ArrayBuffer and get typed arrays back) and keep decoded sheets in an LRU".
 *
 * The pin is structural, not a clock: while the viewer opens a ~30 MB sheet and draws it, the sheet's
 * bytes (the buffer itself, transferred or copied) are posted to a Worker, and for two opens of the same
 * buffer (as the query cache hands it back) they are posted once. The Worker's code, its messages and
 * how the result is uploaded are the builder's. (`vi.mock` of src/sheet/decode cannot be used here: Vitest
 * serves the mocked module to the Worker too, which cannot run it.)
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { SheetViewer } from '@/sheet'
import { darkest, denseSheet, DENSEST_BYTES } from './sheets'

/** How many messages posted to a Worker carried a buffer (or a view of one) of at least `bytes` bytes. */
function postedWith(post: { mock: { calls: unknown[][] } }, bytes: number): number {
  const carries = (value: unknown, depth: number): boolean => {
    if (value instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)) return value.byteLength >= bytes
    if (ArrayBuffer.isView(value)) return value.byteLength >= bytes
    if (depth > 4 || value === null || typeof value !== 'object') return false
    return Object.values(value as Record<string, unknown>).some((v) => carries(v, depth + 1))
  }
  return post.mock.calls.filter((args) => args.some((a) => carries(a, 0))).length
}

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

let post: MockInstance<Worker['postMessage']>

beforeEach(() => {
  post = vi.spyOn(Worker.prototype, 'postMessage')
})

afterEach(() => {
  cleanup()
  post.mockRestore()
})

describe('the densest sheet (issue #828)', () => {
  it('is decoded in a Worker: its bytes are posted to one, and it is drawn', { timeout: 120_000 }, async () => {
    const buffer = await denseSheet()
    const size = buffer.byteLength
    expect(size).toBeGreaterThanOrEqual(DENSEST_BYTES)
    mount(buffer, 'S-10')
    expect(await screen.findByText('S-10')).toBeVisible()
    await expect.poll(darkest, { timeout: 100_000, interval: 250 }).toBeLessThan(50)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(postedWith(post, size), "messages to a Worker carrying the sheet's bytes").toBeGreaterThanOrEqual(1)
  })

  it('is decoded once for two opens of the same buffer', { timeout: 120_000 }, async () => {
    const buffer = await denseSheet()
    const size = buffer.byteLength
    const first = mount(buffer, 'S-10')
    await expect.poll(darkest, { timeout: 100_000, interval: 250 }).toBeLessThan(50)
    first.unmount()
    mount(buffer, 'S-10')
    await expect.poll(darkest, { timeout: 100_000, interval: 250 }).toBeLessThan(50)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(postedWith(post, size), "messages to a Worker carrying the sheet's bytes").toBe(1)
  })
})
