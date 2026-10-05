/*
 * A Question's words (m0-screens §5's templates, §6.7): its kind line, its title, each option and the
 * card's first line, "what answering does". The card, the bar and the list's row all word a Question
 * through here, so they agree. Where 19a's Question lacks a fact (a held file's name comes from the
 * Drawing Set's files; a copy's mark and date from the sheets it holds), the words use what the screen has.
 */
import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { DrawingText } from '@/ui'
import { SheetName } from './acts'
import type { ProposalOut } from './data'
import { distinctTitles, gapOf, titlesDiffer, type QuestionEntry, type Step1Model } from './model'
import { disciplineName } from './SheetList'
import { useHasEnglish } from './useHasEnglish'
import { DISCIPLINE_NAMES, OPTION_NAMES, OTHER_OPTION, OTHER_QUESTION, QUESTION_KINDS, QUESTION_KIND_BY_CODE, SHEET_KIND_NAMES } from './words'

type Option = { key?: string; picked?: boolean }

/** The options in the card's order: where one number's sheets are titled apart, "keep both" first (#322), so keys 1–9 take them in that order. */
export function optionsOf(entry: QuestionEntry): Option[] {
  const options = entry.question.options.map((o) => (typeof o === 'object' && o !== null ? (o as Option) : {}))
  if (!isTitledApart(entry)) return options
  return [...options.filter((o) => o.key === 'keep_all'), ...options.filter((o) => o.key !== 'keep_all')]
}

const isCopies = (entry: QuestionEntry) => entry.question.code === 'engine.conflicts.same_number' && entry.holds.length >= 2

/** Two or more sheets of one number whose titles differ: likely different sheets, so never worded as copies or "superseded" (#322). */
export const isTitledApart = (entry: QuestionEntry) => isCopies(entry) && titlesDiffer(entry.holds)

/** A sheet's title in quotes, as a card names it: “PLAN”; "no title read" for a sheet whose title was not read. */
function Titled({ sheet }: { sheet: ProposalOut }) {
  if (!sheet.title.trim()) return <Trans>no title read</Trans>
  const title = <DrawingText kind="title" text={sheet.title} truncate={false} />
  return <Trans>“{title}”</Trans>
}

function params(entry: QuestionEntry): Record<string, string | number> {
  return Object.fromEntries(Object.entries(entry.question.params).filter(([, v]) => typeof v === 'string' || typeof v === 'number')) as Record<string, string | number>
}

