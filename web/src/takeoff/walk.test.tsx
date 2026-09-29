/*
 * m0-screens §8's walk by keyboard (the lesson of 28 Sep 2026: a UI ticket walks §8 by keyboard itself
 * before its PR), in a real Chromium with real key presses, over the whole app on KR-01 at §7's state
 * (the acceptance fake). No mouse from the first key to the last: ↓ with a visible ring on every row,
 * Enter's bulk act and Ctrl Z, Space into a sheet and back, → through its views, Esc, Q, X and the
 * picker's digits, and the ? overlay naming what works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1280, 800)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const active = () => document.activeElement as HTMLElement | null
const ringed = (el: Element | null) => !!el && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2

describe('§8 by keyboard, as the QS at 1280', () => {
  it('walks the list, a sheet, its views, the Questions, the picker and the keys overlay without the mouse', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    Object.assign(step1.proposals.find((p) => p.number === 'S-02')!, {
      views: [
        { id: 'k1', ordinal: 1, kind: 'plan', title: 'PILE LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['pile'], storeys_as_stated: '', storeys_meaning: 'at_floor_level', steps: ['foundations'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['10', '10', '60', '50'] },
        { id: 'k2', ordinal: 2, kind: 'title_block', title: 'TITLE BLOCK', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: 'for_information', decision: null, excluded_reason: null, box: ['70', '0', '90', '20'] },
      ],
    })
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))

    // Into the list by keyboard; every row ↓ reaches draws its ring (item 7).
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    for (let i = 0; i < 8; i++) {
      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(active()?.getAttribute('role')).toBe('row'))
      expect(ringed(active()), `row ${clean(active()?.textContent).slice(0, 12)}`).toBe(true)
    }

    // Q takes the next open Question; the bar says what Enter does (item 8's words for the QS).
    await userEvent.keyboard('q')
    await waitFor(() => expect(active()?.getAttribute('data-row')).toMatch(/^q:/))
    expect(bodyText()).toMatch(/Question Q\d/)

    // Esc clears the focus; Enter does the bulk act; Ctrl Z undoes it.
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1, each with its reason.'))
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24, 1 excluded'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))

    // Down to S-02, Space into the sheet, → through its views, Esc out of the view, then the sheet.
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const number = () => (active()?.getAttribute('role') === 'row' ? clean(active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent) : '')
    for (let i = 0; i < 30 && number() !== 'S-02'; i++) await userEvent.keyboard('{ArrowDown}')
    expect(number()).toBe('S-02')
    const row = active()!.getAttribute('data-row')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-02/ })
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(2))
    expect(bodyText()).toContain('Proposal 2 · Assigned 0 · Question 0 · Excluded 0')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector('[data-outline][aria-pressed="true"]')?.getAttribute('data-outline')).toBe('k1'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('[data-outline][aria-pressed="true"]')).toBeNull())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(active()?.getAttribute('data-row')).toBe(row))

    // X opens the picker; 8 does nothing; Esc cancels (items 2, 8).
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toContain('Exclude S-02. Why?'))
    await userEvent.keyboard('8')
    expect(bodyText()).toContain('Exclude S-02. Why?')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Exclude S-02. Why?'))

    // ? lists the keys that work here (item 2).
    await userEvent.keyboard('?')
    const overlay = await screen.findByRole('dialog')
    for (const key of ['Next open Question', 'Exclude the focused sheet, with a reason', 'Undo your last act on Step 1']) expect(clean(overlay.textContent)).toContain(key)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual(['POST /confirm', 'POST /exclude', 'POST /undo', 'POST /undo'].slice(0, step1.calls().filter((c) => c.startsWith('POST')).length))
  })
})
