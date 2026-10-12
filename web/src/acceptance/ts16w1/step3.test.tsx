/*
 * Ticket S16-W1's acceptance test, Step 3 (Storeys and levels) at `/p/$code/takeoff/3`, on session 16's
 * contract fixture (frame.fixture.ts). The brief's showing script: "storeys low to high, 'levels typed,
 * not read', fix a view's storeys, accept or type heights, Enter".
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeFrame, bodyText, clean, namedIds } from './frame.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

async function open() {
  const api = new FakeApi()
  const frame = new FakeFrame(api)
  await mountApp('/p/KR-01/takeoff/3', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Basement'), { timeout: 5000 })
  return frame
}

const canvas = () => document.querySelector<HTMLElement>('[data-region="canvas"]')!

describe('Step 3, storeys and levels', () => {
  it('lists the storeys low to high', async () => {
    await open()
    const text = clean(canvas().textContent)
    const at = ['Basement', 'Ground', '1st', '2nd', '3rd'].map((n) => text.indexOf(n))
    expect(at.every((i) => i >= 0), `every storey shown: ${at.join(', ')}`).toBe(true)
    expect([...at].sort((a, b) => a - b), 'storeys low to high').toEqual(at)
  })

  it('says "levels typed, not read"', async () => {
    await open()
    expect(bodyText()).toContain('levels typed, not read')
  })

  it('typing a storey’s level and Enter puts the typed level for that storey', async () => {
    const frame = await open()
    const first = frame.storeys.find((s) => s.name === '1st')!
    const fields = [...within(canvas()).queryAllByRole('textbox', { name: /1st/ }), ...within(canvas()).queryAllByRole('spinbutton', { name: /1st/ })]
    expect(fields.length, 'one level field named for the 1st storey').toBe(1)
    const field = fields[0] as HTMLInputElement
    await userEvent.clear(field)
    await userEvent.type(field, '3.5{Enter}')
    await waitFor(() => expect(frame.calls().some((c) => c.call === 'PUT storeys/levels')).toBe(true))
    const put = frame.calls().find((c) => c.call === 'PUT storeys/levels')!.body as { levels: { storey_id: string; level_m: unknown }[] }
    const level = put.levels.find((l) => l.storey_id === first.id)
    expect(level, 'the 1st storey’s level is put').toBeDefined()
    expect(Number(level!.level_m)).toBe(3.5)
  })

  it('fixing a view’s storeys puts the view’s placement', async () => {
    const frame = await open()
    const ground = frame.storeys.find((s) => s.name === 'Ground')!
    // The view on S-03 is placed on Ground..3rd; the QS takes Ground off it.
    const sheetRow = await waitFor(() => {
      const el = within(canvas()).getAllByText((_, node) => !!node && clean(node.textContent).startsWith('S-03') && node.children.length === 0)[0]
      expect(el).toBeDefined()
      return el!
    })
    await userEvent.click(sheetRow)
    const toggle = within(canvas()).getAllByRole('checkbox', { name: /Ground/ })[0]!
    await userEvent.click(toggle)
    await waitFor(() => expect(frame.calls().some((c) => c.call.startsWith('PUT view-placements/'))).toBe(true))
    const put = frame.calls().find((c) => c.call.startsWith('PUT view-placements/'))!
    expect((put.body as { storey_ids: string[] }).storey_ids).not.toContain(ground.id)
  })

  it('Enter confirms the storeys with the group’s proposals', async () => {
    const frame = await open()
    await userEvent.click(within(canvas()).getAllByText('Basement')[0]!)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(frame.acts().length).toBeGreaterThan(0))
    const act = frame.acts()[0]!
    expect(act.act).toBe('confirm')
    expect(act.step).toBe('storeys')
    const group = frame.groups.storeys[0]!
    expect(namedIds(act, frame.groups.storeys)).toEqual(group.proposals.map((p) => p.id).sort())
  })

  it('with nothing read, reads the storeys, shows no rows and posts nothing on Enter', async () => {
    const api = new FakeApi()
    const frame = new FakeFrame(api, { empty: true })
    await mountApp('/p/KR-01/takeoff/3', { as: PEOPLE.qs, api })
    await waitFor(() => expect(frame.calls().some((c) => c.call === 'GET storeys'), 'the screen reads GET storeys').toBe(true), { timeout: 5000 })
    await userEvent.keyboard('{Enter}')
    expect(frame.acts()).toEqual([])
    expect(within(canvas()).queryAllByRole('row').length + within(canvas()).queryAllByRole('option').length, 'no rows').toBe(0)
  })
})
