/*
 * S24-B3's acceptance, the web part (#665, G1 M0-FL6): a General sheet's untitled pieces are Detail or
 * Notes views, never Plan views (the engine part: engine/recognise/tests/acceptance/ts24b3/), so its
 * Storeys column shows "—", not amber "not stated" (m0-screens 6.8; `StoreysText`,
 * web/src/takeoff/storeys.tsx: a Sheet with no plan View and no storeys stated shows "—").
 *
 * The first test is the screen as the engine reads such a sheet once the ticket is built (green on
 * the base: the screen already words it so); the second is the sheet as the base's engine read it,
 * the amber the ticket removes. Every value is invented.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import type { ViewOut } from '@/takeoff/data'
import { StoreysText } from '@/takeoff/storeys'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let serial = 0
function untitled(kind: string): ViewOut {
  serial += 1
  return {
    id: `b3240000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    ordinal: serial,
    kind,
    title: '',
    stated_scale: '',
    not_to_scale: false,
    storeys: [],
    storeys_as_stated: '',
    storeys_meaning: null,
    steps: ['general_notes'],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: ['0', '0', '10', '10'],
  } as ViewOut
}

function shown(views: ViewOut[]) {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <div data-testid="storeys">
        <StoreysText views={views} stated="" titled={null} />
      </div>
    </I18nProvider>,
  )
  const root = container.querySelector('[data-testid="storeys"]') as HTMLElement
  const amber = [...root.querySelectorAll('.text-question')].map((el) => clean(el.textContent))
  return { text: clean(root.textContent), amber, unmount }
}

describe('a General sheet of untitled pieces shows "—" for its Storeys', () => {
  it('shows "—", not amber "not stated", for its Detail and Notes views', () => {
    const { text, amber, unmount } = shown([untitled('detail'), untitled('detail'), untitled('notes')])
    expect(text).toBe('—')
    expect(amber).toEqual([])
    unmount()
  })

  it('shows amber "not stated" while such a piece is read as a Plan view (what the ticket removes)', () => {
    const { amber, unmount } = shown([untitled('plan'), untitled('detail'), untitled('notes')])
    expect(amber).toEqual(['not stated'])
    unmount()
  })
})
