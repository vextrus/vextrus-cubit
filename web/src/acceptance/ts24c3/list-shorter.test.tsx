/*
 * Ticket S24-C3's acceptance tests, the design gate's item 1 on #725: a Discipline whose drawing list
 * names fewer sheets than were found. m0-screens §6.3: "Each heading carries its Part's own progress":
 * "Structural 40 found, 39 on the drawing list on S-01 | 0 / 40 settled" ("settled" = confirmed or
 * excluded): the heading's total is the sheets found (40), not the list's count (39), and the list's
 * count stays in the words ("39 on the drawing list", its source "29 on the drawing list pasted by
 * Rafiq Hasan"). So settled never exceeds the total: the gate saw "8 / 5 settled".
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts), its Architectural
 * Discipline replaced by 8 numbered sheets A-01–A-08 and a drawing list pasted by Nusrat Jahan naming
 * A-01–A-05. Its `progress` answers as the server's does today (`total` is the list's count when there
 * is a list, so 5): the heading's total must still read the 8 found. Every title is invented.
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

const FOUND = Array.from({ length: 8 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`)
const LISTED = FOUND.slice(0, 5)
/** m0-screens §6.3's heading words: "Structural 40 found, 39 on the drawing list on S-01", "29 on the drawing list pasted by Rafiq Hasan". */
const HEADING = 'Architectural 8 found, 5 on the drawing list pasted by Nusrat Jahan'
const DECIDED = { decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' }

/** KR-01 with Architectural as 8 numbered sheets, `settle` of them confirmed, and a pasted list of 5. */
function kr01(settle: number): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const template = step1.proposals.find((p) => p.discipline === 'architectural')!
  let serial = 0
  const id = (block: string) => `${block}-0000-4000-8000-${String(++serial).padStart(12, '0')}`
  const architectural = FOUND.map(
    (number, i): ProposalOut => ({
      ...template,
      id: id('a2431000'),
      sheet_id: id('b2431000'),
      number,
      title: `ZQ PLAN ${i + 1}`,
      agrees: true,
      proposed_exclusion: null,
      decision: null,
      excluded_reason: null,
      decided_by: null,
      decided_at: null,
      ...(i < settle ? { decision: 'confirmed', ...DECIDED } : {}),
    }),
  )
  step1.proposals = [...step1.proposals.filter((p) => p.discipline !== 'architectural'), ...architectural]
  step1.questions = step1.questions.filter((q) => q.discipline !== 'architectural')
  step1.lists.architectural = {
    source: 'pasted',
    numbers: [...LISTED],
    entered_by: 'Nusrat Jahan',
    entered_at: '2026-09-26T04:00:00Z',
    read_numbers: null,
  }
  return api
}

/** Every "n / N settled" Architectural shows (its heading, and the Inspector's summary when shown). */
async function architecturalSettled(api: FakeApi): Promise<string[]> {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  // The heading names the list once its drawing list has arrived (a query of its own, after progress).
  await waitFor(() => expect(bodyText()).toContain(HEADING))
  const heading = [...document.querySelectorAll<HTMLElement>('span.num')]
    .map((s) => clean(s.textContent))
    .filter((s) => / settled$/.test(s))
  expect(heading.length, 'the Disciplines’ "n / N settled"').toBeGreaterThan(0)
  // Structural's heading reads "n / 13"; Electrical's "n / 3". Architectural's is the one over 5 or 8.
  const said = [...bodyText().matchAll(/(\d+) \/ (\S+) settled/g)].map((m) => `${m[1]} / ${m[2]}`)
  return [...new Set([...said, ...heading.map((s) => s.replace(/ settled$/, ''))])].filter((s) => / \/ [58]$/.test(s))
}

/** Settled never exceeds its total, on any heading or summary. */
function neverOver(): void {
  for (const m of bodyText().matchAll(/(\d+) \/ (\d+) settled/g)) expect(Number(m[1]), m[0]).toBeLessThanOrEqual(Number(m[2]))
}

describe('m0-screens §6.3: with a drawing list shorter than the sheets found, the total is the sheets found', () => {
  it('reads "0 / 8 settled", not "0 / 5", with 8 found and 5 on the drawing list', async () => {
    const shown = await architecturalSettled(kr01(0))
    expect(bodyText()).toContain('0 / 8 settled')
    expect(shown).toEqual(['0 / 8'])
  })

  it('reads "6 / 8 settled", never more settled than its total, with six of the 8 confirmed', async () => {
    const shown = await architecturalSettled(kr01(6))
    neverOver()
    expect(bodyText()).toContain('6 / 8 settled')
    expect(shown).toEqual(['6 / 8'])
  })

  it('reads "8 / 8 settled", not "8 / 5", with all 8 confirmed and a view still unaccounted', async () => {
    const shown = await architecturalSettled(kr01(8))
    neverOver()
    expect(bodyText()).toContain('8 / 8 settled')
    expect(shown).toEqual(['8 / 8'])
  })

  it('keeps the drawing list’s count in the heading: "Architectural 8 found, 5 on the drawing list pasted by Nusrat Jahan"', async () => {
    await architecturalSettled(kr01(6))
    expect(bodyText()).toContain(HEADING)
  })
})
