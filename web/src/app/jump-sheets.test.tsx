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
