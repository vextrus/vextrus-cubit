/*
 * Jump to's sheets (S25-D4, PR #771's round 1): found by a number's start or a title's word starts, not by
 * cmdk's in-order letters; every jump opens its sheet; `?sheet=` is read as typed; copies of one number are
 * addressed by sheet id and shown apart.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { canvasOf, clean, openList, seed } from '../acceptance/ts15w2/keys.fixture'
import { step1AddressFor, sheetAddress } from '@/takeoff/paths'
import { jumpFilter } from './JumpTo'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

async function jumpTyping(text: string): Promise<HTMLElement> {
  await userEvent.keyboard('{Control>}k{/Control}')
  const jump = await screen.findByRole('dialog')
  await userEvent.keyboard(text)
  return jump
}

describe('the sheets filter', () => {
  it('finds by the number’s start and by title word starts only', () => {
    const k = ['S-04', 'GROUND FLOOR BEAM LAYOUT']
    expect(jumpFilter('sheet:a', 's-0', k)).toBeGreaterThan(0)
    expect(jumpFilter('sheet:a', 'ground beam', k)).toBeGreaterThan(0)
    expect(jumpFilter('sheet:a', 'S-99', k)).toBe(0)
    expect(jumpFilter('sheet:a', 'round', k)).toBe(0)
  })

  it('finds titles typed with dashes, marks and all, as shown', () => {
    const f = (title: string, typed: string) => jumpFilter('sheet:a', typed, ['S-09', title])
    expect(f('COLUMN C-1 DETAILS', 'c-1')).toBeGreaterThan(0)
    expect(f('SECTION A-A', 'section a-a')).toBeGreaterThan(0)
    expect(f('GF & 1ST FLOOR SLAB', 'gf & 1st')).toBeGreaterThan(0)
    expect(f('ROOF SLAB (TYP.)', '(typ.')).toBeGreaterThan(0)
    expect(f('ROOF SLAB (TYP.)', 'typ')).toBeGreaterThan(0)
    expect(f('GROUND FLOOR BEAM LAYOUT', 's-09 ground')).toBeGreaterThan(0)
    expect(f('কলাম বিস্তারিত', 'বিস্তারিত')).toBeGreaterThan(0)
    expect(f('PILE-CAP LAYOUT', 'cap')).toBeGreaterThan(0)
    expect(f('COLUMN-BEAM JOINT', 'beam')).toBeGreaterThan(0)
    expect(f('PLINTH/GRADE BEAM LAYOUT', 'grade')).toBeGreaterThan(0)
    expect(f('TYPICAL FLOOR (2ND-9TH) BEAM LAYOUT', '9th')).toBeGreaterThan(0)
    expect(f('COLUMN C-1 DETAILS', 'c-2')).toBe(0)
    expect(f('PILE-CAP LAYOUT', 'ile')).toBe(0)
  })
})

describe('Jump to over ids full of nines', () => {
  it('says "Nothing here by that name." for S-99 whatever the sheets’ ids hold', async () => {
    const s = seed()
    s.step1.proposals.forEach((p, i) => void (p.id = `99999999-9999-7999-9999-99999999999${i}`))
    await openList(s)
    const jump = await jumpTyping('S-99')
    await waitFor(() => expect(clean(jump.textContent)).toContain('Nothing here by that name.'))
    expect(within(jump).queryAllByRole('option').filter((o) => clean(o.textContent).includes('S-0'))).toHaveLength(0)
  })
})

/** Step 1 opened on S-04 by its address, as the Drawing Set's link does: no jump yet. */
async function openOnS04() {
  await mountApp('/p/KR-01/takeoff/1?sheet=S-04', { as: PEOPLE.qs, api: seed().api })
  await canvasOf('S-04')
}

/** The one jump under test: Ctrl K, the number, Enter. */
async function jumpToS04() {
  await jumpTyping('S-04')
  await screen.findByRole('option', { name: /S-04/ })
  await userEvent.keyboard('{Enter}')
}

