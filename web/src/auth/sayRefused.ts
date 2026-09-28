/*
 * A refusal of an act started from a menu (signing out, switching Developer), which has no place of
 * its own to say it: a toast, in the API's words (a stale page's `csrf_failed` included), or that
 * Vextrus could not be reached. The words are made here, inside the frame's Market, as plain text.
 */
import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ApiRefused } from '@/api/client'
import { useFormat } from '@/format'
import { machineText } from '@/format/machine'
import { useToast } from '@/ui'

export function useSayRefused(): (error: unknown) => void {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const toast = useToast()
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiRefused && error.refusal) toast.show({ message: machineText(error.refusal, f, i18n) })
      else if (error instanceof TypeError) toast.show({ message: t`Vextrus can’t be reached. Check your connection and try again.` })
      else if (error instanceof ApiRefused) toast.show({ message: t`That did not work. Reload the page and try again.` })
      else throw error
    },
    [f, i18n, t, toast],
  )
}
