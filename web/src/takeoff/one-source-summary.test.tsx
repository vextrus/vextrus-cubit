/*
 * The bar's "Nothing left but sheets with one source" (m0-screens 6.4's other bar states, as amended for
 * #229): beside a gap, it names the gap Question that gives the sheets their second source; a Plot page
 * showing another title says so; else as before (the words gate of #229, round 2).
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
import { OneSourceSummary } from './Bar'
import type { ProposalOut, QuestionOut, Step1Data } from './data'
import { step1Model } from './model'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()

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
function sheet(number: string | null, over: Partial<ProposalOut> = {}): ProposalOut {
  n += 1
  return {
    id: `p${n}`,
    sheet_id: `s${n}`,
    number,
    title: `TITLE ${n}`,
    revision_mark: 'R0',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline: 'structural',
    file_id: 'f1',
    file_name: 'KR-STR-R0.dwg',
    kind: null,
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision: null,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    decided_act: null,
    agrees: true,
    decided_by_role: null,
    decided_with: 0,
    number_source: 'title_block_attribute',
    title_source: 'title_block_attribute',
    storeys_as_stated: '',
    layout: null,
    plot_file: null,
    plot_page: null,
    plot_residual: null,
    plot_none: null,
    plot_title_alike: true,
    views: [],
    ...over,
  }
}

function question(kind: string, over: Partial<QuestionOut> = {}): QuestionOut {
  n += 1
  // 21c adds `proposals`; cast so this fixture compiles before and after its merge.
  return { id: `q${n}`, kind, status: 'open', code: 'x.y.z', params: {}, options: [], discipline: 'structural', subject_id: null, check_code: null, answer: null, answered_at: null, proposals: [], ...over } as QuestionOut
}

function data(proposals: ProposalOut[], questions: QuestionOut[] = []): Step1Data {
  return {
    proposals,
    questions,
    // 21c adds `unaccounted_views` and `unread_sheets`; cast so this compiles before and after its merge.
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {}, unaccounted_views: [], unread_sheets: 0 } as Step1Data['coverage'],
    progress: { disciplines: [], not_received: [], qs: [] },
    lists: {},
  }
}

const GAP = { after: 'S-01', before: 'S-03', missing: 1 }

describe('the bar over sheets left with one source', () => {
  it('names the gap Question that gives the sheets beside the gap their second source', () => {
    const s1 = sheet('S-01', { agrees: false, plot_page: 1 })
    const s3 = sheet('S-03', { agrees: false, plot_page: 2 })
    const q = question('check', { code: 'engine.register_check.gaps', check_code: 'register', params: { discipline: 'structural', gaps: [GAP] } as QuestionOut['params'], proposals: [s1.id, s3.id] } as Partial<QuestionOut>)
    const model = step1Model(data([s1, s3], [q]))
    const tag = model.queue[0]!.tag

    expect(words(<OneSourceSummary first={model.oneSource[0]!} model={model} />)).toBe(
      `They are beside a gap in the numbering that ${tag} asks about. Answer ${tag} to give them a second source, or open each to confirm it.`,
    )
  })

  it('says a Plot page shows another number or title', () => {
    const s1 = sheet('S-01', { agrees: false, plot_page: 1, plot_title_alike: false })
    const model = step1Model(data([s1]))

    expect(words(<OneSourceSummary first={s1} model={model} />)).toBe('Their Plot pages show a different number or title. Open each to compare and confirm it.')
  })

  it('says there is nothing to check against with no list and no Plot', () => {
    const s1 = sheet('S-01', { agrees: false, plot_page: null })
    const model = step1Model(data([s1]))

    expect(words(<OneSourceSummary first={s1} model={model} />)).toBe('No drawing list and no Plot to check them against. Open each to confirm it.')
  })
})
