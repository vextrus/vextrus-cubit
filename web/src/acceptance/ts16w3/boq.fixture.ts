/*
 * S16-W3's acceptance fake: the Priced BOQ, its Measurement Lines, Rate Analyses, Market Prices and the
 * Gross Floor Area entry, as session 16's contract shapes them (`.private/work/session-16/contracts.md`,
 * "rates (RT)" and "boq (B) and projects GFA"; docs/plans/M1.md C13, C15), in memory, laid over the
 * seed's FakeApi for everything else. Every address is under `/api/projects/{project_id}/`.
 *
 * ONE field is chosen by the acceptance writer: `building_id` on the BOQ's answer. The contract's
 * gross-floor-area PUT needs the Building's id, the BOQ's shape does not carry it, and m0-screens §8.10
 * forbids a building picker; the builder adds it to `boq`'s answer (the report names it).
 *
 * The figures (M1.md C13's worked example and two more, each quantity × rate exact to the paisa):
 *   2.1.1 RCC-COL-1:1.5:3  1245.37 cft × ৳512.40 = ৳6,38,127.59 (measured)
 *   2.1.2 FW-COL           3120.50 sft, rate not entered (amount null)
 *   2.1.3 REBAR-500W       18450 kg by ratio × the Market Price of `rebar_500w` (৳95.00 → ৳17,52,750.00;
 *                          ৳100.00 → ৳18,45,000.00)
 * With no Gross Floor Area there is no allowance line; once one is entered, beams and slabs each carry a
 * Vextrus default allowance (৳24,00,000.00 and ৳31,20,000.00).
 */
import type { FakeApi } from '@/app/seed/api.fixture'

export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** Whether an element of the row shows exactly this text (a cell, a button, a span). */
export const shows = (row: HTMLElement, text: RegExp) => [...row.querySelectorAll<HTMLElement>('*')].some((el) => text.test(clean(el.textContent)))

export const BUILDING_ID = 'b5163000-0000-4000-8000-000000000001'
export const PWD_REF_RATE = 'PWD SoR 2022 (Dhaka), p. 47'
export const PWD_REF_PRICE = 'PWD SoR 2022 (Dhaka), p. 112'

const money = (amount: string) => ({ amount, currency: 'BDT' })
const paisa = (n: bigint) => `${n / 100n}.${String(n % 100n).padStart(2, '0')}`
/** Decimal strings to paisa (two places), exactly. */
const toPaisa = (s: string) => {
  const [whole, frac = ''] = s.split('.')
  return BigInt(whole!) * 100n + BigInt((frac + '00').slice(0, 2))
}
/** quantity × rate, rounded half up to the paisa, exactly. */
export function times(quantity: string, rate: string): string {
  const [qw, qf = ''] = quantity.split('.')
  const q = BigInt(qw! + qf)
  const scale = 10n ** BigInt(qf.length)
  const r = toPaisa(rate)
  const raw = q * r
  return paisa((raw * 2n + scale) / (scale * 2n))
}

export interface Seen {
  call: string
  body: unknown
}

export class FakeBoq {
  readonly projectId: string
  gfa: string | null = null
  rebarPrice = '95.00'
  readonly seen: Seen[] = []

