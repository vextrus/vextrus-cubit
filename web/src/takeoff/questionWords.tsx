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
import { gapOf, type QuestionEntry, type Step1Model } from './model'
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

/** A sheet named in a card's words as a link that opens it (§5 item 3: "the Trace line (sheet and place, as links)"). */
export function SheetLink({ sheet, onOpen, children }: { sheet: ProposalOut; onOpen?: (sheet: ProposalOut) => void; children?: ReactNode }) {
  const name = children ?? <SheetName sheets={[sheet]} />
  if (!onOpen) return <>{name}</>
  return (
    <button type="button" onClick={() => onOpen(sheet)} className="text-primary underline underline-offset-2 hover:text-foreground">
      {name}
    </button>
  )
}

/** Where the Discipline's drawing list came from, as a Trace or body names it: "the drawing list on S-01". */
function ListSource({ entry, context, onOpen }: { entry: QuestionEntry; context: CardContext; onOpen?: (sheet: ProposalOut) => void }) {
  const list = context.lists[entry.question.discipline ?? '']
  if (!list || !list.source) return <Trans>the drawing list</Trans>
  const who = list.entered_by ?? ''
  if (list.source === 'pasted') return who ? <Trans>the drawing list pasted by {who}</Trans> : <Trans>the pasted drawing list</Trans>
  if (list.source === 'typed') return who ? <Trans>the drawing list typed by {who}</Trans> : <Trans>the typed drawing list</Trans>
  const on = list.read_on ? context.sheets.find((p) => p.sheet_id === list.read_on) : undefined
  if (!on) return <Trans>the drawing list found in the drawings</Trans>
  const sheet = <SheetLink sheet={on} onOpen={onOpen} />
  return <Trans>the drawing list on {sheet}</Trans>
}

/** What a card needs from the screen beyond its Question: the drawing lists and every sheet. */
export interface CardContext {
  lists: Readonly<
    Record<string, { source: string | null; entered_by: string | null; read_on?: string | null; numbers: readonly string[]; read_revisions?: Readonly<Record<string, string>> } | null | undefined>
  >
  sheets: readonly ProposalOut[]
  names: Readonly<Record<string, string>>
}

/** A card's context from Step 1's model. */
export function cardContext(model: Step1Model): CardContext {
  return {
    sheets: model.rows.flatMap((r) => [...r.sheets]),
    lists: Object.fromEntries(model.disciplines.map((d) => [d.discipline, d.list])),
    names: model.fileNames,
  }
}

/** The body under the title (§6.7): what was read and why it is asked, with its figures in their kinds. */
export function QuestionBody({ entry, context }: { entry: QuestionEntry; context: CardContext }) {
  const has = useHasEnglish()
  const q = entry.question
  const first = entry.holds[0]
  if (q.kind === 'file_misread') return has(q.code) ? <MachineText message={{ code: q.code, params: params(entry) }} /> : null
  if (isCopies(entry)) {
    const titles = [...new Set(entry.holds.map((h) => h.title))]
    if (titles.length === 1) {
      const title = <DrawingText kind="title" text={titles[0]!} truncate={false} />
      return <Trans>Both are titled “{title}”. Only one can be read.</Trans>
    }
    return <Trans>Their titles differ. Only one can be read, unless they are different sheets.</Trans>
  }
  if (q.code === 'takeoff.step1.no_number' && first) {
    const title = <DrawingText kind="title" text={first.title} truncate={false} />
    const file = <DrawingText kind="file-name" text={first.file_name} truncate={false} />
    return <Trans>A sheet titled “{title}” in {file} has an empty number in its title block.</Trans>
  }
  if (q.code === 'takeoff.step1.which_kind' && first) {
    const title = <DrawingText kind="title" text={first.title} truncate={false} />
    const number = <SheetName sheets={[first]} />
    return <Trans>Its title, “{title}”, does not say which kind of sheet {number} is. Its kind decides which Takeoff steps read it.</Trans>
  }
  if (q.kind === 'check' && typeof q.params.number === 'string') {
    const number = <DrawingText kind="sheet-number" text={q.params.number} truncate={false} />
    if (typeof q.params.page === 'number') {
      const page = q.params.page
      return <Trans>Page {page} of the Plot shows {number}, and no DWG has a sheet with that number.</Trans>
    }
    const list = <ListSource entry={entry} context={context} />
    return <Trans>{number} is named on {list}, and no file added has a sheet with that number.</Trans>
  }
  return null
}

