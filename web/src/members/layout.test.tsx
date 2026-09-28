/*
 * Members and access laid out at 1440, 1280 and 1100 wide, with a person's acts open beside it and
 * without (design gate 20a r1, musts 4 to 7): every row's acts whole, in view and with their focus
 * rings uncut; a revoked row's Until whole, never only in its tooltip; and a 24 px gutter each side of
 * the page when the panel pushes it, never flush with the window's edge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
const named = (re: RegExp) => (name: string) => re.test(clean(name))
const ACTS = /^(Renew 30 days|Revoke|Copy link|Withdraw)$/

function table(name: RegExp) {
  return screen.getByRole('table', { name: named(name) })
}

/** The page with Arif Rahman's access revoked by the MD, and his acts open beside it or not. */
async function membersAt(width: number, open: boolean) {
  await page.viewport(width, 800)
  const api = new FakeApi()
  api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
  await mountApp('/members', { as: PEOPLE.md, api })
  await screen.findByRole('table', { name: named(/^Vextrus access$/) })
  if (open) {
    const arif = within(table(/^Vextrus access$/)).getByRole('row', { name: named(/Arif Rahman/) })
    await userEvent.click(within(arif).getByRole('button', { name: named(/acts?, last/) }))
    await screen.findByRole('region', { name: named(/^Arif Rahman \(Vextrus\)$/) })
  }
}

describe('Members and access in the room it has (design gate 20a r1)', () => {
  it.each([
    [1440, false],
    [1440, true],
    [1280, false],
    [1280, true],
    [1100, true],
  ])('at %i wide, acts open: %s', async (width, open) => {
    await membersAt(width, open)
    const pageBox = document.querySelector('[data-region="page"]')!.getBoundingClientRect()

    // Every row's acts whole and in view: inside the window, inside the page, inside their table's box.
    const buttons = screen.getAllByRole('button', { name: named(ACTS) })
    expect(buttons.length).toBeGreaterThan(4)
    for (const button of buttons) {
      const b = button.getBoundingClientRect()
      const box = button.closest('table')!.parentElement!.getBoundingClientRect()
      expect(b.width).toBeGreaterThan(40)
      expect(b.left).toBeGreaterThanOrEqual(Math.max(box.left, pageBox.left) - 0.5)
      expect(b.right).toBeLessThanOrEqual(Math.min(box.right, pageBox.right) + 0.5)
      // Nothing between the button and its row cuts its focus ring.
      expect(getComputedStyle(button.closest('td')!).overflow).toBe('visible')
    }

    // A revoked row's Until whole.
    const until = within(table(/^Vextrus access$/)).getByText((_, el) => el?.tagName === 'TD' && clean(el.textContent) === 'Revoked by Kamal Uddin, 28 Sep 2026')
    expect(until.scrollWidth).toBeLessThanOrEqual(until.clientWidth + 0.5)

    // With the panel open, a 24 px gutter each side of the page's content.
    if (open) {
      const heading = screen.getByRole('heading', { level: 1, name: 'Members and access' }).getBoundingClientRect()
      expect(heading.left - pageBox.left).toBeGreaterThanOrEqual(24)
      for (const t of screen.getAllByRole('table')) {
        const box = t.parentElement!.getBoundingClientRect()
        expect(box.left - pageBox.left).toBeGreaterThanOrEqual(24)
        expect(pageBox.right - box.right).toBeGreaterThanOrEqual(24)
      }
    }
  })

  it('keeps a focused row act’s ring whole at 1280 with the acts open', async () => {
    await membersAt(1280, true)
    const revoke = within(table(/^People at /)).getAllByRole('button', { name: 'Revoke' })[0]!
    revoke.focus()
    await waitFor(() => expect(revoke).toHaveFocus())
    const ring = revoke.getBoundingClientRect()
    const cell = revoke.closest('td')!
    expect(getComputedStyle(cell).overflow).toBe('visible')
    expect(ring.top).toBeGreaterThanOrEqual(cell.closest('table')!.parentElement!.getBoundingClientRect().top)
  })
})
