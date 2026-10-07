/*
 * The frame's ErrorBar, "Vextrus can't be reached" (m0-screens §4.1): shown under the top bar while the
 * browser is offline or a query cannot reach the server (query-policy.ts `isUnreachable`), taken away
 * once one answers. The policy keeps trying meanwhile.
 */
import { useSyncExternalStore } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { onlineManager, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'
import { ErrorBar } from '@/ui'
import { isUnreachable } from './query-policy'

/** Failed tries in a row before the ErrorBar shows (the policy keeps trying after it does). */
export const UNREACHABLE_AFTER = 2

/**
 * A query whose last try could not reach the server. A refetch's failures are in `fetchFailureReason`
 * while `error` still holds an earlier failure, so the tries under way are read first.
 */
export function cannotReach(state: Query['state']): boolean {
  if (state.fetchFailureCount >= UNREACHABLE_AFTER && isUnreachable(state.fetchFailureReason)) return true
  return state.status === 'error' && isUnreachable(state.error)
}

function unreachable(client: QueryClient): boolean {
  if (!onlineManager.isOnline()) return true
  return client.getQueryCache().getAll().some((q) => cannotReach(q.state))
}

/** True while the browser is offline or the last try of any query failed to reach the server. */
export function useUnreachable(): boolean {
  const client = useQueryClient()
  return useSyncExternalStore(
    (listener) => {
      const offOnline = onlineManager.subscribe(listener)
      const offCache = client.getQueryCache().subscribe(listener)
      return () => {
        offOnline()
        offCache()
      }
    },
    () => unreachable(client),
  )
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
