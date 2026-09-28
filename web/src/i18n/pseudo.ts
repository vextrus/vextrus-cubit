/*
 * The test-only pseudo right-to-left language (docs/design/m0-screens.md §1.8; the review U9). Its
 * catalogue is the English one, pseudo-translated at test time (every letter accented, so a string
 * that never went through the catalogue stands out unaccented) and set right to left, so the market
 * rules can fail in English: the chrome mirrors, LtrCanvas and every notation stay left to right.
 *
 * Never shipped and never offered: only tests, 22's end-to-end run and the development-only specimen
 * route import this file, and `npm run build` fails if its tag reaches the production bundle
 * (scripts/check-dist.mjs). `en-XB` is the pseudo-bidi tag Android and Chromium use for the same job.
 */
import type { Messages } from '@lingui/core'
import { activateLanguage } from './activate'
import { englishMessages } from './catalogues'
import type { Language } from './languages'

export const PSEUDO_RTL: Language = { code: 'en-XB', dir: 'rtl' }

const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ACCENTED = 'áƀçðéƒĝĥîĵķļɱñóþǫŕšţûṽŵẋýžÁƁÇÐÉƑĜĤÎĴĶĻṀÑÓÞǪŔŠŢÛṼŴẊÝŽ'
const MAP = new Map([...PLAIN].map((c, i) => [c, [...ACCENTED][i] ?? c]))

function accent(text: string): string {
  return [...text].map((c) => MAP.get(c) ?? c).join('')
}

type Token = string | unknown[]

const CHOICE_TYPES = new Set(['plural', 'select', 'selectordinal'])

function translateTokens(tokens: readonly Token[]): Token[] {
  return tokens.map((token) => {
    if (typeof token === 'string') return accent(token)
    const [name, type, format] = token
    if (typeof type === 'string' && CHOICE_TYPES.has(type) && format && typeof format === 'object') {
      const choices: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(format)) {
        choices[key] = Array.isArray(value) ? translateTokens(value as Token[]) : value
      }
      return [name, type, choices]
    }
    return token
  })
}

/** The same catalogue with every letter of its text accented; placeholders are left as they are. */
export function pseudoTranslate(messages: Messages): Messages {
  const out: Messages = {}
  for (const [id, message] of Object.entries(messages)) {
    out[id] = (typeof message === 'string' ? accent(message) : translateTokens(message as Token[])) as Messages[string]
  }
  return out
}

/** Switches the page to the pseudo right-to-left language: English, accented, `dir="rtl"`. */
export function activatePseudoRtl(): void {
  activateLanguage(PSEUDO_RTL, pseudoTranslate(englishMessages()))
}
