/*
 * S27-G4, f-8 of session 26's G1 walk (#667): the Confirmation bar and the inspector's "where each was read"
 * agree on where a sheet's title was read. The walk saw a one-source sheet whose bar said "number and title
 * from its title block" while the inspector's Title said "the title of its view": the two contradict each
 * other on one fact. Both read the same `title_source` (the API's Proposal field).
 *
 * docs/design/m0-screens.md 6.6, "Proposal, "where each was read"": "Title (the same / "the title of its view"
 * where the title block gives none and the sheet draws one other view; never counted as a source that
 * agrees)"; 6.7: "A numbered sheet whose one drawing view is titled takes that title, marked "the title of
 * its view"". No line gives the bar's whole sentence for such a sheet, so what is pinned is that the bar
 * says "the title of its view" as the inspector does, and never that the title came from its title block.
 *
 * E-01 (KR-01, §7) has one source; here its number is a title-block attribute and its title its view's.
 * Run at /p/KR-01/takeoff/1 on t22's in-memory API (../t22/step1.fixture.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const VIEW_TITLE = 'the title of its view'

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

/** KR-01 with E-01's title read from its view, E-01 focused in the list. */
async function e01FromItsView() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const e01 = step1.proposals.find((p) => p.number === 'E-01')!
  expect(e01.agrees, 'E-01 has one source').toBe(false)
  Object.assign(e01, { number_source: 'title_block_attribute', title_source: 'view_title' })
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
  await waitFor(() => rowOf('E-01'))
  await userEvent.click(within(rowOf('E-01')).getAllByText('E-01')[0]!)
}

/** The bar's line on E-01: the innermost element, outside the inspector, that starts "E-01 has". */
function barLine(): string {
  const inspector = screen.getByRole('complementary')
  const all = [...document.querySelectorAll<HTMLElement>('div, p, span')].filter((e) => !inspector.contains(e) && clean(e.textContent).startsWith('E-01 has'))
  const inner = all.filter((e) => !all.some((o) => o !== e && e.contains(o)))
  expect(inner, 'the Confirmation bar’s line on E-01').toHaveLength(1)
  return clean(inner[0]!.textContent)
}

/** The inspector's Title fact, in "Proposal: where each was read". */
function inspectorTitle(): string {
  const inspector = screen.getByRole('complementary')
  expect(clean(inspector.textContent)).toContain('where each was read')
  const label = [...inspector.querySelectorAll('dt')].find((dt) => clean(dt.textContent) === 'Title')
  expect(label, 'the Title row').toBeDefined()
  return clean(label!.nextElementSibling?.textContent)
}

describe('the bar and the inspector agree on where the title was read (f-8, #667)', () => {
  it('says in the inspector’s Title row "the title of its view"', async () => {
    await e01FromItsView()
    await waitFor(() => expect(inspectorTitle()).toContain(VIEW_TITLE))
  })

  it('says in the Confirmation bar "the title of its view", as the inspector does', async () => {
    await e01FromItsView()
    await waitFor(() => expect(barLine(), 'the bar names the title’s source as the inspector does').toContain(VIEW_TITLE))
  })

  it('never says in the Confirmation bar that the title came from its title block', async () => {
    await e01FromItsView()
    await waitFor(() => expect(barLine()).toMatch(/^E-01 has/))
    expect(barLine(), 'the bar names the title’s source as the inspector does').not.toMatch(/title from (its|the) title block/)
  })
})
