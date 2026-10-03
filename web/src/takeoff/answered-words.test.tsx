/*
 * #156's fix round 3 (the design gate, item 1): an answer's toast names what the answer did, never the
 * bare "Q5 answered.". The class check: every option key of every Question code (options.fixture.ts,
 * the backend's own table), on a Question holding a sheet and on one holding none. Drawn as the toast
 * is, outside the format's provider.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { BANGLADESH } from '@/app/seed/demo.fixture'
import { FormatProvider } from '@/format'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { FakeAnswers, type Question21c } from '@/acceptance/t156/answer.fixture'
import { DISCIPLINES, QUESTION_SHAPES } from '@/acceptance/t156/options.fixture'
import { DISCIPLINE_ORDER, type QuestionEntry } from './model'
import { AnsweredWords, OptionWords } from './questionWords'
import { disciplineName } from './SheetList'
import { DISCIPLINE_IN_TEXT, LIST_TITLES } from './words'

beforeAll(() => activateLanguage(ENGLISH, englishMessages()))

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function toast(fake: FakeAnswers, question: Question21c, option: string, holds = true, text = 'A-08'): string {
  const entry: QuestionEntry = {
    // The fake's shapes are 22's and 21c's, older than the generated types: read as the screen reads them.
    question: question as unknown as QuestionEntry['question'],
    tag: 'Q5',
    holds: (holds ? fake.step1.proposals.filter((p) => question.proposals.includes(p.id)) : []) as unknown as QuestionEntry['holds'],
    kept: false,
    withdrawn: false,
  }
  const { container, unmount } = render(
    <I18nProvider i18n={i18n}>
      <p>
        <AnsweredWords entry={entry} option={option} text={text} />
      </p>
    </I18nProvider>,
  )
  const said = clean(container.textContent)
  unmount()
  return said
}

const UNKNOWN = 'Your answer is recorded.'

describe('an answer’s toast names the act (#156 round 3, design gate item 1)', () => {
  it('never says only "Q5 answered." nor the unknown answer’s words for any option key of any known Question code', () => {
    const fake = new FakeAnswers()
    const questions = [...fake.everyShape(), ...Object.values(fake.byKind())]
    const gap = fake.everyShape().find((q) => q.code === 'engine.register_check.gap')!
    gap.params = { after: 'S-04', before: 'S-06', missing: 1 }
    questions.push(gap)
    expect(new Set(questions.map((q) => q.code))).toEqual(new Set(QUESTION_SHAPES.map((s) => s.code)))
    const unnamed: string[] = []
    for (const question of questions) {
      for (const { key } of question.options as { key: string }[]) {
        for (const holds of [true, false]) {
          const said = toast(fake, question, key, holds)
          // The fallback is for a code or option this screen does not know: a known one names its act.
          if (!/^Q5 (answered|kept open)\b/.test(said) || said === 'Q5 answered.' || said.includes(UNKNOWN)) unnamed.push(`${question.code} ${key} holds=${holds}: ${said}`)
        }
      }
    }
    expect(unnamed).toEqual([])
  })

  it('keeps the fallback for a code this screen does not know yet, never the bare tag', () => {
    const fake = new FakeAnswers()
    const made = { ...fake.everyShape()[0]!, kind: 'invented', code: 'takeoff.proposals.invented', options: [{ key: 'invented_option', picked: false }] }
    expect(toast(fake, made, 'invented_option')).toBe(`Q5 answered. ${UNKNOWN}`)
  })

  it('words the drawing-list Question’s answers from the card’s first line (the gate’s repro: S-13)', () => {
    const fake = new FakeAnswers()
    const found = fake.byKind().check!
    expect(toast(fake, found, 'not_sent_yet')).toBe('Q5 answered. S-13 stays in the count as missing.')
    expect(toast(fake, found, 'file_not_added')).toBe('Q5 answered. S-13 stays in the count as missing until its file is added.')
    expect(toast(fake, found, 'not_in_set')).toBe('Q5 answered. Recorded: S-13 is not part of this set; the drawing list still counts it.')
    const listed = fake.everyShape().find((q) => q.code === 'engine.register_check.not_listed')!
    expect(toast(fake, listed, 'not_in_set')).toBe('Q5 answered. Recorded: S-02 is not part of this set; exclude it in the list.')
    expect(toast(fake, listed, 'not_sent_yet')).toBe('Q5 answered. S-02 stays in the list, to confirm or exclude.')
    const gap = fake.everyShape().find((q) => q.code === 'engine.register_check.gap')!
    gap.params = { after: 'S-04', before: 'S-07', missing: 2 }
    expect(toast(fake, gap, 'not_in_set')).toBe('Q5 answered. Recorded: the numbering skips between S-04 and S-07; nothing is missing.')
    expect(toast(fake, gap, 'not_sent_yet')).toBe('Q5 answered. Recorded: the 2 missing sheets are still to come. Paste the drawing list to count them.')
  })

  it('names the list the Discipline is counted against, the Discipline set and the storey recorded', () => {
    const fake = new FakeAnswers()
    const kinds = fake.byKind()
    expect(toast(fake, kinds.lists_disagree!, 'use_read')).toBe('Q5 answered. Structural’s sheets are counted against the drawing list on S-01.')
    expect(toast(fake, kinds.lists_disagree!, 'use_given')).toBe('Q5 answered. Structural’s sheets are counted against the drawing list you pasted.')
    expect(toast(fake, kinds.missing_discipline!, 'general')).toBe('Q5 answered. A-06’s Discipline is General.')
    expect(toast(fake, kinds.convention!, 'includes_storey')).toBe('Q5 answered. Recorded: S-08’s range includes its top storey.')
    expect(toast(fake, kinds.convention!, 'excludes_storey')).toBe('Q5 answered. Recorded: S-08’s top storey belongs to the next sheet’s range.')
  })
})

describe('General is a Discipline the web knows (#205)', () => {
  it('orders the Disciplines as the backend does, General last, and names each, never "Another Discipline"', () => {
    // DISCIPLINES is the Bangladesh Market's order (options.node.test.ts proves it is the backend's).
    expect([...DISCIPLINE_ORDER]).toEqual([...DISCIPLINES])
    for (const key of DISCIPLINES) {
      expect(disciplineName(key, i18n), key).not.toBe('Another Discipline')
      expect(DISCIPLINE_IN_TEXT[key], key).toBeDefined()
      expect(LIST_TITLES[key], key).toBeDefined()
    }
    expect(disciplineName('general', i18n)).toBe('General')
  })
})

describe('keep all on a card holding no sheet (#203 words gate, round 3b)', () => {
  it('says "keep them all", never "keep all 0"', () => {
    const fake = new FakeAnswers()
    const said = (code: string) => {
      const question = fake.everyShape().find((q) => q.code === code)!
      const entry = { question: question as unknown as QuestionEntry['question'], tag: 'Q5', holds: [], kept: false, withdrawn: false } as QuestionEntry
      const { container, unmount } = render(
        <I18nProvider i18n={i18n}>
          <FormatProvider profile={BANGLADESH}>
            <p>
              <OptionWords entry={entry} option={{ key: 'keep_all' }} />
            </p>
          </FormatProvider>
        </I18nProvider>,
      )
      const text = clean(container.textContent)
      unmount()
      return text
    }
    expect(said('engine.conflicts.same_title')).toBe('They are different sheets: keep them all')
    expect(said('engine.conflicts.same_storey')).toBe('They draw different things: keep them all')
  })
})
