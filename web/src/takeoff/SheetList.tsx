/*
 * Step 1's list mode (m0-screens §6.2, §6.3): the sheet list as one grid, in sections: "Needs you"
 * (a row per row an open Question holds, in the queue's order), "Proposed to leave out", each
 * Discipline in the Takeoff's order with its progress and its drawing list, then the Disciplines not
 * yet received. Rows are 28 px; continuation sheets are one row. The list is a key region (Space opens
 * the focused sheet; the screen owns the keys); a click focuses a row, a double-click opens it.
 */
import { forwardRef, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { DrawingText, StatusMark, cn } from '@/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip'
import type { ProposalOut } from './data'
import { rowState, type DisciplineSection, type Row, type Step1Model } from './model'
import { DISCIPLINE_NAMES, NOT_RECEIVED_NAMES, OTHER_DISCIPLINE, OTHER_QUESTION, QUESTION_KINDS, REASON_SHORT, UNKNOWN_REASON } from './words'

export interface SheetListProps {
  model: Step1Model
  focused: string | null
  onFocusRow: (key: string) => void
  onOpenRow: (key: string) => void
  onPasteList: ((discipline: string) => void) | null
}

const COLS = 'grid grid-cols-[24px_96px_minmax(0,1fr)_110px_120px_160px] items-center gap-x-2'

export const SheetList = forwardRef<HTMLDivElement, SheetListProps>(function SheetList({ model, focused, onFocusRow, onOpenRow, onPasteList }, ref) {
  const { t } = useLingui()
  const questions = model.queue.length
  return (
    <div ref={ref} className="text-sm">
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
          <Trans>Revision</Trans>
        </span>
        <span role="columnheader">
          <Trans>State</Trans>
        </span>
      </div>

      {model.needsYou.length > 0 ? (
        <Section
          tone="question"
          heading={<Trans>Needs you: {questions} Questions open, in the order Enter takes them</Trans>}
          rows={model.needsYou}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
        />
      ) : null}

      {model.proposedOut.length > 0 ? (
        <Section
          heading={<Trans>Proposed to leave out: excluded sheets stay in the count with their reason</Trans>}
          rows={model.proposedOut}
          focused={focused}
          onFocusRow={onFocusRow}
          onOpenRow={onOpenRow}
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
              {onPasteList ? (
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
      const first = <DrawingText kind="sheet-number" text={list.numbers[0] ?? ''} truncate={false} />
      const last = <DrawingText kind="sheet-number" text={list.numbers.at(-1) ?? ''} truncate={false} />
      return (
        <Trans>
          found, {listed} on the drawing list typed by {who} ({first}–{last})
        </Trans>
      )
    }
    return <Trans>found, {listed} on the drawing list read on a sheet</Trans>
  }
  const run = section.numbering
  if (!run) return <Trans>found; no drawing list; the numbers do not run in one series</Trans>
  const first = <DrawingText kind="sheet-number" text={run.first} truncate={false} />
  const last = <DrawingText kind="sheet-number" text={run.last} truncate={false} />
  if (run.missing.length === 0)
    return (
      <Trans>
        found; no drawing list; numbering runs {first}–{last} without a gap
      </Trans>
    )
  const missing = run.missing.slice(0, 6).join(', ')
  return (
    <Trans>
      found; no drawing list; numbering runs {first}–{last}; {missing} missing
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
}: {
  heading: ReactNode
  side?: ReactNode
  rows: readonly Row[]
  tone?: 'question'
  focused: string | null
  onFocusRow: (key: string) => void
  onOpenRow: (key: string) => void
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
        <SheetRow key={row.key} row={row} focused={focused === row.key} tabbable={focused === row.key || (focused === null && row === rows[0])} onFocus={onFocusRow} onOpen={onOpenRow} />
      ))}
    </div>
  )
}

/** The Discipline's name; its tooltip names the file it came from (6.2; the list has no File column). */
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

function Revision({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const mark = sheet.revision_mark
  if (!mark) return <span className="text-muted-foreground">—</span>
  const date = sheet.issue_date ? f.date(sheet.issue_date) : null
  const markText = <DrawingText kind="revision" text={mark} truncate={false} />
  if (sheet.revision_mark_source === 'file_name') {
    const file = <DrawingText kind="file-name" text={sheet.file_name} truncate={false} />
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={-1}>{markText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <Trans>
            {markText}, from the file name {file}
          </Trans>
        </TooltipContent>
      </Tooltip>
    )
  }
  return date ? (
    <Trans>
      {markText}, {date}
    </Trans>
  ) : (
    markText
  )
}

function State({ row }: { row: Row }) {
  const { i18n } = useLingui()
  const state = rowState(row)
  if (state.kind === 'question') return <StatusMark status="question" questionId={state.tag} />
  if (state.kind === 'confirmed') return <StatusMark status="confirmed" />
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

function SheetRow({
  row,
  focused,
  tabbable,
  onFocus,
  onOpen,
}: {
  row: Row
  focused: boolean
  tabbable: boolean
  onFocus: (key: string) => void
  onOpen: (key: string) => void
}) {
  const { i18n } = useLingui()
  const f = useFormat()
  const first = row.sheets[0]
  const excluded = row.sheets.length > 0 && row.sheets.every((s) => s.decision === 'excluded')
  const count = f.integer(row.sheets.length)
  let title: ReactNode
  if (row.kind === 'file') title = i18n._(QUESTION_KINDS.file_misread ?? OTHER_QUESTION)
  else if (row.kind === 'entry')
    title = (
      <span className="text-muted-foreground">
        <Trans>On the drawing list, in no file. It stays in the count.</Trans>
      </span>
    )
  else if (row.kind === 'copies')
    title = (
      <Trans>
        <DrawingText kind="title" text={first?.title ?? ''} />, {count} copies
      </Trans>
    )
  else if (row.sheets.length > 1)
    title = (
      <Trans>
        <DrawingText kind="title" text={first?.title ?? ''} />, {count} sheets
      </Trans>
    )
  else title = <DrawingText kind="title" text={first?.title ?? ''} />

  return (
    <div
      role="row"
      tabIndex={tabbable ? 0 : -1}
      data-row={row.key}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus(row.key)
      }}
      onDoubleClick={() => onOpen(row.key)}
      className={cn(
        COLS,
        'h-7 cursor-default border-b border-border-subtle px-3 outline-none hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
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
              <DrawingText kind="sheet-number" text={row.number} truncate={false} />–<DrawingText kind="sheet-number" text={row.numberTo} truncate={false} />
            </>
          ) : (
            <DrawingText kind="sheet-number" text={row.number} truncate={false} />
          )
        ) : row.kind === 'file' ? (
          <span className="font-normal text-muted-foreground">
            <Trans>File</Trans>
          </span>
        ) : (
          <span className="font-normal text-question">
            <Trans>none</Trans>
          </span>
        )}
      </span>
      <span role="gridcell" className="min-w-0 truncate">
        {title}
      </span>
      <span role="gridcell" className="truncate text-ink-secondary">
        {first ? <DisciplineCell sheet={first} /> : null}
      </span>
      <span role="gridcell" className="truncate text-ink-secondary">
        {first ? <Revision sheet={first} /> : null}
      </span>
      <span role="gridcell" className="truncate text-xs">
        <State row={row} />
      </span>
    </div>
  )
}
