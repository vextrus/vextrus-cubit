/*
 * S26-HF1's acceptance tests (a hotfix: main's web suite red after #805 S26-D7 and #771 S25-D4 merged).
 *
 * docs/design/m0-screens.md §2.2: "`Ctrl K` | global | Jump to: projects; inside a project, the Drawing
 * Set, Step 1, Members and access, and any sheet by number or title"; §1.4: a Guest has no Members and
 * access. S25-D4 lists Step 1's sheets in Jump to, each with its state mark as the list's State column
 * shows it (m0-screens §3: Proposal, Confirmed, Question, Excluded), read from Step 1's own queries.
 * S26-D7 has the frame read Step 1's counts from those same queries, and `mountApp`'s `step1` option
 * (src/app/testing.tsx: "seeds Step 1's own queries with that many Proposals and open Questions") puts
 * them there. On main, Jump to opened inside a project so seeded throws in <JumpTo>
 * ("Cannot read properties of undefined (reading 'number')") and the router's error boundary replaces
 * it: no dialog.
 *
 * Two halves: the frame's Step 1 queries as `mountApp` seeds them (the seed's KR-01: 24 Proposals,
 * 5 open Questions), and as the API answers them (S15-W2's six sheets), opened while they load and
 * again once read. Neither names the sheets' numbers or titles the seed chooses, nor which sheets the
 * seeded Questions hold; only that each sheet is a row with its number and one of the four marks.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { STEP1 } from '@/app/seed/demo.fixture'
import { NUMBERS, clean, seed } from '../ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const PATH = '/p/KR-01/takeoff/1'
const MARKS = ['Proposal', 'Confirmed', 'Question', 'Excluded']
const SEEDED = STEP1['KR-01']!.found!

async function openJumpTo(): Promise<HTMLElement> {
  await waitFor(() => expect(document.querySelector('[data-region="rail"]')).not.toBeNull())
  await userEvent.keyboard('{Control>}k{/Control}')
  return screen.findByRole('dialog', { name: 'Jump to' })
}

const optionsOf = (el: HTMLElement) => within(el).queryAllByRole('option').map((o) => clean(o.textContent))

/** Jump to's Sheets group, once it is drawn. */
async function sheetsGroup(jump: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => within(jump).getByRole('group', { name: 'Sheets' }))
}

/** Each sheet row's problems: no state mark leading it, or no number marked `sheet-number`. */
function rowProblems(group: HTMLElement): string[] {
  return within(group)
    .getAllByRole('option')
    .flatMap((row) => {
      const text = clean(row.textContent)
      const problems: string[] = []
      if (!MARKS.some((m) => text.startsWith(m))) problems.push(`${text}: no state mark`)
      if (!row.querySelector('[data-notation="sheet-number"]')) problems.push(`${text}: no sheet number`)
      return problems
    })
}

describe('Jump to inside a project whose Step 1 the frame has read (mountApp step1)', () => {
  it('opens for the QS with the Drawing Set, Step 1 and Members and access, and the projects', async () => {
    await mountApp(PATH, { as: PEOPLE.qs, step1: STEP1 })
    const jump = await openJumpTo()
    expect(within(jump).getByRole('combobox', { name: 'Jump to' })).toBeInTheDocument()
    expect(optionsOf(jump)).toEqual(
      expect.arrayContaining(['Drawing Set', 'Step 1, Sheets', 'Members and access', 'Bokul PlaceBP-02', 'Kadam ResidenceKR-01', 'Shimul GardenSG-03']),
    )
  })

  it('opens for the Guest with the Drawing Set and Step 1, no Members and access, and only the Guest’s project', async () => {
    await mountApp(PATH, { as: PEOPLE.guest, step1: STEP1 })
    const jump = await openJumpTo()
    const options = optionsOf(jump)
    expect(options).toEqual(expect.arrayContaining(['Drawing Set', 'Step 1, Sheets', 'Kadam ResidenceKR-01']))
    expect(options).not.toContain('Members and access')
    expect(options).not.toContain('Bokul PlaceBP-02')
  })

  it('lists every seeded sheet for the QS in the Sheets group, each with its state mark and number', async () => {
    await mountApp(PATH, { as: PEOPLE.qs, step1: STEP1 })
    const group = await sheetsGroup(await openJumpTo())
    expect(within(group).getAllByRole('option')).toHaveLength(SEEDED)
    expect(rowProblems(group)).toEqual([])
  })

  it('lists every seeded sheet for the Guest in the Sheets group, each with its state mark and number', async () => {
    await mountApp(PATH, { as: PEOPLE.guest, step1: STEP1 })
    const group = await sheetsGroup(await openJumpTo())
    expect(within(group).getAllByRole('option')).toHaveLength(SEEDED)
    expect(rowProblems(group)).toEqual([])
  })
})

describe('Jump to inside a project while the frame’s Step 1 queries load, then once read (the API)', () => {
  it.each([
    ['QS', PEOPLE.qs],
    ['Guest', PEOPLE.guest],
  ])('opens for the %s while Step 1 loads, then lists its sheets with their marks once read', async (_who, as) => {
    const s = seed()
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const answer = s.api.handle
    s.api.handle = async (request: Request) => {
      if (/\/takeoff\/step1\/(proposals|questions)$/.test(new URL(request.url).pathname)) await held
      return answer(request)
    }
    await mountApp(PATH, { as, api: s.api })
    const jump = await openJumpTo()
    expect(optionsOf(jump)).toEqual(expect.arrayContaining(['Drawing Set', 'Step 1, Sheets', 'Kadam ResidenceKR-01']))
    expect(within(jump).queryByRole('group', { name: 'Sheets' })).toBeNull()
    release()
    const group = await sheetsGroup(jump)
    expect(within(group).getAllByRole('option')).toHaveLength(NUMBERS.length)
    expect(rowProblems(group)).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Jump to' })).toBe(jump)
  })
})
