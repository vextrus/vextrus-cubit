/*
 * The page's title: the screen's name, then the product's ("Sign in · Vextrus", m0-screens §4.2), from
 * the catalogue.
 */
import { useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'

export function usePageTitle(page: string): void {
  const { t } = useLingui()
  // A title is plain text: the isolates the message layer puts round each value are left out.
  const title = t`${page} · Vextrus`.replace(/[⁦-⁩]/g, '')
  useEffect(() => {
    document.title = title
  }, [title])
}
