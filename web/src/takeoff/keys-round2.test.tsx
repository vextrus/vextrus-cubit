/*
 * S15-W2, fix round 1 (PR 562): a Shift selection ends when the focus leaves it by any route, and the
 * stated scale never outlives the pointer's place on a view.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page, userEvent as pointer } from 'vitest/browser'
import userEvent from '@testing-library/user-event'
import { PLAN_VIEW, clean, excludedBy, focusRow, openList, openSheet, rowOf, seed, statusBar } from '@/acceptance/ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

describe('X after the focus leaves a Shift selection', () => {
  it('excludes the focused row, not the selection it left (focus moved by a route other than the arrow keys)', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-01')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    // The focus goes to S-05 as Q, the bar's next act or a pick on a Question card send it: not by ↑ ↓ Home End or a click.
    rowOf('S-05').focus()
    await waitFor(() => expect(document.activeElement).toBe(rowOf('S-05')))
    await userEvent.keyboard('x')
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-05']))
  })

  it('still excludes the whole selection while the focus is inside it', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-01')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-01', 'S-02', 'S-03']))
  })
})

describe('the stated scale in the status bar follows the pointer', () => {
  const scaled = () => clean(statusBar().textContent).includes('1:100, as stated')

  it('is gone when the outlines are hidden and shown again with the pointer elsewhere', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(document.querySelector(`[data-outline="${PLAN_VIEW}"]`)).not.toBeNull())
    await pointer.hover(document.querySelector<HTMLElement>(`[data-outline="${PLAN_VIEW}"]`)!)
    await waitFor(() => expect(scaled()).toBe(true))
    await userEvent.keyboard('o')
    await waitFor(() => expect(document.querySelector('[data-outline]')).toBeNull())
    await pointer.hover(statusBar())
    await userEvent.keyboard('o')
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(2))
    expect(scaled()).toBe(false)
  })

  it('is gone after paging away and back', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(document.querySelector(`[data-outline="${PLAN_VIEW}"]`)).not.toBeNull())
    await pointer.hover(document.querySelector<HTMLElement>(`[data-outline="${PLAN_VIEW}"]`)!)
    await waitFor(() => expect(scaled()).toBe(true))
    await userEvent.keyboard('{PageDown}')
    await userEvent.keyboard('{PageUp}')
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(2))
    await pointer.hover(statusBar())
    expect(scaled()).toBe(false)
  })
})
