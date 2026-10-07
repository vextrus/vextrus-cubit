/*
 * S15-W2's seed (issue #543): a Step 1 small enough that every key's effect can be read off the screen.
 * The API is 19a's Step 1 as ticket 22's acceptance fake answers it (../t22/step1.fixture.ts), its
 * Proposals replaced here: six Structural sheets of one file, S-06 proposed to leave out, no Question.
 * S-02 carries two views on the tiny sheet's paper (210 × 148 mm, engine/render/fixtures): a plan
 * stated at 1:100 at the paper's lower left and a detail not to scale at its upper right.
 *
 * List order (m0-screens §6.3: "Proposed to leave out" before each Discipline's sheets by number):
 * S-06, then S-01 to S-05. Every sheet has its own title, so each is its own row.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, kr01Proposals, type ProposalOut } from '../t22/step1.fixture'

export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

const SHEETS: { number: string; title: string; out?: string }[] = [
  { number: 'S-01', title: 'GENERAL NOTES' },
  { number: 'S-02', title: 'PILE LAYOUT' },
  { number: 'S-03', title: 'PILE CAP LAYOUT' },
  { number: 'S-04', title: 'GROUND FLOOR BEAM LAYOUT' },
  { number: 'S-05', title: 'ROOF BEAM LAYOUT' },
  { number: 'S-06', title: '3D VIEW', out: 'for_information' },
]
export const NUMBERS = SHEETS.map((s) => s.number)
/** The list's order, which paging follows (§2.2 "Previous / next sheet in the list's order"). */
export const ORDER = ['S-06', 'S-01', 'S-02', 'S-03', 'S-04', 'S-05']

/** The plan view on S-02: its outline is the plan's, stated 1:100. */
export const PLAN_VIEW = 'f5152000-0000-4000-8000-000000000001'
/** The detail view on S-02, not to scale. */
export const DETAIL_VIEW = 'f5152000-0000-4000-8000-000000000002'

function view(id: string, ordinal: number, kind: string, title: string, scale: string, nts: boolean, box: [number, number, number, number]) {
  return {
    id,
    ordinal,
    kind,
    title,
    stated_scale: scale,
    not_to_scale: nts,
    storeys: [],
    storeys_as_stated: '',
    storeys_meaning: null,
    steps: [],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: box.map(String),
  }
}

export interface Seed {
  api: FakeApi
  step1: FakeStep1
  /** The Proposal of sheet `number`. */
  of: (number: string) => ProposalOut
}

export function seed(): Seed {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const kr = kr01Proposals()
  const str = kr[0]!
  step1.proposals = SHEETS.map(
    (s, i): ProposalOut => ({
      ...kr[i]!,
      file_id: str.file_id,
      file_name: str.file_name,
      number: s.number,
      title: s.title,
      discipline: 'structural',
      revision_mark: 'R0',
      revision_mark_source: 'file_name',
      proposed_exclusion: s.out ?? null,
      agrees: true,
    }),
  )
  const of = (n: string) => step1.proposals.find((p) => p.number === n)!
  Object.assign(of('S-02'), {
    views: [
      view(PLAN_VIEW, 1, 'plan', 'GROUND FLOOR BEAM LAYOUT', '1:100', false, [15, 15, 55, 45]),
      view(DETAIL_VIEW, 2, 'detail', 'TIE DETAIL', '', true, [150, 95, 195, 135]),
    ],
  })
  step1.questions = []
  step1.lists = {}
  step1.coverage = { views: 2, assigned: 0, excluded: 0, proposed: 2, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
  step1.notReceived = []
  return { api, step1, of }
}

/** Step 1's list, read. */
export async function openList(s: Seed) {
  const app = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: s.api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain(`Confirmed 0 / ${NUMBERS.length}`))
  return app
}

/** Step 1 in sheet mode on sheet `number` ("Open in Step 1", `?sheet=`), drawn. */
export async function openSheet(s: Seed, number: string) {
  const app = await mountApp(`/p/KR-01/takeoff/1?sheet=${s.of(number).sheet_id}`, { as: PEOPLE.qs, api: s.api })
  await canvasOf(number)
  return app
}

/** The sheet's canvas, 16's viewer group "Sheet S-02". */
export async function canvasOf(number: string): Promise<HTMLElement> {
  return await screen.findByRole('group', { name: new RegExp(`^Sheet\\s*⁨?${number}⁩?$`) }, { timeout: 5000 })
}

/** The sheet the toolbar's sheet label names (§6.5), by its number. */
export function shownSheet(): string | null {
  const labels = [...document.querySelectorAll<HTMLElement>('button[aria-haspopup], button[aria-expanded]')].filter(
    (b) => b.offsetParent !== null && !b.closest('[role="dialog"]') && NUMBERS.some((n) => clean(b.textContent).startsWith(n)),
  )
  const shown = new Set(labels.map((b) => NUMBERS.find((n) => clean(b.textContent).startsWith(n))!))
  expect(shown.size, 'at most one sheet label in the toolbar').toBeLessThanOrEqual(1)
  return [...shown][0] ?? null
}

/** The list's row of sheet `number`: the innermost row naming it. */
export function rowOf(number: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(number))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${number}`).toHaveLength(1)
  return inner[0]!
}

/** The sheet whose row holds the browser's focus. */
export function focusedSheet(): string | null {
  const at = document.activeElement
  if (!at) return null
  return NUMBERS.find((n) => {
    const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(n))
    const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
    return inner.length === 1 && (inner[0] === at || inner[0]!.contains(at))
  }) ?? null
}

/** Focus a row as ticket 22's tests do: a click on its number. */
export async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
  await waitFor(() => expect(focusedSheet()).toBe(number))
}

/** The views' outlines drawn on the canvas and visible now (16's outline layer). */
export function visibleOutlines(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-outline]')].filter((o) => o.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
}

/** One view's outline, its on-screen width in CSS pixels. */
export function outlineWidth(id: string): number {
  const el = document.querySelector<HTMLElement>(`[data-outline="${id}"]`)
  expect(el, `the outline of view ${id}`).not.toBeNull()
  return el!.getBoundingClientRect().width
}

/** The proposals excluded through `POST /exclude`, by sheet number, with the reasons sent. */
export function excludedBy(step1: FakeStep1): { numbers: string[]; reasons: string[] } {
  const posts = step1.seen.filter((c) => c.call === 'POST /exclude')
  const ids = posts.flatMap((c) => ((c.body as { proposals?: string[] }).proposals ?? []))
  const reasons = posts.map((c) => String((c.body as { reason?: unknown }).reason))
  const numbers = step1.proposals.filter((p) => ids.includes(p.id)).map((p) => p.number!)
  return { numbers: numbers.sort(), reasons }
}

/** The status bar (§4.1: 24 px, canvas screens only), the F6 region "status-bar". */
export function statusBar(): HTMLElement {
  const bar = document.querySelector<HTMLElement>('[data-region="status-bar"]')
  expect(bar, 'the status bar').not.toBeNull()
  return bar!
}
