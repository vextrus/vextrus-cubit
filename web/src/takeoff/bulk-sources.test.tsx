/*
 * The bulk act's reason and one agreeing sheet's line name the second source each sheet has (the API's
 * `agrees_by`, m0-screens §5): a sheet that agrees by an unbroken run of numbers (no list and no PDF,
 * the session-18 ruling) is never said to match a Plot page (review 1 of #648, design gate must 1).
 * The seed's bulk act (m0-screens 7: Structural 11 on their drawing list, Electrical 3 on their run)
 * reads as 4.7's sentence.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FormatProvider } from '@/format'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { AgreesWhat, BulkReasons } from './Bar'
import type { ProposalOut, Step1Data } from './data'
import { step1Model } from './model'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function words(node: ReactNode): string {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <p>{node}</p>
      </FormatProvider>
    </I18nProvider>,
  )
  const said = clean(container.textContent)
  unmount()
  return said
}

let n = 0
function sheet(number: string, discipline: string, agreesBy: ProposalOut['agrees_by']): ProposalOut {
  n += 1
  return {
    id: `p${n}`, sheet_id: `s${n}`, number, title: `TITLE ${n}`, revision_mark: 'R0', revision_mark_source: 'file_name',
    issue_date: '', discipline, file_id: `f-${discipline}`, file_name: `KR-${discipline}.dwg`, kind: null, jev_pick: null,
    held: false, proposed_exclusion: null, decision: null, confirmed_kind: null, excluded_reason: null, excluded_text: '',
    decided_by: null, decided_at: null, decided_act: null, agrees: agreesBy != null, agrees_by: agreesBy, decided_by_role: null,
    decided_with: 0, number_source: 'title_block_attribute', title_source: 'title_block_attribute', storeys_as_stated: '',
    layout: null, plot_file: null, plot_page: agreesBy === 'plot' ? n : null, plot_residual: null, plot_none: null,
    plot_title_alike: agreesBy === 'plot', views: [], corrected: false,
  } as ProposalOut
}

function data(proposals: ProposalOut[]): Step1Data {
  return {
    proposals,
    questions: [],
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {}, unaccounted_views: [], unread_sheets: 0 } as Step1Data['coverage'],
    progress: { disciplines: [], not_received: [], qs: [] },
    lists: {},
  }
}

const SPEC_4_7 = 'Each has a number and title from its title block, on its drawing list or in numbering without a gap'
const PLOT = /Plot page/

describe("the bulk act's reason names each sheet's second source", () => {
  it("reads the seed's bulk act (Structural on its list, Electrical on its run) as 4.7's sentence", () => {
    const structural = Array.from({ length: 11 }, (_, i) => sheet(`S-${String(i + 1).padStart(2, '0')}`, 'structural', 'list'))
    const electrical = ['E-01', 'E-02', 'E-03'].map((e) => sheet(e, 'electrical', 'run'))
    const model = step1Model(data([...structural, ...electrical]))

    const said = words(<BulkReasons model={model} />)
    expect(said).toBe(`${SPEC_4_7}; storeys from its view titles.`)
    expect(said).not.toMatch(PLOT)
  })

  it('claims no Plot page for sheets agreeing by their run alone', () => {
    const model = step1Model(data(['E-01', 'E-02', 'E-03'].map((e) => sheet(e, 'electrical', 'run'))))

    expect(words(<BulkReasons model={model} />)).toBe('Each has a number and title from its title block, in numbering without a gap; storeys from its view titles.')
  })

  it('keeps the Plot page where a Plot page is the source', () => {
    const model = step1Model(data(['A-01', 'A-02'].map((a) => sheet(a, 'architectural', 'plot'))))

    expect(words(<BulkReasons model={model} />)).toMatch(PLOT)
  })
})

describe("one agreeing sheet's line", () => {
  it('says a sheet agreeing by its run is in numbering without a gap, and claims no Plot page', () => {
    const e1 = sheet('E-01', 'electrical', 'run')
    const model = step1Model(data([e1, sheet('E-02', 'electrical', 'run')]))

    expect(words(<AgreesWhat sheet={e1} model={model} name="E-01" />)).toBe('E-01 agrees: number and title from the title block, in numbering without a gap')
  })

  it('keeps the drawing list and the Plot page where they are the source', () => {
    const s1 = sheet('S-01', 'structural', 'list')
    const a1 = sheet('A-01', 'architectural', 'plot')
    const model = step1Model(data([s1, a1]))

    expect(words(<AgreesWhat sheet={s1} model={model} name="S-01" />)).toBe('S-01 agrees: number and title from the title block, on the drawing list')
    expect(words(<AgreesWhat sheet={a1} model={model} name="A-01" />)).toMatch(PLOT)
  })
})
