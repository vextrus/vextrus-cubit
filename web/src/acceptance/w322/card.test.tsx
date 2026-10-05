/*
 * T-W322's acceptance tests, the Question card (issue #322 FL9 f-28; #321's card heading): mounted
 * through the app on 156's answering fake (`../t156/answer.fixture.ts`, over 22's) with invented Sheets
 * (sheets.fixture.ts), answered by keyboard (m0-screens §6.7, §6.15: `Q` to the Question, `1`–`9` a pick,
 * Enter answers).
 *
 * The words are the ticket's, verbatim. Two Sheets of one number titled apart: "keep both" comes first
 * ("They are different sheets: keep both", key 1, option `keep_all`); `keep_latest` reads "Keep “T”;
 * leave “U” out"; the body "They carry the same number, but their titles differ: “A” and “B”. They may
 * be different sheets."; nothing is "Picked for you"; no word "superseded" on the card, its "Answering"
 * line or the toast. One title kept: the words of today (guards). The card's list of held Sheets names
 * each Sheet's title where titles differ. The `same_title` and `same_storey` headings count `params.sheets`.
 *
 * Chosen by the acceptance writer: the server's pick (`keep_latest`, picked) has a second source here
 * (the drawing list read on the drawings gives D-14 the later mark), so without this ticket the card
 * would show "Picked for you"; the heading is the card's line of words (a paragraph or heading) that
 * names the count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../t156/answer.fixture'
import { COPY_TITLE, SHARED_TITLE, SPLIT_TITLES, clean, copies, listGives, numberShared, sameStorey, stage, titleShared, type Proposal, type Question } from './sheets.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const PATH = '/p/KR-01/takeoff/1'
const bodyText = () => clean(document.body.textContent)

/** The app on these Sheets and this one Question, the drawing list agreeing on `listed`'s later mark; `Q` to its card. */
async function cardFor(sheets: readonly Proposal[], question: Question, listed: { number: string; mark: string } | null = null) {
  const fake = new FakeAnswers()
  stage(fake.step1, sheets, [question])
  if (listed) listGives(fake.api, fake.step1, [...new Set(sheets.map((p) => p.number!))], listed.number, listed.mark)
  await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain(`Confirmed 0 / ${sheets.length}`))
  await userEvent.keyboard('q')
  const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
  return { fake, card }
}

const radios = (card: HTMLElement) => within(card).getAllByRole('radio') as HTMLInputElement[]
const labelOf = (radio: HTMLInputElement) => clean(radio.closest('label')?.textContent)
const radioFor = (card: HTMLElement, key: string) => {
  const found = radios(card).find((r) => r.value === key)
  expect(found, `the option ${key}`).toBeDefined()
  return found!
}

async function postedOnce(fake: FakeAnswers, option: string) {
  await waitFor(() => expect(fake.posted).toHaveLength(1))
  expect(fake.posted[0]!.body).toMatchObject({ option })
}

const [LATER, EARLIER] = SPLIT_TITLES
const LISTED = { number: 'D-14', mark: 'R2' }

