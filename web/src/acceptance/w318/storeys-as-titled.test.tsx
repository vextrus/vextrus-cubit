/*
 * T-W318's acceptance, part D (W1–W6): the Storeys column and the inspector's Storeys fact
 * (`StoreysText`, web/src/takeoff/storeys.tsx) for a Sheet whose title states storeys. The owner's
 * ruling of 5 Oct 2026 on #318: "Show the title's storeys, marked 'as titled'". m0-screens Ruling 2 as
 * amended: "A Sheet with no plan View shows the storeys its title states, muted, "as titled", with no
 * Question; with none stated it shows "—"." A plan View that took its Sheet title's storeys
 * (`storeys_source: 'sheet_title'`) is shown "as titled" too; a plan View with no keys is amber "not
 * stated", never filled from the Sheet's words by the screen (the engine decided).
 *
 * The seam: `StoreysText({ views, stated, titled })` as `Step1Inspector`'s Storeys fact and a
 * `SheetList` row render it (`titled`: the Proposal's `storeys_titled`, the keys the server read the
 * title's words to; S-15 E3 amends W1 to pass them: the web parses no storey words), and `StoreyStrip`. The generated `Step1ViewOut` gains an optional `storeys_source`; a View
 * here is cast to `ViewOut`, so this file type-checks before it does. Every title and storey word is
 * invented.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import type { ViewOut } from '@/takeoff/data'
import { StoreyStrip, StoreysText, stripSlots } from '@/takeoff/storeys'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let serial = 0
function view(kind: string, over: Partial<ViewOut> & { storeys_source?: string | null } = {}): ViewOut {
  serial += 1
  return {
    id: `a3180000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
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

const NO_PLAN = () => [view('section', { title: 'SECTION M-M' }), view('detail', { title: 'TYPICAL RIB DETAIL' })]

function shown(views: ViewOut[], stated: string, titled?: readonly string[]) {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <div data-testid="storeys">
        <StoreysText views={views} stated={stated} titled={titled} />
      </div>
    </I18nProvider>,
  )
  const root = container.querySelector('[data-testid="storeys"]') as HTMLElement
  return { root, text: clean(root.textContent), unmount }
}

/** The deepest element under `root` whose text holds `words`. */
function holder(root: HTMLElement, words: string): HTMLElement {
  let found: HTMLElement = root
  for (const el of root.querySelectorAll<HTMLElement>('*')) if (clean(el.textContent).includes(words)) found = el
  expect(clean(found.textContent)).toContain(words)
  return found
}

const muted = (el: HTMLElement) => el.closest('.text-muted-foreground') !== null
const amber = (root: HTMLElement) => [...root.querySelectorAll('.text-question')].map((el) => clean(el.textContent))

describe('a Sheet with no plan View shows its title’s storeys, muted, as titled (W1–W3)', () => {
  it('W1: words its title’s storeys "3rd, 5th" (the keys the server read them to), muted, then the muted words "as titled"; no amber, no dash', () => {
    const { root, text, unmount } = shown(NO_PLAN(), '3RD & 5TH FLOOR', ['floor_3', 'floor_5'])
    expect(text).toMatch(/^3rd, 5th\b.*\bas titled$/)
    expect(muted(holder(root, '3rd, 5th'))).toBe(true)
    expect(muted(holder(root, 'as titled'))).toBe(true)
    expect(text).not.toContain('—')
    expect(amber(root)).toEqual([])
    unmount()
  })

  it('W2: words its title states that name no storey it can word are shown verbatim, muted, as titled', () => {
    const { root, text, unmount } = shown(NO_PLAN(), 'LEVEL +6.15')
    expect(text).toMatch(/^LEVEL \+6\.15\b.*\bas titled$/)
    expect(muted(holder(root, 'LEVEL +6.15'))).toBe(true)
    expect(muted(holder(root, 'as titled'))).toBe(true)
    expect(amber(root)).toEqual([])
    unmount()
  })

  it('W3: with no plan View and no storeys stated, "—" as before', () => {
    const { root, text, unmount } = shown(NO_PLAN(), '')
    expect(text).toBe('—')
    expect(text).not.toContain('as titled')
    expect(amber(root)).toEqual([])
    unmount()
  })
})

