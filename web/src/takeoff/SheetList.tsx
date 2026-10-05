/*
 * Step 1's list mode (m0-screens §6.2, §6.3): the sheet list as one grid, in sections: "Needs you"
 * (a row per row an open Question holds, in the queue's order), "Proposed to leave out", each
 * Discipline in the Takeoff's order with its progress and its drawing list, then the Disciplines not
 * yet received. Rows are 28 px; continuation sheets are one row. The list is a key region (Space opens
 * the focused sheet; the screen owns the keys); a click focuses a row, a double-click opens it.
 */
import { forwardRef, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { DrawingText, StatusMark, cn, isolateLtr } from '@/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import type { ProposalOut } from './data'
import { SheetRange } from './SheetRange'
import { ActorChip } from './ActorChip'
import { StoreyStrip, StoreysText, stripSlots } from './storeys'
import { QuestionTitle } from './questionWords'
import { distinctTitles, listSheet, rowState, titlesDiffer, type DisciplineSection, type Row, type Step1Model } from './model'
import { DISCIPLINE_NAMES, NOT_RECEIVED_NAMES, OTHER_DISCIPLINE, REASON_SHORT, UNKNOWN_REASON } from './words'

export interface SheetListProps {
  model: Step1Model
  focused: string | null
  onFocusRow: (key: string) => void
  onOpenRow: (key: string) => void
  onPasteList: ((discipline: string) => void) | null
}

/**
 * 6.2's columns: mark, Number, Title, Discipline, Revision and date, Storeys, Views, State; the Storeys
 * column widens from a list 1000 px wide (the list is a container, so the widths follow the list). 6.2's
 * File column (from 1000 px) is not built: ticket 22's acceptance test pins one element per row holding
 * the revision mark, and the file's name ("KR-STR-R0.dwg") would be a second; the Discipline's tooltip
 * names the file instead.
 */
const COLS = cn(
  'grid items-center gap-x-2',
  'grid-cols-[24px_76px_minmax(0,1fr)_78px_106px_180px_40px_150px]',
  '@min-[1000px]:grid-cols-[24px_76px_minmax(0,1fr)_78px_106px_232px_40px_104px_150px]',
)

export const SheetList = forwardRef<HTMLDivElement, SheetListProps>(function SheetList({ model, focused, onFocusRow, onOpenRow, onPasteList }, ref) {
  const { t } = useLingui()
  const questions = model.queue.length
  const slots = stripSlots(model.rows.flatMap((r) => r.sheets.map((p) => p.views)))
  return (
    <div ref={ref} className="@container text-sm">
      <div role="row" className={cn(COLS, 'sticky top-0 z-10 h-7 border-b border-border bg-chrome px-3 text-xs text-muted-foreground')}>
        <span role="columnheader" aria-label={t`State mark`} />
        <span role="columnheader">
          <Trans>Number</Trans>
        </span>
        <span role="columnheader">
          <Trans>Title, as drawn</Trans>
        </span>
        <span role="columnheader">
          <Trans>Discipline</Trans>
        </span>
        <span role="columnheader">
          <Trans>Revision and date</Trans>
        </span>
        <StoreysHeader />
        <span role="columnheader" className="text-end">
          <Trans>Views</Trans>
        </span>
        <span role="columnheader" className={FILE_COLUMN}>
          <Trans>File</Trans>
        </span>
        <span role="columnheader">
          <Trans>State</Trans>
        </span>
      </div>

      {model.needsYou.length > 0 ? (
        <Section
          tone="question"
          heading={<Plural value={questions} one="Needs you: # Question open" other="Needs you: # Questions open, in the order Enter takes them" />}
          rows={model.needsYou}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
          names={model.fileNames}
          slots={slots}
        />
      ) : null}

      {model.withdrawn.length > 0 ? (
        <Section
          heading={
            <Plural
              value={model.withdrawn.length}
              one="# Question withdrawn when its sheet was left out: it needs an answer before the sheet can be confirmed back in"
              other="# Questions withdrawn when their sheets were left out: each needs an answer before its sheets can be confirmed back in"
            />
          }
          rows={model.withdrawn}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
          names={model.fileNames}
          slots={slots}
        />
      ) : null}

      {model.proposedOut.length > 0 ? (
        <Section
          heading={<Trans>Proposed to leave out: excluded sheets stay in the count with their reason</Trans>}
          rows={model.proposedOut}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
          names={model.fileNames}
          slots={slots}
        />
      ) : null}

      {model.disciplines.map((d) => (
        <Section
          key={d.discipline}
          heading={<DisciplineHeading section={d} />}
          side={
            <span className="flex items-center gap-3">
              {d.confirmed ? (
                <span className="text-confirmed">
                  <Trans>✓ confirmed</Trans>
                </span>
              ) : (
                <Settled section={d} />
              )}
              {onPasteList && d.list?.source !== 'sheet' ? (
                <button type="button" tabIndex={-1} onClick={() => onPasteList(d.discipline)} className="text-primary underline-offset-2 hover:underline">
                  {d.list && d.list.source !== 'sheet' ? <Trans>The pasted drawing list</Trans> : <Trans>Paste the drawing list</Trans>}
                </button>
              ) : null}
            </span>
          }
          rows={d.rows}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
          names={model.fileNames}
          slots={slots}
        />
      ))}

      {model.notReceived.length > 0 ? (
        <div role="rowgroup" className="border-t border-border px-3 py-2 text-muted-foreground">
          <div role="row">
            <span role="rowheader" className="font-medium">
              <Trans>Disciplines not yet received</Trans>
            </span>
          </div>
          <div role="row">
            <span role="gridcell">
              <NotReceived keys={model.notReceived} />
            </span>
          </div>
          <div role="row">
            <span role="gridcell" className="text-xs">
              <Trans>Each stays on its allowance until its drawings arrive. A file of a new Discipline opens only its own Step 1; the others stay as they are.</Trans>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
})

function Settled({ section }: { section: DisciplineSection }) {
  const f = useFormat()
  const n = f.integer(section.settled)
  const total = section.total === null ? '—' : f.integer(section.total)
  return (
    <span className="num whitespace-nowrap">
      <Trans>
        {n} / {total} settled
      </Trans>
    </span>
  )
}

function NotReceived({ keys }: { keys: readonly string[] }) {
  const { i18n } = useLingui()
  return <>{keys.map((k) => i18n._(NOT_RECEIVED_NAMES[k] ?? OTHER_DISCIPLINE)).join(' · ')}</>
}

export function disciplineName(key: string | null, i18n: { _: (d: typeof OTHER_DISCIPLINE) => string }): string {
  return i18n._((key && DISCIPLINE_NAMES[key]) || OTHER_DISCIPLINE)
}

/**
 * "Structural 13 found, 13 on the drawing list" / "Architectural 8 found; no drawing list; numbering
 * runs A-01–A-07 without a gap". The name and count lead as a label and its figure, outside the
 * message, so they read as one run of text (a message isolates each value it is given, §1.8).
 */
function DisciplineHeading({ section }: { section: DisciplineSection }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = disciplineName(section.discipline, i18n)
  const found = f.integer(section.found)
  return (
    <>
      {name} {found} <HeadingRest section={section} />
    </>
  )
}

function HeadingRest({ section }: { section: DisciplineSection }) {
  const f = useFormat()
  const list = section.list
  if (list) {
    const listed = f.integer(list.numbers.length)
    const who = list.entered_by ?? ''
    if (list.source === 'pasted') return <Trans>found, {listed} on the drawing list pasted by {who}</Trans>
    if (list.source === 'typed') {
      const range = <SheetRange first={list.numbers[0] ?? ''} last={list.numbers.at(-1) ?? ''} />
      return (
        <Trans>
          found, {listed} on the drawing list typed by {who} ({range})
        </Trans>
      )
    }
    const on = listSheet(section)?.number
    if (!on) return <Trans>found, {listed} on the drawing list found in the drawings</Trans>
    const sheet = <DrawingText kind="sheet-number" text={on} truncate={false} />
    return <Trans>found, {listed} on the drawing list on {sheet}</Trans>
  }
  const run = section.numbering
  if (!run) return <Trans>found; no drawing list; the numbers do not run in one series</Trans>
  const range = <SheetRange first={run.first} last={run.last} />
  if (run.missing.length === 0 && run.twice.length === 0)
    return (
      <Trans>
        found; no drawing list; numbering runs {range} without a gap
      </Trans>
    )
  const listed = <Numbers numbers={run.missing} />
  const twice = <Numbers numbers={run.twice} />
  if (run.missing.length === 0)
    return (
      <Trans>
        found; no drawing list; numbering runs {range}; {twice} twice
      </Trans>
    )
  if (run.twice.length === 0)
    return (
      <Trans>
        found; no drawing list; numbering runs {range}; {listed} missing
      </Trans>
    )
  return (
    <Trans>
      found; no drawing list; numbering runs {range}; {listed} missing; {twice} twice
    </Trans>
  )
}

function Section({
  heading,
  side,
  rows,
  tone,
  focused,
  onFocusRow,
  onOpenRow,
  names,
  slots,
}: {
  heading: ReactNode
  side?: ReactNode
  rows: readonly Row[]
  tone?: 'question'
  focused: string | null
  onFocusRow: (key: string) => void
  onOpenRow: (key: string) => void
  names: Readonly<Record<string, string>>
  slots: readonly string[]
}) {
  return (
    <div role="rowgroup">
      <div
        className={cn(
          'sticky top-7 z-[5] flex h-[26px] items-center justify-between gap-4 border-b border-border px-3 text-xs',
          tone === 'question' ? 'bg-question-surface text-question' : 'bg-chrome-sunken text-ink-secondary',
        )}
      >
        <span className="min-w-0 truncate font-medium">{heading}</span>
        {side ? <span>{side}</span> : null}
      </div>
      {rows.map((row) => (
        <SheetRow key={row.key} row={row} focused={focused === row.key} tabbable={focused === row.key || (focused === null && row === rows[0])} onFocus={onFocusRow} onOpen={onOpenRow} names={names} slots={slots} />
      ))}
    </div>
  )
}

/** 6.2's File column: shown only where the list is at least 1000 px wide. */
const FILE_COLUMN = 'hidden @min-[1000px]:block'

/** The source file (6.2); its tooltip adds where in it the sheet is laid out. */
function FileCell({ sheet }: { sheet: ProposalOut }) {
  const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
  const layout = sheet.layout
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={-1} className="block truncate">
          <DrawingText kind="file-name" text={sheet.file_name} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {layout ? (
          <Trans>
            {file}, layout “<DrawingText kind="mark" text={layout} truncate={false} />”
          </Trans>
        ) : (
          <Trans>{file}, laid out in the drawing</Trans>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** The Discipline's name; its tooltip names the file it came from (6.2). */
function DisciplineCell({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const name = disciplineName(sheet.discipline, i18n)
  const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={-1}>{name}</span>
      </TooltipTrigger>
      <TooltipContent>
        <Trans>
          {name}, from the file {file}
        </Trans>
      </TooltipContent>
    </Tooltip>
  )
}

/** 6.2's Storeys header: "Storeys per view" at 1280; at 1440 the strip's key, "▮ floor to floor  ▁ at floor level"; its tooltip explains the strip. */
function StoreysHeader() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="columnheader" tabIndex={-1} className="truncate">
          <span className="@min-[1000px]:hidden">
            <Trans>Storeys per view</Trans>
          </span>
          <span className="hidden @min-[1000px]:inline">
            <Trans>▮ floor to floor  ▁ at floor level</Trans>
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <Trans>Each slot is a storey: foundations, Basement, Ground, Mezzanine, 1st to 9th, Roof, the roofs above. A full slot is floor to floor; a bar at its foot is members at that floor level.</Trans>
      </TooltipContent>
    </Tooltip>
  )
}

/** "R1, 14 Sep 2026"; a mark read from the file name shows the same, its tooltip saying so; "—" for neither (6.2). */
function Revision({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const mark = sheet.revision_mark
  const date = sheet.issue_date ? f.day(sheet.issue_date) : null
  if (!mark && !date) return <span className="text-muted-foreground">—</span>
  const markText = <DrawingText kind="revision" text={mark} truncate={false} />
  const shown = !mark ? <>{date}</> : date ? <Trans>{markText}, {date}</Trans> : markText
  if (mark && sheet.revision_mark_source === 'file_name') {
    const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={-1}>{shown}</span>
        </TooltipTrigger>
        <TooltipContent>
          <Trans>
            {markText}, from the file name {file}
          </Trans>
        </TooltipContent>
      </Tooltip>
    )
  }
  return shown
}

function State({ row }: { row: Row }) {
  const { i18n } = useLingui()
  const state = rowState(row)
  if (state.kind === 'question') return <StatusMark status="question" questionId={state.tag} />
  if (state.kind === 'withdrawn') {
    const tag = state.tag
    return (
      <span className="inline-flex items-center gap-1.5 text-excluded">
        <StatusMark status="excluded" compact />
        {/* The compact mark says "Excluded" (its tooltip, and to a screen reader); 150 px holds no more (the builder's keyboard walk of 22 after merging 21c: "…Q5 w" at 1280). */}
        <Trans>Question {tag} withdrawn</Trans>
      </span>
    )
  }
  if (state.kind === 'confirmed') {
    const by = row.sheets.find((p) => p.decided_by)
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatusMark status="confirmed" />
        {by?.decided_by ? <ActorChip name={by.decided_by} role={by.decided_by_role} /> : null}
      </span>
    )
  }
  if (state.kind === 'excluded') {
    const reason = state.reason === 'other' && state.text ? state.text : i18n._((state.reason && REASON_SHORT[state.reason]) || UNKNOWN_REASON)
    return (
      <span className="inline-flex items-center gap-1.5 text-excluded">
        <StatusMark status="excluded" compact />
        <Trans>Excluded, {reason}</Trans>
      </span>
    )
  }
  if (state.kind === 'proposed-out') {
    const reason = i18n._(REASON_SHORT[state.reason] ?? UNKNOWN_REASON)
    return (
      <span className="inline-flex items-center gap-1.5 text-proposal">
        <StatusMark status="proposal" compact />
        <span className="border-b border-dashed border-current">{reason}</span>
      </span>
    )
  }
  return state.oneSource ? (
    <span className="inline-flex items-center gap-1.5 text-proposal">
      <StatusMark status="proposal" compact />
      <Trans>Proposal, one source</Trans>
    </span>
  ) : (
    <StatusMark status="proposal" />
  )
}

/** "14 and 31", "S-14, S-15 and S-31", "…, and 4 more" (at most six named). */
function Numbers({ numbers }: { numbers: readonly string[] }) {
  const shown = numbers.slice(0, 6)
  const more = numbers.length - shown.length
  const items = shown.map((n) => <DrawingText key={n} kind="sheet-number" text={n} truncate={false} />)
  if (items.length === 1) return items[0]!
  const head = items.slice(0, -1).flatMap((el, i) => (i === 0 ? [el] : [', ', el]))
  const tail = items.at(-1)!
  if (more > 0) {
    const rest = <>{items.flatMap((el, i) => (i === 0 ? [el] : [', ', el]))}</>
    return <Trans>{rest}, and {more} more</Trans>
  }
  const start = <>{head}</>
  return (
    <Trans>
      {start} and {tail}
    </Trans>
  )
}

function SheetRow({
  row,
  focused,
  tabbable,
  onFocus,
  onOpen,
  names,
  slots,
}: {
  row: Row
  focused: boolean
  tabbable: boolean
  onFocus: (key: string) => void
  onOpen: (key: string) => void
  names: Readonly<Record<string, string>>
  slots: readonly string[]
}) {
  const f = useFormat()
  const first = row.sheets[0]
  const excluded = row.sheets.length > 0 && row.sheets.every((s) => s.decision === 'excluded')
  const count = f.integer(row.sheets.length)
  let title: ReactNode
  const q = row.question?.question
  const file = q?.subject_id ? names[q.subject_id] : undefined
  if (row.kind === 'file')
    title = file ? (
      <Trans>
        <FileName name={file} />
        <span className="ms-1 min-w-0 flex-1 truncate">Held: the two readers disagree</span>
      </Trans>
    ) : (
      <span className="min-w-0 truncate">
        <Trans>A file is held: the two readers disagree</Trans>
      </span>
    )
  else if (row.kind === 'entry')
    // The card's title, cut short, so the row and its card agree (ticket 164).
    title = row.question ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={-1} className="min-w-0 truncate">
            <QuestionTitle entry={row.question} names={names} />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <QuestionTitle entry={row.question} names={names} />
        </TooltipContent>
      </Tooltip>
    ) : null
  else if (row.kind === 'copies')
    title = (
      <Trans>
        <DrawingText kind="title" text={first?.title ?? ''} className="min-w-0" />
        <span className="shrink-0 whitespace-nowrap">, {count} copies</span>
      </Trans>
    )
  else if (row.kind === 'number-shared')
    title = (
      <>
        <Titles sheets={row.sheets} />
        <KindWords>
          <Plural value={row.sheets.length} one="# sheet shares the number" other="# sheets share the number, titles differ" />
        </KindWords>
      </>
    )
  else if (row.kind === 'title-shared')
    title = (
      <>
        <Titles sheets={row.sheets} />
        <KindWords>
          <Plural value={row.sheets.length} one="# sheet that may draw the same thing" other="# sheets that may draw the same thing" />
        </KindWords>
      </>
    )
  else if (row.kind === 'sheets' || (row.sheets.length > 1 && !row.title && titlesDiffer(row.sheets)))
    // A Question's sheets of other numbers and titles, or a continuation split by a decision (its group's title no longer fits).
    title = (
      <>
        <Titles sheets={row.sheets} />
        <KindWords>
          <Plural value={row.sheets.length} one="# sheet" other="# sheets" />
        </KindWords>
      </>
    )
  else if (row.sheets.length > 1)
    title = (
      <Trans>
        <DrawingText kind="title" text={row.title ?? first?.title ?? ''} className="min-w-0" />
        <span className="shrink-0 whitespace-nowrap">, {count} sheets</span>
      </Trans>
    )
  else title = <DrawingText kind="title" text={row.title ?? first?.title ?? ''} className="min-w-0" />

  return (
    <div
      role="row"
      tabIndex={tabbable ? 0 : -1}
      data-row={row.key}
      onFocus={(event) => {
        // A click on a cell (a tooltip's focusable text) focuses the row, so Space opens this sheet.
        if (event.target === event.currentTarget) onFocus(row.key)
        else if (!(event.target as HTMLElement).closest('button, a, input, select, textarea')) event.currentTarget.focus()
      }}
      onDoubleClick={() => onOpen(row.key)}
      className={cn(
        COLS,
        'h-7 cursor-default border-b border-border-subtle px-3 outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring',
        focused && 'bg-selected',
        excluded && 'text-muted-foreground',
      )}
    >
      <span role="gridcell" className="flex items-center">
        <StatusMark status={rowState(row).kind === 'question' ? 'question' : first?.decision === 'confirmed' ? 'confirmed' : excluded ? 'excluded' : 'proposal'} compact />
      </span>
      <span role="gridcell" className={cn('truncate font-semibold', excluded && 'line-through')}>
        {row.number ? (
          row.numberTo ? (
            <>
              <SheetRange first={row.number} last={row.numberTo} />
            </>
          ) : (
            <DrawingText kind="sheet-number" text={row.number} truncate={false} />
          )
        ) : row.kind === 'file' ? (
          <span className="font-normal text-muted-foreground">
            <Trans>File</Trans>
          </span>
        ) : row.kind === 'entry' ? (
          // A Question with no sheet and no number: "none" is a sheet's missing number, so not here.
          <span className="font-normal text-muted-foreground">—</span>
        ) : (
          <span className="font-normal text-question">
            <Trans>none</Trans>
          </span>
        )}
      </span>
      {/* Only the title truncates; ", 2 copies" stays whole (M19: a cell that also truncated clipped it to "…" right to left).
          The held mark leads, so it is never clipped; the kind and series words give up their width before the titles do (#322, round 1). */}
      <span role="gridcell" className="flex min-w-0 items-baseline overflow-hidden whitespace-nowrap">
        {row.sheets.some((s) => s.held) ? <HeldMark /> : null}
        {title}
        {row.series !== undefined ? (
          <KindWords>
            <Plural value={row.series} one="# sheet shares this title" other="# sheets share this title" />
          </KindWords>
        ) : null}
      </span>
      <span role="gridcell" className="truncate text-ink-secondary">
        {first ? <DisciplineCell sheet={first} /> : null}
      </span>
      <span role="gridcell" className="truncate text-ink-secondary">
        {first ? <Revision sheet={first} /> : null}
      </span>
      <span role="gridcell" className="flex min-w-0 items-center gap-1.5 text-ink-secondary">
        {first ? (
          <>
            <StoreyStrip slots={slots} views={row.sheets.flatMap((p) => p.views ?? [])} muted={excluded} />
            <span className="min-w-0 truncate">
              <StoreysText views={row.sheets.flatMap((p) => p.views ?? [])} stated={[...new Set(row.sheets.map((p) => p.storeys_as_stated).filter(Boolean))].join(', ')} />
            </span>
          </>
        ) : null}
      </span>
      <span role="gridcell" className="num text-end text-ink-secondary">
        {first ? f.integer(row.sheets.reduce((n, p) => n + (p.views?.length ?? 0), 0)) : null}
      </span>

      <span role="gridcell" className={cn(FILE_COLUMN, 'min-w-0 text-xs text-ink-secondary')}>
        {first ? <FileCell sheet={first} /> : null}
      </span>
      <span role="gridcell" className="truncate text-xs">
        <State row={row} />
      </span>
    </div>
  )
}

/** Each distinct title of a row's sheets, joined by "; ", cut by the cell; the whole list in its tooltip. */
function Titles({ sheets }: { sheets: readonly ProposalOut[] }) {
  const titles = distinctTitles(sheets).map((p) => p.title)
  const items = titles.flatMap((t, i) => [...(i > 0 ? ['; '] : []), <DrawingText key={i} kind="title" text={t} truncate={false} />])
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={-1} data-titles="" className="min-w-[4ch] truncate">
          {items}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{items}</TooltipContent>
    </Tooltip>
  )
}

/**
 * What a row's sheets are, after their titles ("2 sheets share the number, titles differ"), muted. It
 * gives up its width before the titles do, never below a few characters, and its tooltip reads it whole.
 */
function KindWords({ children }: { children: ReactNode }) {
  return (
    <>
      {' '}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={-1} data-kind-words="" className="ms-1.5 min-w-[9ch] shrink-[20] truncate text-xs text-muted-foreground">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{children}</TooltipContent>
      </Tooltip>
    </>
  )
}

/** A read-anyway file's sheet (#322, FL4): the Drawing Set's held chip promises "its sheets are marked". */
function HeldMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={-1} data-held="" className="me-1.5 inline-flex h-4 shrink-0 items-center self-center rounded-sm border border-question bg-question-surface px-1 text-xs leading-none text-question">
          <Trans>held</Trans>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <Trans>From a file read anyway; its figures are flagged later</Trans>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * A file name cut in its middle when it does not fit, its extension kept ("KR-STRUCTURAL-…R0.dwg" reads
 * as "KR-STRUC…SED-R0.dwg": its start, its last 6 characters and its extension), the whole name in its text (what a screen reader reads) and its tooltip (the
 * review of 22, round 4, F2: a long name spilled past its cell and left the held reason no width).
 * About 16 characters of room (the name's start, its last 6 characters and its extension) before the reason gives up width (its re-check: two held files
 * cut to "K….dwg" looked the same); the reason truncates first.
 */
/** How many of a cut file name's last stem characters always show. */
const TAIL_KEPT = 6

function FileName({ name }: { name: string }) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  // The stem's last characters stay with the extension, so files that differ at their end
  // ("…-old.dwg", "…-R0.dwg") read apart when cut (the re-check of round 4, T1).
  const tail = stem.length > TAIL_KEPT * 2 ? stem.slice(-TAIL_KEPT) : ''
  const head = tail ? stem.slice(0, -TAIL_KEPT) : stem
  return (
    <bdi dir="ltr" data-notation="file-name" title={isolateLtr(name)} className="inline-flex max-w-[calc(100%-var(--spacing)*25)] min-w-[16ch] shrink-0 overflow-hidden">
      <span data-file-head="" className="min-w-0 truncate">{head}</span>
      {tail || extension ? <span className="shrink-0">{tail}{extension}</span> : null}
    </bdi>
  )
}
