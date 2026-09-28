import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { SlotFill, SlotOutlet, SlotsProvider, useSlotFilled } from './slots'

function Filled() {
  return <span data-testid="filled">{String(useSlotFilled('status.end'))}</span>
}

function Feature() {
  const [on, setOn] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOn((o) => !o)}>
        toggle
      </button>
      {on ? (
        <>
          <SlotFill slot="status.end" order={20}>
            <span>second</span>
          </SlotFill>
          <SlotFill slot="status.end" order={10}>
            <span>first</span>
          </SlotFill>
        </>
      ) : null}
    </>
  )
}

describe('the frame’s slots: a feature registers an item, never editing the frame', () => {
  it('places each fill in its outlet, in order, while the fill is mounted', async () => {
    render(
      <SlotsProvider>
        <footer data-testid="bar" style={{ display: 'flex' }}>
          <SlotOutlet name="status.end" />
        </footer>
        <Feature />
        <Filled />
      </SlotsProvider>,
    )
    const bar = screen.getByTestId('bar')
    const items = () =>
      [...bar.querySelectorAll('span')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((e) => e.textContent)
    expect(items()).toEqual(['first', 'second'])
    expect(screen.getByTestId('filled').textContent).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(items()).toEqual([])
    expect(screen.getByTestId('filled').textContent).toBe('false')
  })
})
