/*
 * Ticket S15-W0's acceptance test, no string changed: "Check: the catalogue checks green; no string
 * changed." Every message main's one takeoff catalogue held when the ticket began
 * (`web/src/takeoff/locales/en.po` at bd5378fe5, 644 messages, kept beside this file as
 * `base-takeoff-english.json`: context, id and English) is in a takeoff catalogue after the split, with
 * the same English.
 *
 * This pins the ticket's own moment, not the words for ever: a later ticket that rewords or removes a
 * takeoff message (S15-W2's key labels, S15-W3's words and toasts) retires this file and its JSON in an
 * `acceptance:` commit that only deletes them. `lossless.node.test.ts` keeps the lasting promise (the
 * catalogues hold what the code asks for).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keyOf, takeoffCatalogues } from './po'

interface Base {
  context: string | null
  id: string
  english: string
}

const base = JSON.parse(readFileSync(new URL('./base-takeoff-english.json', import.meta.url), 'utf8')) as Base[]

describe('the split changes no takeoff string (S15-W0)', () => {
  it('keeps every message the takeoff catalogue held before, with the same English', () => {
    const after = new Map<string, string[]>()
    for (const catalogue of takeoffCatalogues()) {
      for (const entry of catalogue.entries) after.set(keyOf(entry), [...(after.get(keyOf(entry)) ?? []), entry.english])
    }
    expect(base.length, 'the base held 644 messages').toBe(644)
    const changed = base
      .filter((b) => {
        const now = after.get(keyOf({ context: b.context ?? undefined, id: b.id }))
        return !now || now.some((english) => english !== b.english)
      })
      .map((b) => (b.context ? `${b.context} | ${b.id}` : b.id))
    expect(changed, 'messages lost or worded differently').toEqual([])
  })
})
