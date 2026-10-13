/*
 * S26-D6 fix round (#801 design gate, item 1): the sheet list's File-cell tooltip said its place as three flex
 * columns at 1440 px and broke the file name mid-name ("KR-STR-" / "R0.dwg"), because the shared TooltipContent is
 * `inline-flex` and CopyPlace hands it several nodes. The words alone read right, so the check measures the layout.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const FILE = 'KR-STR-R0.dwg'

type Placed = ProposalOut & { layout: string | null; x_mm?: number | null }

describe('the sheet list’s File-cell tooltip keeps the file name whole', () => {
  it.each([
    ['laid out in the drawing with its x', null, 7000],
    ['laid out in the drawing, no x', null, null],
    ['on a layout', 'Layout2', null],
  ] as const)('%s: one flow child, the file name in one piece', async (_name, layout, x) => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    for (const p of step1.proposals) Object.assign(p as Placed, { layout: null })
    const sheet = step1.proposals.find((p) => p.number === 'S-07' && p.revision_mark === 'B')!
    Object.assign(sheet as Placed, { file_name: FILE, layout, x_mm: x })
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(clean(document.body.textContent)).toMatch(/Confirmed \d+ \/ 24/))
    const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes('S-07') && clean(r.textContent).includes('B, 20 Aug 2026'))
    const row = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))[0]!
    const cell = [...row.querySelectorAll<HTMLElement>('[tabindex="-1"]')].find((el) => clean(el.textContent) === FILE)!
    await userEvent.hover(cell)
    await screen.findByRole('tooltip')
    // Radix keeps a visually hidden copy with role="tooltip"; the layout is the visible content's.
    const content = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!
    const flow = [...content.children].filter((c) => c.getAttribute('role') !== 'tooltip')
    expect(flow.map((c) => c.tagName), 'one flow child inside the flex content').toHaveLength(1)
    const name = within(content).getByText(FILE, { selector: 'bdi' })
    expect(name.getClientRects(), 'the file name sits on one line').toHaveLength(1)
  })
})
