/*
 * Ticket S16-W1's acceptance test, Step 4 (Grid) at `/p/$code/takeoff/4`, on session 16's contract
 * fixture. The brief's showing script: "grid lines, Space opens a view, Enter confirms, each line's
 * Trace on the sheet".
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeFrame, SHEET_GRID, bodyText, namedIds } from './frame.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

async function open() {
  const api = new FakeApi()
  const frame = new FakeFrame(api)
  await mountApp('/p/KR-01/takeoff/4', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('A–B'), { timeout: 5000 })
  return frame
}

const canvas = () => document.querySelector<HTMLElement>('[data-region="canvas"]')!

describe('Step 4, the grid', () => {
  it('lists the grid lines by their labels, verbatim', async () => {
    const frame = await open()
    await waitFor(() => expect(frame.calls().some((c) => c.call.startsWith('GET steps/grid/proposals'))).toBe(true))
    for (const label of ['A–B', '1–2']) expect(within(canvas()).getAllByText(label, { exact: false }).length).toBeGreaterThan(0)
  })

  it('Enter confirms the focused group with its proposals', async () => {
    const frame = await open()
    await userEvent.click(within(canvas()).getAllByText('A–B', { exact: false })[0]!)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(frame.acts().length).toBeGreaterThan(0))
    const act = frame.acts()[0]!
    expect(act.act).toBe('confirm')
    expect(act.step).toBe('grid')
    expect(namedIds(act, frame.groups.grid)).toEqual(frame.groups.grid[0]!.proposals.map((p) => p.id).sort())
  })

  it('Space opens the line’s view on its sheet (the Trace’s sheet is drawn)', async () => {
    const frame = await open()
    await userEvent.click(within(canvas()).getAllByText('A–B', { exact: false })[0]!)
    await userEvent.keyboard(' ')
    await waitFor(() => expect(frame.calls().some((c) => c.call === `GET /drawings/sheets/${SHEET_GRID}/render`)).toBe(true), { timeout: 5000 })
    expect(frame.acts(), 'Space confirms nothing').toEqual([])
  })

  it('the inspector names the Trace of the focused line', async () => {
    await open()
    await userEvent.click(within(canvas()).getAllByText('A–B', { exact: false })[0]!)
    const inspector = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-region="inspector"]')
      expect(el).not.toBeNull()
      return el!
    })
    await waitFor(() => expect(within(inspector).getAllByRole('button', { name: /Trace/ }).length).toBeGreaterThan(0))
  })

  it('with nothing read, shows no rows and posts nothing on Enter', async () => {
    const api = new FakeApi()
    const frame = new FakeFrame(api, { empty: true })
    await mountApp('/p/KR-01/takeoff/4', { as: PEOPLE.qs, api })
    await waitFor(() => expect(frame.calls().some((c) => c.call.startsWith('GET steps/grid/proposals')), 'the screen reads the grid proposals').toBe(true), { timeout: 5000 })
    await userEvent.keyboard('{Enter}')
    expect(frame.acts()).toEqual([])
    expect(within(canvas()).queryAllByRole('row').length + within(canvas()).queryAllByRole('option').length, 'no rows').toBe(0)
  })
})
