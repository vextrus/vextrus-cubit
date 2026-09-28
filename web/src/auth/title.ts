/*
 * The page's title: the screen's name, then the product's ("Sign in · Vextrus", m0-screens §4.2), from
 * the catalogue.
 */
import { useLayoutEffect } from 'react'
import { useLingui } from '@lingui/react/macro'

export function usePageTitle(page: string): void {
  const { t } = useLingui()
  // A title is plain text: the isolates the message layer puts round each value are left out.
  const title = t`${page} · Vextrus`.replace(/[⁦-⁩]/g, '')
  // With the page's own commit, never a paint later: the tab and the page change together.
  useLayoutEffect(() => {
    document.title = title
  }, [title])
}
