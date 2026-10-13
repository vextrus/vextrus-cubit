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
import { canvasOf, clean, openList, seed, shownSheet } from '../acceptance/ts15w2/keys.fixture'
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

describe('every jump opens its sheet', () => {
  it('opens S-04 again after paging away from it', async () => {
    await openList(seed())
    for (let again = 0; again < 2; again++) {
      const jump = await jumpTyping('S-04')
      await waitFor(() => expect(within(jump).queryAllByRole('option').some((o) => clean(o.textContent).includes('S-04'))).toBe(true))
      await userEvent.keyboard('{Enter}')
      await canvasOf('S-04')
      await waitFor(() => expect(shownSheet()).toBe('S-04'))
      await userEvent.keyboard('{PageDown}')
      await waitFor(() => expect(shownSheet()).toBe('S-05'))
    }
  })

  it('opens S-04 from the list after going back to it', async () => {
    await openList(seed())
    for (let again = 0; again < 2; again++) {
      await jumpTyping('S-04')
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(shownSheet()).toBe('S-04'))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(shownSheet()).toBeNull())
    }
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
  it('are shown apart and each opens by its own id', async () => {
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
    const second = options.find((o) => clean(o.textContent).includes('Rev B'))!
    expect(clean(second.textContent)).toContain('Rev B')
    await userEvent.click(second)
    await waitFor(() => expect(clean(document.body.textContent)).toContain('SECOND COPY'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
