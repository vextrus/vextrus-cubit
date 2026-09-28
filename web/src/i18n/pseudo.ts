/*
 * The test-only pseudo right-to-left language (docs/design/m0-screens.md §1.8; the review U9). Its
 * catalogue is the English one, pseudo-translated at test time (every letter accented and each run
 * forced right to left, so a string that never went through the catalogue stands out, reading
 * forwards and unaccented) and set right to left, so the market
 * rules can fail in English: the chrome mirrors, LtrCanvas and every notation stay left to right.
 *
 * Never shipped and never offered: only tests, 22's end-to-end run and the development-only specimen
 * route import this file, and `npm run build` fails if its tag reaches the production bundle
 * (scripts/check-dist.mjs). Its tag lives in pseudo-tag.ts.
 */
import type { Messages } from '@lingui/core'
import { activateLanguage } from './activate'
import { englishMessages } from './catalogues'
import type { Language } from './languages'
import { PSEUDO_RTL_CODE } from './pseudo-tag'

export const PSEUDO_RTL: Language = { code: PSEUDO_RTL_CODE, dir: 'rtl' }

const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ACCENTED = 'áƀçðéƒĝĥîĵķļɱñóþǫŕšţûṽŵẋýžÁƁÇÐÉƑĜĤÎĴĶĻṀÑÓÞǪŔŠŢÛṼŴẊÝŽ'
const MAP = new Map([...PLAIN].map((c, i) => [c, [...ACCENTED][i] ?? c]))

function accent(text: string): string {
  return [...text].map((c) => MAP.get(c) ?? c).join('')
}

/*
 * Right-to-left strength (design gate M3). Accented Latin letters are still strong left-to-right
 * characters, so they would pull an unisolated figure into a left-to-right run and hide the failure
 * ADR 0038 names (14′-6″ read as ″6-′14 inside Arabic). Each run of the message's own text is wrapped
 * in RIGHT-TO-LEFT OVERRIDE … POP DIRECTIONAL FORMATTING, as Chromium's own en-XB pseudo-bidi
 * locale does: its letters count as right to left and read reversed. Placeholders stay outside the
 * override, so a value keeps its own direction: an isolated notation (<bdi dir="ltr">, LRI…PDI)
 * reads in order, and an unisolated one is reordered as it would be in a real right-to-left language.
 */
const RLO = '\u202E'
const PDF = '\u202C'

function pseudoText(text: string): string {
  // A plural's `#` is the count, not text: Lingui replaces it only when it stands alone.
  if (text === '#' || text.trim() === '') return text
  return `${RLO}${accent(text)}${PDF}`
}

type Token = string | unknown[]

const CHOICE_TYPES = new Set(['plural', 'select', 'selectordinal'])

function translateTokens(tokens: readonly Token[]): Token[] {
  return tokens.map((token) => {
    if (typeof token === 'string') return pseudoText(token)
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
    out[id] = (typeof message === 'string' ? pseudoText(message) : translateTokens(message as Token[])) as Messages[string]
  }
  return out
}

/** Switches the page to the pseudo right-to-left language: English, accented, `dir="rtl"`. */
export function activatePseudoRtl(): void {
  activateLanguage(PSEUDO_RTL, pseudoTranslate(englishMessages()))
}
