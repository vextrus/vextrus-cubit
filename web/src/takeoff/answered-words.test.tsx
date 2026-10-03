/*
 * The toast after an answer names the act (round 3, the design gate's item 1): no option key of any
 * Question code 21c raises yields the bare "Q1 answered.", with or without the sheets it holds, with or
 * without a drawing-list entry's number, and on a numbering gap; and the drawing-list Question's toasts
 * keep step with the card's first line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { FakeAnswers } from '@/acceptance/t156/answer.fixture'
import { QUESTION_SHAPES } from '@/acceptance/t156/options.fixture'
import type { QuestionOut } from './data'
import type { QuestionEntry } from './model'
import { AnsweredWords } from './questionWords'

afterEach(cleanup)

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function toast(entry: QuestionEntry, option: string, text = '') {
  activateLanguage(ENGLISH, englishMessages())
  const { container } = render(
    <I18nProvider i18n={i18n}>
      <p>
        <AnsweredWords entry={entry} option={option} text={text} />
      </p>
    </I18nProvider>,
  )
  const words = clean(container.textContent)
  cleanup()
  return words
}

const fake = new FakeAnswers()
// The fixture's sheets are 22's, as the screen reads them.
const sheets = fake.step1.proposals as unknown as QuestionEntry['holds']
const s02 = sheets.find((p) => p.number === 'S-02')!
const s07 = sheets.filter((p) => p.number === 'S-07')

function entry(question: QuestionOut, holds: QuestionEntry['holds']): QuestionEntry {
  return { question, tag: 'Q1', holds, kept: false, withdrawn: false }
}

/** Each code's Question in the shapes the toast can meet: no sheets, one, two copies; a listed number; a gap. */
function variants(code: string, kind: string): QuestionEntry[] {
  const base = (params: Record<string, unknown>): QuestionOut =>
    ({ ...fake.everyShape().find((q) => q.code === code)!, kind, params, discipline: 'structural' }) as QuestionOut
  const params: Record<string, unknown>[] = [{}, { number: 'S-13' }, { after: 'S-03', before: 'S-06', missing: 2 }, { sheet: 'S-01', named: 'number', source: 'pasted' }, { source: 'typed' }]
  return params.flatMap((p) => [entry(base(p), []), entry(base(p), [s02]), entry(base(p), s07)])
}

describe('the toast after an answer names the act (round 3)', () => {
  it('never says only "Q1 answered." for any option key of any Question code', () => {
    const bare: string[] = []
    for (const shape of QUESTION_SHAPES) {
      for (const option of shape.options) {
        if (option === 'keep_open') continue
        for (const e of variants(shape.code, shape.kind)) {
          const words = toast(e, option, option === 'type_number' ? 'A-08' : '')
          if (!/^Q1 answered\. \S/.test(words)) bare.push(`${shape.code} ${option} (${e.holds.length} held, ${JSON.stringify(e.question.params)}): "${words}"`)
        }
      }
    }
    expect(bare).toEqual([])
  })

  it('words "another kind of sheet" as English, and the two lists’ answer by the sheet that carries the list (the words gate)', () => {
    const which = fake.byKind().low_confidence! as QuestionOut
    expect(toast(entry(which, [s02]), 'other')).toBe('Q1 answered. S-02 is another kind of sheet.')
    expect(toast(entry(which, []), 'other')).toBe('Q1 answered. The sheet is another kind of sheet.')
    const lists = fake.byKind().lists_disagree! as QuestionOut
    expect(toast(entry(lists, []), 'use_read')).toBe('Q1 answered. Structural’s sheets are counted against the drawing list on S-01.')
    expect(toast(entry(lists, []), 'use_given')).toBe('Q1 answered. Structural’s sheets are counted against the drawing list you pasted.')
  })

  it('words the drawing-list Question’s answers as the card’s first line does', () => {
    const check = (code: string, params: Record<string, unknown>) =>
      entry({ ...fake.byKind().check!, code, params } as QuestionOut, [])
    const notFound = check('engine.register_check.not_found', { number: 'S-13' })
    expect(toast(notFound, 'not_sent_yet')).toBe('Q1 answered. S-13 stays in the count as missing.')
    expect(toast(notFound, 'file_not_added')).toBe('Q1 answered. S-13 stays in the count as missing until its file is added.')
    expect(toast(notFound, 'not_in_set')).toBe('Q1 answered. Recorded: S-13 is not part of this set.')
    const notListed = check('engine.register_check.not_listed', { number: 'S-13' })
    expect(toast(notListed, 'not_in_set')).toBe('Q1 answered. Recorded: S-13 is not part of this set; exclude it in the list.')
    expect(toast(notListed, 'not_sent_yet')).toBe('Q1 answered. S-13 stays in the list, to confirm or exclude.')
    const gap = check('engine.register_check.gap', { after: 'S-03', before: 'S-06', missing: 2 })
    expect(toast(gap, 'not_in_set')).toBe('Q1 answered. Recorded: the numbering skips here; nothing is missing.')
    expect(toast(gap, 'not_in_set')).not.toContain('S-13')
    expect(toast(gap, 'not_sent_yet')).toBe('Q1 answered. Recorded: the 2 missing sheets are still to come. Paste the drawing list to count them.')
  })
})
