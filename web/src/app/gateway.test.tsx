/*
 * A gateway with nothing behind it (S15-W1, round 3; m0-screens §4.1 "Server unreachable"): a proxy
 * answers 502, 503 or 504 with no body at all. That is "can't be reached", not a fault
 * of a page: the ErrorBar shows, the frame stays, and the tries go on until the server answers. And a
 * page that failed once with a fault still shows the ErrorBar when a later try cannot reach the server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { api as apiClient, setTransport, unwrap } from '@/api/client'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { KeyMap } from '@/ui/keys/registry'
import { UiProviders } from '@/ui/UiProviders'
import { page } from 'vitest/browser'
import { SCREENS, UNREACHABLE, alerts, barUnderTopBar, clean, fakeClock, outage, region, settle, tick, until } from '@/acceptance/ts15w1/server.fixture'
import { createAppRouter, createQueryClient } from './router'
import { FakeApi, PEOPLE, mountApp } from './testing'

beforeEach(async () => {
  await page.viewport(1440, 900)
  onlineManager.setOnline(true)
  fakeClock()
})
afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

const WITHIN = 10 * 60_000

describe('a 502 with no body', () => {
  it.each([502, 504])(
    'on a screen read (%i): the ErrorBar shows, the frame stays, the tries never stop, and it clears when the server answers',
    async (status) => {
      const api = new FakeApi()
      const base = api.handle
      const down = { down: true, tries: [] as { at: number; status: number }[] }
      api.handle = async (request: Request) => {
        if (new URL(request.url, location.origin).pathname !== '/api/members') return base(request)
        if (down.down) {
          down.tries.push({ at: Date.now(), status })
          return new Response(null, { status })
        }
        const answer = await base(request)
        down.tries.push({ at: Date.now(), status: answer.status })
        return answer
      }
      await settle(mountApp(SCREENS[0]!.path, { as: PEOPLE.qs, api }))
      expect(await until(() => barUnderTopBar() !== undefined, WITHIN), 'the ErrorBar').toBe(true)
      const tried = down.tries.length
      await until(() => down.tries.length > Math.max(tried, 6), WITHIN)
      expect(down.tries.length, 'still trying after the ErrorBar (more than the 5xx bound)').toBeGreaterThan(Math.max(tried, 6))
      expect(region('top-bar'), 'the frame stays').not.toBeNull()
      down.down = false
      expect(await until(() => barUnderTopBar() === undefined && down.tries.some((t) => t.status === 200), WITHIN)).toBe(true)
      await tick(1000)
      expect(alerts().map((a) => clean(a.textContent))).toEqual([])
    },
  )

  it('on /api/me (the session read): the frame is never replaced, the ErrorBar shows, and the page opens when the API returns', async () => {
    const api = new FakeApi()
    const base = api.handle
    let down = true
    let asked = 0
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      if (down && (path === '/api/me' || path === '/api/projects')) {
        asked++
        return new Response(null, { status: 502 })
      }
      return base(request)
    }
    // The app opens as it does in the browser: drawn at once, the router's pending screen while the session is read.
    api.signInAs(PEOPLE.qs)
    const restore = setTransport(api.handle)
    const queryClient = createQueryClient()
    const router = createAppRouter({
      queryClient,
      history: createMemoryHistory({ initialEntries: ['/members'] }),
    })
    render(
      <QueryClientProvider client={queryClient}>
        <UiProviders keyMap={new KeyMap({ strict: true })}>
          <RouterProvider router={router} />
        </UiProviders>
      </QueryClientProvider>,
    )
    try {
      expect(await until(() => document.body.textContent?.includes(UNREACHABLE) ?? false, WITHIN), 'the ErrorBar while the session cannot be read').toBe(true)
      await until(() => asked > 6, WITHIN)
      expect(asked, 'the session read goes on').toBeGreaterThan(6)
      expect(clean(document.body.textContent)).not.toContain('This page could not be opened')
      down = false
      expect(await until(() => region('top-bar') !== null, WITHIN), 'the frame, once the API answers').toBe(true)
      expect(await until(() => barUnderTopBar() === undefined, WITHIN)).toBe(true)
    } finally {
      restore()
    }
  })
})

describe('a 503 that carries a Vextrus refusal', () => {
  it('stays a refusal: shown as the screen’s own problem, never "can’t be reached"', async () => {
    const down = outage(SCREENS[0]!, {
      kind: 'refusal',
      status: 503,
      body: { code: 'takeoff.step1.discipline_unknown', params: {} },
    })
    await settle(mountApp(SCREENS[0]!.path, { as: PEOPLE.qs, api: down.api }))
    expect(await until(() => alerts().length > 0, WITHIN)).toBe(true)
    await until(() => false, 2 * 60_000)
    expect(barUnderTopBar()).toBeUndefined()
    expect(down.tries.length, 'a refusal-bearing 503 is a fault: bounded').toBeLessThanOrEqual(6)
  })
})

describe('the ErrorBar after an earlier fault', () => {
  it('shows when a later refetch cannot reach the server, though the query still holds its old 5xx error', async () => {
    const api = new FakeApi()
    const base = api.handle
    let mode: 'fault' | 'gone' = 'fault'
    api.handle = async (request: Request) => {
      if (new URL(request.url, location.origin).pathname !== '/api/members') return base(request)
      if (mode === 'gone') throw new TypeError('Failed to fetch')
      return new Response('unavailable', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    const { queryClient } = await settle(mountApp('/members', { as: PEOPLE.qs, api }))
    expect(await until(() => alerts().length > 0, WITHIN), 'the 5xx shown').toBe(true)
    expect(barUnderTopBar(), 'a fault is not "can’t be reached"').toBeUndefined()
    // The server goes away: the refetch's failures are unreachable, the old error is still the 5xx.
    mode = 'gone'
    void queryClient.refetchQueries({ queryKey: ['members'] })
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN), 'the ErrorBar again').toBe(true)
  })
})

describe('the ErrorBar’s name', () => {
  it('is told apart from an act’s alert by a name', async () => {
    const down = outage(SCREENS[0]!, { kind: 'unreachable' })
    await settle(mountApp(SCREENS[0]!.path, { as: PEOPLE.qs, api: down.api }))
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN)).toBe(true)
    expect(screen.getByRole('alert', { name: 'Connection' })).toBe(barUnderTopBar())
  })
})

/** A server whose address(es) answer nothing (a stopped API behind a proxy) while `state.down`. */
function behindProxy(api: FakeApi, addresses: (path: string) => boolean) {
  const state = { down: true, asked: 0 }
  const base = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    if (state.down && addresses(path)) {
      state.asked++
      return new Response(null, { status: 502 })
    }
    return base(request)
  }
  return state
}

