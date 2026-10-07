/*
 * S16-W3's acceptance test, Market Prices (`/p/$code/prices`). The showing script: "Market Prices: edit
 * the rebar price, back to BOQ, rates and amounts move, quantities do not". The contract: an empty price
 * shows "rate not entered"; `PUT /api/projects/{project_id}/prices/{resource_code} {amount}`; every
 * price cites its PWD SoR 2022 (Dhaka) page. Data: ./boq.fixture.ts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeBoq, PWD_REF_PRICE, clean, shows } from './boq.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const bodyText = () => clean(document.body.textContent)

function rowWith(text: string): HTMLElement {
  const cell = [...document.querySelectorAll<HTMLElement>('body *')].find((el) => clean(el.textContent) === text && el.children.length === 0)
  const row = cell?.closest<HTMLElement>('[role="row"], tr')
  if (!row) throw new Error(`no row carries "${text}"`)
  return row
}

async function openPrices() {
  const api = new FakeApi()
  const boq = new FakeBoq(api)
  const mounted = await mountApp('/p/KR-01/prices', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Rebar, Grade 500W'))
  return { ...mounted, boq }
}

describe('Market Prices', () => {
  it('shows each price in ৳ with its PWD SoR 2022 (Dhaka) page ref', async () => {
    await openPrices()
    const text = clean(rowWith('Rebar, Grade 500W').textContent)
    expect(text).toContain('৳95.00')
    expect(text).toContain(PWD_REF_PRICE)
  })

  it('shows "rate not entered" for a Resource with no price, never ৳0', async () => {
    await openPrices()
    const text = clean(rowWith('Shutter hire').textContent)
    expect(text).toContain('rate not entered')
    expect(text).not.toMatch(/৳\s?0\.00/)
  })

  it('puts an edited Rebar price, and the Priced BOQ moves its rate and amount but not its quantity', async () => {
    const { boq } = await openPrices()
    const field = within(rowWith('Rebar, Grade 500W')).getByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, '100.00{Enter}')
    await waitFor(() => expect(boq.calls()).toContain('PUT prices/rebar_500w'))
    const put = boq.seen.find((s) => s.call === 'PUT prices/rebar_500w')!
    expect(Number((put.body as { amount: unknown }).amount)).toBe(100)

    const nav = screen.getByRole('navigation', { name: 'Project' })
    await userEvent.click(within(nav).getByRole('link', { name: 'Priced BOQ' }))
    await waitFor(() => expect(bodyText()).toContain('2.1.3'))
    const fetches = boq.calls().filter((c) => c === 'GET boq')
    expect(fetches.length, 'the Priced BOQ read after the price edit').toBeGreaterThanOrEqual(1)
    const putAt = boq.calls().indexOf('PUT prices/rebar_500w')
    expect(boq.calls().lastIndexOf('GET boq')).toBeGreaterThan(putAt)
    await waitFor(() => {
      const row = clean(rowWith('2.1.3').textContent)
      expect(row).toContain('৳100.00')
      expect(row).toContain('৳18,45,000.00')
      expect(shows(rowWith('2.1.3'), /^18,450(?:\.00)?$/), 'the quantity unmoved').toBe(true)
      expect(row).not.toContain('৳17,52,750.00')
    })
  })
})
