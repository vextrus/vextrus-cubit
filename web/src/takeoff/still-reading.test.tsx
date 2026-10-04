/*
 * Step 1's still-reading row past ticket 230's acceptance tests: "sheet n of N" only where the file's
 * status counts sheets. A PDF reading its pages, or a file waiting its turn, reads "Still reading
 * <file>. Its sheets join the list when it is read." (a page is not a sheet); a file being stopped
 * adds no sheets and gets no row.
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

it('words a page count, a wait and a stop without "sheet n of N"', async () => {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api, 'KR-01', true)
  set.files = [
    file({ name: 'KR-STR-R0.pdf', state: 'reading', status: msg('drawings.files.reading_page', { position: 4, total: 9 }) }),
    file({ name: 'KR-ARC-R0.dwg', state: 'waiting', status: msg('drawings.files.waiting') }),
    file({ name: 'KR-ELE-R0.dwg', state: 'stopping', status: msg('drawings.files.stopping') }),
  ]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Still reading KR-STR-R0.pdf. Its sheets join the list when it is read.'))
  expect(bodyText()).toContain('Still reading KR-ARC-R0.dwg. Its sheets join the list when it is read.')
  expect(bodyText()).not.toMatch(/sheet 4 of 9/)
  expect(bodyText()).not.toContain('Still reading KR-ELE-R0.dwg')
})
