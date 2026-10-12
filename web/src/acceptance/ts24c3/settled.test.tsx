/*
 * Ticket S24-C3's acceptance tests (G1 blocker M0-FL5, #324): a Discipline heading's "n / N settled".
 * m0-screens §6.3: "Each heading carries its Part's own progress": "Structural 40 found, 39 on the
 * drawing list on S-01 | 0 / 40 settled" ("settled" = confirmed or excluded). The heading's n and N come
 * from one count, so n never exceeds N: a sheet the read proposed out with no number (a cover) is not
 * counted in Step 1's progress until the QS confirms it in (ticket 162), so excluding it settles nothing
 * the heading counts. Step 1's `progress` gives that count per Discipline (`Step1DisciplineProgressOut`:
 * `confirmed`, `found`, `total`).
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts), its Architectural
 * Discipline replaced by 8 numbered sheets A-01–A-08 and one numberless sheet proposed out as a cover;
 * its `progress` answers as the server's does (a numberless sheet proposed out is counted only once
 * confirmed in). Every title is invented.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

const NUMBERS = Array.from({ length: 8 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`)
const COVER_TITLE = 'ZQ COVER SHEET'
const DECIDED = { decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' }

/** A numberless sheet proposed out and not confirmed in: Step 1's progress leaves it out. */
const counted = (p: ProposalOut) => !(p.proposed_exclusion !== null && !p.number) || p.decision === 'confirmed'

/**
 * KR-01 with Architectural as 8 numbered sheets and one numberless cover proposed out; `settle` is
 * how many of A-01… are confirmed, `coverOut` whether the cover is excluded.
 */
function kr01(settle: number, coverOut: boolean): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const template = step1.proposals.find((p) => p.discipline === 'architectural')!
  let serial = 0
  const id = (block: string) => `${block}-0000-4000-8000-${String(++serial).padStart(12, '0')}`
  const sheet = (number: string | null, title: string, over: Partial<ProposalOut> = {}): ProposalOut => ({
    ...template,
    id: id('a2430000'),
    sheet_id: id('b2430000'),
    number,
    title,
    agrees: true,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    decided_by: null,
    decided_at: null,
    ...over,
  })
  const architectural = NUMBERS.map((n, i) => sheet(n, `ZQ PLAN ${i + 1}`, i < settle ? { decision: 'confirmed', ...DECIDED } : {}))
  const cover = sheet(null, COVER_TITLE, {
    proposed_exclusion: 'cover_index',
    ...(coverOut ? { decision: 'excluded', excluded_reason: 'cover_index', ...DECIDED } : {}),
  })
  step1.proposals = [...step1.proposals.filter((p) => p.discipline !== 'architectural'), ...architectural, cover]
  step1.questions = step1.questions.filter((q) => q.discipline !== 'architectural')
  Object.assign(step1, { coverage: { ...step1.coverage, unaccounted: 0 } })
  // The server's `progress()`: a numberless sheet proposed out is counted only once confirmed in.
  const lists = step1.lists
  Object.assign(step1, {
    progress: () => ({
      disciplines: ['structural', 'architectural', 'electrical'].map((d) => {
        const mine = step1.proposals.filter((p) => p.discipline === d && counted(p))
        const listed = lists[d] ? lists[d]!.numbers.length : null
        return {
          discipline: d,
          confirmed: mine.filter((p) => p.decision !== null).length,
          found: mine.length,
          listed,
          lists_disagree: false,
          total: listed ?? mine.length,
          open_questions: step1.questions.filter((q) => q.discipline === d && q.status === 'open').length,
        }
      }),
      not_received: step1.notReceived,
    }),
  })
  return api
}

/** Every "n / N settled" Architectural shows (its heading, and the Inspector's summary when shown). */
async function architecturalSettled(api: FakeApi): Promise<string[]> {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  // "8 found" is the server's count (the client's own would be 9): the progress has arrived.
  await waitFor(() => expect(bodyText()).toContain('Architectural 8 found'))
  const said = [...bodyText().matchAll(/(\d+) \/ (\S+) settled/g)].map((m) => `${m[1]} / ${m[2]}`)
  const heading = [...document.querySelectorAll<HTMLElement>('span.num')]
    .map((s) => clean(s.textContent))
    .filter((s) => / settled$/.test(s))
  expect(heading.length, 'the Disciplines’ "n / N settled"').toBeGreaterThan(0)
  // Settled never exceeds its total, on any heading or summary.
  for (const m of bodyText().matchAll(/(\d+) \/ (\d+) settled/g)) expect(Number(m[1]), m[0]).toBeLessThanOrEqual(Number(m[2]))
  return [...new Set([...said, ...heading.map((s) => s.replace(/ settled$/, ''))])].filter((s) => s.endsWith('/ 8'))
}

describe('m0-screens §6.3: a Discipline heading’s "n / N settled" counts what N counts', () => {
  it('reads "0 / 8 settled" when only the numberless cover, outside the 8, is excluded', async () => {
    const shown = await architecturalSettled(kr01(0, true))
    expect(bodyText()).toContain('0 / 8 settled')
    expect(shown).toEqual(['0 / 8'])
  })

  it('reads "1 / 8 settled" when A-01 is confirmed and the numberless cover is excluded', async () => {
    const shown = await architecturalSettled(kr01(1, true))
    expect(bodyText()).toContain('1 / 8 settled')
    expect(shown).toEqual(['1 / 8'])
  })

  it('reads "1 / 8 settled" when A-01 is confirmed and the numberless cover is still proposed out', async () => {
    const shown = await architecturalSettled(kr01(1, false))
    expect(bodyText()).toContain('1 / 8 settled')
    expect(shown).toEqual(['1 / 8'])
  })

  it('reads "7 / 8 settled", not "8 / 8", with seven of the 8 confirmed and the numberless cover excluded', async () => {
    const shown = await architecturalSettled(kr01(7, true))
    expect(bodyText()).toContain('7 / 8 settled')
    expect(shown).toEqual(['7 / 8'])
  })
})
