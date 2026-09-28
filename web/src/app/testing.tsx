/*
 * For screen tests (03, 16, 20a, 20b, 22): the whole app at an address, on the seed's static copy,
 * signed in as a seeded member, with a key map you hold for `expectKeyMapSound`.
 *
 *   const { router, keyMap } = await mountApp('/p/KR-01/takeoff/1', { as: 'farhana@padma-builders.example' })
 */
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { KeyMap } from '@/ui/keys/registry'
import { UiProviders } from '@/ui/UiProviders'
import { createAppRouter, createQueryClient } from './router'
import { setStaticMember, type Session } from './session'

export async function mountApp(path: string, { as, session }: { as?: string; session?: Session } = {}) {
  setStaticMember(as)
  const queryClient = createQueryClient()
  if (session) queryClient.setQueryData(['session'], session)
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
  return { router, keyMap, queryClient, ...view }
}
