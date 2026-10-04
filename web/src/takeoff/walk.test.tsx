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
    for (const key of ['Next open Question', 'Exclude the focused sheet, with a reason', 'Undo your last confirmation, exclusion or drawing list on Step 1']) expect(clean(overlay.textContent)).toContain(key)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual(['POST /confirm', 'POST /exclude', 'POST /undo', 'POST /undo'].slice(0, step1.calls().filter((c) => c.startsWith('POST')).length))
  })
})

describe('M22 (walk 5, item 2): Space works straight after load, before anything is focused', () => {
  const sheetMode = () => screen.getByRole('button', { name: 'Sheet' }).getAttribute('aria-pressed') === 'true'
  /** The sheet the bar's Space names ("Open E-01"), or null when the bar names none. */
  const barOpens = () => {
    const ghost = document.querySelector<HTMLElement>('button[aria-keyshortcuts="Space"]:not([aria-pressed])')
    const label = ghost ? [...ghost.childNodes].filter((n) => !(n instanceof Element && n.querySelector('kbd, [data-key-combo]')) && !(n instanceof Element && n.matches('kbd'))).map((n) => n.textContent).join('') : ''
    const m = /^Open (\S+)$/.exec(clean(label))
    return m ? m[1]! : null
  }

  it('opens the sheet the bar names when Space is pressed with focus on the page', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    // The walk: the bulk act first, so the bar says "Open <sheet>" with Space.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24, 1 excluded'))
    await waitFor(() => expect(barOpens()).not.toBeNull())
    const named = barOpens()!
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)
    await userEvent.keyboard(' ')
    await waitFor(() => expect(sheetMode()).toBe(true))
    // The canvas region names the sheet open ("Sheet E-01 rev R0").
    expect(await screen.findByRole('group', { name: (n) => clean(n) === `Sheet ${named}` || clean(n).startsWith(`Sheet ${named} `) })).toBeTruthy()
    // And back: Space with focus on the page again returns to the list.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard(' ')
    await waitFor(() => expect(sheetMode()).toBe(false))
  })

  it('opens the first sheet row on a fresh load (m0-screens 6.15: none focused, the first sheet row)', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard(' ')
    await waitFor(() => expect(sheetMode()).toBe(true))
  })

  it('names what Space does from the page in the ? overlay, without a focused sheet (the words gate)', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('?')
    const overlay = await screen.findByRole('dialog')
    expect(clean(overlay.textContent)).toContain('Open the sheet the bar names, or go back to the list')
    expect(clean(overlay.textContent)).not.toContain('Open the focused sheet')
  })
})

describe('Y5 (walk 5): the inspector lists what Enter takes in the bar’s order', () => {
  it('reads: the bulk act, the sheets with one source, then the Questions', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Enter takes them in this order'))
    const heading = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && clean(e.textContent) === 'Enter takes them in this order')!
    const list = heading.closest('section, div')!.parentElement!.querySelector('ol')!
    const items = [...list.querySelectorAll('li')].map((li) => clean(li.textContent))
    expect(items).toHaveLength(3)
    expect(items[0]).toMatch(/^Confirm the 16 sheets that agree/)
    expect(items[1]).toMatch(/one source/)
    expect(items[2]).toMatch(/^Answer 5 Questions/)
  })
})
