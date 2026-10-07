/*
 * Ticket S15-W7's acceptance tests: the one DOM check the screen tests call for m0-screens §8 item 4,
 * "No word from 1.1's list in the DOM". Its seam, named by this ticket: `web/src/test/never-shown.ts`
 * exports `neverShownIn(text)`, the entries of the one list (`web/src/test/never-shown.json`, which the
 * words lint reads too) found in a screen's text, as the list writes them; [] when none is.
 * tools/lint/tests/acceptance/ts15w7/ pins the list itself, the catalogues, and that the copies are gone.
 */
import { describe, expect, it } from 'vitest'
import { neverShownIn } from '@/test/never-shown'

/** m0-screens §1.1's list, "Never shown to a QS or an MD", each word as it is written there. */
const NEVER_SHOWN = [
  'handle', 'entity', 'SDF', 'DXF', 'LibreDWG', 'ACadSharp', 'ezdxf', 'pdf.js', 'WebGL', 'buffer',
  'artefact', 'render', 'parse', 'JSON', 'sandbox', 'worker', 'job', 'queue', 'hash', 'sha256',
  'tenant', 'RLS', 'API', 'null', 'undefined', 'NaN', 'UUID', 'locale', 'cell', 'home region', 'Rod',
  'model space',
]

describe('the DOM check of §8 item 4 (m0-screens §1.1)', () => {
  it.each(NEVER_SHOWN)('finds "%s" in a screen’s text', (word) => {
    expect(neverShownIn(`The ${word} could not be read.`)).toContain(word)
  })

  it.each([
    ['Job 3 has stopped.', 'job'],
    ['Parse the file again.', 'parse'],
    ['Tenant not found.', 'tenant'],
    ['Locale is not set.', 'locale'],
    ['Cell 4 is full.', 'cell'],
    ['Null was given.', 'null'],
  ])('finds a word capitalised at the start of a sentence: "%s"', (text, word) => {
    expect(neverShownIn(text)).toContain(word)
  })

  it.each([
    ['Two jobs are waiting.', 'job'],
    ['No workers are free.', 'worker'],
    ['Both tenants can see it.', 'tenant'],
    ['3 entities were drawn.', 'entity'],
    ['Two cells are full.', 'cell'],
    ['The UUIDs differ.', 'UUID'],
    ['Both handles are kept.', 'handle'],
  ])('finds a word of the list in the plural: "%s"', (text, word) => {
    expect(neverShownIn(text)).toContain(word)
  })

  it('finds a font file name with its extension ("romans.shx")', () => {
    expect(neverShownIn('The lettering romans.shx is not on this computer.')).not.toEqual([])
  })

  it('finds nothing in the QS’s own words', () => {
    const text =
      'Cancelled. Rapid progress on Production Road 7: the Rebar is laid out in the drawing, in Romans (AutoCAD lettering).'
    expect(neverShownIn(text)).toEqual([])
  })
})
