/*
 * S15-E3's acceptance, the web part: "the web shows the server's storeys and parses none" (#536). The
 * Storeys column and the inspector's Storeys fact (`StoreysText`, web/src/takeoff/storeys.tsx) word the
 * storey keys the server sends (a plan View's `storeys`; a Sheet's `storeys_titled`, the keys its
 * title's stated words read to, T-W318's Proposal field, passed as `titled`) and show stated words only
 * verbatim. A plan with no keys is amber "not stated" whatever its words or its Sheet's words say;
 * a Sheet with no plan View whose title's words the server read to no key shows those words as stated,
 * muted, "as titled" (m0-screens Ruling 2 as T-W318 amends it), never storeys the screen read itself.
 *
 * The seam: `StoreysText({ views, stated, titled })`. A View is cast to `ViewOut`, so this file
 * type-checks before the generated types change. Every title and storey word is invented.
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
function view(kind: string, over: Partial<ViewOut> = {}): ViewOut {
  serial += 1
  return {
    id: `e3150000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    ordinal: serial,
    kind,
    title: '',
    stated_scale: '',
    not_to_scale: false,
    storeys: [],
    storeys_as_stated: '',
    storeys_meaning: null,
    steps: [],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: ['0', '0', '10', '10'],
    ...over,
  } as ViewOut
}

type Props = { views: ViewOut[]; stated?: string; titled?: readonly string[] | null }

function shown(props: Props) {
  // `titled` is T-W318's prop; cast so this file type-checks before it exists.
  const Text = StoreysText as unknown as (p: Props) => ReturnType<typeof StoreysText>
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <div data-testid="storeys">
        <Text {...props} />
      </div>
    </I18nProvider>,
  )
  const root = container.querySelector('[data-testid="storeys"]') as HTMLElement
  const amber = [...root.querySelectorAll('.text-question')].map((el) => clean(el.textContent))
  return { root, text: clean(root.textContent), amber, unmount }
}

const NO_PLAN = () => [view('section', { title: 'SECTION M-M' }), view('detail', { title: 'TYPICAL RIB DETAIL' })]
const UNKEYED = (over: Partial<ViewOut> = {}) =>
  view('plan', { title: 'RIB LAYOUT PLAN', storeys: ['not_stated'], storeys_meaning: 'at_floor_level', ...over })

describe('a plan View with no storey keys is "not stated": the screen reads no words into storeys', () => {
  it('does not read its own stated words "3RD FLOOR" as the 3rd', () => {
    const { text, amber, unmount } = shown({ views: [UNKEYED({ storeys_as_stated: '3RD FLOOR' })] })
    expect(amber).toEqual(['not stated'])
    expect(text).not.toContain('3rd')
    unmount()
  })

  it('does not fill it from its Sheet’s stated words "2ND & 4TH FLOOR"', () => {
    const { text, amber, unmount } = shown({ views: [UNKEYED()], stated: '2ND & 4TH FLOOR' })
    expect(amber).toEqual(['not stated'])
    expect(text).not.toMatch(/2nd|4th/)
    unmount()
  })

  it('does not read "TYPICAL FLOOR" in its words as typical', () => {
    const { text, amber, unmount } = shown({ views: [UNKEYED({ storeys_as_stated: 'TYPICAL FLOOR' })] })
    expect(amber).toEqual(['not stated'])
    expect(text).not.toContain('typical (range from Step 3)')
    unmount()
  })
})

describe('a plan View’s keys are the server’s, worded', () => {
  it('words the keys it is sent, not the words it states', () => {
    const plan = view('plan', { storeys: ['floor_7'], storeys_meaning: 'at_floor_level', storeys_as_stated: '3RD FLOOR' })
    const { text, unmount } = shown({ views: [plan] })
    expect(text).toBe('7th')
    unmount()
  })
})

describe('a Sheet with no plan View words the keys the server read its title to (titled)', () => {
  it('words "3rd, 5th" from the keys sent, muted, "as titled"', () => {
    const { root, text, amber, unmount } = shown({ views: NO_PLAN(), stated: '3RD & 5TH FLOOR', titled: ['floor_3', 'floor_5'] })
    expect(text).toMatch(/^3rd, 5th\b.*\bas titled$/)
    expect(root.querySelector('.text-muted-foreground')).not.toBeNull()
    expect(amber).toEqual([])
    unmount()
  })

  it('words the keys sent over the words stated: "9th", not "3rd"', () => {
    const { text, unmount } = shown({ views: NO_PLAN(), stated: '3RD FLOOR', titled: ['floor_9'] })
    expect(text).toMatch(/^9th\b.*\bas titled$/)
    expect(text).not.toContain('3rd')
    unmount()
  })

  it.each([
    ['no keys sent', null],
    ['an empty list sent', []],
  ] as const)('with %s, shows the stated words verbatim "3RD & 5TH FLOOR", never "3rd, 5th"', (_, titled) => {
    const { text, amber, unmount } = shown({ views: NO_PLAN(), stated: '3RD & 5TH FLOOR', titled })
    expect(text).toMatch(/^3RD & 5TH FLOOR\b.*\bas titled$/)
    expect(text).not.toContain('3rd')
    expect(amber).toEqual([])
    unmount()
  })
})