describe('every jump opens its sheet', () => {
  it('opens S-04 again after paging away from it', async () => {
    await openOnS04()
    await userEvent.keyboard('{PageDown}')
    await canvasOf('S-05')
    await jumpToS04()
    await canvasOf('S-04')
  })

  it('opens S-04 from the list after going back to it', async () => {
    await openOnS04()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Sheet\s/ })).toBeNull())
    await jumpToS04()
    await canvasOf('S-04')
  })
})

describe('?sheet= is read as typed', () => {
  it('opens a sheet whose number is all digits', async () => {
    const s = seed()
    s.of('S-04').number = '101'
    await mountApp('/p/KR-01/takeoff/1?sheet=101', { as: PEOPLE.qs, api: s.api })
    await canvasOf('101')
  })
})

describe('two sheets sharing a number', () => {
  it.each([
    ['Rev A', 'GROUND FLOOR BEAM LAYOUT', 'SECOND COPY'],
    ['Rev B', 'SECOND COPY', 'GROUND FLOOR BEAM LAYOUT'],
  ])('are shown apart and %s opens by its own id', async (mark, opens, other) => {
    const s = seed()
    const a = s.of('S-04')
    const b = s.of('S-05')
    Object.assign(a, { revision_mark: 'Rev A' })
    Object.assign(b, { number: 'S-04', title: 'SECOND COPY', revision_mark: 'Rev B' })
    await openList(s)
    const jump = await jumpTyping('S-04')
    const options = within(jump).getAllByRole('option').filter((o) => clean(o.textContent).includes('S-04'))
    expect(options).toHaveLength(2)
    expect(clean(options[0]!.textContent)).not.toBe(clean(options[1]!.textContent))
    const chosen = options.find((o) => clean(o.textContent).includes(mark))!
    await userEvent.click(chosen)
    // The sheet label in the toolbar names the copy that opened, not the other with the same number.
    const label = () =>
      [...document.querySelectorAll<HTMLElement>('button[aria-haspopup], button[aria-expanded]')].filter((x) => x.offsetParent !== null && !x.closest('[role="dialog"]')).map((x) => clean(x.textContent))
    await waitFor(() => expect(label().some((t) => t.includes('S-04') && t.includes(opens))).toBe(true))
    expect(label().some((t) => t.includes(other))).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

/** The address `?sheet=` holds now, as typed. */
const addressed = (app: Awaited<ReturnType<typeof mountApp>>) => new URLSearchParams(app.router.state.location.searchStr).get('sheet')

describe('the sheet address (S25-D4, the design gate)', () => {
  it('is the number where it is unique in the project, the id only for copies sharing one', () => {
    const a = { sheet_id: 'id-a', number: 'S-04' }
    const b = { sheet_id: 'id-b', number: 'S-05' }
    const c = { sheet_id: 'id-c', number: 'S-04' }
    expect(sheetAddress(a, [a, b])).toBe('S-04')
    expect(sheetAddress(a, [a, b, c])).toBe('id-a')
    expect(sheetAddress(c, [a, b, c])).toBe('id-c')
    expect(sheetAddress({ sheet_id: 'id-n', number: null }, [a, b])).toBe('id-n')
    expect(step1AddressFor('KR-01', a, [a, b])).toBe('/p/KR-01/takeoff/1?sheet=S-04')
  })

  it('is written as the number after a jump, and follows paging without sending the QS back', async () => {
    const app = await openList(seed())
    await jumpTyping('S-04')
    await screen.findByRole('option', { name: /S-04/ })
    await userEvent.keyboard('{Enter}')
    await canvasOf('S-04')
    await waitFor(() => expect(addressed(app)).toBe('S-04'))
    await userEvent.keyboard('{PageDown}')
    await canvasOf('S-05')
    await waitFor(() => expect(addressed(app)).toBe('S-05'))
    // A second page lands on the next sheet: nothing re-read the address as S-04.
    await userEvent.keyboard('{PageUp}')
    await canvasOf('S-04')
    await userEvent.keyboard('{PageUp}')
    await canvasOf('S-03')
    await waitFor(() => expect(addressed(app)).toBe('S-03'))
  })

  it('leaves the address when the QS goes back to the list', async () => {
    const app = await mountApp('/p/KR-01/takeoff/1?sheet=S-04', { as: PEOPLE.qs, api: seed().api })
    await canvasOf('S-04')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Sheet\s/ })).toBeNull())
    await waitFor(() => expect(addressed(app)).toBeNull())
  })

  it('names a copy sharing its number by its id, and the copy opens', async () => {
    const s = seed()
    Object.assign(s.of('S-05'), { number: 'S-04', title: 'SECOND COPY', revision_mark: 'Rev B' })
    Object.assign(s.of('S-04'), { revision_mark: 'Rev A' })
    const app = await openList(s)
    await jumpTyping('S-04')
    const copy = (await screen.findAllByRole('option', { name: /S-04/ })).find((o) => clean(o.textContent).includes('Rev B'))!
    await userEvent.click(copy)
    const second = s.step1.proposals.find((p) => p.title === 'SECOND COPY')!
    await waitFor(() => expect(addressed(app)).toBe(second.sheet_id))
    // The id opens that copy, not the other with the same number.
    expect(await screen.findByRole('group', { name: /^Sheet\s.*S-04 rev B/i })).toBeVisible()
  })
})

