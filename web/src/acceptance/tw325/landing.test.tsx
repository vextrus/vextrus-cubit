/*
 * Ticket T-W325's acceptance tests (#328): after "Create project" the QS lands on the new project's
 * Drawing Set, in its empty state (docs/design/m0-screens.md §4.3: "After create: straight to its
 * Drawing Set (empty state)"), and a row of the Projects list still opens Step 1. Through the in-memory
 * API with readings.fixture.ts laid over it (it answers an empty Drawing Set for a project it has no
 * data for). Every name and number is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeReadings, aRow, cellOf, cellText, clean, files, listbox, rowOf, rows } from './readings.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-29T08:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

async function projects(api: FakeApi, as: string = PEOPLE.qs) {
  const app = await mountApp('/projects', { as, api })
  await screen.findByRole('heading', { name: 'Projects' })
  return app
}

describe('after "Create project" (#328)', () => {
  it.each([
    ['the QS', PEOPLE.qs],
    ['the Vextrus Engineer', PEOPLE.engineer],
  ])('takes %s straight to the new project’s empty Drawing Set, the request unchanged', async (_, as) => {
    const api = new FakeApi()
    const readings = new FakeReadings(api)
    const { router } = await projects(api, as)
    const header = screen.getByRole('heading', { name: 'Projects' }).closest('header')!
    await userEvent.click(within(header).getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog', { name: 'New project' })
    await waitFor(() => expect(within(dialog).getByLabelText('Name')).toBeVisible())
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Jarul Mahal')
    await userEvent.type(within(dialog).getByLabelText('Code'), 'JM-07')
    await userEvent.type(within(dialog).getByLabelText('Address'), 'Holding 41, Lane 6, Dhaka')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/JM-07/drawing-set'))
    expect(readings.created).toEqual([
      {
        name: 'Jarul Mahal',
        code: 'JM-07',
        address: 'Holding 41, Lane 6, Dhaka',
        unit_system: 'imperial',
      },
    ])
    expect(await screen.findByRole('heading', { name: 'Drawing Set' })).toBeVisible()
    await waitFor(() => expect(clean(document.body.textContent)).toContain('No drawings yet.'))
    expect(readings.count('files', 'JM-07')).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New project' })).toBeNull())
  })
})

describe('a row still opens Step 1 (§4.3; guards the landing change)', () => {
  function filled() {
    const api = new FakeApi()
    const readings = new FakeReadings(api)
    readings.setFiles('SG-03', files(3, 'read'))
    readings.setProgress('SG-03', [aRow('architectural', { found: 5, confirmed: 2 })])
    readings.setFiles('BP-02', files(1, 'read'))
    return api
  }

  it('opens the focused project’s Step 1 with Enter', async () => {
    const { router } = await projects(filled())
    await waitFor(() => expect(rows()).toHaveLength(3))
    listbox().focus()
    await userEvent.keyboard('{End}')
    expect(rows()[2]).toHaveAttribute('data-focused')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/SG-03/takeoff/1'))
  })

  it.each(['Drawing Set', 'Takeoff', 'Updated'] as const)('opens a project’s Step 1 with a click on its %s cell', async (column) => {
    const { router } = await projects(filled())
    await waitFor(() => expect(rows()).toHaveLength(3))
    // Whatever the cell shows by the time it is clicked, the row opens Step 1.
    await waitFor(() => expect(cellText('SG-03', column)).not.toBe(''))
    await userEvent.click(cellOf(rowOf('SG-03'), column))
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/SG-03/takeoff/1'))
  })
})
