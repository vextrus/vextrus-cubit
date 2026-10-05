/*
 * Ticket W320's acceptance tests, the words (gh issue #320; the owner's ruling of 5 Oct 2026, "Make
 * them bulk-confirmable"): a Sheet whose number and title come from its title block, in numbering
 * without a gap, joins the bulk act on that one source, and the screen says so. A Proposal carries
 * `agrees_on` ('list' | 'plot' | 'title_block' | null; null exactly when `agrees` is false; absent from
 * an older server).
 *
 * The words are the ticket's section 3 (cases 11 to 15), verbatim. The API is ticket 22's in-memory fake
 * (`../t22/step1.fixture.ts`) with its sheets replaced by invented ones; every number and title here is
 * invented.
 *
 * Not pinned: the words of a gap with no tag ("answering its Question lets it join"), and the "N sheets
 * have one source each" bar's list (it reads `agrees`, as on the base).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut, type QuestionOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const inspector = () => screen.getByRole('complementary')
const PATH = '/p/KR-01/takeoff/1'

type AgreesOn = 'list' | 'plot' | 'title_block' | null | undefined

const TITLES: Record<string, string> = {
  'E-01': 'CONDUIT KEY AND NOTES',
  'E-02': 'MEZZANINE LUMINAIRE PLAN',
  'E-03': 'MEZZANINE OUTLET PLAN',
  'E-04': 'ROOF LUMINAIRE PLAN',
  'E-05': 'METER BANK RISER',
  'S-01': 'GROUND BEAM NOTES',
  'S-02': 'RAFT REINFORCEMENT PLAN',
}

let serial = 0
const id = (block: string) => {
  serial += 1
  return `${block}-0000-4000-8000-${String(serial).padStart(12, '0')}`
}

/** The fake with only the invented sheets: each `[number, agrees_on]` (undefined: the field absent). */
function project(sheets: [string, AgreesOn][]): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const template = step1.proposals.find((p) => p.discipline === 'electrical')!
  const structural = step1.proposals.find((p) => p.discipline === 'structural')!
  step1.proposals = sheets.map(([number, on]) => {
    const from = number.startsWith('S-') ? structural : template
    const made: ProposalOut = { ...from, id: id('a3200000'), sheet_id: id('b3200000'), number, title: TITLES[number]!, agrees: on !== null, decision: null, proposed_exclusion: null, held: false }
    return on === undefined ? made : Object.assign(made, { agrees_on: on })
  })
  step1.questions = []
  step1.lists = {}
  step1.coverage = { ...step1.coverage, views: 0, proposed: 0, unaccounted: 0, by_step: {}, by_reason: {} }
  return { api, step1 }
}

/** A Discipline's drawing list naming `numbers` (typed by the QS). */
function listed(step1: FakeStep1, discipline: string, numbers: string[]): void {
  step1.lists[discipline] = { source: 'typed', numbers, entered_by: 'A QS', entered_at: '2026-10-04T05:00:00Z', read_numbers: null }
}

/** The open gap Question the read raises for a Discipline (its base shape: no sheet linked). */
function gapAsked(discipline: string, after: string, before: string): QuestionOut {
  return {
    id: id('c3200000'),
    kind: 'check',
    status: 'open',
    code: 'engine.register_check.gap',
    params: { after, before, missing: 1, discipline },
    options: ['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline,
    subject_id: null,
    check_code: 'register',
    answer: null,
    answered_at: null,
    ...{ proposals: [], withdrawn_by: null, blocking: true },
  }
}

async function open(api: FakeApi, found: number) {
  const app = await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain(`Confirmed 0 / ${found}`))
  return app
}

/** The smallest row-like element holding `text`. */
function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

/** Focus the Sheet's row (found by its invented title: a Question's row may name its number too). */
async function focusRow(number: string) {
  const title = TITLES[number]!
  await waitFor(() => rowOf(title))
  await userEvent.click(within(rowOf(title)).getByText(number))
}

const TITLE_BLOCK_WHY = 'Each has a number and title from its title block, in numbering without a gap; no drawing list or Plot page confirms them.'

