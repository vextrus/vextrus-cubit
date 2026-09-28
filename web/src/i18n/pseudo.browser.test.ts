import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { activateLanguage } from './activate'
import { englishMessages } from './catalogues'
import { ENGLISH } from './languages'
import { PSEUDO_RTL, activatePseudoRtl, pseudoTranslate } from './pseudo'

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

describe('the pseudo language is English, marked so an untranslated string stands out', () => {
  it('accents the text and leaves placeholders and plural choices intact', () => {
    const messages = pseudoTranslate({
      a: ['You have ', ['n'], ' files'],
      b: [['count', 'plural', { offset: undefined, one: ['#', ' sheet'], other: ['#', ' sheets'] }], ' read'],
      c: [['when', 'date', 'short']],
    })
    expect(messages.a).toEqual(['Ýóû ĥáṽé ', ['n'], ' ƒîļéš'])
    expect(messages.b).toEqual([
      ['count', 'plural', { offset: undefined, one: ['#', ' šĥééţ'], other: ['#', ' šĥééţš'] }],
      ' ŕéáð',
    ])
    expect(messages.c).toEqual([['when', 'date', 'short']])
  })

  it('renders every English message, pseudo-translated, with its values', () => {
    i18n.loadAndActivate({
      locale: PSEUDO_RTL.code,
      messages: pseudoTranslate({ probe: [['count', 'plural', { offset: undefined, one: ['#', ' file'], other: ['#', ' files'] }]] }),
    })
    expect(i18n._('probe', { count: 3 })).toBe('3 ƒîļéš')
    activatePseudoRtl()
    expect(Object.keys(i18n.messages).length).toBe(Object.keys(englishMessages()).length)
  })
})
