/*
 * For screen tests (03, 16, 20a, 20b, 22): the whole app at an address, answered by the in-memory API
 * (seed/api.fixture.ts; no new dependency), signed in as a seeded person, with a key map you hold for
 * `expectKeyMapSound`.
 *
 *   const { router, keyMap, api } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.guest })
 *   const { api } = await mountApp('/projects', { as: null })        // signed out: /sign-in
 *   api.calls()                                                       // ['GET /api/me', …]
 *
 * `step1` seeds Step 1's own queries with that many Proposals and open Questions, which the frame's counts
 * read; `session` replaces the session outright (the Market's language, say) and holds until the first
 * move inside the frame, which reads the session again from the API (auth/gate.ts). The API is restored
 * when the test finishes.
 */
import { onTestFinished } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { setTransport } from '@/api/client'
import { nameTabChannel } from '@/auth/tabs'
import { KeyMap } from '@/ui/keys/registry'
import { UiProviders } from '@/ui/UiProviders'
import { createAppRouter, createQueryClient } from './router'
import { FakeApi, PEOPLE } from './seed/api.fixture'
import { proposalsQuery, questionsQuery, type ProposalOut, type QuestionOut } from '@/takeoff/data'
import type { Step1Counts } from '@/takeoff/model'
import { sessionQuery, type Session } from './session'

export { FakeApi, PEOPLE }

// Each test file's apps talk to one another as tabs do (auth/tabs.ts), never to another file's.
nameTabChannel(`vextrus-session-test-${crypto.randomUUID()}`)

function clearCsrfCookie() {
  document.cookie = 'csrftoken=; Max-Age=0; path=/' // eslint-disable-line lingui/no-unlocalized-strings -- a cookie, not words
}

export interface MountOptions {
  /** Who is signed in (a seeded email); null: nobody. The seed's QS unless given. */
  as?: string | null
  /** The API to answer with (to prepare its state first); a fresh seed unless given. */
  api?: FakeApi
  /** Step 1's counts by project code: that many Proposals (some confirmed or excluded) and open Questions are put in Step 1's queries. */
  step1?: Readonly<Record<string, Step1Counts>>
  session?: Session
}

/* eslint-disable lingui/no-unlocalized-strings -- seed rows for tests, never shown words of the product's */
/** A Proposal as the API sends it (Step1ProposalOut), typed so it cannot drift from the schema. */
function seedProposal(i: number, decision: string | null): ProposalOut {
  const n = String(i + 1).padStart(2, '0')
  return {
    id: `00000000-0000-4000-8000-0000000001${n}`,
    sheet_id: `00000000-0000-4000-8000-0000000002${n}`,
    number: `S-${n}`,
    title: `Seeded sheet ${n}`,
    revision_mark: '',
    revision_mark_source: null,
    issue_date: null,
    discipline: null,
    file_id: `00000000-0000-4000-8000-0000000003${n}`,
    file_name: `seed-${n}.pdf`,
    kind: null,
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    decided_act: null,
    agrees: false,
    decided_by_role: null,
    decided_with: 0,
    number_source: null,
    title_source: null,
    storeys_as_stated: '',
    layout: null,
    plot_file: null,
    plot_page: null,
    plot_residual: null,
    plot_title_alike: false,
    plot_none: null,
    views: [],
    corrected: false,
  }
}

/** An open Question as the API sends it (Step1QuestionOut): params, options and proposals always present. */
function seedQuestion(i: number): QuestionOut {
  const n = String(i + 1).padStart(2, '0')
  return {
    id: `00000000-0000-4000-8000-0000000004${n}`,
    kind: 'conflict',
    status: 'open',
    code: 'takeoff.step1.seeded',
    params: {},
    options: [],
    discipline: null,
    subject_id: null,
    check_code: null,
    answer: null,
    answered_at: null,
    proposals: [],
    blocking: true,
  }
}

/* eslint-enable lingui/no-unlocalized-strings */

/** The session the API gives a seeded person, built as the app builds it. */
export async function sessionAs(email: string, api: FakeApi = new FakeApi()): Promise<Session> {
  clearCsrfCookie()
  api.signInAs(email)
  const restore = setTransport(api.handle)
  try {
    return await createQueryClient().fetchQuery(sessionQuery)
  } finally {
    restore()
  }
}

export async function mountApp(path: string, { as = PEOPLE.qs, api, step1, session }: MountOptions = {}) {
  clearCsrfCookie()
  const fake = api ?? new FakeApi()
  if (as) fake.signInAs(as)
  const restore = setTransport(fake.handle)
  onTestFinished(() => {
    restore()
    clearCsrfCookie()
  })
  const queryClient = createQueryClient()
  if (session) queryClient.setQueryData(sessionQuery.queryKey, session)
  if (step1) {
    const fetched = session ?? (await queryClient.fetchQuery(sessionQuery))
    for (const p of fetched.projects) {
      const counts = step1[p.code]
      if (!counts) continue
      // Only what the counts read (decision, status) varies; every other field is the API's real shape (the generated types), so no reader meets a missing one.
      const decisions = [...Array(counts.confirmed).fill('confirmed'), ...Array(counts.excluded).fill('excluded')]
      const proposals = Array.from({ length: counts.found ?? 0 }, (_, i) => seedProposal(i, decisions[i] ?? null))
      const questions = Array.from({ length: counts.questionsOpen }, (_, i) => seedQuestion(i))
      queryClient.setQueryData(proposalsQuery(p.id).queryKey, proposals)
      queryClient.setQueryData(questionsQuery(p.id).queryKey, questions)
    }
  }
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [path] }) })
  const keyMap = new KeyMap({ strict: true })
  await router.load()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <UiProviders keyMap={keyMap}>
        <RouterProvider router={router} />
      </UiProviders>
    </QueryClientProvider>,
  )
  return { router, keyMap, queryClient, api: fake, ...view }
}

/**
 * Jump to's sheet rows against §1.8 ("every piece of drawing notation carries `data-notation`"): `notationProblems`
 * checks only the elements already marked, so a number written as a plain `<bdi>` passes it. Every row of the dialog's
 * Sheets group must hold its number as `sheet-number`, and each of `marks` (revision marks the rows show) as `revision`.
 */
// Its findings are for developers' test output, never shown in the UI.
/* eslint-disable lingui/no-unlocalized-strings */
export function sheetRowNotationProblems(group: ParentNode, marks: readonly string[] = []): string[] {
  const rows = [...group.querySelectorAll<HTMLElement>('[role="option"]')]
  if (rows.length === 0) return ['no sheet rows to check']
  const problems: string[] = []
  const text = (el: Element) => (el.textContent ?? '').replace(/[⁦-⁩]/g, '').trim()
  for (const row of rows) {
    if (!row.querySelector('[data-notation="sheet-number"]')) problems.push(`${text(row)}: the sheet number has no data-notation="sheet-number"`)
    for (const mark of marks) {
      if (!text(row).includes(mark)) continue
      const marked = [...row.querySelectorAll('[data-notation="revision"]')].some((el) => text(el).includes(mark))
      if (!marked) problems.push(`${text(row)}: the revision mark ${mark} has no data-notation="revision"`)
    }
  }
  return problems
}
/* eslint-enable lingui/no-unlocalized-strings */