describe('the bulk act’s why (case 11)', () => {
  it('says the title-block Sheets have no drawing list or Plot page to confirm them', async () => {
    const { api } = project([['E-01', 'title_block'], ['E-02', 'title_block'], ['E-03', 'title_block']])
    await open(api, 3)
    await waitFor(() => expect(bodyText()).toContain(TITLE_BLOCK_WHY))
    expect(bodyText()).not.toContain('Plot page shows')
    expect(bodyText()).not.toContain('Plot page matches')
    expect(bodyText()).not.toContain('on its drawing list')
  })

  it('counts the title-block Sheets among Sheets on a drawing list: "3 of them have one source each"', async () => {
    const { api, step1 } = project([['S-01', 'list'], ['S-02', 'list'], ['E-01', 'title_block'], ['E-02', 'title_block'], ['E-03', 'title_block']])
    listed(step1, 'structural', ['S-01', 'S-02'])
    await open(api, 5)
    await waitFor(() => expect(bodyText()).toContain('3 of them have one source each, their title block, in numbering without a gap.'))
    expect(bodyText()).not.toContain(TITLE_BLOCK_WHY)
  })

  it('says one title-block Sheet among them in the singular', async () => {
    const { api, step1 } = project([['S-01', 'list'], ['S-02', 'list'], ['E-01', 'title_block']])
    listed(step1, 'structural', ['S-01', 'S-02'])
    await open(api, 3)
    await waitFor(() => expect(bodyText()).toContain('1 of them has one source: its title block, in numbering without a gap.'))
  })
})

describe('sheet mode on a title-block Sheet (case 12)', () => {
  it('says it is in the bulk act on one source and keeps "Confirm all 3 that agree"', async () => {
    const { api } = project([['E-01', 'title_block'], ['E-02', 'title_block'], ['E-03', 'title_block']])
    await open(api, 3)
    await focusRow('E-02')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /E-02/ })
    await waitFor(() => expect(bodyText()).toContain('E-02 is in the bulk act on one source: number and title from the title block, in numbering without a gap'))
    expect(bodyText()).toContain('Confirm all 3 that agree')
  })
})

describe('the card’s Sources fact (cases 13 and 15)', () => {
  it('reads "one, the title block, in numbering without a gap" for a title-block Sheet', async () => {
    const { api } = project([['E-01', 'title_block'], ['E-02', 'title_block'], ['E-03', 'title_block']])
    await open(api, 3)
    await focusRow('E-03')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Sources'))
    expect(clean(inspector().textContent)).toContain('one, the title block, in numbering without a gap')
    expect(clean(inspector().textContent)).not.toContain('two, agreeing')
  })

  it('reads "two, agreeing" for a Sheet on its drawing list', async () => {
    const { api, step1 } = project([['S-01', 'list'], ['S-02', 'list'], ['E-01', 'title_block']])
    listed(step1, 'structural', ['S-01', 'S-02'])
    await open(api, 3)
    await focusRow('S-02')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('two, agreeing'))
  })

  it('reads "two, agreeing" for an agreeing Sheet from a server that sends no agrees_on', async () => {
    const { api, step1 } = project([['S-01', undefined], ['S-02', undefined]])
    listed(step1, 'structural', ['S-01', 'S-02'])
    await open(api, 2)
    await focusRow('S-01')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('two, agreeing'))
    expect(clean(inspector().textContent)).not.toContain('in numbering without a gap')
  })
})

describe('the State column and a Sheet beside a gap (case 14)', () => {
  it('still marks a title-block Sheet "Proposal, one source" while it is in the bulk act', async () => {
    const { api } = project([['E-01', 'title_block'], ['E-02', 'title_block'], ['E-03', 'title_block']])
    await open(api, 3)
    await waitFor(() => expect(clean(rowOf(TITLES['E-02']!).textContent)).toContain('Proposal, one source'))
    expect(screen.getByRole('button', { name: /Confirm all 3 that agree|Confirm 3/ })).toBeVisible()
  })

  it('says a Sheet beside an asked gap joins the bulk act once its Question is answered', async () => {
    const { api, step1 } = project([['E-01', 'title_block'], ['E-02', null], ['E-04', null], ['E-05', 'title_block']])
    step1.questions = [gapAsked('electrical', 'E-02', 'E-04')]
    await open(api, 4)
    await focusRow('E-04')
    await waitFor(() => expect(bodyText()).toContain('It sits beside a gap in the numbering that Q1 asks about; answer Q1 and it joins the bulk act.'))
    expect(bodyText()).not.toContain('No drawing list and no Plot to check it against.')
  })
})
