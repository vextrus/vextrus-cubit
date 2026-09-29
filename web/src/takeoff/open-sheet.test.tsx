/*
 * Step 1 opened on one printed sheet by its address (#118's "Open in Step 1"): `?sheet=<id>` opens it in
 * sheet mode; an id Step 1 does not list opens the list.
 */
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
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
