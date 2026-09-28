import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { Direction } from 'radix-ui'
import { useLanguage } from './activate'

/**
 * Messages and direction for everything below. Radix primitives "do not automatically inherit
 * direction from the document" (docs/research/global-markets-foundation.md §2.1), so the active
 * language's direction is passed down through one DirectionProvider; LtrCanvas sets its own.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
  const language = useLanguage()
  return (
    <I18nProvider i18n={i18n}>
      <Direction.Provider dir={language.dir}>{children}</Direction.Provider>
    </I18nProvider>
  )
}
