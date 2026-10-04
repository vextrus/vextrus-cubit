/*
 * #167's words gate (F1): a sheet with neither number nor title is named "an untitled sheet in <file>",
 * and that name broke every sentence built for a sheet number: lowercase at a sentence's start, and a
 * possessive that names the file ("an untitled sheet in KR-ARC-R0.dwg’s kind"). The class check: every
 * option key of every Question code, its toast, its card's first line and the withdrawn card's words,
 * on a Question holding one untitled sheet with no number.
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
import { FakeAnswers, type Question21c } from '@/acceptance/t156/answer.fixture'
import { SheetName } from './acts'
import type { QuestionEntry } from './model'
import { AnsweredWords, AnswerNote, Answering, QuestionBody, Trace, useKindLine, type CardContext } from './questionWords'

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

/** The faults the gate found: a sentence opening in lowercase on the name, a possessive on the file, an empty quotation. */
function faults(text: string): string[] {
  const out: string[] = []
  if (/(^|[.?!]\s+)an untitled sheet/.test(text)) out.push('a sentence opens "an untitled sheet"')
  if (/\.dwg’s|\.dwg's/.test(text)) out.push('a possessive on the file name')
  if (/“\s*”|"\s*"/.test(text)) out.push('an empty quotation')
  return out
}

function untitled(fake: FakeAnswers) {
  const sheet = fake.step1.proposals.find((p) => p.number === null)!
  sheet.title = ''
  return sheet
}

const entryOf = (question: Question21c, holds: unknown[], withdrawn = false): QuestionEntry => ({
  question: question as unknown as QuestionEntry['question'],
  tag: 'Q5',
  holds: holds as QuestionEntry['holds'],
  kept: false,
  withdrawn,
})

describe('an untitled sheet’s name in every sentence (#167 words gate, F1)', () => {
  it('names it by its file, capitalised at a sentence’s start', () => {
    const fake = new FakeAnswers()
    const sheet = untitled(fake) as unknown as QuestionEntry['holds'][number]
    expect(words(<SheetName sheets={[sheet]} />)).toBe('an untitled sheet in KR-ARC-R0.dwg')
    expect(words(<SheetName sheets={[sheet]} start />)).toBe('An untitled sheet in KR-ARC-R0.dwg')
  })

  it('never opens a sentence in lowercase on it, puts a possessive on it or quotes nothing, for any option of any Question', () => {
    const fake = new FakeAnswers()
    const sheet = untitled(fake)
    const context: CardContext = { lists: {}, sheets: fake.step1.proposals as unknown as CardContext['sheets'], names: {} }
    const found: string[] = []
    for (const question of [...fake.everyShape(), ...Object.values(fake.byKind())]) {
      const entry = entryOf(question, [sheet])
      const said = [
        words(<QuestionBody entry={entry} context={context} />),
        words(<Trace entry={entry} context={context} />),
        words(<Answering entry={entry} context={context} />),
        words(<Answering entry={entryOf(question, [sheet], true)} context={context} />),
        words(<AnswerNote entry={entryOf(question, [sheet], true)} readOnly={null} />),
      ]
      for (const { key } of question.options as { key: string }[]) {
        said.push(words(<AnsweredWords entry={entry} option={key} text="" />))
        said.push(words(<Answering entry={entry} context={context} choice={key} />))
      }
      for (const text of said) for (const fault of faults(text)) found.push(`${question.code}: ${fault}: ${text}`)
    }
    expect(found).toEqual([])
  })
})

function KindLine({ entry }: { entry: QuestionEntry }) {
  return <>{useKindLine(entry)}</>
}

describe('a same-title conflict’s heading counts its sheets (#167 words gate, F3)', () => {
  it('heads two sheets "One title on two sheets" and three "One title on 3 sheets", as its body counts them', () => {
    const fake = new FakeAnswers()
    const question = fake.everyShape().find((q) => q.code === 'engine.conflicts.same_title')!
    expect(words(<KindLine entry={entryOf({ ...question, params: { ...question.params, sheets: 2 } }, [])} />)).toBe('One title on two sheets')
    expect(words(<KindLine entry={entryOf({ ...question, params: { ...question.params, sheets: 3 } }, [])} />)).toBe('One title on 3 sheets')
  })
})