describe('the same_number card when the titles differ (T-W322, FL9 f-28)', () => {
  it('offers "They are different sheets: keep both" first, and key 1 then Enter answers keep_all', async () => {
    const { sheets, question } = numberShared()
    const { fake, card } = await cardFor(sheets, question, LISTED)
    expect(radios(card)[0]!.value, 'keep_all is the first option').toBe('keep_all')
    expect(labelOf(radios(card)[0]!)).toContain('They are different sheets: keep both')
    await userEvent.keyboard('1')
    await waitFor(() => expect(radioFor(card, 'keep_all').checked).toBe(true))
    await userEvent.keyboard('{Enter}')
    await postedOnce(fake, 'keep_all')
  })

  it('words keep_latest by the titles: "Keep “<the later>”; leave “<the other>” out"', async () => {
    const { sheets, question } = numberShared()
    const { card } = await cardFor(sheets, question, LISTED)
    const words = labelOf(radioFor(card, 'keep_latest'))
    expect(words).toContain(`Keep “${LATER}”; leave “${EARLIER}” out`)
    expect(words).not.toMatch(/superseded/i)
  })

  it('says "They carry the same number, but their titles differ: … They may be different sheets."', async () => {
    const { sheets, question } = numberShared()
    const { card } = await cardFor(sheets, question, LISTED)
    const text = clean(card.textContent)
    const either = [LATER, EARLIER].map((a, i) => `They carry the same number, but their titles differ: “${a}” and “${[EARLIER, LATER][i]}”. They may be different sheets.`)
    expect(either.some((s) => text.includes(s)), `one of:\n${either.join('\n')}\nin:\n${text}`).toBe(true)
  })

  it('shows no "Picked for you" though the server picked keep_latest and the drawing list agrees', async () => {
    const { sheets, question } = numberShared()
    const { card } = await cardFor(sheets, question, LISTED)
    expect(clean(card.textContent)).not.toContain('Picked for you')
  })

  it('never says "superseded": not on the card, its Answering line for keep_latest, or the toast after it', async () => {
    const { sheets, question } = numberShared()
    const { fake, card } = await cardFor(sheets, question, LISTED)
    expect(clean(card.textContent)).not.toMatch(/superseded/i)
    await userEvent.keyboard(String(radios(card).findIndex((r) => r.value === 'keep_latest') + 1))
    await waitFor(() => expect(radioFor(card, 'keep_latest').checked).toBe(true))
    expect(clean(card.textContent)).toContain('Answering')
    expect(clean(card.textContent)).not.toMatch(/superseded/i)
    await userEvent.keyboard('{Enter}')
    await postedOnce(fake, 'keep_latest')
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    expect(bodyText()).not.toMatch(/superseded/i)
  })

  it('names each held Sheet’s title in the card’s list of them', async () => {
    const { sheets, question } = numberShared()
    const { card } = await cardFor(sheets, question, LISTED)
    const items = within(card).getAllByRole('listitem').map((li) => clean(li.textContent))
    expect(items.some((t) => t.includes('D-14') && t.includes(LATER)), `“${LATER}” in ${JSON.stringify(items)}`).toBe(true)
    expect(items.some((t) => t.includes('D-14') && t.includes(EARLIER)), `“${EARLIER}” in ${JSON.stringify(items)}`).toBe(true)
  })
})

describe('the same_number card when the titles are one (guard: its words stay)', () => {
  it('keeps keep_latest first, "leave … out as superseded", and "Picked for you" where two sources agree', async () => {
    const { sheets, question } = copies()
    const { card } = await cardFor(sheets, question, { number: 'D-15', mark: 'R2' })
    expect(radios(card)[0]!.value).toBe('keep_latest')
    expect(labelOf(radios(card)[0]!)).toMatch(/^1 ?Keep .*; leave .* out as superseded/)
    expect(clean(card.textContent)).toContain('Picked for you')
    expect(clean(card.textContent)).toContain(`Both are titled “${COPY_TITLE}”. Only one can be read.`)
  })
})

/** The card's lines of words (its paragraphs and headings), each on its own. */
const lines = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, [role="heading"]')].map((el) => clean(el.textContent))

describe('the card heading counts the Sheets the card lists (#321, T-W322 4a)', () => {
  it('heads a same_storey Question over 3 Sheets with the count 3, not "Two plans"', async () => {
    const { sheets, question } = sameStorey(3)
    const { card } = await cardFor(sheets, question)
    expect(lines(card).some((l) => /\b3 sheets\b/.test(l)), JSON.stringify(lines(card))).toBe(true)
    expect(clean(card.textContent)).not.toContain('Two plans')
  })

  it('heads a same_storey Question over 2 Sheets for two', async () => {
    const { sheets, question } = sameStorey(2)
    const { card } = await cardFor(sheets, question)
    expect(lines(card).some((l) => /\b(two|2) (sheets|plans)\b/i.test(l)), JSON.stringify(lines(card))).toBe(true)
    expect(clean(card.textContent)).not.toMatch(/\b3 sheets\b/)
  })

  it('heads a same_title Question by its params.sheets', async () => {
    const { sheets, question } = titleShared()
    const { card } = await cardFor(sheets, question)
    expect(lines(card).some((l) => /\b12 sheets\b/.test(l) && !l.includes(SHARED_TITLE)), JSON.stringify(lines(card))).toBe(true)
  })

  it('falls back to the Question’s own words when params.sheets is absent (an older server)', async () => {
    const { sheets, question } = sameStorey(3, null)
    const { card } = await cardFor(sheets, question)
    const text = clean(card.textContent)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('engine.conflicts')
    expect(text).not.toMatch(/\bNaN\b/)
  })
})
