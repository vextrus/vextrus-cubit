/*
 * The languages the web can show, as data (ADR 0038; docs/design/m0-screens.md §1.8–1.9). The page's
 * `lang` and `dir` come from here, never from a literal in a component. English is the only language
 * shipped; the Market (sent by `/api/me` from ticket 07) names which one a Developer uses.
 */

export type Direction = 'ltr' | 'rtl'

export interface Language {
  /** A BCP 47 tag: the page's `lang` and the locale Lingui formats plurals with. */
  code: string
  dir: Direction
}

export const ENGLISH: Language = { code: 'en', dir: 'ltr' }

/** Every language a production build may activate. */
export const SHIPPED_LANGUAGES: readonly Language[] = [ENGLISH]
