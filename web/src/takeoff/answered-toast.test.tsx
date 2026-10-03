/*
 * The toast after an answer names the act (§6.5; the design gate, round 3, item 1): no option key of any
 * Question code yields the bare "Q5 answered.", whatever the Question holds; and a drawing-list Check's
 * toast is in step with its card's first line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FormatProvider } from '@/format/Format'
import { QUESTION_SHAPES } from '@/acceptance/t156/options.fixture'
import type { ProposalOut, QuestionOut } from './data'
import type { QuestionEntry } from './model'
import { AnsweredWords } from './questionWords'

afterEach(cleanup)

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let n = 0
function sheet(number: string, revision_mark = 'R0'): ProposalOut {
  n += 1
  return { id: `p${n}`, sheet_id: `s${n}`, number, title: `TITLE ${n}`, revision_mark, issue_date: '', discipline: 'structural', file_name: 'KR-STR-R0.dwg' } as ProposalOut
}

function entry(code: string, kind: string, holds: ProposalOut[], params: Record<string, unknown> = {}): QuestionEntry {
  const question = { id: 'q1', kind, status: 'open', code, params, options: [], discipline: 'structural', subject_id: null, check_code: null, answer: null, answered_at: null } as unknown as QuestionOut
  return { question, tag: 'Q5', holds, kept: false, withdrawn: false }
}

function toast(e: QuestionEntry, option: string, text = '') {
  const { container } = render(
    <I18nProvider i18n={i18n}>
      <FormatProvider profile={BANGLADESH}>
        <p>
          <AnsweredWords entry={e} option={option} text={text} />
        </p>
      </FormatProvider>
    </I18nProvider>,
  )
  const words = clean(container.textContent)
  cleanup()
  return words
}

/** Each code's entries as the screen can meet them: holding no sheet, one, two; a Check with each of its params. */
function variants(code: string, kind: string): QuestionEntry[] {
  const out = [entry(code, kind, []), entry(code, kind, [sheet('S-07')]), entry(code, kind, [sheet('S-07', 'R1'), sheet('S-07', 'R0')])]
  if (kind === 'check') out.push(entry(code, kind, [], { number: 'S-13' }), entry(code, kind, [], { after: 'S-04', before: 'S-06', missing: 1 }), entry(code, kind, [], { after: 'S-04', before: 'S-08', missing: 3 }))
  if (code === 'takeoff.proposals.lists_disagree')
    out.push(entry(code, kind, [], { sheet: 'S-01', named: 'number', source: 'pasted' }), entry(code, kind, [], { sheet: 'GENERAL NOTES', named: 'title', source: 'typed' }))
  return out
}

describe('the toast after an answer (round 3, item 1)', () => {
  it('never says the bare "Q5 answered." for any option key of any Question code', () => {
    let seen = 0
    for (const shape of QUESTION_SHAPES) {
      for (const option of shape.options) {
        for (const e of variants(shape.code, shape.kind)) {
          for (const text of option === 'type_number' ? ['', 'S-21'] : ['']) {
            const words = toast(e, option, text)
            expect(words, `${shape.code} ${option} holds=${e.holds.length} ${JSON.stringify(e.question.params)}`).not.toBe('Q5 answered.')
            expect(words, `${shape.code} ${option}`).toMatch(/^Q5 (answered\. \S|kept open)/)
            seen += 1
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(200)
  })

  it('names the act of each drawing-list Check answer, as its card’s first line does', () => {
    const notFound = entry('engine.register_check.not_found', 'check', [], { number: 'S-13' })
    expect(toast(notFound, 'not_sent_yet')).toBe('Q5 answered. S-13 stays in the count as missing.')
    expect(toast(notFound, 'file_not_added')).toBe('Q5 answered. S-13 stays in the count as missing until its file is added.')
    expect(toast(notFound, 'not_in_set')).toBe('Q5 answered. Recorded: S-13 is not part of this set.')
    const unlisted = entry('engine.register_check.not_listed', 'check', [sheet('S-14')], { number: 'S-14' })
    expect(toast(unlisted, 'not_in_set')).toBe('Q5 answered. Recorded: S-14 is not part of this set; exclude it in the list.')
    expect(toast(unlisted, 'not_sent_yet')).toBe('Q5 answered. Recorded: your pick. S-14 stays in the list, to confirm or exclude.')
    const gap = entry('engine.register_check.gap', 'check', [], { after: 'S-04', before: 'S-08', missing: 3 })
    expect(toast(gap, 'not_in_set')).toBe('Q5 answered. Recorded: the numbering skips here, and nothing is missing.')
    expect(toast(gap, 'not_sent_yet')).toBe('Q5 answered. Recorded: the 3 missing sheets are still to come. Paste the drawing list to count them.')
  })

  it('names what the two lists’ answer and the Discipline’s answer set', () => {
    const lists = entry('takeoff.proposals.lists_disagree', 'conflict', [], { sheet: 'S-01', named: 'number', source: 'pasted' })
    expect(toast(lists, 'use_read')).toBe('Q5 answered. Structural’s sheets are counted against the drawing list on S-01.')
    expect(toast(lists, 'use_given')).toBe('Q5 answered. Structural’s sheets are counted against the drawing list you pasted.')
    const which = entry('takeoff.proposals.which_discipline', 'missing_discipline', [sheet('S-07')])
    expect(toast(which, 'general')).toBe('Q5 answered. S-07’s Discipline is General.')
    const boundary = entry('takeoff.proposals.boundary_storey', 'convention', [sheet('A-03')])
    expect(toast(boundary, 'includes_storey')).toBe('Q5 answered. Recorded: A-03’s range includes the storey where it ends.')
  })
})
