/*
 * The same_number card when one copy's title was not read (#447, review round 1): an empty title never
 * makes two copies "titled apart". The card keeps its copies words: keep_latest first, no empty quotes.
 * Mounted on 156's answering fake with T-W322's invented Sheets (read here, never changed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../acceptance/t156/answer.fixture'
import { clean, conflict, sheet, stage } from '../acceptance/w322/sheets.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a copy whose title was not read (#447, round 1)', () => {
  it('keeps the copies card: keep_latest first, no empty quotes, never "titles differ"', async () => {
    const later = sheet('D-27', 'GARDEN WALL SECTIONS', { revision_mark: 'R3', issue_date: '2026-08-02' })
    const earlier = sheet('D-27', '', { revision_mark: 'R1', issue_date: '2026-04-19' })
    const question = conflict('engine.conflicts.same_number', { number: 'D-27', copies: 2 }, [later, earlier])
    const fake = new FakeAnswers()
    stage(fake.step1, [later, earlier], [question])
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 / 2'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    const radios = within(card).getAllByRole('radio') as HTMLInputElement[]
    expect(radios[0]!.value).toBe('keep_latest')
    const text = clean(card.textContent)
    expect(text).not.toContain('“”')
    expect(text).not.toContain('titles differ')
  })

  it.each([
    ['case', 'Tidewharf Pergola Details', 'TIDEWHARF PERGOLA DETAILS'],
    ['spacing', 'TIDEWHARF PERGOLA DETAILS', '  TIDEWHARF   PERGOLA DETAILS '],
  ])('reads two titles equal but for %s as one title, the copies words (#447, round 2)', async (_, a, b) => {
    const later = sheet('D-33', a, { revision_mark: 'R2', issue_date: '2026-08-02' })
    const earlier = sheet('D-33', b, { revision_mark: 'R1', issue_date: '2026-04-19' })
    const question = conflict('engine.conflicts.same_number', { number: 'D-33', copies: 2 }, [later, earlier])
    const fake = new FakeAnswers()
    stage(fake.step1, [later, earlier], [question])
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 / 2'))
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    const text = clean(card.textContent)
    expect(text).toContain('Both are titled')
    expect(text).not.toContain('only title read')
    expect(text).not.toContain('titles differ')
    expect((within(card).getAllByRole('radio') as HTMLInputElement[])[0]!.value).toBe('keep_latest')
  })
})
