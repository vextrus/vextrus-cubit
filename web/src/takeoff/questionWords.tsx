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
import { compareNumbers, type DisciplineSection, type QuestionEntry, type Step1Model } from './model'
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

/** The drawing list's source in a sentence: "The drawing list read on a sheet", "… pasted by Nusrat Jahan". */
function ListSource({ section }: { section: DisciplineSection | undefined }) {
  const list = section?.list
  const who = list?.entered_by ?? ''
  if (list?.source === 'pasted' && who) return <Trans>The drawing list pasted by {who}</Trans>
  if (list?.source === 'typed' && who) return <Trans>The drawing list typed by {who}</Trans>
  if (list?.source === 'sheet') return <Trans>The drawing list read on a sheet</Trans>
  return <Trans>The drawing list</Trans>
}

/** The body under the title (§5 item 3, 6.7): what was read, in words, with its figures. */
export function QuestionBody({ entry, model }: { entry: QuestionEntry; model: Step1Model }) {
  const has = useHasEnglish()
  const q = entry.question
  const sheet = entry.holds[0]
  if (q.kind === 'file_misread') return has(q.code) ? <MachineText message={{ code: q.code, params: params(entry) }} /> : null
  if (isCopies(entry)) {
    const titles = [...new Set(entry.holds.map((s) => s.title))]
    if (titles.length === 1) {
      const title = <DrawingText kind="title" text={titles[0]!} truncate={false} />
      return <Trans>Both are titled “{title}”. Only one can be read.</Trans>
    }
    return <Trans>Their titles differ. Only one can be read.</Trans>
  }
  if (q.code === 'takeoff.step1.no_number' && sheet) {
    const title = <DrawingText kind="title" text={sheet.title} truncate={false} />
    const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
    return <Trans>A sheet titled “{title}” in {file} has an empty number in its title block.</Trans>
  }
  if (q.kind === 'low_confidence' && sheet) {
    const name = <SheetName sheets={[sheet]} />
    const title = <DrawingText kind="title" text={sheet.title} truncate={false} />
    const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
    return <Trans>{name} “{title}” in {file}: its title and views do not settle which kind of sheet it is.</Trans>
  }
  if (q.kind === 'check' && typeof q.params.number === 'string') {
    const section = model.disciplines.find((d) => d.discipline === q.discipline)
    const number = <DrawingText kind="sheet-number" text={q.params.number} truncate={false} />
    const files = [...new Set((section?.rows ?? []).flatMap((r) => r.sheets.map((s) => s.file_name)))].sort()
    const named = <FileList names={files} />
    const source = <ListSource section={section} />
    if (q.code === 'engine.register_check.not_found') {
      const found = section?.found ?? 0
      if (section?.list && files.length > 0) {
        const listed = section.list.numbers.length
        return (
          <Trans>
            {source} names <Plural value={listed} one="# sheet" other="# sheets" />. <Plural value={found} one="# was" other="# were" /> found in {named}; {number} was
            not.
          </Trans>
        )
      }
      return files.length > 0 ? (
        <Trans>
          {source} names {number}, and it was not found in {named}.
        </Trans>
      ) : (
        <Trans>
          {source} names {number}, and no file has it.
        </Trans>
      )
    }
    const holder = entry.holds[0] ?? model.rows.flatMap((r) => r.sheets).find((p) => p.number === q.params.number && p.discipline === q.discipline)
    const file = holder ? <DrawingText kind="file-name" text={holder.file_name} truncate={false} /> : null
    if (q.code === 'engine.register_check.not_listed' && file)
      return (
        <Trans>
          {number} is in {file} but not on the drawing list, so it has one source.
        </Trans>
      )
    if (q.code === 'engine.plot_pages.no_page' && file)
      return (
        <Trans>
          {number} is in {file} but on no page of its Discipline’s PDF.
        </Trans>
      )
    return null
  }
  return null
}

function FileList({ names }: { names: readonly string[] }) {
  const items = names.map((n) => <DrawingText key={n} kind="file-name" text={n} truncate={false} />)
  return <>{items.flatMap((el, i) => (i === 0 ? [el] : [', ', el]))}</>
}

