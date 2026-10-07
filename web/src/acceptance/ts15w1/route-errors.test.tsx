/*
 * Ticket S15-W1's acceptance tests, the error boundaries (#542: "every route has an error boundary";
 * the orchestrator's pin: "a thrown render error inside a route shows an error component, not a blank
 * page"). docs/design/m0-screens.md §4.1: "One frame every screen sits in, so the chrome never moves
 * between screens"; §1.1: never shown, "stack traces, error codes", and "no 'Error:', no 'Oops', no
 * exclamation marks" (so never the router's own "Something went wrong!").
 *
 * The throw is made by a crafted answer: Step 1's proposals answered with a number where the list
 * goes, so drawing the screen throws (or, if the builder checks the answer first, the read fails).
 * Either way the screen's place shows an error, inside the frame. The error component's words are the
 * builder's (no authority words it); only that an alert shows is asserted.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { createAppRouter, createQueryClient } from '@/app/router'
import { FakeStep1 } from '../t22/step1.fixture'
import { alerts, clean, region } from './server.fixture'

afterEach(() => {
  sessionStorage.clear()
})

describe('every route has an error boundary', () => {
  it('gives every route an error component, its own or the router’s default', () => {
    const router = createAppRouter({ queryClient: createQueryClient(), history: createMemoryHistory({ initialEntries: ['/'] }) })
    const routes = Object.values(router.routesById) as { id: string; options: { errorComponent?: unknown } }[]
    expect(routes.length, 'the app’s routes').toBeGreaterThan(5)
    const without = routes.filter((r) => !(r.options.errorComponent ?? router.options.defaultErrorComponent)).map((r) => r.id)
    expect(without, 'routes with no error component of their own and no default').toEqual([])
  })

  it('shows an error in place of a screen whose drawing throws, inside the frame, never a blank page or the router’s own words', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    const proposals = `/api/projects/${api.project('KR-01').id}/takeoff/step1/proposals`
    const base = api.handle
    api.handle = async (request: Request) => {
      if (new URL(request.url, location.origin).pathname !== proposals) return base(request)
      return new Response(JSON.stringify({ proposals: 5 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(alerts().length, 'an alert where the screen was').toBeGreaterThan(0))
    expect(region('top-bar'), 'the frame’s top bar stays (§4.1: the chrome never moves)').not.toBeNull()
    expect(router.state.location.pathname, 'the address stays').toBe('/p/KR-01/takeoff/1')
    const text = clean(document.body.textContent)
    expect(text).not.toContain('Something went wrong')
    expect(text, 'no exclamation mark (§1.1)').not.toContain('!')
    expect(text, 'no error’s own words or stack (§1.1)').not.toMatch(/TypeError|not iterable|is not a function|undefined|null|at [\w.]+ \(/)
  })
})
