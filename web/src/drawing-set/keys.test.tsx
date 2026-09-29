/*
 * The Drawing Set by keyboard (m0-screens §4.5 "Keys", §8 items 2 and 7): Tab reaches "Add files" and
 * then the file list; ↑ ↓ Home End move between files; Enter opens the focused file's report and puts
 * focus in it; Esc closes it and gives focus back to its row; Enter on a row's Discipline select or
 * button is theirs, never the report's. The MD walks the same list, with nothing to change.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound } from '@/ui'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const focusedText = () => clean(document.activeElement?.textContent)
const isRow = () => document.activeElement instanceof HTMLTableRowElement

async function open(as: string) {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  set.files.push(
    file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 8 }),
    file({ name: 'KR-ARC-R0.dwg', discipline: 'architectural', state: 'reading', status: msg('drawings.files.reading_drawing') }),
    file({ name: 'KR-ELE-R0.dwg', discipline: 'electrical', state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') }),
  )
  const app = await mountApp('/p/KR-01/drawing-set', { as, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(3))
  ;(document.activeElement as HTMLElement | null)?.blur()
  return { ...app, set }
}

async function tabTo(done: () => boolean, most = 60) {
  for (let i = 0; i < most && !done(); i++) await userEvent.tab()
  expect(done()).toBe(true)
}

describe('the Drawing Set by keyboard', () => {
  it('Tab reaches "Add files", then the first file; arrows move; Enter opens, Esc closes and returns', async () => {
    const { keyMap, set } = await open(PEOPLE.qs)
    await tabTo(() => clean(document.activeElement?.textContent) === 'Add files')
    await tabTo(isRow)
    expect(focusedText()).toContain('KR-STR-R0.dwg')
    await userEvent.keyboard('{ArrowDown}')
    expect(focusedText()).toContain('KR-ARC-R0.dwg')
    await userEvent.keyboard('{End}')
    expect(focusedText()).toContain('KR-ELE-R0.dwg')
    await userEvent.keyboard('{Home}')
    expect(focusedText()).toContain('KR-STR-R0.dwg')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    const heading = await screen.findByRole('heading', { level: 2 })
    expect(clean(heading.textContent)).toBe('KR-ARC-R0.dwg')
    await waitFor(() => expect(document.activeElement).toBe(heading))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).toBeNull())
    expect(isRow()).toBe(true)
    expect(focusedText()).toContain('KR-ARC-R0.dwg')
    // Out of the list and back: Tab returns to the file last focused, not the first.
    await userEvent.tab()
    expect(document.activeElement).toBeInstanceOf(HTMLSelectElement)
    await userEvent.tab({ shift: true })
    expect(focusedText()).toContain('KR-ARC-R0.dwg')
    // Enter on the row's select is the select's: no report opens, nothing is written.
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(set.seen.filter((s) => !s.call.startsWith('GET'))).toEqual([])
    expectKeyMapSound(keyMap)
  })

  it('shows where focus is on a row', async () => {
    await open(PEOPLE.qs)
    await tabTo(isRow)
    const style = getComputedStyle(document.activeElement!)
    expect(style.outlineStyle).toBe('solid')
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2)
  })

  it('lets the MD walk and open every report, with nothing to change on the way', async () => {
    const { set } = await open(PEOPLE.md)
    await tabTo(isRow)
    await userEvent.keyboard('{End}')
    await userEvent.keyboard('{Enter}')
    expect(clean((await screen.findByRole('heading', { level: 2 })).textContent)).toBe('KR-ELE-R0.dwg')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(isRow()).toBe(true))
    // Nothing in any row changes the Drawing Set for the MD: no select, and only "Open in Step 1".
    for (const row of document.querySelectorAll('tbody tr')) expect(row.querySelector('select')).toBeNull()
    expect([...document.querySelectorAll('tbody tr button')].map((b) => clean(b.textContent))).toEqual(['Open in Step 1'])
    expect(set.seen.filter((s) => !s.call.startsWith('GET'))).toEqual([])
  })
})
