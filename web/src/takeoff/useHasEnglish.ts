/*
 * Whether a machine code has English in the catalogue: a Question whose code has none is titled by
 * its kind's words instead of the plain "no words yet" sentence (m0-screens §1.7).
 */
import { useCallback } from 'react'
import { useLingui } from '@lingui/react'

export function useHasEnglish(): (code: string) => boolean {
  const { i18n } = useLingui()
  return useCallback((code: string) => Object.prototype.hasOwnProperty.call(i18n.messages, code), [i18n])
}
