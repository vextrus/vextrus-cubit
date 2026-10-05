/*
 * T-W318's acceptance, part D (W7, W8): the title-against-plans Question's words. Step 1 asks the
 * storey-titles Check's findings as one `check` Question per Discipline (the owner's ruling of
 * 5 Oct 2026), code `engine.storey_titles.differs`, params `discipline`, `count`, `sheet`, `named`,
 * `stated`, `not_drawn`, `not_named` (the last five the first disagreeing Sheet's), options
 * `plans_right`, `title_right`, `keep_open`, none picked. The words, from the ticket's table (its
 * section 4 step 5): the title "{count, plural, one {The title of 1 sheet names storeys its plans do
 * not agree with} other {The titles of # sheets name storeys their plans do not agree with}}, for
 * example {sheet}, which names “{stated}” (…). Vextrus takes the storeys from the plans."; the options
 * "The plans are right: keep the storeys they name", "The titles are right: I’ll correct the plans’
 * storeys in the list", "Keep open, ask the consultant"; the answered lines "{tag} answered. Recorded:
 * the plans’ storeys stand." and "{tag} answered. Recorded: the titles are right; correct each plan’s
 * storeys in the list."; the Trace "Trace: the title blocks and plans of {sheets}".
 *
 * The seam: `questionWords.tsx` (`QuestionTitle`, `OptionWords`, `prePick`, `Trace`, `AnsweredWords`),
 * as the card, the bar and the toast word a Question. Every number and storey word is invented.
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
import storeyTitlesCatalogue from '@/messages/engine/storey_titles/en.po?raw'
import takeoffCatalogue from '@/takeoff/locales/en.po?raw'
import type { ProposalOut } from '@/takeoff/data'
import type { QuestionEntry } from '@/takeoff/model'
import { AnsweredWords, type CardContext, OptionWords, QuestionTitle, Trace, optionsOf, prePick } from '@/takeoff/questionWords'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const CODE = 'engine.storey_titles.differs'
const OPTIONS = ['plans_right', 'title_right', 'keep_open'] as const

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let serial = 0
const id = () => `b3180000-0000-4000-8000-${String(++serial).padStart(12, '0')}`

function sheet(number: string): ProposalOut {
  const sheetId = id()
  return {
    id: id(),
    sheet_id: sheetId,
    number,
    title: 'RIB LAYOUT',
    revision_mark: 'R1',
    revision_mark_source: null,
    issue_date: null,
    discipline: 'structural',
    file_id: id(),
    file_name: 'KR-STR-R1.dwg',
    kind: 'slab_layout',
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision: null,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    agrees: false,
    storeys_as_stated: '1ST, 5TH & 7TH FLOOR',
    views: [],
  } as unknown as ProposalOut
}

function entry(count: number): QuestionEntry {
  const holds = Array.from({ length: count }, (_, i) => sheet(`S-1${i + 3}`))
  const question = {
    id: id(),
    kind: 'check',
    status: 'open',
    code: CODE,
    params: { discipline: 'structural', count, sheet: 'S-13', named: 'number', stated: '1ST, 5TH & 7TH FLOOR', not_drawn: 1, not_named: 1 },
    options: OPTIONS.map((key) => ({ key, picked: false })),
    discipline: 'structural',
    subject_id: null,
    check_code: 'storey_titles',
    answer: null,
    answered_at: null,
    proposals: holds.map((h) => h.id),
  }
  return { question: question as unknown as QuestionEntry['question'], tag: 'Q4', holds, kept: false, withdrawn: false }
}

const context = (e: QuestionEntry): CardContext => ({ lists: {}, sheets: e.holds, names: {} })

function said(node: ReactNode): string {
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <p>{node}</p>
      </FormatProvider>
    </I18nProvider>,
  )
  const text = clean(container.textContent)
  unmount()
  return text
}

describe('the title-against-plans Question’s words (W7)', () => {
  it('words one sheet in the singular, naming it and what its title states, and says where Vextrus takes the storeys from', () => {
    const e = entry(1)
    const title = said(<QuestionTitle entry={e} names={{}} />)
    expect(title).toContain('The title of 1 sheet names storeys its plans do not agree with')
    expect(title).toContain('S-13')
    expect(title).toContain('“1ST, 5TH & 7TH FLOOR”')
    expect(title).toContain('Vextrus takes the storeys from the plans.')
  })

  it('words five sheets in the plural', () => {
    const title = said(<QuestionTitle entry={entry(5)} names={{}} />)
    expect(title).toContain('The titles of 5 sheets name storeys their plans do not agree with')
    expect(title).not.toContain('1 sheet')
  })

  it('words its three options as the table says, in order', () => {
    const e = entry(2)
    const words = optionsOf(e).map((o) => said(<OptionWords entry={e} option={o} />))
    expect(optionsOf(e).map((o) => o.key)).toEqual([...OPTIONS])
    expect(words).toEqual([
      'The plans are right: keep the storeys they name',
      'The titles are right: I’ll correct the plans’ storeys in the list',
      'Keep open, ask the consultant',
    ])
  })

  it('picks neither "plans right" nor "title right" for the QS', () => {
    const e = entry(3)
    expect(prePick(e, context(e))).toBeNull()
  })

  it('traces the title blocks and plans of the sheets it holds', () => {
    const e = entry(2)
    const trace = said(<Trace entry={e} context={context(e)} />)
    expect(trace).toMatch(/^Trace: the title blocks and plans of /)
    expect(trace).toContain('S-13')
    expect(trace).toContain('S-14')
  })

  it('says what each answer recorded', () => {
    const e = entry(2)
    const line = (option: string) => said(<AnsweredWords entry={e} option={option} text="" />)
    expect(line('plans_right')).toBe('Q4 answered. Recorded: the plans’ storeys stand.')
    expect(line('title_right')).toBe('Q4 answered. Recorded: the titles are right; correct each plan’s storeys in the list.')
    expect(line('keep_open')).toBe('Q4 kept open for the consultant.')
  })
})

describe('the new words are in the catalogues (W8)', () => {
  it('the engine code is worded in web/src/messages/engine/storey_titles/en.po', () => {
    expect(storeyTitlesCatalogue).toContain(`msgid "${CODE}"`)
  })

  it('the options, the answered lines and "as titled" are in the takeoff catalogue', () => {
    for (const words of [
      'The plans are right: keep the storeys they name',
      'The titles are right: I’ll correct the plans’ storeys in the list',
      'as titled',
    ])
      expect(takeoffCatalogue).toContain(`msgid "${words}"`)
    expect(takeoffCatalogue).toContain('Recorded: the plans’ storeys stand.')
    expect(takeoffCatalogue).toContain('Recorded: the titles are right; correct each plan’s storeys in the list.')
  })
})
