import { useSyncExternalStore } from 'react'
import { i18n, type Messages } from '@lingui/core'
import { ENGLISH, type Language } from './languages'

let current: Language = ENGLISH
const listeners = new Set<() => void>()

/**
 * Activates a language: its messages for Lingui, and its `lang` and `dir` on `<html>`, both from the
 * language's data (docs/design/m0-screens.md §1.8). The one place the page's direction is set.
 */
export function activateLanguage(language: Language, messages: Messages): void {
  i18n.loadAndActivate({ locale: language.code, messages })
  document.documentElement.lang = language.code
  document.documentElement.dir = language.dir
  current = language
  for (const l of listeners) l()
}

export function currentLanguage(): Language {
  return current
}

/** The active language; re-renders when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