/** The kind in the card's header: "Two sheets, one number". */
export function useKindLine(entry: QuestionEntry): string {
  const { i18n, t } = useLingui()
  const f = useFormat()
  const q = entry.question
  // Counted as the card lists them, from `params.sheets` (#321); without it, the generic words.
  const n = typeof q.params.sheets === 'number' && q.params.sheets > 1 ? q.params.sheets : null
  const count = n === null ? '' : f.integer(n)
  if (q.code === 'engine.conflicts.same_title' && n !== null) return n === 2 ? t`One title on two sheets` : t`One title on ${count} sheets`
  if (q.code === 'engine.conflicts.same_storey' && n !== null) return t({ message: plural(n, { 2: 'Two sheets may draw one thing', other: '# sheets may draw one thing' }) })
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
    if (titles.length === 1 && !titles[0]!.trim())
      return <Plural value={entry.holds.length} _2="Neither has a title. Only one can be read, unless they are different sheets." other="None of the # has a title. Only one can be read, unless they are different sheets." />
    if (titles.length === 1) {
      const title = <DrawingText kind="title" text={titles[0]!} truncate={false} />
      return <Trans>Both are titled “{title}”. Only one can be read.</Trans>
    }
    // A title not read is no different title (#447, round 1): said as what was read.
    const read = distinctTitles(entry.holds)
    if (read.length === 0)
      return <Plural value={entry.holds.length} _2="Neither has a title. Only one can be read, unless they are different sheets." other="None of the # has a title. Only one can be read, unless they are different sheets." />
    if (read.length === 1) {
      const title = <DrawingText kind="title" text={read[0]!.title} truncate={false} />
      return <Trans>“{title}” is the only title read. Only one can be read.</Trans>
    }
    if (isTitledApart(entry)) {
      const named = <Joined items={distinctTitles(entry.holds).map((h) => <Titled key={h.id} sheet={h} />)} />
      return <Trans>They carry the same number, but their titles differ: {named}. They may be different sheets.</Trans>
    }
    return <Trans>Their titles differ. Only one can be read, unless they are different sheets.</Trans>
  }
  if (q.code === 'takeoff.step1.no_number' && first) {
    const title = <DrawingText kind="title" text={first.title} truncate={false} />
    const file = <DrawingText kind="file-name" text={first.file_name} truncate={false} />
    if (!first.title.trim()) return <Trans>A sheet in {file} has neither a number nor a title in its title block.</Trans>
    return <Trans>A sheet titled “{title}” in {file} has an empty number in its title block.</Trans>
  }
  if (q.code === 'takeoff.step1.which_kind' && first) {
    const title = <DrawingText kind="title" text={first.title} truncate={false} />
    const number = <SheetName sheets={[first]} />
    if (!first.title.trim() && !first.number) return <Trans>It has neither a number nor a title, so nothing says which kind of sheet it is. Its kind decides which Takeoff steps read it.</Trans>
    if (!first.title.trim()) return <Trans>It has no title, so nothing says which kind of sheet {number} is. Its kind decides which Takeoff steps read it.</Trans>
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
    if (!first.title.trim()) {
      const untitled = <SheetLink sheet={first} onOpen={onOpen} />
      return <Trans>Trace: the title block of {untitled} (its number and title fields are empty)</Trans>
    }
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
/** The latest of the copies, as 21c keeps it for "keep the latest": by issue date, then revision mark. */
export function latestOf(copies: readonly ProposalOut[]): ProposalOut | undefined {
  const date = (text: string | null | undefined): number => {
    const parts = (text ?? '').trim().split(/[./-]/).filter((x) => /^\d+$/.test(x)).map(Number)
    if (parts.length !== 3) return 0
    const [first, month, last] = parts as [number, number, number]
    const [day, year] = first > 31 ? [last, first] : [first, last] // written year first, or day first
    return year * 10000 + month * 100 + day
  }
  return [...copies].sort((a, b) => date(b.issue_date) - date(a.issue_date) || b.revision_mark.localeCompare(a.revision_mark, 'en', { numeric: true, sensitivity: 'base' }))[0]
}

/** The copy kept and the copy left out by a pick on two sheets of one number, or null for another pick. */
function keptAndDropped(entry: QuestionEntry, key: string): { keep: ProposalOut; drop: ProposalOut } | null {
  if (!isCopies(entry)) return null
  const [later, earlier] = entry.holds as [ProposalOut, ProposalOut]
  if (key === 'keep_b') return { keep: later, drop: earlier }
  if (key === 'keep_a') return { keep: earlier, drop: later }
  if (key !== 'keep_latest') return null
  const keep = latestOf(entry.holds) ?? later
  const drop = entry.holds.find((h) => h !== keep) ?? earlier
  return { keep, drop }
}

export function usePick(entry: QuestionEntry, context: CardContext): { key: string } | null {
  return prePick(entry, context)
}

/** The option pre-picked for the QS (usePick's, outside a component). */
export function prePick(entry: QuestionEntry, context: CardContext): { key: string } | null {
  const picked = optionsOf(entry).find((o) => o.picked && o.key)
  if (!picked?.key) return null
  // Only two copies of one number have sources the card can name yet; any other pick is not shown.
  // Titled apart, they may be two sheets: nothing is picked for the QS (#322).
  if (!isCopies(entry) || isTitledApart(entry) || pickSources(entry, context, picked.key).count < 2) return null
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
  const pair = keptAndDropped(entry, pick)
  if (!pair) return none
  const { keep, drop } = pair
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
  const pair = keptAndDropped(entry, key)
  if (pair && isTitledApart(entry)) {
    const kept = <Titled sheet={pair.keep} />
    const dropped = <Titled sheet={pair.drop} />
    const others = entry.holds.length - 1
    if (others > 1)
      return (
        <Trans>
          Keep {kept}; leave the other <Plural value={others} one="# sheet" other="# sheets" /> out
        </Trans>
      )
    return (
      <Trans>
        Keep {kept}; leave {dropped} out
      </Trans>
    )
  }
  if (pair) {
    const { keep, drop } = pair
    const later = entry.holds[0]
    const kept = <CopyIn sheet={keep} other={drop} first={keep === later} />
    const dropped = <CopyIn sheet={drop} other={keep} first={drop === later} />
    const byMark = !!keep.revision_mark.trim() && !!drop.revision_mark.trim() && keep.revision_mark !== drop.revision_mark
    const date = byMark && keep.issue_date ? f.day(keep.issue_date) : null
    const others = entry.holds.length - 1
    if (others > 1)
      return date ? (
        <Trans>
          Keep {kept} ({date}); leave the other <Plural value={others} one="# copy" other="# copies" /> out as superseded
        </Trans>
      ) : (
        <Trans>
          Keep {kept}; leave the other <Plural value={others} one="# copy" other="# copies" /> out as superseded
        </Trans>
      )
    return date ? <Trans>Keep {kept} ({date}); leave {dropped} out as superseded</Trans> : <Trans>Keep {kept}; leave {dropped} out as superseded</Trans>
  }
  const q = entry.question
  if (key === 'keep_all') {
    const n = entry.holds.length
    if (q.code === 'engine.conflicts.same_storey') return <Plural value={n} _0="They draw different things: keep them all" one="They draw different things: keep it" _2="They draw different things: keep both" other="They draw different things: keep all #" />
    return <Plural value={n} _0="They are different sheets: keep them all" one="They are different sheets: keep it" _2="They are different sheets: keep both" other="They are different sheets: keep all #" />
  }
  if (key === 'use_read' && typeof q.params.sheet === 'string' && q.params.sheet) {
    const sheet = q.params.sheet
    if (q.params.named === 'number') {
      const number = <DrawingText kind="sheet-number" text={sheet} truncate={false} />
      return <Trans>Use the drawing list on {number}</Trans>
    }
    const title = <DrawingText kind="title" text={sheet} truncate={false} />
    return <Trans>Use the drawing list on the sheet titled “{title}”</Trans>
  }
  if (key === 'use_given' && q.params.source === 'pasted') return <Trans>Use the drawing list you pasted</Trans>
  if (key === 'use_given' && q.params.source === 'typed') return <Trans>Use the range you typed</Trans>
  if (q.kind === 'missing_discipline' && key !== 'keep_open') return <>{disciplineName(key, i18n)}</>
  // 21c raises every Check with the drawing list's options; a numbering gap words two of them for itself.
  const gap = gapOf(entry.question)
  if (gap && key === 'not_sent_yet') {
    const missing = typeof entry.question.params.missing === 'number' ? entry.question.params.missing : 1
    return <Plural value={missing} one="Not sent yet: keep the missing sheet in the count and ask the consultant" other="Not sent yet: keep the missing sheets in the count and ask the consultant" />
  }
  if (gap && key === 'not_in_set') return <Trans>Not part of this set: the numbering skips here</Trans>
  // A sheet in a file but not on the drawing list: the list does not hold it, so the option says what is left to do.
  if (entry.question.code === 'engine.register_check.not_listed' && key === 'not_in_set') return <Trans>Not part of this set: record it, then exclude it in the list</Trans>
  const words = OPTION_NAMES[key] ?? (q.kind === 'low_confidence' ? SHEET_KIND_NAMES[key] : undefined)
  return <>{i18n._(words ?? OTHER_OPTION)}</>
}

/** The card's first line (§5 item 2, §6.7), for the option picked (pre-picked in M0), else what it settles. */
export function Answering({ entry, context, choice, hint = false }: { entry: QuestionEntry; context: CardContext; choice?: string | null; hint?: boolean }) {
  const { i18n } = useLingui()
  const names = context.names
  const prePick = usePick(entry, context)?.key
  const picked = choice ?? prePick
  const n = entry.holds.length
  const q = entry.question
  if (entry.withdrawn) {
    const sheet = <SheetName sheets={entry.holds} />
    const Sheet = <SheetName sheets={entry.holds} start />
    return <Trans>Withdrawn when {sheet} was left out. {Sheet} can be confirmed back in once this is answered.</Trans>
  }
  const keys = <PickKeys entry={entry} />
  const discipline = q.discipline ? disciplineName(q.discipline, i18n) : null
  if (q.kind === 'file_misread') {
    // §6.7's held-file row: each pick's own first line; before a pick, what it decides and the keys.
    const named = !!(q.subject_id && names[q.subject_id])
    const file = <FileName entry={entry} names={names} />
    if (picked === 'read_anyway')
      return named ? (
        <Trans>Answering reads {file} anyway: its sheets join the list as Proposals, each marked held, and their figures are flagged later.</Trans>
      ) : (
        <Trans>Answering reads this file anyway: its sheets join the list as Proposals, each marked held, and their figures are flagged later.</Trans>
      )
    if (picked === 'await_resaved' || picked === 'sent_to_vextrus')
      return discipline ? (
        <Trans>Answering sets the file aside: none of its sheets is read or counted. {discipline} can still be confirmed.</Trans>
      ) : (
        <Trans>Answering sets the file aside: none of its sheets is read or counted.</Trans>
      )
    if (picked === 'keep_open')
      return discipline ? <Trans>Answering keeps the file held. {discipline} cannot be confirmed until it is answered.</Trans> : <Trans>Answering keeps the file held.</Trans>
    if (hint && !picked)
      return named ? (
        <Trans>Answering decides whether {file}’s sheets join the list. Pick an answer: {keys}.</Trans>
      ) : (
        <Trans>Answering decides whether this file’s sheets join the list. Pick an answer: {keys}.</Trans>
      )
    return named ? <Trans>Answering decides whether {file}’s sheets join the list.</Trans> : <Trans>Answering decides whether this file’s sheets join the list.</Trans>
  }
  if (q.kind === 'check' && picked) {
    // §6.7's drawing-list row: what each pick does to the entry (or the gap) and to its Discipline.
    const gap = gapOf(q)
    const listed = typeof q.params.number === 'string' && q.params.number ? q.params.number : null
    const entryName = listed ? <DrawingText kind="sheet-number" text={listed} truncate={false} /> : n > 0 ? <SheetName sheets={entry.holds} /> : null
    const missing = typeof q.params.missing === 'number' ? q.params.missing : 1
    // A sheet in a file but not on the drawing list: it exists, and stays in the list whatever is picked.
    const unlisted = q.code === 'engine.register_check.not_listed'
    if (picked === 'not_in_set') {
      if (gap) return <Trans>Answering records that the numbering skips here: nothing is missing.</Trans>
      if (unlisted && entryName) return <Trans>Answering records that {entryName} is not part of this set; exclude it in the list.</Trans>
      // 21c records it and takes nothing off the drawing list (#206): said as what is recorded.
      const recorded = entryName ? (
        <Trans>Answering records that {entryName} is not part of this set; it stays on the drawing list.</Trans>
      ) : (
        <Trans>Answering records that the sheet is not part of this set; it stays on the drawing list.</Trans>
      )
      return discipline ? (
        <>
          {recorded} <Trans>{discipline} can still be confirmed.</Trans>
        </>
      ) : (
        recorded
      )
    }
    if (picked === 'not_sent_yet' || picked === 'file_not_added') {
      // A gap is raised only without a drawing list: the missing numbers were never in the count.
      const kept = gap ? (
        <Plural
          value={missing}
          one="Answering records that the missing sheet is still to come. Paste the drawing list to count it."
          other="Answering records that the # missing sheets are still to come. Paste the drawing list to count them."
        />
      ) : unlisted && entryName ? (
        <Trans>Answering records your pick; {entryName} stays in the list, to confirm or exclude.</Trans>
      ) : entryName ? (
        <Trans>Answering keeps {entryName} in the count as missing.</Trans>
      ) : (
        <Trans>Answering keeps the sheet in the count as missing.</Trans>
      )
      return discipline ? (
        <>
          {kept} <Trans>{discipline} can still be confirmed.</Trans>
        </>
      ) : (
        kept
      )
    }
    if (picked === 'keep_open') {
      const open = gap ? <Trans>Answering keeps this gap open.</Trans> : entryName ? <Trans>Answering keeps {entryName} open.</Trans> : <Trans>Answering keeps this Question open.</Trans>
      return discipline ? (
        <>
          {open} <Trans>{discipline} cannot be confirmed until this Question is answered.</Trans>
        </>
      ) : (
        open
      )
    }
  }
  if (q.kind === 'missing' && n > 0) {
    // §6.7's no-number row, as 21c does it: the number is set (or left empty); the sheet is confirmed in the list.
    if (picked === 'no_number') return <Trans>Answering leaves the sheet without a number; confirm it in the list.</Trans>
    if (picked === 'type_number') return <Trans>Answering gives the sheet the number you type; confirm it in the list.</Trans>
  }
  if (picked && RECORDED_ONLY.has(picked)) return <Trans>Answering records your pick; the copies stay as they are, to confirm or exclude in the list.</Trans>
  if (isCopies(entry) && picked) {
    const [later] = entry.holds as [ProposalOut, ProposalOut]
    const number = <SheetName sheets={[later]} />
    const pair = keptAndDropped(entry, picked)
    if (pair && isTitledApart(entry)) {
      const kept = <Titled sheet={pair.keep} />
      const dropped = <Titled sheet={pair.drop} />
      const others = n - 1
      if (others > 1)
        return (
          <Trans>
            Answering confirms {kept}; the other <Plural value={others} one="# sheet is" other="# sheets are" /> left out.
          </Trans>
        )
      return (
        <Trans>
          Answering confirms {kept}; {dropped} is left out.
        </Trans>
      )
    }
    if (isTitledApart(entry) && picked === 'keep_all' && n === 2) return <Trans>Answering confirms both sheets.</Trans>
    if (isTitledApart(entry) && picked === 'keep_open' && n === 2) return <Trans>Answering keeps both sheets open. Neither is read until the consultant replies.</Trans>
    if (pair) {
      const { keep, drop } = pair
      const kept = <CopyIn sheet={keep} other={drop} first={keep === later} />
      const dropped = <CopyIn sheet={drop} other={keep} first={drop === later} />
      const others = n - 1
      if (others > 1)
        return (
          <Trans>
            Answering confirms {number} ({kept}) and excludes the other <Plural value={others} one="# copy" other="# copies" /> as superseded.
          </Trans>
        )
      return (
        <Trans>
          Answering confirms {number} ({kept}) and excludes {number} ({dropped}) as superseded.
        </Trans>
      )
    }
    if (picked === 'keep_all' && n === 2) return <Trans>Answering confirms both copies.</Trans>
    if (picked === 'keep_open' && !isTitledApart(entry)) return <Trans>Answering keeps both copies open. Neither is read until the consultant replies.</Trans>
  }
  if (picked === 'keep_open' && n > 0) {
    const name = <SheetName sheets={entry.holds} />
    return <Trans>Answering keeps {name} open.</Trans>
  }
  if (picked === 'keep_all' && n > 0) return <Plural value={n} one="Answering confirms # sheet." other="Answering confirms # sheets." />
  if (q.code === 'takeoff.proposals.lists_disagree') {
    const name = disciplineName(q.discipline, i18n)
    return hint && !picked ? (
      <Trans>Answering decides which drawing list {name}’s sheets are counted against. Pick an answer: {keys}.</Trans>
    ) : (
      <Trans>Answering decides which drawing list {name}’s sheets are counted against.</Trans>
    )
  }
  if (q.kind === 'low_confidence' && picked && picked !== 'keep_open' && SHEET_KIND_NAMES[picked] && n > 0) {
    const sheet = <SheetName sheets={entry.holds} />
    const kind = i18n._(SHEET_KIND_NAMES[picked]!)
    return <Trans>Answering sets the kind of {sheet} to {kind} and confirms it, unless its number or Discipline is still asked.</Trans>
  }
  if (n === 0) return hint && !picked ? <Trans>Answering confirms no sheets. Pick an answer: {keys}.</Trans> : <Trans>Answering confirms no sheets.</Trans>
  if (hint && !picked)
    return (
      <>
        <Plural value={n} one="Answering settles # sheet." other="Answering settles # sheets." /> <Trans>Pick an answer: {keys}.</Trans>
      </>
    )
  return <Plural value={n} one="Answering settles # sheet." other="Answering settles # sheets." />
}

/** Two copies' older keys (the seed's): 21c records them and changes no sheet, so their words promise nothing. */
const RECORDED_ONLY: ReadonlySet<string> = new Set(['keep_b', 'keep_a', 'keep_both'])

/** "1, 2, 3": the number keys of a card's options (at most 9 have one). */
function PickKeys({ entry }: { entry: QuestionEntry }) {
  const f = useFormat()
  const n = Math.min(9, optionsOf(entry).length)
  return <>{Array.from({ length: n }, (_, i) => f.integer(i + 1)).join(', ')}</>
}

/** The card's foot: who answers, and what waits on the answer. */
export function AnswerNote({ entry, readOnly }: { entry: QuestionEntry; readOnly: 'md' | 'guest' | null }): ReactNode {
  const { i18n } = useLingui()
  if (readOnly === 'md') return <Trans>Waiting for the QS. The MD reads Questions and cannot answer them.</Trans>
  if (readOnly === 'guest') return <Trans>Waiting for the QS. A Guest reads Questions and cannot answer them.</Trans>
  if (entry.withdrawn) {
    const sheet = <SheetName sheets={entry.holds} start />
    return <Trans>{sheet} stays left out until this Question is answered. A pick changes nothing until you answer.</Trans>
  }
  const discipline = entry.question.discipline
  if (!discipline) return <Trans>A pick changes nothing until you answer.</Trans>
  const name = disciplineName(discipline, i18n)
  return <Trans>A pick changes nothing until you answer. {name} cannot be confirmed until this Question is answered.</Trans>
}

/**
 * The toast after an answer (§6.5: "Q3 answered. Confirms S-19 R1 and excludes R0 as superseded."),
 * naming only what 21c's answer does to the sheets; "Keep open" says the Question stays.
 */
function SheetKindName({ option }: { option: string }) {
  const { i18n } = useLingui()
  return <>{i18n._(SHEET_KIND_NAMES[option]!)}</>
}

export function AnsweredWords({ entry, option, text }: { entry: QuestionEntry; option: string; text: string }) {
  const tag = entry.tag
  const n = entry.holds.length
  if (option === 'keep_open') return <Trans>{tag} kept open for the consultant.</Trans>
  if (RECORDED_ONLY.has(option)) return <Trans>{tag} answered. Its sheets are unchanged: confirm or exclude them in the list.</Trans>
  const pair = keptAndDropped(entry, option)
  if (pair && isTitledApart(entry)) {
    const kept = <Titled sheet={pair.keep} />
    const dropped = <Titled sheet={pair.drop} />
    const others = n - 1
    if (others > 1)
      return (
        <Trans>
          {tag} answered. Confirms {kept}; the other <Plural value={others} one="# sheet is" other="# sheets are" /> left out.
        </Trans>
      )
    return (
      <Trans>
        {tag} answered. Confirms {kept}; {dropped} is left out.
      </Trans>
    )
  }
  if (pair) {
    // A toast is drawn outside the format's provider: the copies go by their marks, never their dates.
    const number = <SheetName sheets={[pair.keep]} />
    const others = n - 1
    const marked = !!pair.keep.revision_mark.trim() && !!pair.drop.revision_mark.trim() && pair.keep.revision_mark !== pair.drop.revision_mark
    if (!marked || others > 1) {
      return (
        <Trans>
          {tag} answered. Confirms the latest copy of {number} and excludes the other <Plural value={others} one="# copy" other="# copies" /> as superseded.
        </Trans>
      )
    }
    const kept = <Copy sheet={pair.keep} />
    const dropped = <Copy sheet={pair.drop} />
    return (
      <Trans>
        {tag} answered. Confirms {number} {kept} and excludes {dropped} as superseded.
      </Trans>
    )
  }
  // Nothing held (or one copy): 21c confirms what it holds, so say what it did with what is there.
  if (option === 'keep_latest') {
    if (n === 0) return <Trans>{tag} answered. Recorded: keep the latest copy; no sheet was confirmed.</Trans>
    const sheet = <SheetName sheets={entry.holds} />
    return <Trans>{tag} answered. Confirms {sheet}.</Trans>
  }
  if (option === 'keep_all' && n === 0) return <Trans>{tag} answered. Recorded: keep them all; no sheet was confirmed.</Trans>
  if (option === 'keep_all' && n > 0) {
    return (
      <Trans>
        {tag} answered. <Plural value={n} one="Confirms # sheet." other="Confirms # sheets." />
      </Trans>
    )
  }
  if (option === 'type_number' && text) {
    const number = <DrawingText kind="sheet-number" text={text} truncate={false} />
    return <Trans>{tag} answered. The sheet is numbered {number}.</Trans>
  }
  // §6.5: the toast names what the answer did (the walk, M7).
  const q = entry.question
  if (q.kind === 'file_misread') {
    if (option === 'read_anyway') return <Trans>{tag} answered. Reading the file again: its sheets join the list, marked held, once it is read.</Trans>
    if (option === 'await_resaved') return <Trans>{tag} answered. The file is set aside, waiting for the re-saved file.</Trans>
    if (option === 'sent_to_vextrus') return <Trans>{tag} answered. The file is set aside and marked for Vextrus to look at.</Trans>
  }
  if (q.kind === 'low_confidence' && SHEET_KIND_NAMES[option] && n === 0) {
    const kind = <SheetKindName option={option} />
    return <Trans>{tag} answered. Recorded the kind as {kind}; no sheet was confirmed.</Trans>
  }
  if (q.kind === 'low_confidence' && SHEET_KIND_NAMES[option] && n > 0) {
    const sheet = <SheetName sheets={entry.holds} />
    const kind = <SheetKindName option={option} />
    // 21c confirms it only when nothing else holds it (its number or Discipline asked, or left out it keeps the kind alone).
    return <Trans>{tag} answered. The kind of {sheet} is {kind}.</Trans>
  }
  if (q.kind === 'missing' && option === 'no_number') return <Trans>{tag} answered. The sheet stays without a number.</Trans>
  if (q.kind === 'missing_discipline' && option in DISCIPLINE_NAMES && n === 0) {
    // 21c sets the Discipline of the sheet the Question is about, held or not.
    const discipline = <DisciplineWord option={option} />
    return <Trans>{tag} answered. The sheet’s Discipline is {discipline}.</Trans>
  }
  if (q.kind === 'missing_discipline' && option in DISCIPLINE_NAMES && n > 0) {
    const sheet = <SheetName sheets={entry.holds} />
    const discipline = <DisciplineWord option={option} />
    return <Trans>{tag} answered. The Discipline of {sheet} is {discipline}.</Trans>
  }
  if (option === 'includes_storey' || option === 'excludes_storey') {
    if (n === 0) return option === 'includes_storey' ? <Trans>{tag} answered. Recorded: the sheet’s range includes its top storey.</Trans> : <Trans>{tag} answered. Recorded: the sheet’s top storey belongs to the next sheet’s range.</Trans>
    const sheet = <SheetName sheets={entry.holds} />
    return option === 'includes_storey' ? <Trans>{tag} answered. Recorded: the range on {sheet} includes its top storey.</Trans> : <Trans>{tag} answered. Recorded: the top storey on {sheet} belongs to the next sheet’s range.</Trans>
  }
  if (q.code === 'takeoff.proposals.lists_disagree' && (option === 'use_read' || option === 'use_given')) return <ListUsed entry={entry} option={option} />
  if (q.kind === 'check') return <CheckAnswered entry={entry} option={option} />
  // A code or option this screen does not know yet: still not the bare tag (round 3's design gate).
  return <Trans>{tag} answered. Your answer is recorded.</Trans>
}

function DisciplineWord({ option }: { option: string }) {
  const { i18n } = useLingui()
  return <>{disciplineName(option, i18n)}</>
}

/** The two lists' Question answered: which list the Discipline's sheets are now counted against. */
function ListUsed({ entry, option }: { entry: QuestionEntry; option: 'use_read' | 'use_given' }) {
  const { i18n } = useLingui()
  const tag = entry.tag
  const q = entry.question
  const name = disciplineName(q.discipline, i18n)
  if (option === 'use_read') {
    if (typeof q.params.sheet === 'string' && q.params.sheet) {
      const sheet = q.params.sheet
      if (q.params.named === 'number') {
        const number = <DrawingText kind="sheet-number" text={sheet} truncate={false} />
        return <Trans>{tag} answered. {name}’s sheets are counted against the drawing list on {number}.</Trans>
      }
      const title = <DrawingText kind="title" text={sheet} truncate={false} />
      return <Trans>{tag} answered. {name}’s sheets are counted against the drawing list on the sheet titled “{title}”.</Trans>
    }
    return <Trans>{tag} answered. {name}’s sheets are counted against the drawing list found in the drawings.</Trans>
  }
  if (q.params.source === 'typed') return <Trans>{tag} answered. {name}’s sheets are counted against the range you typed.</Trans>
  return <Trans>{tag} answered. {name}’s sheets are counted against the drawing list you pasted.</Trans>
}

/** A drawing-list Question answered (§6.7's row): the card's first line, said as done. */
function CheckAnswered({ entry, option }: { entry: QuestionEntry; option: string }) {
  const tag = entry.tag
  const q = entry.question
  const gap = gapOf(q)
  const listed = typeof q.params.number === 'string' && q.params.number ? q.params.number : null
  const sheet = listed ? <DrawingText kind="sheet-number" text={listed} truncate={false} /> : entry.holds.length > 0 ? <SheetName sheets={entry.holds} /> : null
  // At a sentence's start, after "Q3 answered." (#167's words gate: an untitled sheet's words are capitalised).
  const Sheet = listed ? sheet : entry.holds.length > 0 ? <SheetName sheets={entry.holds} start /> : null
  const missing = typeof q.params.missing === 'number' ? q.params.missing : 1
  const unlisted = q.code === 'engine.register_check.not_listed'
  if (option === 'not_in_set') {
    if (gap) {
      const after = <DrawingText kind="sheet-number" text={gap.after} truncate={false} />
      const before = <DrawingText kind="sheet-number" text={gap.before} truncate={false} />
      return <Trans>{tag} answered. Recorded: the numbering skips between {after} and {before}; nothing is missing.</Trans>
    }
    if (!sheet) return <Trans>{tag} answered. Recorded: the sheet is not part of this set.</Trans>
    if (unlisted) return <Trans>{tag} answered. Recorded: {sheet} is not part of this set; exclude it in the list.</Trans>
    return <Trans>{tag} answered. Recorded: {sheet} is not part of this set; it stays on the drawing list.</Trans>
  }
  if (option !== 'not_sent_yet' && option !== 'file_not_added') return <Trans>{tag} answered. Your answer is recorded.</Trans>
  if (gap)
    return (
      <Trans>
        {tag} answered. Recorded:{' '}
        <Plural
          value={missing}
          one="the missing sheet is still to come. Paste the drawing list to count it."
          other="the # missing sheets are still to come. Paste the drawing list to count them."
        />
      </Trans>
    )
  if (unlisted && Sheet) return <Trans>{tag} answered. {Sheet} stays in the list, to confirm or exclude.</Trans>
  if (option === 'file_not_added')
    return sheet ? <Trans>{tag} answered. {Sheet} stays in the count as missing until its file is added.</Trans> : <Trans>{tag} answered. The sheet stays in the count as missing until its file is added.</Trans>
  return sheet ? <Trans>{tag} answered. {Sheet} stays in the count as missing.</Trans> : <Trans>{tag} answered. The sheet stays in the count as missing.</Trans>
}
