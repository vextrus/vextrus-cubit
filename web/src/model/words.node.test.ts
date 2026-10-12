/*
 * The 3D view's words keep the domain's (CONTEXT.md, Live Model: _Avoid_ "BIM, Building Model, digital twin, 3D view"):
 * the screen says the Live Model, and its things Elements, never "the model" alone or "an element" in lower case.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const msgids = [...readFileSync(new URL('./locales/en.po', import.meta.url), 'utf8').matchAll(/^msgid "(.*)"$/gm)].map((m) => m[1]!).filter(Boolean)

describe('the 3D view’s words', () => {
  it('has words to check', () => {
    expect(msgids.length).toBeGreaterThan(10)
  })

  it.each([/\b3D view\b/i, /\bBIM\b/, /\bBuilding Model\b/i, /\bdigital twin\b/i, /\bobjects?\b/i, /\bentit(?:y|ies)\b/i])(
    'never uses the avoided word %s',
    (avoided) => {
      expect(msgids.filter((m) => avoided.test(m))).toEqual([])
    },
  )

  it('says "model" only as the Live Model, and Element with a capital', () => {
    expect(msgids.filter((m) => /(?<!Live )\bmodel\b/i.test(m))).toEqual([])
    expect(msgids.filter((m) => /\belements?\b/.test(m))).toEqual([])
  })
})
