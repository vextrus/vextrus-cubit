/*
 * S24-A3 (#670; m0-screens §6.2): past the files band's two lines, the files that do not fit are behind
 * "n more files", reached by the keyboard, each opening its report; the Questions' evidence (#663) and the
 * MD's "Needs you" (#580) fold and read as the QS's and the MD's own.
 */
import { beforeEach, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1280, 800)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const NAMES = Array.from({ length: 9 }, (_, i) => `ZQ-DISCIPLINE-${i + 1}-WORKING-DRAWINGS-R${i}.dwg`)

function nineFiles(): FakeApi {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api)
  set.files = NAMES.map((name) => file({ name, state: 'read', status: msg('drawings.files.read', { sheets: 3 }), sheets_found: 3 }))
  return api
}

it('keeps every file reachable: the ones past two lines are under "n more files", opened by the keyboard', async () => {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: nineFiles() })
  const band = await screen.findByRole('list', { name: /files/ })
  const more = await within(band).findByRole('button', { name: (name) => /\d+ more files?/.test(clean(name)) })
  const shown = within(band).getAllByRole('button').filter((b) => b !== more)
  expect(shown.length).toBeGreaterThan(0)
  const hidden = Number(/^(\d+) more/.exec(clean(more.textContent))![1])
  expect(shown.length + hidden).toBe(NAMES.length)
  more.focus()
  await userEvent.keyboard('{Enter}')
  const menu = await screen.findByRole('menu')
  const items = within(menu).getAllByRole('menuitem')
  expect(items).toHaveLength(hidden)
  const last = NAMES.at(-1)!
  expect(clean(menu.textContent)).toContain(last)
  const first = NAMES[shown.length]!
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(document.querySelector('section[aria-labelledby="report-heading"]')).not.toBeNull())
  expect(clean(document.querySelector('#report-heading')?.textContent)).toContain(first)
})

it('lists every file as a chip, with no "more files", when two lines hold them all', async () => {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api)
  set.files = [file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read', { sheets: 3 }), sheets_found: 3 })]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  const band = await screen.findByRole('list', { name: /files/ })
  expect(within(band).getAllByRole('button')).toHaveLength(1)
  expect(within(band).queryByRole('button', { name: (name) => /more file/.test(clean(name)) })).toBeNull()
})

it('tells the MD "Open: 5 Questions, waiting for the QS", not what Enter does', async () => {
  const api = new FakeApi()
  new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.md, api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain('Open: 5 Questions, waiting for the QS'))
})
