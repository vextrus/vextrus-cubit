import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nRoot } from '@/i18n/I18nRoot'
import { KeyMap } from './registry'
import { KeyMapProvider, KeyRegion, KeyScope, useKeys } from './KeyMapProvider'
import { KeysOverlay } from './KeysOverlay'
import { expectKeyMapSound } from './testing'

function Bind({ keys, label, run }: { keys: string; label: string; run: () => void }) {
  useKeys([{ key: keys, label, group: 'screen', run }])
  return null
}

function renderWith(ui: React.ReactNode, map = new KeyMap({ strict: true })) {
  render(
    <I18nRoot>
      <KeyMapProvider map={map}>{ui}</KeyMapProvider>
    </I18nRoot>,
  )
  return map
}

describe('useKeys: features register keys, the map dispatches them (m0-screens §2.1)', () => {
  it('runs a screen binding for its key', async () => {
    const run = vi.fn()
    renderWith(
      <KeyScope level="screen" name="specimen">
        <Bind keys="Q" label="Next Question" run={run} />
      </KeyScope>,
    )
    await userEvent.keyboard('q')
    expect(run).toHaveBeenCalledOnce()
  })

  it('gives Space to the focused region over the screen, and to the screen elsewhere', async () => {
    const region = vi.fn()
    const screenSpace = vi.fn()
    renderWith(
      <KeyScope level="screen" name="step1">
        <Bind keys="Space" label="Screen Space" run={screenSpace} />
        <KeyRegion name="list">
          <button type="button">Row</button>
          <Bind keys="Space" label="Open the focused sheet" run={region} />
        </KeyRegion>
        <input aria-label="elsewhere" type="checkbox" />
      </KeyScope>,
    )
    screen.getByRole('button', { name: 'Row' }).closest('[data-key-region]')?.setAttribute('tabindex', '0')
    ;(screen.getByRole('button', { name: 'Row' }).closest('[data-key-region]') as HTMLElement).focus()
    await userEvent.keyboard(' ')
    expect(region).toHaveBeenCalledOnce()
    expect(screenSpace).not.toHaveBeenCalled()
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.keyboard(' ')
    expect(screenSpace).toHaveBeenCalledOnce()
  })

  it('lets typing win: letters type in a field, Esc and Ctrl shortcuts still reach the map', async () => {
    const letter = vi.fn()
    const esc = vi.fn()
    const ctrl = vi.fn()
    renderWith(
      <KeyScope level="screen" name="specimen">
        <Bind keys="D" label="CAD-dark" run={letter} />
        <Bind keys="Escape" label="Leave" run={esc} />
        <Bind keys="Ctrl K" label="Jump to" run={ctrl} />
        <input aria-label="Title" />
      </KeyScope>,
    )
    await userEvent.click(screen.getByLabelText('Title'))
    await userEvent.keyboard('Dd')
    expect(screen.getByLabelText('Title')).toHaveValue('Dd')
    expect(letter).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(esc).toHaveBeenCalledOnce()
    expect(ctrl).toHaveBeenCalledOnce()
  })

  it('gives every key to an open dialog alone', async () => {
    const screenKey = vi.fn()
    const dialogEsc = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <KeyScope level="screen" name="specimen">
          <Bind keys="Escape" label="Clear the selection" run={screenKey} />
          <Bind keys="F" label="Fit" run={screenKey} />
          {open ? (
            <KeyScope level="dialog" name="probe">
              <Bind
                keys="Escape"
                label="Close"
                run={() => {
                  dialogEsc()
                  setOpen(false)
                }}
              />
            </KeyScope>
          ) : null}
        </KeyScope>
      )
    }
    renderWith(<Harness />)
    await userEvent.keyboard('f')
    await userEvent.keyboard('{Escape}')
    expect(dialogEsc).toHaveBeenCalledOnce()
    expect(screenKey).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(screenKey).toHaveBeenCalledOnce()
  })

  it('lets a screen’s test fail on two bindings for one key in one scope', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const map = renderWith(
      <KeyScope level="screen" name="step1">
        <Bind keys="X" label="Exclude" run={() => {}} />
        <Bind keys="X" label="Something else" run={() => {}} />
      </KeyScope>,
      new KeyMap({ strict: false }),
    )
    expect(() => expectKeyMapSound(map)).toThrow(/X is bound twice in screen "step1"/)
    error.mockRestore()
  })

  it('removes a component’s keys when it unmounts', () => {
    const map = new KeyMap({ strict: true })
    const { unmount } = render(
      <KeyMapProvider map={map}>
        <Bind keys="Q" label="Next Question" run={() => {}} />
      </KeyMapProvider>,
    )
    expect(map.all()).toHaveLength(1)
    unmount()
    expect(map.all()).toHaveLength(0)
  })
})

describe('the ? overlay lists every active key, drawn from the map (m0-screens §2.1)', () => {
  it('groups the active keys and leaves out keys whose region is not focused', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      useKeys([{ key: '?', label: 'Show the keys', group: 'global', run: () => setOpen(true) }])
      return (
        <KeyScope level="screen" name="specimen">
          <Bind keys="Q" label="Go to the next open Question" run={() => {}} />
          <KeyRegion name="canvas">
            <Bind keys="F" label="Fit the whole sheet" run={() => {}} />
          </KeyRegion>
          <KeysOverlay open={open} onOpenChange={setOpen} />
        </KeyScope>
      )
    }
    renderWith(<Harness />)
    await userEvent.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: 'Keys' })
    expect(dialog).toHaveTextContent('On this screen')
    expect(dialog).toHaveTextContent('Go to the next open Question')
    expect(dialog).toHaveTextContent('Everywhere')
    expect(dialog).toHaveTextContent('Show the keys')
    expect(dialog).not.toHaveTextContent('Fit the whole sheet')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
