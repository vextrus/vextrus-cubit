import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { activateLanguage } from './activate'
import { englishMessages } from './catalogues'
import { ENGLISH } from './languages'
import { PSEUDO_RTL, activatePseudoRtl, pseudoTranslate } from './pseudo'
import { isolateLtr } from '@/ui/notation'

afterEach(() => activateLanguage(ENGLISH, englishMessages()))

describe('<html lang dir> comes from the active language’s data (m0-screens §1.8)', () => {
  it('is en and ltr for English, the one language shipped', () => {
    activateLanguage(ENGLISH, englishMessages())
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('is right to left in the test-only pseudo language, and back again', () => {
    activatePseudoRtl()
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe(PSEUDO_RTL.code)
    expect(getComputedStyle(document.body).direction).toBe('rtl')
    activateLanguage(ENGLISH, englishMessages())
    expect(document.documentElement.dir).toBe('ltr')
  })
})

const RLO = '‮'
const PDF = '‬'

describe('the pseudo language is English, marked so an untranslated string stands out', () => {
  it('accents the text, forces each run right to left, and leaves placeholders and plural choices intact', () => {
    const messages = pseudoTranslate({
      a: ['You have ', ['n'], ' files'],
      b: [['count', 'plural', { offset: undefined, one: ['#', ' sheet'], other: ['#', ' sheets'] }], ' read'],
      c: [['when', 'date', 'short']],
    })
    expect(messages.a).toEqual([`${RLO}Ýóû ĥáṽé ${PDF}`, ['n'], `${RLO} ƒîļéš${PDF}`])
    expect(messages.b).toEqual([
      ['count', 'plural', { offset: undefined, one: ['#', `${RLO} šĥééţ${PDF}`], other: ['#', `${RLO} šĥééţš${PDF}`] }],
      `${RLO} ŕéáð${PDF}`,
    ])
    expect(messages.c).toEqual([['when', 'date', 'short']])
  })

  it('renders every English message, pseudo-translated, with its values', () => {
    i18n.loadAndActivate({
      locale: PSEUDO_RTL.code,
      messages: pseudoTranslate({ probe: [['count', 'plural', { offset: undefined, one: ['#', ' file'], other: ['#', ' files'] }]] }),
    })
    expect(i18n._('probe', { count: 3 })).toBe(`3${RLO} ƒîļéš${PDF}`)
    activatePseudoRtl()
    expect(Object.keys(i18n.messages).length).toBe(Object.keys(englishMessages()).length)
  })
})

/** The x position, in the page, of each character of `part` inside `el`'s text. */
function xs(el: HTMLElement, part: string): number[] {
  const text = el.firstChild as Text
  const at = text.data.indexOf(part)
  expect(at).toBeGreaterThanOrEqual(0)
  const range = document.createRange()
  return [...part].map((_, i) => {
    range.setStart(text, at + i)
    range.setEnd(text, at + i + 1)
    return range.getBoundingClientRect().left
  })
}

const ascending = (v: number[]) => v.every((x, i) => i === 0 || x > v[i - 1]!)

describe('the pseudo language catches a length left unisolated (design gate M3; m0-screens §1.8)', () => {
  const LENGTH = '14′-6″'

  function show(value: string): HTMLElement {
    activatePseudoRtl()
    i18n.load(PSEUDO_RTL.code, pseudoTranslate({ probe: ['Width ', ['len'], ' to the wall'] }))
    const p = document.createElement('p')
    p.style.fontSize = '20px'
    p.textContent = i18n._('probe', { len: value })
    document.body.append(p)
    return p
  }

  it('draws an unisolated 14′-6″ out of order, as Arabic would', () => {
    const p = show(LENGTH)
    expect(ascending(xs(p, LENGTH))).toBe(false)
    p.remove()
  })

  it('draws an isolated 14′-6″ in order', () => {
    const p = show(isolateLtr(LENGTH))
    expect(ascending(xs(p, LENGTH))).toBe(true)
    p.remove()
  })
})
