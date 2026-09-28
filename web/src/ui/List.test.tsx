import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nRoot } from '@/i18n/I18nRoot'
import { KeyMap } from './keys/registry'
import { KeyMapProvider } from './keys/KeyMapProvider'
import { expectKeyMapSound } from './keys/testing'
import { List } from './List'

const SHEETS = ['S-01', 'S-02', 'S-03', 'S-04', 'S-05'].map((number) => ({ number }))

function Sheets({
  selectable,
  items = SHEETS,
  keys,
}: {
  selectable?: boolean
  items?: { number: string }[]
  keys?: Parameters<typeof List>[0]['keys']
}) {
  const [focused, setFocused] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  return (
    <List
      label="Sheets"
      items={items}
      getKey={(s) => s.number}
      renderItem={(s) => <span>{s.number}</span>}
      focusedKey={focused}
      onFocusedKeyChange={setFocused}
      selectable={selectable}
      selectedKeys={selected}
      onSelectedKeysChange={setSelected}
      keys={keys}
    />
  )
}

function renderList(ui: React.ReactNode, map = new KeyMap({ strict: true })) {
  const result = render(
    <I18nRoot>
      <KeyMapProvider map={map}>{ui}</KeyMapProvider>
    </I18nRoot>,
  )
  return { ...result, map }
}

const option = (name: string) => screen.getByRole('option', { name })
const listbox = () => screen.getByRole('listbox', { name: 'Sheets' })

describe('the list every table uses (m0-screens §3, §2.2)', () => {
  it('moves the focused row with ↑ ↓ Home End through the key map', async () => {
    renderList(<Sheets />)
    listbox().focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-01').id)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-03').id)
    await userEvent.keyboard('{ArrowUp}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-02').id)
    await userEvent.keyboard('{End}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-05').id)
    await userEvent.keyboard('{Home}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-01').id)
  })

  it('selects with Space, Shift ↓ and Shift-click only on a list that opts in', async () => {
    renderList(<Sheets selectable />)
    expect(listbox()).toHaveAttribute('aria-multiselectable', 'true')
    listbox().focus()
    await userEvent.keyboard('{ArrowDown} ')
    expect(option('S-01')).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    expect(['S-01', 'S-02', 'S-03'].map((n) => option(n).getAttribute('aria-selected'))).toEqual(['true', 'true', 'true'])
    await userEvent.keyboard(' ')
    expect(option('S-03')).toHaveAttribute('aria-selected', 'false')
    const user = userEvent.setup()
    await user.click(option('S-05'))
    await user.keyboard('{Shift>}')
    await user.click(option('S-04'))
    await user.keyboard('{/Shift}')
    expect(option('S-01')).toHaveAttribute('aria-selected', 'false')
    expect(option('S-05')).toHaveAttribute('aria-selected', 'true')
    expect(option('S-04')).toHaveAttribute('aria-selected', 'true')
  })

  it('shrinks a Shift range back towards its anchor, keeping what was chosen before the anchor', async () => {
    renderList(<Sheets selectable />)
    const user = userEvent.setup()
    const chosen = () => ['S-01', 'S-02', 'S-03', 'S-04', 'S-05'].filter((n) => option(n).getAttribute('aria-selected') === 'true')
    await user.click(option('S-03'))
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    expect(chosen()).toEqual(['S-03', 'S-04', 'S-05'])
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(chosen()).toEqual(['S-03', 'S-04'])
    await user.keyboard('{Shift>}')
    await user.click(option('S-02'))
    await user.keyboard('{/Shift}')
    expect(chosen()).toEqual(['S-02', 'S-03'])
    await user.click(option('S-05'))
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp} ')
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(chosen()).toEqual(['S-01', 'S-02', 'S-05'])
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(chosen()).toEqual(['S-01', 'S-05'])
  })

  it('leaves Space to the feature when the list does not opt in (Step 1 claims it)', async () => {
    const open = vi.fn()
    const { map } = renderList(<Sheets keys={[{ key: 'Space', label: 'Open the focused sheet', group: 'screen', run: open }]} />)
    listbox().focus()
    await userEvent.keyboard('{ArrowDown} ')
    expect(open).toHaveBeenCalledOnce()
    expect(listbox()).not.toHaveAttribute('aria-multiselectable')
    expect(() => expectKeyMapSound(map)).not.toThrow()
  })

  it('fails the key-map test when a feature claims Space on a list that selects with it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { map } = renderList(
      <Sheets selectable keys={[{ key: 'Space', label: 'Open the focused sheet', group: 'screen', run: () => {} }]} />,
      new KeyMap({ strict: false }),
    )
    expect(() => expectKeyMapSound(map)).toThrow(/Space is bound twice in region "list"/)
    error.mockRestore()
  })

  it('keeps the focused row across a re-render and when rows change around it', async () => {
    function Changing() {
      const [items, setItems] = useState(SHEETS)
      return (
        <>
          <button type="button" onClick={() => setItems((xs) => [{ number: 'S-00' }, ...xs.filter((x) => x.number !== 'S-01')])}>
            change
          </button>
          <Sheets items={items} />
        </>
      )
    }
    renderList(<Changing />)
    listbox().focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-03').id)
    await userEvent.click(screen.getByRole('button', { name: 'change' }))
    expect(listbox()).toHaveAttribute('aria-activedescendant', option('S-03').id)
  })

  it('does not move the page when it first shows a focused row', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ number: `S-${String(i + 1).padStart(2, '0')}` }))
    renderList(
      <div style={{ height: 140, overflow: 'auto' }} data-testid="scroller">
        <List label="Sheets" items={many} getKey={(s) => s.number} renderItem={(s) => s.number} focusedKey="S-60" />
      </div>,
    )
    expect(screen.getByTestId('scroller').scrollTop).toBe(0)
  })

  it('scrolls the focused row into view', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ number: `S-${String(i + 1).padStart(2, '0')}` }))
    renderList(
      <div style={{ height: 140, overflow: 'auto' }} data-testid="scroller">
        <Sheets items={many} />
      </div>,
    )
    listbox().focus()
    await userEvent.keyboard('{End}')
    const scroller = screen.getByTestId('scroller').getBoundingClientRect()
    const last = option('S-60').getBoundingClientRect()
    expect(last.bottom).toBeLessThanOrEqual(scroller.bottom + 1)
    expect(last.top).toBeGreaterThanOrEqual(scroller.top - 1)
  })
})
