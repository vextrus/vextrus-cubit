/*
 * T-W318's builder tests for `StoreysText`, beyond the acceptance cases (web/src/acceptance/w318): the
 * API's `storeys_titled` keys win over the screen's own reading of the words; a "typical" title with no
 * plan view is shown as its words; "as titled" only when every plan view took its sheet's storeys. Every
 * title and storey word is invented.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import type { ViewOut } from './data'
import { StoreysText } from './storeys'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let serial = 0
function view(kind: string, over: Partial<ViewOut> = {}): ViewOut {
  serial += 1
  return {
    id: `c3180000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    ordinal: serial,
    kind,
    title: '',
    stated_scale: '',
    not_to_scale: false,
    storeys: [],
    storeys_as_stated: '',
    storeys_meaning: null,
    storeys_source: null,
    steps: [],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: ['0', '0', '10', '10'],
    ...over,
  }
}

function shown(views: ViewOut[], stated: string, titled?: string[] | null) {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <StoreysText views={views} stated={stated} titled={titled} />
    </I18nProvider>,
  )
  const text = clean(container.textContent)
  const muted = container.querySelector('.text-muted-foreground') !== null
  unmount()
  return { text, muted }
}

const inherited = (keys: string[]) => view('plan', { storeys: keys, storeys_meaning: 'at_floor_level', storeys_source: 'sheet_title' })
const own = (keys: string[]) => view('plan', { storeys: keys, storeys_meaning: 'at_floor_level', storeys_as_stated: 'FLOOR' })

describe('StoreysText for a sheet with no plan view', () => {
  it('words the keys the API read from the title, even where the screen’s own reading reads none', () => {
    expect(shown([view('detail')], 'G.F & MEZZ FLOOR', ['ground', 'mezzanine']).text).toBe('Ground, Mezzanine as titled')
  })

  it('shows a typical title as its words, muted, as titled (the range is Step 3’s)', () => {
    const { text, muted } = shown([view('section')], 'TYPICAL FLOOR', ['typical'])
    expect(text).toBe('TYPICAL FLOOR as titled')
    expect(muted).toBe(true)
  })

  it('shows "—" for a title stating only spaces', () => {
    expect(shown([view('section')], '   ').text).toBe('—')
  })
})

describe('StoreysText across the plan views of a row', () => {
  it('marks "as titled" when every plan took its sheet’s storeys', () => {
    const { text, muted } = shown([inherited(['floor_4']), inherited(['floor_6'])], '')
    expect(text).toBe('4th, 6th as titled')
    expect(muted).toBe(true)
  })

  it('is plain when any plan names its own storeys', () => {
    const { text, muted } = shown([inherited(['floor_4']), own(['floor_6'])], '')
    expect(text).toBe('4th, 6th')
    expect(muted).toBe(false)
  })

  it('never fills a plan’s missing keys from its own stated words', () => {
    const plan = view('plan', { storeys: [], storeys_as_stated: '9TH FLOOR' })
    expect(shown([plan], '9TH FLOOR').text).toBe('not stated')
  })
})
