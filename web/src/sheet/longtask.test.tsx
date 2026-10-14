/*
 * The page stays live while the densest sheet opens (issue #828; the walk measured 12.5 s main-thread
 * stalls on a 30,534,769-byte sheet). Opening a ~30 MB sheet, and opening it again from the cache, no
 * main-thread task runs five seconds or more: the decode is a Worker's, the frame's work is bounded from
 * the work grid, and the marks are drawn a part a frame (a software GPU, as the test browser has,
 * draws a million lines for many seconds, and the page waited on it all at once before: 18 s here). The
 * bound is five seconds, not the 200 ms the design aims at: the suite runs files side by side on one
 * software GPU, which slows a part many times over before the pacing catches up.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SlotOutlet, SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { darkest, denseSheet } from '@/acceptance/ts27g2/sheets'
import { decodedSheets } from './decoded'
import { SheetViewer } from './SheetViewer'

function mount(buffer: ArrayBuffer) {
  return render(
    <UiProviders>
      <SlotsProvider>
        <KeyScope level="screen" name="sheet">
          <SlotOutlet name="toolbar.start" />
          <div style={{ width: 800, height: 600, position: 'relative' }}>
            <SheetViewer buffer={buffer} label="S-10" />
          </div>
        </KeyScope>
      </SlotsProvider>
    </UiProviders>,
  )
}

/** The longest main-thread task while `run` runs, in ms. */
async function longestTask(run: () => Promise<void>): Promise<number> {
  const tasks: number[] = []
  const observer = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) tasks.push(e.duration)
  })
  observer.observe({ type: 'longtask' })
  try {
    await run()
    await new Promise((r) => setTimeout(r, 50))
    for (const e of observer.takeRecords()) tasks.push(e.duration)
  } finally {
    observer.disconnect()
  }
  return Math.max(0, ...tasks)
}

/** Until the sheet shows ink, then two seconds more of its parts. */
async function opens() {
  expect(await screen.findByRole('group', { name: /S-10/ })).toBeVisible()
  await expect.poll(darkest, { timeout: 60_000, interval: 250 }).toBeLessThan(50)
  await new Promise((r) => setTimeout(r, 2000))
}

afterEach(() => {
  cleanup()
  decodedSheets.clear()
})

describe('the densest sheet opening (#828)', () => {
  it('holds the main thread under five seconds at a time, opened and opened again', { timeout: 180_000 }, async () => {
    const buffer = await denseSheet()
    const first = await longestTask(async () => {
      const view = mount(buffer)
      await opens()
      view.unmount()
    })
    expect(first, 'the longest task opening it (ms)').toBeLessThan(5000)
    const again = await longestTask(async () => {
      mount(buffer)
      await opens()
    })
    expect(again, 'the longest task opening it again (ms)').toBeLessThan(5000)
  })
})
