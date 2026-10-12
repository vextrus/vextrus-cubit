/*
 * S16-W3's acceptance test, the Priced BOQ (`/p/$code/boq`). The ticket's finish: "quantity × rate =
 * amount on every row; 'rate not entered' shown; money in ৳ with lakh grouping; §8 keys"; the showing
 * script: type the Gross Floor Area, Enter, a whole-building ৳ figure and every step's allowance line
 * "Vextrus default, Low"; Rebar marked "by ratio"; a quantity opens its Measurement Lines; a rate opens
 * its Rate Analysis with PWD SoR 2022 (Dhaka) page refs. Data: ./boq.fixture.ts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { BUILDING_ID, FakeBoq, PWD_REF_RATE, clean, shows, times } from './boq.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const bodyText = () => clean(document.body.textContent)

async function openBoq() {
  const api = new FakeApi()
  const boq = new FakeBoq(api)
  const mounted = await mountApp('/p/KR-01/boq', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('2.1.1'))
  return { ...mounted, boq }
}

/** The row (a grid or table row) that carries the BOQ Item's number. */
function rowOf(number: string): HTMLElement {
  const cell = [...document.querySelectorAll<HTMLElement>('body *')].find((el) => clean(el.textContent) === number && el.children.length === 0)
  const row = cell?.closest<HTMLElement>('[role="row"], tr')
  if (!row) throw new Error(`no row carries the BOQ Item number ${number}`)
  return row
}

/** Every ৳ figure in a text, as decimal strings without grouping. */
const takas = (text: string) => [...text.matchAll(/৳\s?([\d,]+\.\d{2})/g)].map((m) => m[1]!.replace(/,/g, ''))

describe('the Priced BOQ', () => {
  it('shows money in ৳ with lakh grouping (৳6,38,127.59)', async () => {
    await openBoq()
    expect(clean(rowOf('2.1.1').textContent)).toContain('৳6,38,127.59')
  })

  it('shows on every priced row a quantity × rate equal to its amount', async () => {
    await openBoq()
    const rows: [string, RegExp, string][] = [
      ['2.1.1', /^1,245\.37$/, '1245.37'],
      ['2.1.3', /^18,450(?:\.00)?$/, '18450'],
    ]
    for (const [number, quantityShown, quantity] of rows) {
      const row = rowOf(number)
      const text = clean(row.textContent)
      expect(shows(row, quantityShown), `row ${number} shows its quantity`).toBe(true)
      const figures = takas(text)
      expect(figures.length, `row ${number} shows a rate and an amount in ৳: "${text}"`).toBeGreaterThanOrEqual(2)
      const [rate, amount] = [figures[0]!, figures[figures.length - 1]!]
      expect(times(quantity, rate), `row ${number}: ${quantity} × ৳${rate}`).toBe(amount)
    }
  })

  it('shows "rate not entered" for an unpriced BOQ Item, never ৳0', async () => {
    await openBoq()
    const text = clean(rowOf('2.1.2').textContent)
    expect(text).toContain('rate not entered')
    expect(text).not.toMatch(/৳\s?0\.00/)
  })

  it('marks Rebar measured by ratio "by ratio"', async () => {
    await openBoq()
    expect(clean(rowOf('2.1.3').textContent)).toContain('by ratio')
    expect(clean(rowOf('2.1.1').textContent)).not.toContain('by ratio')
  })

  it('puts the Gross Floor Area typed and Enter to the Building, and shows the whole-building figure with each allowance line "Vextrus default, Low"', async () => {
    const { boq } = await openBoq()
    expect(bodyText()).not.toContain('Vextrus default, Low')
    const field = screen.getByRole('textbox', { name: /Gross Floor Area/i })
    await userEvent.click(field)
    await userEvent.keyboard('38400{Enter}')
    await waitFor(() => expect(boq.calls()).toContain(`PUT buildings/${BUILDING_ID}/gross-floor-area`))
    const put = boq.seen.find((s) => s.call === `PUT buildings/${BUILDING_ID}/gross-floor-area`)!
    const body = put.body as { value: unknown; unit: unknown }
    expect(Number(body.value)).toBe(38400)
    expect(body.unit).toBe('sft')
    // measured ৳23,90,877.59 + allowances ৳24,00,000.00 and ৳31,20,000.00
    await waitFor(() => expect(bodyText()).toContain('৳79,10,877.59'))
    const allowanceLines = bodyText().split('Vextrus default, Low').length - 1
    expect(allowanceLines, 'one "Vextrus default, Low" per allowance line').toBeGreaterThanOrEqual(2)
  })

  it('opens a quantity\'s Measurement Lines when the quantity is chosen', async () => {
    const { boq } = await openBoq()
    await userEvent.click(within(rowOf('2.1.1')).getByRole('button', { name: /1,245\.37/ }))
    await waitFor(() => expect(boq.calls()).toContain('GET boq/items/RCC-COL-1:1.5:3/lines'))
    await waitFor(() => {
      expect(bodyText()).toContain('704.12')
      expect(bodyText()).toContain('541.25')
    })
  })

  it('opens a rate\'s Rate Analysis with its PWD SoR 2022 (Dhaka) page refs when the rate is chosen', async () => {
    const { boq } = await openBoq()
    await userEvent.click(within(rowOf('2.1.1')).getByRole('button', { name: /512\.40/ }))
    await waitFor(() => expect(boq.calls()).toContain('GET rates/RCC-COL-1:1.5:3'))
    await waitFor(() => expect(bodyText()).toContain(PWD_REF_RATE))
    expect(bodyText()).toContain('PWD SoR 2022 (Dhaka), p. 130')
  })

  it('has Project nav entries "Priced BOQ" and "Market Prices"', async () => {
    await openBoq()
    const nav = screen.getByRole('navigation', { name: 'Project' })
    expect(within(nav).getByRole('link', { name: 'Priced BOQ' }).getAttribute('href')).toMatch(/\/p\/KR-01\/boq$/)
    expect(within(nav).getByRole('link', { name: 'Market Prices' }).getAttribute('href')).toMatch(/\/p\/KR-01\/prices$/)
  })

  it('reaches the Gross Floor Area and a quantity by Tab, each with a visible focus ring', async () => {
    await openBoq()
    const field = screen.getByRole('textbox', { name: /Gross Floor Area/i })
    const quantity = within(rowOf('2.1.1')).getByRole('button', { name: /1,245\.37/ })
    ;(document.activeElement as HTMLElement | null)?.blur()
    const reached = new Set<Element>()
    for (let i = 0; i < 80 && !(reached.has(field) && reached.has(quantity)); i += 1) {
      await userEvent.tab()
      const el = document.activeElement
      if (el === field || el === quantity) {
        reached.add(el)
        const style = getComputedStyle(el)
        const ring = (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none'
        expect(ring, `a visible focus ring on ${el === field ? 'the Gross Floor Area' : 'the quantity'}`).toBe(true)
      }
    }
    expect(reached.has(field), 'Tab reaches the Gross Floor Area').toBe(true)
    expect(reached.has(quantity), 'Tab reaches the quantity').toBe(true)
  })
})