describe('Jump to’s sheet rows (S25-D4, the design gate)', () => {
  it('reads shared copies as "rev A, 12 Sep 2026", with the Discipline only where it differs', async () => {
    const s = seed()
    Object.assign(s.of('S-04'), { revision_mark: 'A', issue_date: '2026-09-12' })
    Object.assign(s.of('S-05'), { number: 'S-04', title: 'SECOND COPY', revision_mark: 'B', issue_date: '2026-09-20' })
    Object.assign(s.of('S-03'), { number: 'S-02', title: 'THIRD COPY', discipline: 'architectural', revision_mark: 'A', issue_date: '2026-09-01' })
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: s.api })
    const jump = await jumpTyping('S-0')
    const text = (number: string, title: string) => clean(within(jump).getAllByRole('option').find((o) => clean(o.textContent).includes(title) && clean(o.textContent).includes(number))!.textContent)
    // Same Discipline: revision and date only.
    expect(text('S-04', 'GROUND FLOOR BEAM LAYOUT')).toMatch(/rev A, 12 Sep 2026$/)
    expect(text('S-04', 'GROUND FLOOR BEAM LAYOUT')).not.toContain('·')
    expect(text('S-04', 'SECOND COPY')).toMatch(/rev B, 20 Sep 2026$/)
    // Two Disciplines sharing a number: the Discipline too.
    expect(text('S-02', 'THIRD COPY')).toMatch(/rev A, 1 Sep 2026 · \S+$/)
    // A sheet with no copy shows nothing of the kind.
    expect(text('S-01', 'GENERAL NOTES')).not.toMatch(/rev|·/)
  })

  it('shows the compact status mark (Proposal, Confirmed, Question) before the number', async () => {
    const s = seed()
    Object.assign(s.of('S-02'), { decision: 'confirmed' })
    s.step1.questions = [
      {
        id: 'c0000000-0000-4000-8000-000000000001',
        kind: 'missing',
        status: 'open',
        code: 'takeoff.step1.no_number',
        params: {},
        options: [{ key: 'keep_open', picked: false }],
        discipline: 'structural',
        subject_id: s.of('S-03').sheet_id,
        check_code: null,
        answer: null,
        answered_at: null,
      },
    ]
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: s.api })
    const jump = await jumpTyping('S-0')
    const markOf = (number: string) => {
      const option = within(jump).getAllByRole('option').find((o) => clean(o.textContent).includes(number))!
      const mark = option.querySelector<HTMLElement>('[title]')!
      expect(mark.compareDocumentPosition(option.querySelector('[data-notation="sheet-number"]')!) & Node.DOCUMENT_POSITION_FOLLOWING, 'the mark comes before the number').toBeTruthy()
      return mark.getAttribute('title')
    }
    expect(markOf('S-01')).toBe('Proposal')
    expect(markOf('S-02')).toBe('Confirmed')
    expect(markOf('S-03')).toBe('Question')
  })
})
