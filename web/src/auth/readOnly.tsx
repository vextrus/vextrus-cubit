/*
 * The read-only toast (docs/design/m0-screens.md §1.4, §4.4's Guest walk; the review U4): a key that
 * would change the Takeoff or the Drawing Set, pressed by the MD or a Guest, shows why nothing happened.
 * No screen of 20a's has such a key; 20b and 22 call this on theirs (22: Enter, X, E, a digit, Ctrl Z).
 *
 *   const readOnly = readOnlyRole(session)          // 'md' | 'guest' | null
 *   const refuse = useReadOnlyToast()
 *   useKeys([{ key: 'X', label: t`Exclude`, group: 'screen', run: () => (readOnly ? refuse(readOnly) : exclude()) }])
 *
 * The API refuses the same acts (07's guard); this only says so before asking.
 */
import { useCallback } from 'react'
import { Trans } from '@lingui/react/macro'
import { useToast } from '@/ui'

/** The toast's words for a read-only role. */
export function ReadOnlyMessage({ role }: { role: 'md' | 'guest' }) {
  return role === 'md' ? <Trans>As MD you can look at the Takeoff but not change it.</Trans> : <Trans>As a Guest you can look at the Takeoff but not change it.</Trans>
}

/** Shows the read-only toast for the MD or a Guest (6 s, replacing any other toast). */
export function useReadOnlyToast(): (role: 'md' | 'guest') => void {
  const toast = useToast()
  return useCallback((role) => toast.show({ message: <ReadOnlyMessage role={role} /> }), [toast])
}
