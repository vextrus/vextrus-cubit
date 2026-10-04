/*
 * Step 1's still-reading row past ticket 230's acceptance tests (its words gate's must and mays):
 * "sheet n of N" only where the file's status counts sheets; a PDF (a Plot) counts pages and promises
 * its pages are matched to sheets, never that its sheets join the list; a waiting or interrupted file
 * is never "Still reading"; a file being stopped adds nothing and gets no row.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

it('words a Plot\'s pages, a wait, a retry and a stop by what each file is doing', async () => {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api, 'KR-01', true)
  set.files = [
    file({ name: 'KR-STR-R0.pdf', state: 'reading', status: msg('drawings.files.reading_page', { position: 4, total: 9 }) }),
    file({ name: 'KR-ARC-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting', { ahead: 0 }) }),
    file({ name: 'KR-PLB-R0.dwg', state: 'retrying', status: msg('drawings.files.retrying', { attempt: 2, tries: 3 }) }),
    file({ name: 'KR-MEC-R0.dwg', state: 'reading', status: msg('drawings.files.opening_file') }),
    file({ name: 'KR-ELE-R0.dwg', state: 'stopping', status: msg('drawings.files.stopping') }),
  ]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Still reading KR-STR-R0.pdf: page 4 of 9. Its pages are matched to sheets when it is read.'))
  expect(bodyText()).toContain('KR-ARC-R0.dwg is waiting to be read. Its sheets join the list when it is read.')
  expect(bodyText()).toContain('Reading KR-PLB-R0.dwg was interrupted and is starting again. Its sheets join the list when it is read.')
  expect(bodyText()).toContain('Still reading KR-MEC-R0.dwg. Its sheets join the list when it is read.')
  expect(bodyText()).not.toMatch(/Still reading KR-(ARC|PLB|ELE)/)
  expect(bodyText()).not.toMatch(/sheet 4 of 9/)
})
