/*
 * A Question's words (m0-screens §5's templates, §6.7): its kind line, its title, each option and the
 * card's first line, "what answering does". The card, the bar and the list's row all word a Question
 * through here, so they agree. Where 19a's Question lacks a fact (a held file's name comes from the
 * Drawing Set's files; a copy's mark and date from the sheets it holds), the words use what the screen has.
 */
import type { ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { DrawingText } from '@/ui'
import { SheetName } from './acts'
import type { ProposalOut } from './data'
import type { QuestionEntry } from './model'
import { disciplineName } from './SheetList'
import { useHasEnglish } from './useHasEnglish'
import { OPTION_NAMES, OTHER_OPTION, OTHER_QUESTION, QUESTION_KINDS, QUESTION_KIND_BY_CODE, SHEET_KIND_NAMES } from './words'

type Option = { key?: string; picked?: boolean }

export function optionsOf(entry: QuestionEntry): Option[] {
  return entry.question.options.map((o) => (typeof o === 'object' && o !== null ? (o as Option) : {}))
}

const isCopies = (entry: QuestionEntry) => entry.question.code === 'engine.conflicts.same_number' && entry.holds.length >= 2

function params(entry: QuestionEntry): Record<string, string | number> {
  return Object.fromEntries(Object.entries(entry.question.params).filter(([, v]) => typeof v === 'string' || typeof v === 'number')) as Record<string, string | number>
}

/** The kind in the card's header: "Two sheets, one number". */
export function useKindLine(entry: QuestionEntry): string {
  const { i18n } = useLingui()
  const q = entry.question
  return i18n._(QUESTION_KIND_BY_CODE[q.code] ?? QUESTION_KINDS[q.kind] ?? OTHER_QUESTION)
}

function FileName({ entry, names }: { entry: QuestionEntry; names: Readonly<Record<string, string>> }) {
  const name = entry.question.subject_id ? names[entry.question.subject_id] : undefined
  return name ? <DrawingText kind="file-name" text={name} truncate={false} /> : null
}

/** The title: "KR-STR-old.dwg may be misread", "Two sheets are numbered S-07". */
export function QuestionTitle({ entry, names }: { entry: QuestionEntry; names: Readonly<Record<string, string>> }) {
  const has = useHasEnglish()
  const kind = useKindLine(entry)
  const q = entry.question
  if (q.kind === 'file_misread') {
    const file = <FileName entry={entry} names={names} />
    return q.subject_id && names[q.subject_id] ? <Trans>{file} may be misread</Trans> : <Trans>This file may be misread</Trans>
  }
  if (has(q.code)) return <MachineText message={{ code: q.code, params: params(entry) }} />
  return <>{kind}</>
}

/** The body under the title, where the Question's own sentence is not its title (a held file's). */
export function QuestionBody({ entry }: { entry: QuestionEntry }) {
  const has = useHasEnglish()
  const q = entry.question
  if (q.kind !== 'file_misread' || !has(q.code)) return null
  return <MachineText message={{ code: q.code, params: params(entry) }} />
}

/** A copy by its mark: "R1" as drawn, a bare letter as "rev B" (§5, §6.7); "no revision mark" for none. */
export function Copy({ sheet }: { sheet: ProposalOut }) {
  if (!sheet.revision_mark.trim()) return <Trans>no revision mark</Trans>
  const mark = <DrawingText kind="revision" text={sheet.revision_mark} truncate={false} />
  return /^rev\b|^r\d/i.test(sheet.revision_mark) ? mark : <Trans>rev {mark}</Trans>
}

/**
 * Two copies told apart in an option's words: by mark where both have one and they differ, else by
 * date, else by place in the card's list of copies.
 */
function CopyIn({ sheet, other, first }: { sheet: ProposalOut; other: ProposalOut; first: boolean }) {
  const f = useFormat()
  if (sheet.revision_mark.trim() && other.revision_mark.trim() && sheet.revision_mark !== other.revision_mark) return <Copy sheet={sheet} />
  if (sheet.issue_date && other.issue_date && sheet.issue_date !== other.issue_date) {
    const date = f.day(sheet.issue_date)
    return <Trans>the copy dated {date}</Trans>
  }
  return first ? <Trans>the first copy</Trans> : <Trans>the second copy</Trans>
}

/** The option picked for the QS, only where two independent sources that agree can be named (ruling 2). */
export function usePick(_entry: QuestionEntry): { key: string; sources: string } | null {
  // The title block's mark and date are one source (§5); the second, the drawing list naming the
  // kept copy's mark, does not reach the web yet, so nothing is pre-picked (ruling 2).
  return null
}

/** An option's words, naming the copies' marks and dates for two sheets of one number. */
export function OptionWords({ entry, option }: { entry: QuestionEntry; option: Option }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const key = option.key ?? ''
  if (isCopies(entry) && (key === 'keep_b' || key === 'keep_a')) {
    const [later, earlier] = entry.holds as [ProposalOut, ProposalOut]
    const keep = key === 'keep_b' ? later : earlier
    const drop = key === 'keep_b' ? earlier : later
    const kept = <CopyIn sheet={keep} other={drop} first={keep === later} />
    const dropped = <CopyIn sheet={drop} other={keep} first={drop === later} />
    const byMark = !!keep.revision_mark.trim() && !!drop.revision_mark.trim() && keep.revision_mark !== drop.revision_mark
    const date = byMark && keep.issue_date ? f.day(keep.issue_date) : null
    return date ? <Trans>Keep {kept} ({date}); leave {dropped} out as superseded</Trans> : <Trans>Keep {kept}; leave {dropped} out as superseded</Trans>
  }
  const words = OPTION_NAMES[key] ?? (entry.question.kind === 'low_confidence' ? SHEET_KIND_NAMES[key] : undefined)
  return <>{i18n._(words ?? OTHER_OPTION)}</>
}

/** The card's first line (§5 item 2, §6.7), for the option picked (pre-picked in M0), else what it settles. */
export function Answering({ entry, names }: { entry: QuestionEntry; names: Readonly<Record<string, string>> }) {
  const picked = usePick(entry)?.key
  const n = entry.holds.length
  const q = entry.question
  if (q.kind === 'file_misread') {
    const file = <FileName entry={entry} names={names} />
    return q.subject_id && names[q.subject_id] ? <Trans>Answering decides whether {file}’s sheets join the list.</Trans> : <Trans>Answering decides whether this file’s sheets join the list.</Trans>
  }
  if (isCopies(entry) && picked) {
    const [later, earlier] = entry.holds as [ProposalOut, ProposalOut]
    const number = <SheetName sheets={[later]} />
    if (picked === 'keep_b' || picked === 'keep_a') {
      const keep = picked === 'keep_b' ? later : earlier
      const drop = picked === 'keep_b' ? earlier : later
      const kept = <CopyIn sheet={keep} other={drop} first={keep === later} />
      const dropped = <CopyIn sheet={drop} other={keep} first={drop === later} />
      return (
        <Trans>
          Answering confirms {number} ({kept}) and excludes {number} ({dropped}) as superseded.
        </Trans>
      )
    }
    if (picked === 'keep_both') return <Trans>Answering confirms both copies.</Trans>
    if (picked === 'keep_open') return <Trans>Answering keeps both copies open. Neither is read until the consultant replies.</Trans>
  }
  if (picked === 'keep_open' && n > 0) {
    const name = <SheetName sheets={entry.holds} />
    return <Trans>Answering keeps {name} open.</Trans>
  }
  if (n === 0) return <Trans>Answering confirms no sheets.</Trans>
  return <Plural value={n} one="Answering settles # sheet." other="Answering settles # sheets." />
}

/** What the screen cannot do yet: answering (19a has no answer operation). */
export function CannotAnswer({ entry, readOnly }: { entry: QuestionEntry; readOnly: 'md' | 'guest' | null }): ReactNode {
  const { i18n } = useLingui()
  if (readOnly === 'md') return <Trans>Waiting for the QS. The MD reads Questions and cannot answer them.</Trans>
  if (readOnly === 'guest') return <Trans>Waiting for the QS. A Guest reads Questions and cannot answer them.</Trans>
  const discipline = entry.question.discipline
  if (!discipline) return <Trans>Questions cannot be answered on this screen yet. Confirm the other sheets meanwhile.</Trans>
  const name = disciplineName(discipline, i18n)
  return <Trans>Questions cannot be answered on this screen yet, so {name} cannot be confirmed until this Question is answered. Confirm its other sheets meanwhile.</Trans>
}
