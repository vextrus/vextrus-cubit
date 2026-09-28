import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { activateLanguage } from './i18n/activate'
import { englishMessages } from './i18n/catalogues'
import { ENGLISH } from './i18n/languages'
import { routeTree } from './routeTree.gen'
import { UiProviders } from './ui/UiProviders'

// English is the only language shipped; ticket 20a activates the Market's language from /api/me.
activateLanguage(ENGLISH, englishMessages())

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root')

createRoot(root).render(
  <StrictMode>
    <UiProviders>
      <RouterProvider router={router} />
    </UiProviders>
  </StrictMode>,
)
