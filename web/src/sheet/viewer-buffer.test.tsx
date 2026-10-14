/*
 * A viewer given a new buffer (a sheet fetched again, issue #828): while the new one decodes off the
 * main thread its canvas is empty, never the sheet before it under the new one's label.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { darkest } from '@/acceptance/ts27g2/sheets'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import type { DecodedSheet } from './decode'
import { decodedSheets, openDecodedSheet } from './decoded'
import { SheetViewer } from './SheetViewer'

vi.mock('./decoded', { spy: true })

function viewer(buffer: ArrayBuffer) {
  return (
    <UiProviders>
      <SlotsProvider>
        <KeyScope level="screen" name="sheet">
          <div style={{ width: 800, height: 600, position: 'relative' }}>
            <SheetViewer buffer={buffer} label="S-04" />
          </div>
        </KeyScope>
      </SlotsProvider>
    </UiProviders>
  )
}

afterEach(() => {
  cleanup()
  vi.mocked(openDecodedSheet).mockReset()
  decodedSheets.clear()
})

describe('<SheetViewer> given a new buffer', () => {
  it('empties its canvas while the new buffer decodes', async () => {
    const first = await (await fetch(tinySheetUrl)).arrayBuffer()
    const view = render(viewer(first))
    await expect.poll(darkest, { timeout: 30_000 }).toBeLessThan(50)
    const next = await (await fetch(tinySheetUrl)).arrayBuffer()
    // The new buffer's decode never finishes here.
    vi.mocked(openDecodedSheet).mockImplementation(() => new Promise<DecodedSheet>(() => {}))
    view.rerender(viewer(next))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(darkest(), 'the sheet before drawn under the new buffer').toBe(255)
  })
})