describe('a plan View’s storeys: as titled only when taken from the Sheet’s title (W4, W5)', () => {
  it('W4: the only plan that took its Sheet title’s storeys shows "3rd" muted, then "as titled"', () => {
    const plan = view('plan', { storeys: ['floor_3'], storeys_meaning: 'at_floor_level', storeys_as_stated: '3RD FLOOR', storeys_source: 'sheet_title' })
    const { root, text, unmount } = shown([plan], '3RD FLOOR')
    expect(text).toMatch(/^3rd\b.*\bas titled$/)
    expect(muted(holder(root, '3rd'))).toBe(true)
    expect(muted(holder(root, 'as titled'))).toBe(true)
    expect(amber(root)).toEqual([])
    unmount()
  })

  it('W4: a plan with storeys of its own shows "3rd" plain, never "as titled"', () => {
    const plan = view('plan', { title: '3RD FLOOR RIB LAYOUT PLAN', storeys: ['floor_3'], storeys_meaning: 'at_floor_level', storeys_as_stated: '3RD FLOOR', storeys_source: null })
    const { root, text, unmount } = shown([plan], '3RD FLOOR')
    expect(text).toBe('3rd')
    expect(muted(holder(root, '3rd'))).toBe(false)
    unmount()
  })

  it('W4: two plans that state none show amber "not stated" and no "as titled", whatever the Sheet’s title says', () => {
    const plans = [
      view('plan', { title: 'RIB LAYOUT PLAN', storeys: ['not_stated'], storeys_meaning: 'at_floor_level' }),
      view('plan', { title: 'WAFFLE SLAB LAYOUT PLAN', storeys: ['not_stated'], storeys_meaning: 'at_floor_level' }),
    ]
    const { root, text, unmount } = shown(plans, '2ND & 4TH FLOOR')
    expect(amber(root)).toContain('not stated')
    expect(text).not.toContain('as titled')
    expect(text).not.toMatch(/2nd|4th/)
    unmount()
  })

  it('W5: of two plans, the one with no keys is amber "not stated"; the screen does not fill it from the Sheet’s title', () => {
    const plans = [
      view('plan', { title: '2ND FLOOR RIB LAYOUT PLAN', storeys: ['floor_2'], storeys_meaning: 'at_floor_level', storeys_as_stated: '2ND FLOOR' }),
      view('plan', { title: 'WAFFLE SLAB LAYOUT PLAN', storeys: ['not_stated'], storeys_meaning: 'at_floor_level' }),
    ]
    const { root, text, unmount } = shown(plans, '2ND & 4TH FLOOR')
    expect(text).toContain('2nd')
    expect(amber(root)).toContain('not stated')
    expect(text).not.toContain('4th')
    expect(text).not.toContain('as titled')
    unmount()
  })
})

describe('the storey strip (W6)', () => {
  it('is drawn from keyed plans as before', () => {
    const plans = [view('plan', { storeys: ['floor_2', 'floor_3'], storeys_meaning: 'at_floor_level' })]
    const { container, unmount } = render(<StoreyStrip slots={stripSlots([plans])} views={plans} />)
    expect(container.firstElementChild).not.toBeNull()
    expect(container.firstElementChild!.childElementCount).toBe(stripSlots([plans]).length)
    unmount()
  })

  it('is not drawn for a Sheet shown "as titled" with no plan View', () => {
    const views = NO_PLAN()
    const { container, unmount } = render(<StoreyStrip slots={stripSlots([views])} views={views} />)
    expect(container.firstElementChild).toBeNull()
    unmount()
  })
})
