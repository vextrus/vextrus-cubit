import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createAppRouter, createQueryClient } from './app/router'
import { activateLanguage } from './i18n/activate'
import { englishMessages } from './i18n/catalogues'
import { ENGLISH } from './i18n/languages'
import { UiProviders } from './ui/UiProviders'

// English is the only language shipped; the frame then takes the Market's language data (app/Frame.tsx).
activateLanguage(ENGLISH, englishMessages())

// Development only, for the design gate (docs/design/m0-screens.md §8): `?lang=en-XB` shows the
// test-only pseudo right-to-left language, and `?as=<email>` signs the static session in as another
// seeded member. Neither reaches a production bundle (scripts/check-dist.mjs).
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search)
  const as = params.get('as')
  if (as) (await import('./app/session')).setStaticMember(as)
  const { PSEUDO_RTL_CODE } = await import('./i18n/pseudo-tag')
  if (params.get('lang') === PSEUDO_RTL_CODE) {
    ;(await import('./app/dev-language')).overrideLanguage()
    ;(await import('./i18n/pseudo')).activatePseudoRtl()
  }
}

const queryClient = createQueryClient()
const router = createAppRouter({ queryClient })

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiProviders>
        <RouterProvider router={router} />
      </UiProviders>
    </QueryClientProvider>
  </StrictMode>,
)
