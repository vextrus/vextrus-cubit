/*
 * Every value filled into a message is isolated in its own direction (docs/design/m0-screens.md
 * §1.7–1.8; ADR 0038; design gate N1): each placeholder, and a plural's `#`, is wrapped in FIRST
 * STRONG ISOLATE … POP DIRECTIONAL ISOLATE, as ICU MessageFormat 2 does by default. A Latin date,
 * name or count then keeps its order and its place inside a right-to-left sentence ("26 Oct 2026"
 * split apart in real Arabic without it). A value with no strong letter (a figure, 14′-6″) resolves
 * left to right. Drawing notation keeps its own <bdi dir="ltr" data-notation> as well.
 *
 * Applied once, where a language's messages are loaded (activate.ts), for every language.
 */
import type { Messages } from '@lingui/core'

const FSI = '⁨'
const PDI = '⁩'
const CHOICES = new Set(['plural', 'selectordinal', 'select'])

type Token = string | unknown[]

function isolateTokens(tokens: readonly Token[], countable: boolean): Token[] {
  return tokens.flatMap((token): Token[] => {
    if (typeof token === 'string') return countable && token === '#' ? [FSI, token, PDI] : [token]
    const [name, type, format] = token
    if (typeof type === 'string' && CHOICES.has(type) && format && typeof format === 'object') {
      const choices: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(format)) {
        choices[key] = Array.isArray(value) ? isolateTokens(value as Token[], type !== 'select') : value
      }
      return [[name, type, choices]]
    }
    return [FSI, token, PDI]
  })
}

/** The same messages with every placeholder, and every plural's `#`, isolated. */
export function isolatePlaceholders(messages: Messages): Messages {
  const out: Messages = {}
  for (const [id, message] of Object.entries(messages)) {
    out[id] = (Array.isArray(message) ? isolateTokens(message as Token[], false) : message) as Messages[string]
  }
  return out
}
