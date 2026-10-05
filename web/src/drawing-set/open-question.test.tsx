/*
 * #327 and #331 on the Drawing Set: "Open the Question"'s address, and a cancel that came too late is a
 * toast even when the list has not yet caught up. Every name here is invented.
 */
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeDrawingSet, file, msg, refusalOf } from '@/acceptance/t20b/drawings.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { step1FilePath } from '@/takeoff/paths'

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

describe('step1FilePath', () => {
  it("is Step 1's address with the file's id", () => {
    expect(step1FilePath('ZQ-7', 'a b/c')).toBe('/p/ZQ-7/takeoff/1?file=a%20b%2Fc')
  })
})

describe('a cancel that came too late', () => {
  it('is a toast and no error bar, though the list still shows the file reading', async () => {
    const api = new FakeApi()
    const set = new FakeDrawingSet(api, 'KR-01')
    const reading = file({ name: 'ZQ-PLB-R3.dwg', state: 'reading', status: msg('drawings.files.finishing') })
    set.files.push(reading)
    api.failOnce((m, p) => m === 'POST' && p.endsWith(`/files/${reading.id}/cancel`), 409, refusalOf('drawings.files.cancel_too_late'))
    await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    const row = await waitFor(() => document.querySelector<HTMLElement>(`tr[data-file="${reading.id}"]`)!)
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel reading' }))

    await waitFor(() =>
      expect(clean([...document.querySelectorAll('[role="status"]')].map((s) => s.textContent).join(' '))).toContain(
        'finished reading before the cancel arrived',
      ),
    )
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(screen.queryByText(/cancel_too_late/)).toBeNull()
  })
})
