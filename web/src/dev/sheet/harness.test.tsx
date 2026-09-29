/*
 * The sheet harness's pages (ticket 16's review): /dev/sheet lists what it can open, and an unknown
 * name lists the same, as links, instead of a dead end.
 */
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mountApp } from '@/app/testing'
import { sheetOrder } from './SheetHarness'

describe('/dev/sheet', () => {
  it('lists the sheets the harness can open, as links', async () => {
    await mountApp('/dev/sheet')
    const list = await screen.findByRole('list', { name: 'Sheets the harness can open' })
    const links = within(list).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toEqual(expect.arrayContaining(['/dev/sheet/tiny-sheet', '/dev/sheet/lineweight-ramp']))
  })

  it('names an unknown sheet and links the ones it can open', async () => {
    await mountApp('/dev/sheet/no-such-sheet')
    expect((await screen.findByText(/has no sheet named/)).textContent).toContain('no-such-sheet')
    const list = screen.getByRole('list', { name: 'Sheets the harness can open' })
    expect(within(list).getByRole('link', { name: 'tiny-sheet' })).toBeVisible()
  })
})

describe('sheetOrder', () => {
  it('orders sheet names by their numbers’ values: 1, 2, 3 … 10', () => {
    expect(sheetOrder(['plan-10', 'plan-2', 'plan-1', 'plan-3', 'tiny-sheet'])).toEqual(['plan-1', 'plan-2', 'plan-3', 'plan-10', 'tiny-sheet'])
  })
})
