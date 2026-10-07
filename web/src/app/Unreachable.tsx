/*
 * The frame's ErrorBar, "Vextrus can't be reached" (m0-screens §4.1): shown under the top bar while the
 * frame's connectivity says the server is down (connectivity.ts), taken away once it answers. The one
 * source of truth: no screen and no other read decides it.
 */
import { useSyncExternalStore } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorBar } from '@/ui'
import { connectivityOf } from './connectivity'

/** True while the browser is offline, an act could not reach the server, or a read is failing as unreachable. */
export function useUnreachable(): boolean {
  const connectivity = connectivityOf(useQueryClient())
  return useSyncExternalStore(connectivity.subscribe, connectivity.isDown)
}

export function UnreachableBar({ className }: { className?: string }) {
  const { t } = useLingui()
  if (!useUnreachable()) return null
  // Named, so an act's alert beside it ("The discipline was not changed.") is told apart from it.
  return (
    <ErrorBar className={className} label={t`Connection`}>
      <Trans>Vextrus can’t be reached. Check your connection; this page keeps trying.</Trans>
    </ErrorBar>
  )
}