/** The Trace line (§5 item 3, §6.7): where each fact was read, the sheets as links. */
export function Trace({ entry, context, onOpen }: { entry: QuestionEntry; context: CardContext; onOpen?: (sheet: ProposalOut) => void }) {
  const q = entry.question
  const first = entry.holds[0]
  if (q.kind === 'file_misread') {
    const name = q.subject_id ? context.names[q.subject_id] : undefined
    if (!name) return <Trans>Trace: the file’s two readings</Trans>
    const file = <DrawingText kind="file-name" text={name} truncate={false} />
    return <Trans>Trace: {file}, as each of the two readers read it</Trans>
  }
  if (isCopies(entry)) {
    const copies = <Joined items={entry.holds.map((h) => <SheetLink key={h.id} sheet={h} onOpen={onOpen}><SheetName sheets={[h]} /> <Copy sheet={h} /></SheetLink>)} />
    const list = context.lists[q.discipline ?? '']
    if (first?.number && list?.numbers.includes(first.number)) {
      const source = <ListSource entry={entry} context={context} onOpen={onOpen} />
      return <Trans>Trace: the title blocks of {copies}; {source}</Trans>
    }
    return <Trans>Trace: the title blocks of {copies}</Trans>
  }
  if (q.code === 'takeoff.step1.no_number' && first) {
    const sheet = <SheetLink sheet={first} onOpen={onOpen}><DrawingText kind="title" text={first.title} truncate={false} /></SheetLink>
    return <Trans>Trace: the title block of {sheet} (the number field is empty)</Trans>
  }
  if (q.kind === 'check') {
    const gap = gapOf(q)
    if (gap) {
      // No drawing list: the gap was read from the numbers in the title blocks either side of it.
      const sides = [gap.after, gap.before].flatMap((n) => context.sheets.filter((p) => p.number === n && (!q.discipline || p.discipline === q.discipline)).slice(0, 1))
      const [one, two] = sides.map((h) => <SheetLink key={h.id} sheet={h} onOpen={onOpen} />)
      if (!one) return null
      // Its own words, plural on the sides found (the words gate of 164, round 1, M1).
      if (!two) {
        const sheet = one
        return <Trans>Trace: the title block of {sheet}</Trans>
      }
      const first = one
      const second = two
      return (
        <Trans>
          Trace: the title blocks of {first} and {second}
        </Trans>
      )
    }
    if (typeof q.params.page === 'number') {
      const page = q.params.page
      return <Trans>Trace: page {page} of the Plot</Trans>
    }
    const source = <ListSource entry={entry} context={context} onOpen={onOpen} />
    return <Trans>Trace: {source}</Trans>
  }
  if (entry.holds.length > 0) {
    const sheets = <Joined items={entry.holds.map((h) => <SheetLink key={h.id} sheet={h} onOpen={onOpen} />)} />
    return <Trans>Trace: the title block of {sheets}</Trans>
  }
  return null
}

