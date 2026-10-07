/*
 * S15-W2, fix rounds 1 to 3 (PR 562): a Shift selection ends when the focus leaves it by any route, a
 * selection is named by its count, the stated scale follows the pointer's place on the paper, and the
 * sheet keys are listed and kept in focus.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { page, userEvent as pointer } from 'vitest/browser'
import userEvent from '@testing-library/user-event'
import { DETAIL_VIEW, PLAN_VIEW, canvasOf, clean, excludedBy, focusRow, focusedSheet, openList, openSheet, rowOf, seed, statusBar } from '@/acceptance/ts15w2/keys.fixture'

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

describe('the stated scale in the status bar (round 3: by paper position, selection, working view)', () => {
  const text = () => clean(statusBar().textContent)

  it('shows the scale of the view under the pointer with the outlines hidden', async () => {
    await openSheet(seed(), 'S-02')
    const rect = (await waitFor(() => document.querySelector<HTMLElement>(`[data-outline="${DETAIL_VIEW}"]`)!)).getBoundingClientRect()
    await userEvent.keyboard('o')
    await waitFor(() => expect(document.querySelector('[data-outline]')).toBeNull())
    const area = await canvasOf('S-02')
    const at = area.getBoundingClientRect()
    await pointer.hover(area, { position: { x: rect.left + rect.width / 2 - at.left, y: rect.top + rect.height / 2 - at.top } })
    await waitFor(() => expect(text()).toContain('Not to scale'))
  })

  it('shows the working view’s scale with no pointer, and the selected view’s after → (keys alone)', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(text()).toContain('1:100, as stated'))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(text()).toContain('Not to scale'))
    expect(text()).not.toContain('1:100')
  })

  it('shows no scale for a sheet whose views state none', async () => {
    await openSheet(seed(), 'S-01')
    expect(text()).not.toContain('as stated')
    expect(text()).not.toContain('Not to scale')
  })
})

describe('the sheet keys in the ? overlay and focus after O (round 3)', () => {
  it('lists O, [ ], PageUp and PageDown under "On the sheet", each Next and Previous pair together', async () => {
    await openSheet(seed(), 'S-02')
    await userEvent.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: 'Keys' })
    const heading = [...dialog.querySelectorAll('h3')].find((h) => clean(h.textContent) === 'On the sheet')!
    const rows = [...heading.parentElement!.querySelectorAll('li')].map((li) => [clean(li.querySelector('span')?.textContent), ...[...li.querySelectorAll('kbd')].map((k) => clean(k.textContent))])
    const keys = rows.map((r) => r.slice(1).join(' '))
    for (const k of ['O', '[', ']', 'PageUp', 'PageDown']) expect(keys, k).toContain(k)
    expect(Math.abs(keys.indexOf(']') - keys.indexOf('PageDown'))).toBe(1)
    expect(Math.abs(keys.indexOf('[') - keys.indexOf('PageUp'))).toBe(1)
    const screenHeading = [...dialog.querySelectorAll('h3')].find((h) => clean(h.textContent) === 'On this screen')
    const onScreen = [...(screenHeading?.parentElement?.querySelectorAll('li') ?? [])].map((li) => [...li.querySelectorAll('kbd')].map((k) => clean(k.textContent)).join(' '))
    for (const k of ['O', '[', ']', 'PageUp', 'PageDown']) expect(onScreen, k).not.toContain(k)
  })

  it('moves focus to the sheet’s canvas when O hides the outline that holds it', async () => {
    await openSheet(seed(), 'S-02')
    const outline = await waitFor(() => document.querySelector<HTMLElement>(`[data-outline="${PLAN_VIEW}"]`)!)
    outline.focus()
    expect(document.activeElement).toBe(outline)
    await userEvent.keyboard('o')
    await waitFor(() => expect(document.querySelector('[data-outline]')).toBeNull())
    const canvas = await canvasOf('S-02')
    await waitFor(() => expect(document.activeElement).toBe(canvas))
    await userEvent.keyboard('f')
  })
})

describe('a selection of several rows is named by its count (round 2)', () => {
  const body = () => clean(document.body.textContent)

  it('names an unnumbered sheet in the selection by the count, in the picker and the toast, and sends all', async () => {
    const s = seed()
    Object.assign(s.of('S-05'), { number: null })
    await openList(s)
    await focusRow('S-04')
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Exclude 2 sheets. Why?'))
    expect(body()).not.toContain('Exclude S-04.')
    await userEvent.keyboard('1')
    await waitFor(() => expect(s.step1.seen.find((c) => c.call === 'POST /exclude')).toBeTruthy())
    expect(((s.step1.seen.find((c) => c.call === 'POST /exclude')!.body as { proposals: string[] }).proposals)).toHaveLength(2)
    await waitFor(() => expect(body()).toContain('2 sheets excluded: '))
    expect(body()).toContain('They stay in the count.')
  })

  it('names a selection crossing out of "Proposed to leave out" by the count, not a range', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-06')
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Exclude 2 sheets. Why?'))
    expect(body()).not.toMatch(/S-06\s*–\s*S-01/)
  })

  it('keeps one row’s own name', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Exclude S-02. Why?'))
  })
})

describe('the exclusion picker is modal (round 4)', () => {
  const body = () => clean(document.body.textContent)
  const selectedNow = () => [...document.querySelectorAll('[role="row"][aria-selected="true"]')].length

  async function openPickerOnThree(s: ReturnType<typeof seed>) {
    await openList(s)
    await focusRow('S-01')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Exclude 3 sheets. Why?'))
  }

  it('↓ while it is open moves nothing, and the reason excludes the three sheets it named', async () => {
    const s = seed()
    await openPickerOnThree(s)
    await userEvent.keyboard('{ArrowDown}')
    expect(focusedSheet()).toBe('S-03')
    expect(selectedNow()).toBe(3)
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-01', 'S-02', 'S-03']))
  })

  it('Shift ↑ while it is open does not shrink the selection, and the reason excludes the three it named', async () => {
    const s = seed()
    await openPickerOnThree(s)
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(selectedNow()).toBe(3)
    expect(body()).toContain('Exclude 3 sheets. Why?')
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-01', 'S-02', 'S-03']))
  })

  it('other keys (Home, End, Q, O, ?) do nothing while it is open', async () => {
    const s = seed()
    await openPickerOnThree(s)
    await userEvent.keyboard('{Home}{End}q?')
    expect(focusedSheet()).toBe('S-03')
    expect(screen.queryByRole('dialog', { name: 'Keys' })).toBeNull()
    expect(body()).toContain('Exclude 3 sheets. Why?')
  })

  it('a click on the list closes it without excluding anything', async () => {
    const s = seed()
    await openPickerOnThree(s)
    await userEvent.click(within(rowOf('S-05')).getByText('S-05'))
    await waitFor(() => expect(body()).not.toContain('Why?'))
    expect(excludedBy(s.step1).numbers).toEqual([])
  })

  it('Esc closes it and the keys work again', async () => {
    const s = seed()
    await openPickerOnThree(s)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body()).not.toContain('Why?'))
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(focusedSheet()).toBe('S-04'))
  })
})

describe('the picker closes on every focus change (round 5)', () => {
  const body = () => clean(document.body.textContent)

  it('closes when a Question card’s option is picked in the inspector, and 1 then excludes nothing', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api, 'KR-01')
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(body()).toContain('Confirmed 0 /'))
    await focusRow('S-01')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Exclude 3 sheets. Why?'))
    await userEvent.click(await screen.findByRole('tab', { name: /Questions/ }))
    const option = (await screen.findAllByRole('radio'))[0]!
    await userEvent.click(option)
    await waitFor(() => expect(body()).not.toContain('Why?'))
    await userEvent.keyboard('1')
    expect(step1.seen.filter((c) => c.call === 'POST /exclude')).toHaveLength(0)
  })

  it('closes the picker when the focused row changes by any route, and not when the same row is focused again', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-02')
    await userEvent.keyboard('x')
    await waitFor(() => expect(body()).toContain('Why?'))
    rowOf('S-02').focus()
    expect(body()).toContain('Why?')
    rowOf('S-04').focus()
    await waitFor(() => expect(body()).not.toContain('Why?'))
    expect(excludedBy(s.step1).numbers).toEqual([])
  })
})
