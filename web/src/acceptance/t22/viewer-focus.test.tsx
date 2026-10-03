/*
 * Issue #115, fixed before 22 mounts the viewer (the orchestrator's brief for 22): after Try again
 * succeeds, the drawn sheet takes focus once; if the user then puts focus elsewhere and the working
 * view changes (22 pages sheets and fits their working views), focus stays where the user put it.
 * `<SheetViewer buffer label workingView onRetry />` (16, on main).
 */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotsProvider } from '@/app/slots'
import { UiProviders } from '@/ui/UiProviders'
import { KeyScope } from '@/ui/keys/KeyMapProvider'
import { SheetViewer } from '@/sheet'
import { fixtureBuffer } from '../t16/sheet.fixture'

describe('the viewer after Try again (#115)', () => {
  it('keeps focus where the user put it when the working view changes after a successful retry', async () => {
    const good = await fixtureBuffer('tiny-sheet')
    let moveView: () => void = () => {}
    function Step1Like() {
      const [buffer, setBuffer] = useState(new ArrayBuffer(8))
      const [view, setView] = useState({ x0: 20, y0: 30, x1: 400, y1: 280 })
      moveView = () => setView({ x0: 10, y0: 10, x1: 200, y1: 150 })
      return (
        <>
          <input aria-label="Elsewhere" />
          <div style={{ width: 800, height: 600, position: 'relative' }}>
            <SheetViewer buffer={buffer} label="S-04" workingView={view} onRetry={() => setBuffer(good)} />
          </div>
        </>
      )
    }
    render(
      <UiProviders>
        <SlotsProvider>
          <KeyScope level="screen" name="sheet">
            <Step1Like />
          </KeyScope>
        </SlotsProvider>
      </UiProviders>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await expect.poll(() => document.activeElement?.getAttribute('role')).toBe('group')
    const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' })
    await userEvent.click(elsewhere)
    await userEvent.type(elsewhere, 'abc')
    moveView()
    await expect.poll(() => screen.getByRole('group')).toBeTruthy()
    // Two frames for the redraw the new working view asks for.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(document.activeElement).toBe(elsewhere)
    expect(elsewhere).toHaveValue('abc')
  })
})
