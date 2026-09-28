/*
 * For screen tests (03, 16, 20a, 20b, 22): the whole app at an address, answered by the in-memory API
 * (seed/api.fixture.ts; no new dependency), signed in as a seeded person, with a key map you hold for
 * `expectKeyMapSound`.
 *
 *   const { router, keyMap, api } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.guest })
 *   const { api } = await mountApp('/projects', { as: null })        // signed out: /sign-in
 *   api.calls()                                                       // ['GET /api/me', …]
 *
 * `step1` puts Step 1's counts on the session's projects, which 19a will send; `session` replaces the
 * session outright (the Market's language, say). The API is restored when the test finishes.
 */
import { onTestFinished } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { setTransport } from '@/api/client'
import { forgetMarket, rememberMarket } from '@/auth/market'
import type { MarketFormat } from '@/format/profile'
import { KeyMap } from '@/ui/keys/registry'
import { UiProviders } from '@/ui/UiProviders'
import { createAppRouter, createQueryClient } from './router'
import { FakeApi, PEOPLE } from './seed/api.fixture'
import { sessionQuery, type ProjectSummary, type Session } from './session'

export { FakeApi, PEOPLE }

function clearCsrfCookie() {
  document.cookie = 'csrftoken=; Max-Age=0; path=/' // eslint-disable-line lingui/no-unlocalized-strings -- a cookie, not words
}

export interface MountOptions {
  /** Who is signed in (a seeded email); null: nobody. The seed's QS unless given. */
  as?: string | null
  /** The API to answer with (to prepare its state first); a fresh seed unless given. */
  api?: FakeApi
  /** Step 1's counts by project code, until 19a sends them. */
  step1?: Readonly<Record<string, ProjectSummary['step1']>>
  session?: Session
  /** The Market this browser last worked in (the pages outside the frame format with it); none unless given. */
  market?: MarketFormat
}

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

export async function mountApp(path: string, { as = PEOPLE.qs, api, step1, session, market }: MountOptions = {}) {
  clearCsrfCookie()
  forgetMarket()
  if (market) rememberMarket(market)
  const fake = api ?? new FakeApi()
  if (as) fake.signInAs(as)
  const restore = setTransport(fake.handle)
  onTestFinished(() => {
    restore()
    clearCsrfCookie()
  })
  const queryClient = createQueryClient()
  if (session) queryClient.setQueryData(sessionQuery.queryKey, session)
  else if (step1) {
    const fetched = await queryClient.fetchQuery(sessionQuery)
    queryClient.setQueryData(sessionQuery.queryKey, {
      ...fetched,
      projects: fetched.projects.map((p) => ({ ...p, step1: step1[p.code] ?? p.step1 })),
    })
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