/** The Trace line (§5 item 3, 6.7): where each fact the Question stands on was read. */
export function Trace({ entry, model }: { entry: QuestionEntry; model: Step1Model }) {
  const q = entry.question
  const sheet = entry.holds[0]
  const section = model.disciplines.find((d) => d.discipline === q.discipline)
  let where: ReactNode = null
  if (q.kind === 'file_misread') {
    const name = q.subject_id ? model.fileNames[q.subject_id] : undefined
    const file = name ? <DrawingText kind="file-name" text={name} truncate={false} /> : null
    where = file ? <Trans>{file}, as each of the two readers read it</Trans> : <Trans>The file, as each of the two readers read it</Trans>
  } else if (isCopies(entry)) {
    where = section?.list?.source === 'sheet' ? <Trans>Title blocks of both copies; the drawing list read on a sheet</Trans> : <Trans>Title blocks of both copies</Trans>
  } else if (q.kind === 'conflict' && entry.holds.length > 1) {
    where = (
      <>
        {entry.holds.map((s, i) => {
          const name = <SheetName sheets={[s]} />
          return (
            <span key={s.id}>
              {i > 0 ? '; ' : null}
              <Trans>{name} title block</Trans>
            </span>
          )
        })}
      </>
    )
  } else if (q.code === 'takeoff.step1.no_number') {
    where = <Trans>Title block text (the number field is empty)</Trans>
  } else if (q.kind === 'low_confidence' && sheet) {
    const name = <SheetName sheets={[sheet]} />
    where = <Trans>{name} title block and its views</Trans>
  } else if (q.kind === 'check') {
    where = <ListSource section={section} />
  } else if (sheet) {
    const name = <SheetName sheets={[sheet]} />
    where = <Trans>{name} title block</Trans>
  }
  if (!where) return null
  return (
    <>
      <Trans>Trace:</Trans> {where}
    </>
  )
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

/**
 * The pick the server made for the QS, shown only where the card can name two independent sources
 * that agree (ruling 2, §5): for two copies of one number, the later revision mark and date in the
 * title block (one source) and a drawing list read on a sheet naming the number. Else no pre-pick.
 */
export function usePick(entry: QuestionEntry, model?: Step1Model): { key: string; sources: ReactNode } | null {
  const picked = optionsOf(entry).find((o) => o.picked && o.key)
  if (!picked?.key || !model) return null
  if (!isCopies(entry) || (picked.key !== 'keep_b' && picked.key !== 'keep_a')) return null
  const [later, earlier] = entry.holds as [ProposalOut, ProposalOut]
  const keep = picked.key === 'keep_b' ? later : earlier
  const drop = picked.key === 'keep_b' ? earlier : later
  const laterMark = !!keep.revision_mark.trim() && !!drop.revision_mark.trim() && compareNumbers(keep.revision_mark, drop.revision_mark) > 0
  const laterDate = !!keep.issue_date && (!drop.issue_date || keep.issue_date > drop.issue_date)
  const section = model.disciplines.find((d) => d.discipline === entry.question.discipline)
  const listed = section?.list?.source === 'sheet' && !!keep.number && section.list.numbers.includes(keep.number)
  if (!(laterMark || laterDate) || !listed) return null
  return { key: picked.key, sources: <PickSources mark={laterMark} date={laterDate} /> }
}

/** 6.7's form: "the later revision mark and date in the title block, and the drawing list read on a sheet, agree". */
function PickSources({ mark, date }: { mark: boolean; date: boolean }) {
  if (mark && date) return <Trans>the later revision mark and date in the title block, and the drawing list read on a sheet, agree</Trans>
  if (mark) return <Trans>the later revision mark in the title block, and the drawing list read on a sheet, agree</Trans>
  return <Trans>the later date in the title block, and the drawing list read on a sheet, agree</Trans>
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
export function Answering({ entry, names, model }: { entry: QuestionEntry; names: Readonly<Record<string, string>>; model?: Step1Model }) {
  const picked = usePick(entry, model)?.key
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
