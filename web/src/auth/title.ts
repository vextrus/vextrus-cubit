/*
 * The page's title: the screen's name, then the product's ("Sign in · Vextrus", m0-screens §4.2), from
 * the catalogue.
 */
import { useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'

export function usePageTitle(page: string): void {
  const { t } = useLingui()
  const title = t`${page} · Vextrus`
  useEffect(() => {
    document.title = title
  }, [title])
}