/** "A and B", "A, B and C". */
function Joined({ items }: { items: readonly ReactNode[] }) {
  if (items.length <= 1) return <>{items[0] ?? null}</>
  const head = <>{items.slice(0, -1).flatMap((el, i) => (i === 0 ? [el] : [', ', el]))}</>
  const tail = items.at(-1)
  return (
    <Trans>
      {head} and {tail}
    </Trans>
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
 * The option the API picked for the QS, shown only where two or more independent sources agree and
 * the card can name them (screens.md Takeoff ruling 2, m0-screens 6.7): for two copies of one number,
 * `pickSources` must name two; for any other Question no option is pre-picked yet.
 */
export function usePick(entry: QuestionEntry, context: CardContext): { key: string } | null {
  const picked = optionsOf(entry).find((o) => o.picked && o.key)
  if (!picked?.key) return null
  // Only two copies of one number have sources the card can name yet; any other pick is not shown.
  if (!isCopies(entry) || pickSources(entry, context, picked.key).count < 2) return null
  return { key: picked.key }
}

interface PickSources {
  /** The kept copy's title block: its later revision mark, its later date (one source, not two). */
  mark: boolean
  date: boolean
  /** The Discipline's drawing list read on a sheet gives the number the kept copy's mark (a second source). */
  list: ProposalOut | 'found' | null
  count: number
}

const sameMark = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

/**
 * What agrees on keeping one of two copies (m0-screens 6.7 and 7's "the later revision mark, the later
 * date and the drawing list on S-01 agree"): the kept copy's title block (a later revision mark or date)
 * and the drawing list read on a sheet, when it lists the number with the kept copy's mark.
 */
export function pickSources(entry: QuestionEntry, context: CardContext, pick: string): PickSources {
  const none: PickSources = { mark: false, date: false, list: null, count: 0 }
  if (!isCopies(entry) || (pick !== 'keep_b' && pick !== 'keep_a')) return none
  const [later, earlier] = entry.holds as [ProposalOut, ProposalOut]
  const keep = pick === 'keep_b' ? later : earlier
  const drop = pick === 'keep_b' ? earlier : later
  const mark = !!keep.revision_mark.trim() && !!drop.revision_mark.trim() && keep.revision_mark.localeCompare(drop.revision_mark, 'en', { numeric: true }) > 0
  const date = !!keep.issue_date && !!drop.issue_date && keep.issue_date > drop.issue_date
  const list = context.lists[entry.question.discipline ?? keep.discipline ?? '']
  const listed = keep.number ? list?.read_revisions?.[keep.number] : undefined
  const agrees = !!listed && !!keep.revision_mark.trim() && sameMark(listed, keep.revision_mark) && !sameMark(listed, drop.revision_mark)
  const on = agrees ? (list?.read_on ? context.sheets.find((p) => p.sheet_id === list.read_on) : undefined) : undefined
  return { mark, date, list: agrees ? (on ?? 'found') : null, count: (mark || date ? 1 : 0) + (agrees ? 1 : 0) }
}

/** The pre-pick's sources in words ("the later revision mark and the drawing list on S-01 agree"), or null. */
export function usePickSources(entry: QuestionEntry, context: CardContext): ReactNode | null {
  const pick = usePick(entry, context)?.key
  if (!pick) return null
  const found = pickSources(entry, context, pick)
  if (found.count < 2 || !found.list) return null
  const list = found.list === 'found' ? <Trans>the drawing list found in the drawings</Trans> : <Trans>the drawing list on <SheetName sheets={[found.list]} /></Trans>
  if (found.mark && found.date) return <Trans>the later revision mark, the later date and {list} agree</Trans>
  if (found.mark) return <Trans>the later revision mark and {list} agree</Trans>
  return <Trans>the later date and {list} agree</Trans>
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
  // 21c raises every Check with the drawing list's options; a numbering gap words two of them for itself.
  const gap = gapOf(entry.question)
  if (gap && key === 'not_sent_yet') {
    const missing = typeof entry.question.params.missing === 'number' ? entry.question.params.missing : 1
    return <Plural value={missing} one="Not sent yet: keep the missing sheet in the count and ask the consultant" other="Not sent yet: keep the missing sheets in the count and ask the consultant" />
  }
  if (gap && key === 'not_in_set') return <Trans>Not part of this set: the numbering skips here</Trans>
  const words = OPTION_NAMES[key] ?? (entry.question.kind === 'low_confidence' ? SHEET_KIND_NAMES[key] : undefined)
  return <>{i18n._(words ?? OTHER_OPTION)}</>
}

/** The card's first line (§5 item 2, §6.7), for the option picked (pre-picked in M0), else what it settles. */
export function Answering({ entry, context }: { entry: QuestionEntry; context: CardContext }) {
  const names = context.names
  const picked = usePick(entry, context)?.key
  const n = entry.holds.length
  const q = entry.question
  if (entry.withdrawn) {
    const sheet = <SheetName sheets={entry.holds} />
    return <Trans>Withdrawn when {sheet} was left out. {sheet} can be confirmed back in once this is answered.</Trans>
  }
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
  if (entry.withdrawn) {
    const sheet = <SheetName sheets={entry.holds} />
    return <Trans>Questions cannot be answered on this screen yet, so {sheet} stays left out until this one is answered.</Trans>
  }
  const discipline = entry.question.discipline
  if (!discipline) return <Trans>Questions cannot be answered on this screen yet. Confirm the other sheets meanwhile.</Trans>
  const name = disciplineName(discipline, i18n)
  return <Trans>Questions cannot be answered on this screen yet, so {name} cannot be confirmed until this Question is answered. Confirm its other sheets meanwhile.</Trans>
}
