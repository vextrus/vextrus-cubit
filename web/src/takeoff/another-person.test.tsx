/*
 * S26-D7 round 2's finding: Step 1's kept snapshot (`useSettled`) could outlive a reset of the cache, so
 * after another person signed in through the signed-out dialog the first person's rows, the toolbar's Count
 * and the status bar's Coverage could be drawn until the reset's read landed. The two whole-app cases record
 * every drawn DOM state (another person; another project with the screen kept) and none may show the last
 * one's figures; both are green before the fix too (the frame starts again and Suspense hides the old page),
 * so the cases at the seam pin the snapshot itself: dropped when its data is gone or the session moves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
import { PASSWORD } from '@/app/seed/api.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { sessionChanged } from '@/auth/actions'
import { FakeStep1 } from '../acceptance/t22/step1.fixture'
import { useStep1Counts } from './counts'
import { proposalsQuery, questionsQuery, step1Key } from './data'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
// What the eye sees: a page Suspense has hidden (display: none) while the frame is read again is not drawn.
const bodyText = () => clean(document.body.innerText)
const drawn = (el: HTMLElement | null) => (el?.checkVisibility() ? el.innerText : '')
const toolbar = () => clean(drawn(document.querySelector<HTMLElement>('[role="toolbar"][aria-label="The step\'s tools"]')))
const coverage = () => /Coverage \d+ views?: (\d+) assigned/.exec(bodyText())?.[1] ?? '(no Coverage)'
const count = () => /Confirmed (\d+) \//.exec(toolbar())?.[1] ?? '(no Count)'

describe('Another person signs in through the signed-out dialog (S26-D7)', () => {
  it("no rendered state shows the first person's rows, Count or Coverage", async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    // Step 1 is read slowly once the first person has been shown it. States are recorded from the moment the
    // cache is reset for the other person (its read of the Proposals is sent then, in the same task), not before.
    let slow = false
    let signedIn = false
    let reset = false
    const base = api.handle
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      if (signedIn && request.method === 'GET' && path.endsWith('/step1/proposals')) reset = true
      if (slow && request.method === 'GET' && path.endsWith('/proposals')) await new Promise((r) => setTimeout(r, 250))
      const response = await base(request)
      if (request.method === 'POST' && path === '/api/auth/sign-in' && response.ok) signedIn = true
      return response
    }
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    expect([count(), coverage()]).toEqual(['0', '0'])
    const row = step1.proposals.find((p) => bodyText().includes(p.title))!.title

    // What the server holds now differs from what the first person was shown: every sheet confirmed, a title
    // corrected, the Coverage moved. Step 1 is read slowly, so the window the old snapshot could fill is wide.
    step1.proposals = step1.proposals.map((p) => ({ ...p, decision: 'confirmed' as const, decided_by: 'Kamal Uddin', decided_at: '2026-10-13T05:00:00Z' }))
    step1.proposals.find((p) => p.title === row)!.title = 'Corrected since'
    step1.coverage = { ...step1.coverage, assigned: 39 }
    slow = true

    api.session = { userId: null, developerId: null }
    await userEvent.keyboard('{Enter}')
    const signedOut = await screen.findByRole('dialog', { name: 'You were signed out.' })
    await userEvent.clear(within(signedOut).getByLabelText('Email'))
    await userEvent.type(within(signedOut).getByLabelText('Email'), PEOPLE.md)
    await userEvent.type(within(signedOut).getByLabelText('Password'), PASSWORD)

    const seen = new Set<string>()
    const look = () => reset && seen.add(JSON.stringify({ count: count(), coverage: coverage(), row: bodyText().includes(row) }))
    const mo = new MutationObserver(look)
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    await userEvent.click(within(signedOut).getByRole('button', { name: 'Sign in' }))
    look()
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'), { timeout: 5000 })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'You were signed out.' })).toBeNull())
    look()
    mo.disconnect()

    expect(seen.size).toBeGreaterThan(0)
    const first = [...seen].map((s) => JSON.parse(s) as { count: string; coverage: string; row: boolean }).filter((s) => s.count === '0' || s.coverage === '0' || s.row)
    expect(first).toEqual([])
  })
})

describe('Another project, the screen kept (S26-D7)', () => {
  it("moving to another project's Step 1, no rendered state shows the last project's rows, Count or Coverage", async () => {
    const api = new FakeApi()
    const kr01 = new FakeStep1(api, 'KR-01')
    const bp02 = new FakeStep1(api, 'BP-02')
    bp02.proposals = bp02.proposals.map((p) => ({ ...p, decision: 'confirmed' as const, decided_by: 'Kamal Uddin', decided_at: '2026-10-13T05:00:00Z' }))
    bp02.coverage = { ...bp02.coverage, assigned: 39 }
    const base = api.handle
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      if (request.method === 'GET' && path === `/api/projects/${bp02.projectId}/takeoff/step1/proposals`) await new Promise((r) => setTimeout(r, 250))
      return base(request)
    }
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.md, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    expect([count(), coverage()]).toEqual(['0', '0'])
    const row = kr01.proposals.find((p) => bodyText().includes(p.title))!.title
    bp02.proposals.find((p) => p.title === row)!.title = 'Corrected since'

    const seen = new Set<string>()
    // Recorded once the screen names the other project: from then on, only its figures may be drawn.
    const look = () => bodyText().includes('Bokul Place') && seen.add(JSON.stringify({ count: count(), coverage: coverage(), row: bodyText().includes(row) }))
    const mo = new MutationObserver(look)
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    expect(bodyText()).not.toContain('Bokul Place')
    await router.navigate({ href: '/p/BP-02/takeoff/1' })
    look()
    await waitFor(() => expect(count()).toBe('24'), { timeout: 5000 })
    await waitFor(() => expect(coverage()).toBe('39'))
    look()
    mo.disconnect()

    expect(seen.size).toBeGreaterThan(0)
    const last = [...seen].map((s) => JSON.parse(s) as { count: string; coverage: string; row: boolean }).filter((s) => s.count === '0' || s.coverage === '0' || s.row)
    expect(last).toEqual([])
  })
})

describe('The kept snapshot, at its seam (S26-D7)', () => {
  // The two cases above are green on the round before this fix too: the frame starts again for another
  // person, and for another project, so the screen holding the snapshot is gone. These pin the snapshot itself.
  function Probe({ projectId }: { projectId: string }) {
    return <output>{String(useStep1Counts(projectId).found)}</output>
  }

  async function mountCounts() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    api.signInAs(PEOPLE.qs)
    const read = setTransport(api.handle)
    await queryClient.fetchQuery(proposalsQuery(step1.projectId))
    await queryClient.fetchQuery(questionsQuery(step1.projectId))
    read()
    // From now on every read stays on its way: the window in which the last snapshot was kept.
    const restore = setTransport(() => new Promise<Response>(() => {}))
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Probe projectId={step1.projectId} />
      </QueryClientProvider>,
    )
    const found = () => view.container.querySelector('output')!.textContent
    return { queryClient, projectId: step1.projectId, found, view, restore }
  }

  it('the cache reset (its data gone, read again): the counts say not read, never the last ones', async () => {
    const { queryClient, projectId, found, view, restore } = await mountCounts()
    try {
      expect(found()).toBe('24')
      act(() => void queryClient.resetQueries({ queryKey: step1Key(projectId) }))
      await waitFor(() => expect(found()).toBe('null'))
    } finally {
      view.unmount()
      restore()
    }
  })

  it('the session moved on (another person): the counts say not read, never the last ones', async () => {
    const { queryClient, projectId, found, view, restore } = await mountCounts()
    try {
      expect(found()).toBe('24')
      sessionChanged(queryClient)
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <Probe projectId={projectId} />
        </QueryClientProvider>,
      )
      await waitFor(() => expect(found()).toBe('null'))
    } finally {
      view.unmount()
      restore()
    }
  })
})
