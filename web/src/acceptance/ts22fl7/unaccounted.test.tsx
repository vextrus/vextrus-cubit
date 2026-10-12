/*
 * Ticket S22-FL7's acceptance tests (G1 blocker M0-FL7, #657, #335): the Coverage panel's "Unaccounted"
 * list. m0-screens §6.11: the Coverage panel shows "Unaccounted" (each "S-20 8th floor beam layout", in
 * amber), from Coverage's `unaccounted_views` (`Step1CoverageOut`: each view's Proposal `id`, its
 * `view_id` and its `sheet_id`). Each entry opens its sheet with that view selected (the ticket). Run at
 * /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts); every title is invented.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

const view = (id: string, ordinal: number, kind: string, title: string, steps: string[], box: string[]) => ({
  id,
  ordinal,
  kind,
  title,
  stated_scale: '',
  not_to_scale: true,
  storeys: [],
  storeys_as_stated: '',
  storeys_meaning: null,
  steps,
  part: null,
  proposed_exclusion: null,
  decision: null,
  excluded_reason: null,
  box,
})

const S05 = [view('fl7-s05-plan', 1, 'plan', 'BEAM LAYOUT ZQ', ['beams'], ['10', '10', '60', '50']), view('fl7-s05-sec', 2, 'section', 'SECTION ZQ-9', [], ['70', '10', '90', '30'])]
const S10 = [view('fl7-s10-plan', 1, 'plan', 'STAIR PLAN ZQ', ['stairs'], ['10', '10', '60', '50']), view('fl7-s10-dtl', 2, 'detail', 'DETAIL ZQ-C', [], ['70', '10', '90', '30'])]

/** KR-01 with S-05's section and S-10's detail unaccounted (`unaccounted` 2, as t22's Coverage has). */
function kr01(unaccounted: boolean): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const s05 = step1.proposals.find((p) => p.number === 'S-05')!
  const s10 = step1.proposals.find((p) => p.number === 'S-10')!
  Object.assign(s05, { views: S05 })
  Object.assign(s10, { views: S10 })
  const views = unaccounted
    ? [
        { id: 'fl7-p-s05-sec', view_id: 'fl7-s05-sec', sheet_id: s05.sheet_id },
        { id: 'fl7-p-s10-dtl', view_id: 'fl7-s10-dtl', sheet_id: s10.sheet_id },
      ]
    : []
  Object.assign(step1, { coverage: { ...step1.coverage, unaccounted: views.length, unaccounted_views: views, unread_sheets: 0 } })
  return api
}

async function openCoverage(api: FakeApi) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  const bar = screen.getAllByRole('button').find((b) => clean(b.textContent).startsWith('Coverage 70 views'))
  expect(bar, 'the status bar’s Coverage').toBeDefined()
  await userEvent.click(bar!)
  await screen.findByText('Coverage, every view on every sheet read')
}

/** The "Unaccounted" list's entries: what a click or Enter opens (buttons or links) under its heading. */
function entries(): HTMLElement[] {
  const heading = screen.getByRole('heading', { name: 'Unaccounted' })
  const list = heading.closest('section') ?? heading.parentElement!
  return [...list.querySelectorAll<HTMLElement>('button, a[href]')]
}

const selected = () => document.querySelector('[data-outline][aria-pressed="true"]')?.getAttribute('data-outline') ?? null

describe('m0-screens §6.11: the Coverage panel’s "Unaccounted" list', () => {
  it('lists the 2 unaccounted views under "Unaccounted", each by its sheet’s number and its title', async () => {
    await openCoverage(kr01(true))
    await screen.findByRole('heading', { name: 'Unaccounted' })
    const found = entries().map((e) => clean(e.textContent).toLowerCase())
    expect(found).toHaveLength(2)
    expect(found[0]).toContain('s-05')
    expect(found[0]).toContain('section zq-9')
    expect(found[1]).toContain('s-10')
    expect(found[1]).toContain('detail zq-c')
  })

  it('opens S-05 with its unaccounted section selected', async () => {
    await openCoverage(kr01(true))
    await screen.findByRole('heading', { name: 'Unaccounted' })
    await userEvent.click(entries()[0]!)
    await screen.findByRole('group', { name: /S-05/ })
    await waitFor(() => expect(selected()).toBe('fl7-s05-sec'))
  })

  it('opens S-10 with its unaccounted detail selected', async () => {
    await openCoverage(kr01(true))
    await screen.findByRole('heading', { name: 'Unaccounted' })
    await userEvent.click(entries()[1]!)
    await screen.findByRole('group', { name: /S-10/ })
    await waitFor(() => expect(selected()).toBe('fl7-s10-dtl'))
  })

  it('shows no "Unaccounted" list when no view is unaccounted', async () => {
    await openCoverage(kr01(false))
    expect(screen.queryByRole('heading', { name: 'Unaccounted' })).toBeNull()
  })
})