class FakeStep1Api extends FakeApi {
  constructor() {
    super()
    new FakeStep1(this)
  }
}

describe('reads nothing tries again, and acts', () => {
  it('the session read again on a move: a body-less 502 shows the bar, the frame stays, and the bar goes when the API returns', async () => {
    const api = new FakeApi()
    const proxy = behindProxy(api, (path) => path === '/api/me')
    proxy.down = false
    const { router } = await settle(mountApp('/members', { as: PEOPLE.qs, api }))
    expect(await until(() => region('top-bar') !== null, WITHIN)).toBe(true)
    proxy.down = true
    void router.navigate({ to: '/projects' })
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN), 'the ErrorBar after the one-shot read failed').toBe(true)
    expect(region('top-bar'), 'the frame stays').not.toBeNull()
    expect(clean(document.body.textContent)).not.toContain('This page could not be opened')
    proxy.down = false
    expect(await until(() => barUnderTopBar() === undefined, WITHIN), 'the bar goes once the API answers').toBe(true)
  })

  it('Step 1’s file names (a read that is never tried again): the bar goes when the server answers', async () => {
    const api = new FakeStep1Api()
    const proxy = behindProxy(api, (path) => path.endsWith('/drawings/files'))
    await settle(mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api }))
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN), 'the ErrorBar').toBe(true)
    proxy.down = false
    expect(await until(() => barUnderTopBar() === undefined, WITHIN), 'the bar goes once the server answers').toBe(true)
    expect(proxy.asked).toBeGreaterThan(0)
  })

  it('an act that cannot reach the server shows the bar, which goes when the server answers', async () => {
    const api = new FakeApi()
    const base = api.handle
    let down = false
    api.handle = async (request: Request) => {
      if (down && request.method === 'POST') throw new TypeError('Failed to fetch')
      return base(request)
    }
    await settle(mountApp('/members', { as: PEOPLE.qs, api }))
    expect(await until(() => region('top-bar') !== null, WITHIN)).toBe(true)
    expect(barUnderTopBar()).toBeUndefined()
    down = true
    await expect(unwrap(apiClient.POST('/api/members/{membership_id}/revoke', { params: { path: { membership_id: 'x' } } }))).rejects.toBeInstanceOf(TypeError)
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN), 'the ErrorBar after the act failed').toBe(true)
    down = false
    expect(await until(() => barUnderTopBar() === undefined, WITHIN), 'the bar goes once the server answers').toBe(true)
  })
})
