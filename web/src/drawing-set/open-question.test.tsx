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
import { SECOND_HELD, twoHeld } from '@/acceptance/tw327/held.fixture'

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

describe('a summary without held_sheets', () => {
  it('is worded without the held clause, never "NaN"', async () => {
    const api = new FakeApi()
    const set = new FakeDrawingSet(api, 'KR-01')
    set.files.push(file({ name: 'ZQ-ARC-R1.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 5 }))
    set.summary = msg('drawings.files.summary', { files: 1, sheets: 5, reading: 0, failed: 0, held: 0, refused: 0 })
    await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await waitFor(() => expect(clean(document.body.textContent)).toContain('1 file: 5 sheets read'))
    expect(clean(document.body.textContent)).not.toMatch(/NaN|of them from/)
  })
})

describe('"Open the Question" after Step 1 was seen without that Question (the review, F1)', () => {
  it("focuses the file's Question though Step 1's answers were cached before it was raised", async () => {
    const held = twoHeld()
    const raised = held.second.question
    held.fake.questions = held.fake.questions.filter((q) => q.id !== raised.id)
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: held.fake.api })
    await waitFor(() => expect(clean(document.body.textContent)).toMatch(/Confirmed 0 \/ \d+/))

    held.fake.questions = [...held.fake.questions, raised]
    await router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    const row = await waitFor(() => document.querySelector<HTMLElement>(`tr[data-file="${held.second.file.id}"]`) ?? Promise.reject(new Error(SECOND_HELD)))
    await userEvent.click(within(row).getByRole('button', { name: 'Open the Question' }))

    await waitFor(() => expect(document.activeElement?.getAttribute('data-row')).toBe(`q:${raised.id}`))
  })
})
