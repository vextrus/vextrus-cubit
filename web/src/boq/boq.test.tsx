/*
 * The Priced BOQ and Market Prices beyond the acceptance tests (ticket S16-W3): the keys (m0-screens §2,
 * §8 item 2), the read-only roles, a refused number, the Trace's address and the words a QS reads
 * (§1.1: no message code, none of 1.1's forbidden words) on the acceptance fake's figures.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
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
    const share = () => clean(screen.getByText('Measured share of the total').parentElement?.textContent)
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
    expect(await screen.findByText('Type the price as a number above zero, like 95.00.')).toBeVisible()
    expect(boq.calls().some((c) => c.startsWith('PUT'))).toBe(false)
  })
})

type Row = Record<string, unknown>
interface Loose {
  allowances: Row[]
  sections: { groups: { items: Row[] }[] }[]
}

/** Lays a change over the BOQ's answer and a Rebar item's Measurement Lines, as the API would send them. */
function patchBoq(api: FakeApi, change: (boq: Loose) => void) {
  const served = api.handle
  api.handle = async (request: Request) => {
    const path = decodeURIComponent(new URL(request.url, location.origin).pathname)
    if (request.method === 'GET' && path.endsWith('/boq/items/REBAR-500W/lines'))
      return Response.json({
        lines: [
          { id: 'line-r1', item_code: 'REBAR-500W', element_id: 'e-c1', mark: 'C1', storey: 'floor_1', quantity: '704.37', billing_unit: 'kg', trace: [] },
          { id: 'line-r2', item_code: 'REBAR-500W', element_id: 'e-c2', mark: 'C2', storey: 'basement_1', quantity: '17745.63', billing_unit: 'kg', trace: [] },
        ],
      })
    const answer = await served(request)
    if (request.method === 'GET' && path.endsWith('/boq')) {
      const body = await answer.clone().json()
      change(body)
      return Response.json(body)
    }
    return answer
  }
}

describe("the Priced BOQ, the design gate's words", () => {
  it("words every BOQ Item's description and never falls back to the sentence for an unworded code", async () => {
    await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    expect(clean(rowItem('RCC-COL-1:1.5:3').textContent)).toContain('RCC 1:1.5:3 (25 MPa) in columns')
    expect(clean(rowItem('FW-COL').textContent)).toContain('Formwork to columns')
    expect(clean(rowItem('REBAR-500W').textContent)).toContain('Rebar, Grade 500W, in columns')
    expect(bodyText()).not.toContain('no words for it yet')
  })

  it('shows a Rebar Measurement Line to two places of a kilogram and its storey in words', async () => {
    const api = new FakeApi()
    new FakeBoq(api)
    patchBoq(api, () => {})
    await mountApp('/p/KR-01/boq', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('2.1.3'))
    await userEvent.click(within(rowItem('REBAR-500W')).getByRole('button', { name: /18,450/ }))
    await waitFor(() => expect(bodyText()).toContain('704.37 kg'))
    expect(bodyText()).toContain('17,745.63 kg')
    expect(bodyText()).not.toMatch(/floor_1|basement_1/)
    expect(bodyText()).toContain('1st')
  })

  it('names the part of a step an allowance is for, so Foundations is not shown twice alike', async () => {
    const api = new FakeApi()
    const boq = new FakeBoq(api)
    boq.gfa = '38400'
    patchBoq(api, (body) => {
      const first = body.allowances[0]!
      body.allowances = [
        { ...first, step: 'foundations', part: 'piles_caps' },
        { ...first, step: 'foundations', part: 'rest' },
      ]
    })
    await mountApp('/p/KR-01/boq', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Vextrus default, Low'))
    const rows = [...document.querySelectorAll('table[aria-label="Allowances"] tr')].map((r) => clean(r.textContent))
    expect(rows[0]).toContain('Foundations, piles and pile caps')
    expect(rows[1]).toContain('Foundations, the rest')
  })

  it('says all three Rebar Bases, and an awaiting quantity with its unit', async () => {
    const api = new FakeApi()
    new FakeBoq(api)
    patchBoq(api, (body) => {
      const [concrete, formwork, rebar] = body.sections[0]!.groups[0]!.items as [Row, Row, Row]
      formwork.rebar_basis = 'from_drawing'
      rebar.rebar_basis = 'from_drawing_rules'
      concrete.awaiting_answer = { quantity: '12.50', amount: null }
    })
    await mountApp('/p/KR-01/boq', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    expect(clean(rowItem('FW-COL').textContent)).toContain('from the drawing')
    expect(clean(rowItem('REBAR-500W').textContent)).toContain('from the drawing + rules')
    expect(clean(rowItem('RCC-COL-1:1.5:3').textContent)).toContain('+ 12.50 cft waiting on a Question')
  })

  it('asks for the Gross Floor Area in one line while the Allowance and the total per area are blank, and stops asking once it is entered', async () => {
    await open('/p/KR-01/boq')
    await waitFor(() => expect(bodyText()).toContain('2.1.1'))
    const ask = 'Enter the Gross Floor Area above to see the allowances and the total per area.'
    expect(bodyText()).toContain(ask)
    await userEvent.click(screen.getByRole('textbox', { name: /Gross Floor Area/i }))
    await userEvent.keyboard('38400{Enter}')
    await waitFor(() => expect(bodyText()).not.toContain(ask))
  })
})

describe('Market Prices, what a price may be and who hears of it', () => {
  it('refuses zero and a decimal comma before asking the API', async () => {
    const { boq } = await open('/p/KR-01/prices')
    await waitFor(() => expect(bodyText()).toContain('Rebar, Grade 500W'))
    const field = screen.getAllByRole('textbox')[0]!
    for (const typed of ['0', '95,50']) {
      await userEvent.clear(field)
      await userEvent.type(field, `${typed}{Enter}`)
      expect(await screen.findByText('Type the price as a number above zero, like 95.00.')).toBeVisible()
    }
    expect(boq.calls().some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('says nothing of a price saved when the session ended while the answer was on its way', async () => {
    const api = new FakeApi()
    new FakeBoq(api)
    await mountApp('/p/KR-01/prices', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Rebar, Grade 500W'))
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let held = 0
    setTransport(async (request) => {
      const answer = await api.handle(request)
      if (request.method !== 'PUT' || !request.url.includes('/prices/')) return answer
      held += 1
      await released
      return answer
    })
    const field = screen.getAllByRole('textbox')[0]!
    await userEvent.type(field, '100.00{Enter}')
    await waitFor(() => expect(held).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: (name) => /Nusrat Jahan, QS/.test(clean(name)) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    release()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(clean(document.body.textContent)).not.toContain('saved')
  })
})
