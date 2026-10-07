/*
 * The Priced BOQ and Market Prices beyond the acceptance tests (ticket S16-W3): the keys (m0-screens §2,
 * §8 item 2), the read-only roles, a refused number, the Trace's address and the words a QS reads
 * (§1.1: no message code, none of 1.1's forbidden words) on the acceptance fake's figures.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { BUILDING_ID, FakeBoq, clean } from '@/acceptance/ts16w3/boq.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound } from '@/ui'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const bodyText = () => clean(document.body.textContent)

async function open(path: string, as: string = PEOPLE.qs) {
  const api = new FakeApi()
  const boq = new FakeBoq(api)
  const mounted = await mountApp(path, { as, api })
  return { ...mounted, boq }
}

const rowItem = (code: string) => document.querySelector<HTMLElement>(`tr[data-item="${code}"]`)!

describe('the Priced BOQ, keys', () => {
  it('moves between BOQ Items by arrow, Enter opens the Measurement Lines, F2 the Rate Analysis, Esc closes', async () => {
    const { keyMap, boq } = await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    expectKeyMapSound(keyMap)
    rowItem('RCC-COL-1:1.5:3').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rowItem('FW-COL'))
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(rowItem('REBAR-500W'))
    await userEvent.keyboard('{Home}{Enter}')
    await waitFor(() => expect(boq.calls()).toContain('GET boq/items/RCC-COL-1:1.5:3/lines'))
    expect(await screen.findByRole('heading', { name: 'Measurement Lines' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Measurement Lines' })).toBeNull())
    expect(document.activeElement).toBe(rowItem('RCC-COL-1:1.5:3'))
    await userEvent.keyboard('{F2}')
    expect(await screen.findByRole('heading', { name: 'Rate Analysis' })).toBeVisible()
    await waitFor(() => expect(boq.calls()).toContain('GET rates/RCC-COL-1:1.5:3'))
  })

  it('lists each of its keys in the keys overlay labelled', async () => {
    const { keyMap } = await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    const labels = keyMap.all().map((b) => b.label)
    for (const label of ['Previous BOQ Item', 'Next BOQ Item', 'Open the Measurement Lines', 'Open the Rate Analysis']) expect(labels).toContain(label)
  })
})

describe('the Priced BOQ, the strip', () => {
  it('shows the measured share: all of the total before allowances, a part of it once the Gross Floor Area is entered', async () => {
    await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    const share = () => clean(screen.getByText('Measured share').parentElement?.textContent)
    expect(share()).toContain('100%')
    await userEvent.click(screen.getByRole('textbox', { name: /Gross Floor Area/i }))
    await userEvent.keyboard('38400{Enter}')
    await waitFor(() => expect(share()).toContain('30%'))
    expect(bodyText()).toContain('1 BOQ Item has no rate yet')
  })
})

describe('the Priced BOQ, the Trace and the words', () => {
  it("links a Measurement Line's Trace to the sheet it was read on, in Step 1's viewer", async () => {
    await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    await userEvent.click(
      within(rowItem('RCC-COL-1:1.5:3')).getByRole('button', {
        name: /1,245\.37/,
      }),
    )
    const trace = await screen.findByRole('link', { name: /Trace\W*C1/ })
    expect(trace.getAttribute('href')).toMatch(/\/p\/KR-01\/takeoff\/1\?sheet=s-01$/)
  })

  it('shows no message code and none of the words the QS never reads', async () => {
    await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    const text = bodyText()
    expect(text).not.toMatch(/boq\.item\.|rates\./)
    expect(text).not.toMatch(/\b(undefined|NaN|null|JSON|UUID|API)\b/)
  })
})

describe('roles and refusals', () => {
  it('lets the MD look at the Priced BOQ and Market Prices but not change them', async () => {
    await open('/p/KR-01/boq', PEOPLE.md)
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    expect(screen.queryByRole('textbox', { name: /Gross Floor Area/i })).toBeNull()
    expect(bodyText()).toContain('Gross Floor Area not entered')
  })

  it('offers no price field to the MD', async () => {
    await open('/p/KR-01/prices', PEOPLE.md)
    await waitFor(() => expect(bodyText()).toContain('Rebar, Grade 500W'))
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('refuses a Gross Floor Area that is not a number before asking the API', async () => {
    const { boq } = await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    await userEvent.click(screen.getByRole('textbox', { name: /Gross Floor Area/i }))
    await userEvent.keyboard('about 38k{Enter}')
    expect(await screen.findByText('Type the area as a number, like 38400.')).toBeVisible()
    expect(boq.calls().some((c) => c.startsWith('PUT'))).toBe(false)
    expect(BUILDING_ID).toBeTruthy()
  })

  it('refuses a price that is not a number before asking the API', async () => {
    const { boq } = await open('/p/KR-01/prices')
    await waitFor(() => expect(bodyText()).toContain('Rebar, Grade 500W'))
    const field = screen.getAllByRole('textbox')[0]!
    await userEvent.type(field, 'ninety{Enter}')
    expect(await screen.findByText('Type the price as a number, like 95.00.')).toBeVisible()
    expect(boq.calls().some((c) => c.startsWith('PUT'))).toBe(false)
  })
})
