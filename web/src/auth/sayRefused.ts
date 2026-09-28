/*
 * A refusal of an act started from a menu (signing out, switching Developer), which has no place of
 * its own to say it: a toast with the problem's words (problem.tsx), made here, inside the frame's
 * Market, as plain text.
 */
import { useCallback } from 'react'
import { useLingui } from '@lingui/react'
import { useFormat } from '@/format'
import { useToast } from '@/ui'
import { problemOf, problemText } from './problem'

export function useSayRefused(): (error: unknown) => void {
  const { i18n } = useLingui()
  const f = useFormat()
  const toast = useToast()
  return useCallback(
    (error: unknown) => {
      const problem = problemOf(error)
      if (problem) toast.show({ message: problemText(problem, f, i18n) })
    },
    [f, i18n, toast],
  )
}