  constructor(api: FakeApi, code = 'KR-01') {
    this.projectId = api.project(code).id
    const base = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const root = `/api/projects/${this.projectId}/`
      const path = decodeURIComponent(url.pathname)
      if (!path.startsWith(root)) return base(request)
      const rest = path.slice(root.length)
      const body = request.method === 'GET' ? null : await request.clone().json().catch(() => null)
      const answer = this.answer(request.method, rest, body)
      if (!answer) return base(request)
      this.seen.push({ call: `${request.method} ${rest}`, body })
      return new Response(JSON.stringify(answer[1]), { status: answer[0], headers: { 'Content-Type': 'application/json' } })
    }
  }

  calls(): string[] {
    return this.seen.map((s) => s.call)
  }

  items() {
    const rebarAmount = times('18450', this.rebarPrice)
    return [
      {
        number: '2.1.1', item_code: 'RCC-COL-1:1.5:3', section: 'super_structure', group: 'columns',
        description: { code: 'boq.item.rcc', params: { strength_mpa: '25', mix: '1:1.5:3', class: 'columns' } },
        billing_unit: 'cft', quantity: '1245.37', rate: money('512.40'), amount: money('638127.59'),
        cost_basis: 'measured', rebar_basis: null, rebar_from_drawing_share: null, awaiting_answer: null,
        by_storey: [{ storey: 'floor_1', quantity: '1245.37' }], trace: { lines: 2 },
      },
      {
        number: '2.1.2', item_code: 'FW-COL', section: 'super_structure', group: 'columns',
        description: { code: 'boq.item.formwork', params: { class: 'columns' } },
        billing_unit: 'sft', quantity: '3120.50', rate: null, amount: null,
        cost_basis: 'measured', rebar_basis: null, rebar_from_drawing_share: null, awaiting_answer: null,
        by_storey: [{ storey: 'floor_1', quantity: '3120.50' }], trace: { lines: 2 },
      },
      {
        number: '2.1.3', item_code: 'REBAR-500W', section: 'super_structure', group: 'columns',
        description: { code: 'boq.item.rebar', params: { grade: '500W', class: 'columns' } },
        billing_unit: 'kg', quantity: '18450', rate: money(this.rebarPrice), amount: money(rebarAmount),
        cost_basis: 'measured', rebar_basis: 'by_ratio', rebar_from_drawing_share: null, awaiting_answer: null,
        by_storey: [{ storey: 'floor_1', quantity: '18450' }], trace: { lines: 2 },
      },
    ]
  }

  allowances() {
    if (this.gfa === null) return []
    const line = (step: string, amount: string) => ({
      step, part: 'whole', cost_basis: 'allowance', source: 'vextrus_default',
      consumptions: [{ item_code: 'RCC-COL-1:1.5:3', per_area: '0.62' }],
      amount: money(amount), measured_so_far: money('0.00'),
    })
    return [line('beams', '2400000.00'), line('slabs', '3120000.00')]
  }

  boq() {
    const items = this.items()
    const measured = items.reduce((s, i) => s + (i.amount ? toPaisa(i.amount.amount) : 0n), 0n)
    const allowance = this.allowances().reduce((s, a) => s + toPaisa(a.amount.amount), 0n)
    const total = measured + allowance
    return {
      building_id: BUILDING_ID,
      strip: {
        measured: money(paisa(measured)), awaiting_answer: money('0.00'), allowance: money(paisa(allowance)),
        total: money(paisa(total)), unpriced_lines: 1,
        per_area: this.gfa === null ? null : money(paisa(total / BigInt(this.gfa))),
        gfa: this.gfa === null ? null : { value: this.gfa, basis: 'entered' },
      },
      measured_share: total === 0n ? '0' : (Number(measured) / Number(total)).toFixed(4),
      sections: [{ section: 'super_structure', groups: [{ group: 'columns', items }] }],
      allowances: this.allowances(),
    }
  }

  prices() {
    return {
      price_set: { id: 'ps-pwd-2022', name: 'PWD SoR 2022 2nd Rev (Dhaka)', currency: 'BDT' },
      prices: [
        { resource_code: 'rebar_500w', name: 'Rebar, Grade 500W', unit: 'kg', price: money(this.rebarPrice), source_ref: PWD_REF_PRICE, changed_at: '2026-10-01T04:00:00Z' },
        { resource_code: 'shutter_hire', name: 'Shutter hire', unit: 'sft', price: null, source_ref: 'PWD SoR 2022 (Dhaka), p. 130', changed_at: null },
      ],
    }
  }

  private answer(method: string, rest: string, body: unknown): [number, unknown] | null {
    if (method === 'GET' && rest === 'boq') return [200, this.boq()]
    if (method === 'GET' && rest === 'boq/items/RCC-COL-1:1.5:3/lines')
      return [200, {
        lines: [
          { id: 'line-0001', item_code: 'RCC-COL-1:1.5:3', element_id: 'e-c1', mark: 'C1', storey: 'floor_1', quantity: '704.12', billing_unit: 'cft', trace: [{ sheet_id: 's-01', view_id: 'v-01', anchor: [10, 20] }] },
          { id: 'line-0002', item_code: 'RCC-COL-1:1.5:3', element_id: 'e-c2', mark: 'C2', storey: 'floor_1', quantity: '541.25', billing_unit: 'cft', trace: [{ sheet_id: 's-01', view_id: 'v-01', anchor: [30, 20] }] },
        ],
      }]
    if (method === 'GET' && rest === 'rates/RCC-COL-1:1.5:3')
      return [200, {
        item_code: 'RCC-COL-1:1.5:3', per_unit: 'cft', rate: money('512.40'),
        lines: [
          { resource_code: 'cement_opc', name: 'Cement', qty: '0.28', unit: 'bag', price: money('520.00'), amount: money('145.60'), source_ref: PWD_REF_RATE },
          { resource_code: 'shutter_hire', name: 'Shutter hire', qty: '1.00', unit: 'sft', price: null, amount: null, source_ref: 'PWD SoR 2022 (Dhaka), p. 130' },
        ],
      }]
    if (method === 'GET' && rest === 'prices') return [200, this.prices()]
    if (method === 'PUT' && rest === 'prices/rebar_500w') {
      this.rebarPrice = Number((body as { amount: unknown }).amount).toFixed(2)
      return [200, this.prices().prices[0]]
    }
    if (method === 'PUT' && rest === `buildings/${BUILDING_ID}/gross-floor-area`) {
      this.gfa = String(Number((body as { value: unknown }).value))
      return [200, { value: this.gfa, unit: (body as { unit: unknown }).unit }]
    }
    return null
  }
}
