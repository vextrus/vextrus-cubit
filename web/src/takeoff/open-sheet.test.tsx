/*
 * Step 1 opened on one printed sheet by its address (#118's "Open in Step 1"): `?sheet=<id>` opens it in
 * sheet mode; an id Step 1 does not list opens the list.
 */
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { step1SheetPath } from './paths'

describe('Step 1 at one sheet', () => {
  it('opens the sheet the address names', async () => {
    await page.viewport(1440, 900)
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const s02 = step1.proposals.find((p) => p.number === 'S-02')!
    await mountApp(step1SheetPath('KR-01', s02.sheet_id), { as: PEOPLE.qs, api })
    expect(await screen.findByRole('group', { name: /Sheet\s*⁨?S-02⁩?/ })).toBeVisible()
    expect(step1.calls()).toContain(`GET /drawings/sheets/${s02.sheet_id}/render`)
  })

  it('opens the list for a sheet it does not list', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp(step1SheetPath('KR-01', '00000000-0000-4000-8000-000000000000'), { as: PEOPLE.qs, api })
    await waitFor(() => expect(screen.getByRole('grid', { name: 'Sheets' })).toBeVisible())
    expect(screen.queryByRole('group', { name: /^Sheet/ })).toBeNull()
  })
})

describe('#115: a sheet image that fails again after Try again', () => {
  it('keeps focus in the sheet region, on Try again, never on the page', async () => {
    await page.viewport(1440, 900)
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const s02 = step1.proposals.find((p) => p.number === 'S-02')!
    // The sheet's render answers 503 every time (the walk forced it): the retry fails too.
    let renders = 0
    const served = api.handle
    api.handle = async (request: Request) => {
      if (new URL(request.url, location.origin).pathname.endsWith('/render')) {
        renders++
        return new Response('unavailable', { status: 503 })
      }
      return served(request)
    }
    await mountApp(step1SheetPath('KR-01', s02.sheet_id), { as: PEOPLE.qs, api })
    const first = await screen.findByRole('button', { name: 'Try again' })
    const before = renders
    first.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(renders).toBeGreaterThan(before))
    const again = await screen.findByRole('button', { name: 'Try again' })
    await waitFor(() => expect(document.activeElement).toBe(again))
    const region = again.closest('[data-region-focus]')!
    expect(region).not.toBeNull()
    expect(region.contains(document.activeElement)).toBe(true)
    // Enter on it tries again from there, without a click.
    const tried = renders
    expect(document.activeElement).toBe(again)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(renders).toBeGreaterThan(tried))
  })
})

