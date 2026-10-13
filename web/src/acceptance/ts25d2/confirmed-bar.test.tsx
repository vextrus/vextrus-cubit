/*
 * S25-D2 (G1 walk A f-3, FL8): the Confirmation bar on a confirmed sheet once Step 1 is confirmed, on t22's
 * fixture (the seed's KR-01; every title invented).
 *
 * docs/design/m0-screens.md §6.4, "Other bar states" (list mode, by what is focused):
 * - "A confirmed sheet | "S-20 is confirmed by Rafiq Hasan" … | "Next open item ↵""
 * - "Step 1 confirmed | "Step 1 is confirmed: every sheet is confirmed or excluded, and Coverage has none
 *   unaccounted" · "Step 2, General notes and specification, comes in M1." | none"
 * - "`Enter` on a row with nothing to act on, a confirmed sheet or a kept Question does the queue's next
 *   item." With nothing open there is no next item: the bar offers no button and Enter acts on nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const STEP1_CONFIRMED = 'Step 1 is confirmed: every sheet is confirmed or excluded, and Coverage has none unaccounted'
const STEP2_LATER = 'Step 2, General notes and specification, comes in M1.'

/** KR-01 with every sheet confirmed or excluded, every Question answered and Coverage none unaccounted. */
function allSettled(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  step1.settleAllBut('no discipline')
  return { api, step1 }
}

/** KR-01 with Structural and Architectural settled and Electrical still to confirm. */
function electricalOpen(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  step1.settleAllBut('electrical')
  return { api, step1 }
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
  await waitFor(() => expect(focusedOn(number), `focus on ${number}`).toBe(true))
}

function focusedOn(number: string): boolean {
  const row = rowOf(number)
  return row === document.activeElement || row.contains(document.activeElement)
}

const posts = (step1: FakeStep1) => step1.calls().filter((c) => !c.startsWith('GET'))
const nextOpenItem = () => screen.queryByRole('button', { name: /Next open item/ })

/** Open KR-01 with every sheet settled and focus the confirmed sheet S-05. */
async function confirmedS05() {
  const { api, step1 } = allSettled()
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await focusRow('S-05')
  return step1
}

describe('the bar on a confirmed sheet once Step 1 is confirmed (m0-screens §6.4)', () => {
  it('says "Step 1 is confirmed: every sheet is confirmed or excluded, and Coverage has none unaccounted"', async () => {
    await confirmedS05()
    await waitFor(() => expect(bodyText()).toContain(STEP1_CONFIRMED))
  })

  it('says "Step 2, General notes and specification, comes in M1."', async () => {
    await confirmedS05()
    await waitFor(() => expect(bodyText()).toContain(STEP2_LATER))
  })

  it('offers no "Next open item" button', async () => {
    await confirmedS05()
    await waitFor(() => expect(bodyText()).toContain(STEP1_CONFIRMED))
    expect(nextOpenItem()).toBeNull()
  })

  it('offers no button that Enter would press', async () => {
    await confirmedS05()
    await waitFor(() => expect(bodyText()).toContain(STEP1_CONFIRMED))
    const enterButtons = [...document.querySelectorAll<HTMLElement>('button[aria-keyshortcuts="Enter"]')].filter((b) => b.offsetParent !== null)
    expect(enterButtons.map((b) => clean(b.textContent))).toEqual([])
  })

  it('acts on nothing on Enter: no request, focus stays on S-05, and the bar still says Step 1 is confirmed', async () => {
    const step1 = await confirmedS05()
    // Every sheet is settled once the list has drawn S-05 confirmed; Enter is pressed whatever the bar says.
    await waitFor(() => expect(bodyText()).toContain('Coverage 70 views: 39 assigned, 28 excluded, 3 proposed, 0 unaccounted'))
    const before = posts(step1)
    await userEvent.keyboard('{Enter}')
    await new Promise<void>((done) => requestAnimationFrame(() => done()))
    expect(posts(step1), 'no act on Enter').toEqual(before)
    expect(focusedOn('S-05'), 'focus stays on S-05').toBe(true)
    await waitFor(() => expect(bodyText()).toContain(STEP1_CONFIRMED))
  })
})

describe('the bar on a confirmed sheet while a sheet is still open (m0-screens §6.4)', () => {
  it('still offers "Next open item" with Electrical left to confirm', async () => {
    const { api } = electricalOpen()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await focusRow('S-05')
    await waitFor(() => expect(bodyText()).toContain('S-05 is confirmed by Nusrat Jahan'))
    expect(nextOpenItem()).not.toBeNull()
    expect(bodyText()).not.toContain(STEP1_CONFIRMED)
  })
})
