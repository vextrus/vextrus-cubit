/*
 * Step 1 in the inspector (m0-screens §6.6, §6.7, §6.11): with nothing focused, the overview (the
 * per-Part progress, the order Enter takes things in, the expected sheets); with a row focused, its
 * Question card, the sheet's facts, where each was read, and who did what; Coverage's panel when the
 * status bar's Coverage is clicked. The Questions tab holds every open Question's card in queue order.
 *
 * The QS answers on the card (#156; §6.7): a pick (a click, or the number key on the focused Question)
 * changes nothing until "Answer Q1 ↵" (Enter); the MD and a Guest read the card and cannot pick.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { TAKEOFF_STEPS } from '@/app/steps'
import { useFormat } from '@/format'
import { Button, DrawingText, KeyCombo, TextField, cn } from '@/ui'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { ActorChip } from './ActorChip'
import { StoreyStrip, StoreysText, knownStorey, useStoreysWords } from './storeys'
import { QuestionGlyph } from '@/ui/glyphs'
import { SheetName } from './acts'
import { SheetRange } from './SheetRange'
import type { CoverageOut, ProposalOut, ViewOut } from './data'
import { DISCIPLINE_ORDER, NOTES_STEP, STEP_DISCIPLINES, listSheet, type DisciplineSection, type QuestionEntry, type Row, type Step1Model } from './model'
import { AnswerNote, Answering, cardContext, Copy, OptionWords, QuestionBody, QuestionTitle, Trace, optionsOf, useKindLine, usePick, usePickSources, type CardContext } from './questionWords'
import { disciplineName } from './SheetList'
import { NOT_RECEIVED_NAMES, OTHER_DISCIPLINE, OTHER_VIEW_KIND, REASON_SHORT, ROLE_NAMES, STEP_KEYS, STOREY_MEANINGS, UNKNOWN_REASON, VIEW_KINDS } from './words'

function Block({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-border px-3 py-3 text-sm">
      {title ? <h3 className="text-xs font-semibold text-ink-secondary">{title}</h3> : null}
      {children}
    </section>
  )
}

/** "Structural confirmed · Architectural confirmed · Electrical 3 to confirm", or "Structural 0 / 13 settled · …". */
export function PartsLine({ model }: { model: Step1Model }) {
  const { i18n, t } = useLingui()
  const f = useFormat()
  const anyConfirmed = model.disciplines.some((d) => d.confirmed)
  const parts = model.disciplines.map((d) => {
    const name = disciplineName(d.discipline, i18n)
    if (d.confirmed) return t`${name} confirmed`
    if (anyConfirmed) {
      const left = d.found - d.settled
      const leftText = f.integer(left)
      if (left > 0) return t`${name} ${leftText} to confirm`
      const open = d.openQuestions
      const openText = f.integer(open)
      if (open > 0) return open === 1 ? t`${name}: 1 Question open` : t`${name}: ${openText} Questions open`
      return t`${name}: a view unaccounted`
    }
    const settled = f.integer(d.settled)
    const total = d.total === null ? '—' : f.integer(d.total)
    return t`${name} ${settled} / ${total} settled`
  })
  // The sheets of no Discipline are counted too (#167): 19a's progress row with no Discipline, else the list's own.
  if (model.noDiscipline > 0) {
    const count = f.integer(model.noDiscipline)
    parts.push(model.noDiscipline === 1 ? t`1 with no Discipline` : t`${count} with no Discipline`)
  }
  return <>{parts.join(' · ')}</>
}

function Expected({ section }: { section: DisciplineSection }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = disciplineName(section.discipline, i18n)
  const found = f.integer(section.found)
  const list = section.list
  if (list) {
    const listed = f.integer(list.numbers.length)
    const who = list.entered_by ?? ''
    if (list.source === 'pasted') {
      const when = list.entered_at ? `${f.date(list.entered_at)} ${f.time(list.entered_at)}` : ''
      if (!who || !when)
        return (
          <Trans>
            {name}: {listed} on the pasted drawing list; {found} found.
          </Trans>
        )
      return (
        <Trans>
          {name}: {listed} on the drawing list pasted by {who}, {when}; {found} found.
        </Trans>
      )
    }
    if (list.source === 'typed') {
      const range = <SheetRange first={list.numbers[0] ?? ''} last={list.numbers.at(-1) ?? ''} />
      return (
        <Trans>
          {name}: {listed} on the drawing list typed by {who} ({range}); {found} found.
        </Trans>
      )
    }
    const on = listSheet(section)?.number
    if (!on)
      return (
        <Trans>
          {name}: {listed} on the drawing list found in the drawings; {found} found.
        </Trans>
      )
    const sheet = <DrawingText kind="sheet-number" text={on} truncate={false} />
    return (
      <Trans>
        {name}: {listed} on the drawing list on {sheet}; {found} found.
      </Trans>
    )
  }
  const run = section.numbering
  if (!run)
    return (
      <Trans>
        {name}: no drawing list; {found} found.
      </Trans>
    )
  const range = <SheetRange first={run.first} last={run.last} />
  return run.missing.length === 0 && run.twice.length === 0 ? (
    <Trans>
      {name}: no drawing list; numbering runs {range} without a gap; {found} found.
    </Trans>
  ) : (
    <Trans>
      {name}: no drawing list; numbering runs {range} with gaps or repeats (see the list); {found} found.
    </Trans>
  )
}

export function Overview({ model, projectName, readOnly }: { model: Step1Model; projectName: string; readOnly: 'md' | 'guest' | null }) {
  const { i18n } = useLingui()
  const n = model.bulk.confirm.length
  const m = model.bulk.leaveOut.length
  const questions = model.queue.length
  const single = model.oneSource.length
  const reasons = model.bulk.reasons.map((r) => i18n._(REASON_SHORT[r] ?? UNKNOWN_REASON)).join(', ')
  const nothing = n + m === 0 && questions === 0 && single === 0
  // "The held file first" only while a held file's Question is open (#167: no file held, no such words).
  const heldFirst = model.queue.some((e) => e.question.kind === 'file_misread')
  return (
    <>
      <Block title={<Trans>{projectName}’s sheets</Trans>}>
        <p>
          <PartsLine model={model} />
        </p>
      </Block>
      <Block title={readOnly ? <Trans>What the QS has left, in order</Trans> : <Trans>Enter takes them in this order</Trans>}>
        {nothing ? (
          <p>
            <Trans>Nothing is waiting.</Trans>
          </p>
        ) : (
          <ol className="list-decimal ps-5">
            {n + m > 0 ? (
              <li>
                {n === 0 ? (
                  <Trans>
                    Leave out {m}: {reasons}
                  </Trans>
                ) : m > 0 ? (
                  <Trans>
                    <Plural value={n} one="Confirm the # sheet that agrees" other="Confirm the # sheets that agree" /> and leave out {m}: {reasons}
                  </Trans>
                ) : (
                  <Plural value={n} one="Confirm the # sheet that agrees" other="Confirm the # sheets that agree" />
                )}
              </li>
            ) : null}
            {/* The bar's order (Y5, walk 5): the bulk act, then the sheets with one source, then the Questions. */}
            {single > 0 ? (
              <li>
                <Plural value={single} one="Confirm # sheet with one source, on its own" other="Confirm # sheets with one source, one by one" />
              </li>
            ) : null}
            {questions > 0 ? (
              <li>
                {heldFirst ? (
                  <Plural
                    value={questions}
                    one="Answer # Question: the held file’s"
                    other="Answer # Questions: the held file first, then those holding the most sheets"
                  />
                ) : (
                  <Plural value={questions} one="Answer # Question" other="Answer # Questions: those holding the most sheets first" />
                )}
              </li>
            ) : null}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          {readOnly ? (
            <Trans>↓ walks the list; Space opens a sheet; a Proposal counts toward nothing until the QS confirms it.</Trans>
          ) : (
            <Trans>↓ walks the list; Space opens a sheet; a Proposal counts toward nothing until you confirm it.</Trans>
          )}
        </p>
      </Block>
      <Block title={<Trans>Expected sheets</Trans>}>
        {model.disciplines.map((d) => (
          <p key={d.discipline}>
            <Expected section={d} />
          </p>
        ))}
        {model.notReceived.length > 0 ? (
          <p className="text-muted-foreground">
            <Trans>Disciplines not yet received:</Trans> {model.notReceived.map((k) => i18n._(NOT_RECEIVED_NAMES[k] ?? OTHER_DISCIPLINE)).join(', ')}
          </p>
        ) : null}
      </Block>
    </>
  )
}

/** The header's state and when (§5, "Who did what"): "Confirmed by Nusrat Jahan, 26 Sep 2026". */
function Decided({ sheet, readOnly }: { sheet: ProposalOut; readOnly: boolean }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = sheet.decided_by ?? ''
  const date = sheet.decided_at ? f.date(sheet.decided_at) : ''
  const vextrus = sheet.decided_by_role === 'vextrus_engineer'
  if (sheet.decision === 'confirmed') return vextrus ? <Trans>Confirmed by {name} (Vextrus), {date}</Trans> : <Trans>Confirmed by {name}, {date}</Trans>
  if (sheet.decision === 'excluded') {
    const reason = reasonOf(sheet, i18n)
    return vextrus ? (
      <Trans>
        Excluded by {name} (Vextrus), {date}: {reason}
      </Trans>
    ) : (
      <Trans>
        Excluded by {name}, {date}: {reason}
      </Trans>
    )
  }
  return readOnly ? (
    <Trans>A Proposal counts toward nothing until the QS confirms it.</Trans>
  ) : (
    <Trans>A Proposal counts toward nothing until you confirm it.</Trans>
  )
}

function reasonOf(sheet: { excluded_reason: string | null; excluded_text?: string }, i18n: { _: (d: MessageDescriptor) => string }): string {
  return sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
}

/** One act in "who did what" (§6.6): the what, over "name, role, time" with the initials chip. */
function Act({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = sheet.decided_by ?? ''
  const roleWords = sheet.decided_by_role ? ROLE_NAMES[sheet.decided_by_role] : undefined
  const role = roleWords ? i18n._(roleWords) : null
  const date = sheet.decided_at ? f.date(sheet.decided_at) : ''
  const time = sheet.decided_at ? f.time(sheet.decided_at) : ''
  const others = Math.max(0, (sheet.decided_with ?? 0) - 1)
  const reason = reasonOf(sheet, i18n)
  const what =
    sheet.decision === 'excluded' ? (
      <Trans>Excluded: {reason}</Trans>
    ) : others > 0 ? (
      <Plural value={others} one="Confirmed in bulk with # other sheet" other="Confirmed in bulk with # other sheets" />
    ) : (
      <Trans>Confirmed</Trans>
    )
  return (
    <div className="flex flex-col">
      <span>{what}</span>
      <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
        {name ? <ActorChip name={name} role={sheet.decided_by_role} /> : null}
        <ActLine name={name} role={role} date={date} time={time} />
      </span>
    </div>
  )
}

/** "Nusrat Jahan, QS, 26 Sep 2026, 10:42", leaving out what is not known (no hanging comma). */
function ActLine({ name, role, date, time }: { name: string; role: string | null; date: string; time: string }) {
  if (name && role && date)
    return (
      <Trans>
        {name}, {role}, {date}, {time}
      </Trans>
    )
  if (name && date)
    return (
      <Trans>
        {name}, {date}, {time}
      </Trans>
    )
  if (name && role)
    return (
      <Trans>
        {name}, {role}
      </Trans>
    )
  return <>{name}</>
}

function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** "R0, from the file name; dated 12 Sep 2026" / "R1, 14 Sep 2026" (6.6). */
function RevisionFact({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const mark = <DrawingText kind="revision" text={sheet.revision_mark} truncate={false} />
  const date = sheet.issue_date ? f.day(sheet.issue_date) : null
  if (sheet.revision_mark_source === 'file_name')
    return date ? <Trans>{mark}, from the file name; dated {date}</Trans> : <Trans>{mark}, from the file name</Trans>
  return date ? (
    <Trans>
      {mark}, {date}
    </Trans>
  ) : (
    mark
  )
}

/** Where a number or title was read (6.6): "title-block attribute", "text in the title block"; nothing where the API names no source. */
function ReadFrom({ source }: { source: string | null | undefined }) {
  if (source === 'title_block_attribute') return <Trans>title-block attribute</Trans>
  if (source === 'title_block_text') return <Trans>text in the title block</Trans>
  if (source === 'jev') return <Trans>read by Vextrus from the title</Trans>
  if (source === 'register') return <Trans>the drawing list</Trans>
  if (source === 'file_name') return <Trans>the file name</Trans>
  return null
}

/** "3rd, 5th, 7th, at floor level" with the strip, from the plan views; amber "not stated"; "—" with no plan view (6.6, 6.8). */
function StoreysFact({ sheet, slots }: { sheet: ProposalOut; slots: readonly string[] }) {
  const { i18n } = useLingui()
  const plans = (sheet.views ?? []).filter((v) => v.kind === 'plan')
  const meanings = [...new Set(plans.map((v) => v.storeys_meaning).filter((m): m is string => !!m))]
  const meaning = meanings.length === 1 && STOREY_MEANINGS[meanings[0]!] ? i18n._(STOREY_MEANINGS[meanings[0]!]!) : meanings.length > 1 ? i18n._(MIXED) : null
  const stated = plans.some((v) => v.storeys.some(knownStorey)) && !plans.some((v) => v.storeys.includes('typical'))
  return (
    <span className="flex flex-col gap-1">
      <span>
        <StoreysText views={sheet.views} stated={sheet.storeys_as_stated} />
        {stated && meaning ? <>, {meaning}</> : null}
      </span>
      <StoreyStrip slots={slots} views={sheet.views} size={6} />
    </span>
  )
}

const MIXED = msg`mixed`

/** "KR-STR-R0.dwg page 20, registered to 0.2 mm", or "None: " and the reason (6.6, 6.13). */
function PlotFact({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  if (sheet.plot_file && sheet.plot_page) {
    const file = <DrawingText kind="file-name" text={sheet.plot_file} truncate={false} />
    const page = f.integer(sheet.plot_page)
    const residual = sheet.plot_residual ? f.quantity(sheet.plot_residual, 1) : null
    return residual ? (
      <Trans>
        {file} page {page}, registered to {residual} mm
      </Trans>
    ) : (
      <Trans>
        {file} page {page}
      </Trans>
    )
  }
  const none = sheet.plot_none as { code: string; params: Record<string, string | number> } | null | undefined
  return <PlotNone none={none} />
}

/** Why a sheet has no Plot, as 6.13 words it, after "None: " (the machine's own sentences start "No Plot for this sheet"). */
function PlotNone({ none }: { none: { code: string; params: Record<string, string | number> } | null | undefined }) {
  const code = none?.code
  if (code === 'drawings.sheets.plot_no_page' && typeof none?.params.plot_file === 'string') {
    const file = <DrawingText kind="file-name" text={none.params.plot_file} truncate={false} />
    return <Trans>None: no page of {file} matched it</Trans>
  }
  if (code === 'drawings.sheets.plot_no_pdf' && typeof none?.params.discipline === 'string') {
    // The message carries the Discipline's display name, as sent.
    const discipline = none.params.discipline
    return <Trans>None: no PDF has been added for {discipline}</Trans>
  }
  if (code === 'drawings.sheets.plot_no_pdf_any') return <Trans>None: no PDF was added to the Drawing Set</Trans>
  if (code === 'drawings.sheets.plot_no_number') return <Trans>None: the sheet has no number, so no PDF page could be matched to it</Trans>
  if (code === 'drawings.sheets.plot_not_yet') return <Trans>None: its PDF is still being read</Trans>
  if (code === 'drawings.sheets.plot_pdf_refused') return <Trans>None: its PDF was a scan and was refused</Trans>
  if (code === 'drawings.sheets.plot_pdf_unread') return <Trans>None: its PDF could not be read</Trans>
  return <Trans>None: no PDF page is matched to it</Trans>
}

/** A view's chips (6.6): each proposed step ("7 Beams") or its Part, or its exclusion, or amber "no step: unaccounted". */
const CHIP = cn('rounded-sm bg-chrome-sunken px-1 text-2xs')

function ViewChips({ view, confirmed }: { view: ViewOut; confirmed: boolean }) {
  const { i18n } = useLingui()
  const chip = CHIP
  if (view.decision === 'excluded' || view.proposed_exclusion) {
    const reason = i18n._(REASON_SHORT[view.excluded_reason ?? view.proposed_exclusion ?? ''] ?? UNKNOWN_REASON)
    return (
      <>
        <span className={cn(chip, 'text-excluded')}>
          <Trans>excluded: {reason}</Trans>
        </span>
        {view.decision === 'excluded' || confirmed ? null : (
          <span className="text-2xs text-muted-foreground">
            <Trans>proposed</Trans>
          </span>
        )}
      </>
    )
  }
  // A Structural or Architectural Part (a legend) is Step 2's Notes, not an MEP Part for M3.
  const notes = view.part !== null && STEP_DISCIPLINES.has(view.part) && !view.steps.some((k) => k === String(NOTES_STEP) || k === STEP_KEYS[NOTES_STEP - 1])
  const steps = [...view.steps, ...(notes ? [String(NOTES_STEP)] : [])]
    .map((key) => {
      const n = /^\d+$/.test(key) ? Number(key) : (STEP_KEYS as readonly string[]).indexOf(key) + 1
      const step = TAKEOFF_STEPS[n - 1]
      return step ? { n, name: i18n._(step.name) } : null
    })
    .filter((x): x is { n: number; name: string } => x !== null)
  if (steps.length === 0 && !view.part)
    return (
      <span className={cn(chip, 'text-question')}>
        <Trans>no step: unaccounted</Trans>
      </span>
    )
  const part = view.part && !STEP_DISCIPLINES.has(view.part) ? disciplineName(view.part, i18n) : null
  return (
    <>
      {steps.map((s) => (
        <span key={s.n} className={chip}>
          <span className="num">{s.n}</span> {s.name}
        </span>
      ))}
      {part ? (
        <span className={chip}>
          <Trans>{part}, M3 onwards</Trans>
        </span>
      ) : null}
      {confirmed ? null : (
        <span className="text-2xs text-muted-foreground">
          <Trans>proposed</Trans>
        </span>
      )}
    </>
  )
}

/** The sheet's views (6.6): mark, kind, title, scale; storeys and meaning; the chips. */
function Views({ sheet, selected, onSelect, readOnly }: { sheet: ProposalOut; selected: string | null; onSelect?: (id: string) => void; readOnly: boolean }) {
  const { i18n } = useLingui()
  const words = useStoreysWords()
  const views = sheet.views ?? []
  const n = views.length
  // The title's stated storeys belong to its one plan view; with several, each shows only its own.
  const titleStated = views.filter((v) => v.kind === 'plan').length === 1 ? sheet.storeys_as_stated : ''
  return (
    <Block
      title={
        <>
          <Plural value={n} one="Views (#)" other="Views (#)" />{' '}
          <span className="font-normal text-muted-foreground">
            {readOnly ? <Trans>→ walks them</Trans> : <Trans>→ walks them; X excludes</Trans>}
          </span>
        </>
      }
    >
      <ol className="flex flex-col gap-1.5">
        {views.map((v, i) => {
          const kind = i18n._(VIEW_KINDS[v.kind] ?? OTHER_VIEW_KIND)
          const mark = String(i + 1)
          const scale = v.not_to_scale ? <Trans>not to scale</Trans> : v.stated_scale ? <DrawingText kind="mark" text={v.stated_scale} truncate={false} /> : null
          const storeys = words(v.storeys)
          const meaning = v.storeys_meaning && STOREY_MEANINGS[v.storeys_meaning] ? i18n._(STOREY_MEANINGS[v.storeys_meaning]!) : null
          return (
            <li
              key={v.id}
              data-view={v.id}
              aria-current={selected === v.id ? 'true' : undefined}
              onClick={onSelect ? () => onSelect(v.id) : undefined}
              className={cn('flex flex-col gap-0.5 rounded-sm px-1 py-0.5', selected === v.id && 'bg-selected', v.decision === 'excluded' && 'text-muted-foreground line-through')}
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="num text-xs text-muted-foreground">{mark}</span>
                <span className="text-xs text-ink-secondary">{kind}</span>
                <DrawingText kind="title" text={v.title} className="min-w-0" />
                {scale ? <span className="ms-auto shrink-0 text-xs text-ink-secondary">{scale}</span> : null}
              </span>
              {v.kind === 'plan' ? (
                <span className="text-xs text-ink-secondary">
                  <StoreysText views={[v]} stated={titleStated} />
                  {storeys && meaning && !v.storeys.includes('typical') ? <>, {meaning}</> : null}
                </span>
              ) : storeys ? (
                <span className="text-xs text-ink-secondary">{storeys}</span>
              ) : null}
              <span className="flex flex-wrap items-center gap-1">
                <ViewChips view={v} confirmed={sheet.decision === 'confirmed'} />
              </span>
            </li>
          )
        })}
      </ol>
    </Block>
  )
}

function DisciplineFact({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const name = disciplineName(sheet.discipline, i18n)
  return <Trans>{name} from the file</Trans>
}

export interface SheetActs {
  /** X: the exclusion picker for the sheet. */
  exclude: () => void
  /** "Confirm back in" an excluded sheet. */
  confirmBackIn: () => void
}

export function SheetFacts({
  row,
  showTitle,
  readOnly,
  acts,
  selectedView = null,
  onSelectView,
  slots = [],
  open,
}: {
  row: Row
  /** In sheet mode, the sheet open: of two copies in one row, the one shown (M18). */
  open?: ProposalOut
  showTitle: boolean
  readOnly: boolean
  acts?: SheetActs
  selectedView?: string | null
  onSelectView?: (id: string) => void
  /** The storey strip's slots, the project's (6.8). */
  slots?: readonly string[]
}) {
  const sheet = open && row.sheets.some((s) => s.id === open.id) ? open : row.sheets[0]
  if (!sheet) return null
  const excluded = row.sheets.every((s) => s.decision === 'excluded')
  const decided = row.sheets.filter((s) => s.decision)
  return (
    <>
      <Block>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">
            <SheetName sheets={row.sheets} start />
          </span>
          {showTitle ? <DrawingText kind="title" text={sheet.title} truncate={false} className="text-ink-secondary" /> : null}
          <span className="text-xs text-ink-secondary">
            <Decided sheet={sheet} readOnly={readOnly} />
          </span>
        </div>
      </Block>
      <Block title={<Trans>Proposal: where each was read</Trans>}>
        <dl className="flex flex-col gap-1">
          <Fact label={<Trans>Number</Trans>}>
            {sheet.number ? (
              <>
                <DrawingText kind="sheet-number" text={sheet.number} truncate={false} /> <ReadFrom source={sheet.number_source} />
              </>
            ) : (
              <span className="text-question">
                <Trans>not found</Trans>
              </span>
            )}
          </Fact>
          <Fact label={<Trans>Title</Trans>}>
            {sheet.title ? (
              <ReadFrom source={sheet.title_source} />
            ) : (
              <span className="text-question">
                <Trans>not found</Trans>
              </span>
            )}
          </Fact>
          <Fact label={<Trans>Discipline</Trans>}>
            <DisciplineFact sheet={sheet} />
          </Fact>
          <Fact label={<Trans>Revision</Trans>}>
            {sheet.revision_mark ? <RevisionFact sheet={sheet} /> : <Trans>none: the title block has none and the file name none</Trans>}
          </Fact>
          <Fact label={<Trans>File</Trans>}>
            <DrawingText kind="file-name" text={sheet.file_name} />
            <span className="block text-xs text-ink-secondary">
              {sheet.layout ? <Trans>layout “<DrawingText kind="mark" text={sheet.layout} truncate={false} />”</Trans> : <Trans>laid out in the drawing</Trans>}
            </span>
          </Fact>
          <Fact label={<Trans>Storeys</Trans>}>
            <StoreysFact sheet={sheet} slots={slots} />
          </Fact>
          <Fact label={<Trans>Plot</Trans>}>
            <PlotFact sheet={sheet} />
          </Fact>
          <Fact label={<Trans>Sources</Trans>}>
            <SourcesFact row={row} />
          </Fact>
        </dl>
      </Block>
      <Views sheet={sheet} selected={selectedView} onSelect={onSelectView} readOnly={readOnly} />
      <Block title={<Trans>Who did what</Trans>}>
        {decided.length === 0 ? (
          <p>
            <Trans>Proposed by Vextrus from the file; no one has acted on it yet.</Trans>
          </p>
        ) : (
          decided.map((s) => (
            <div key={s.id}>
              {row.sheets.length > 1 ? (
                <span className="text-xs text-ink-secondary">
                  <SheetName sheets={[s]} /> <Copy sheet={s} />
                </span>
              ) : null}
              <Act sheet={s} />
            </div>
          ))
        )}
      </Block>
      {!readOnly && acts ? (
        <Block>
          <div className="flex flex-wrap gap-2">
            {excluded ? (
              <Button variant="secondary" onClick={acts.confirmBackIn}>
                <Trans>Confirm back in</Trans>
              </Button>
            ) : (
              <Button variant="secondary" onClick={acts.exclude} aria-keyshortcuts="X">
                <Trans>Exclude</Trans>
                <KeyCombo combo="X" />
              </Button>
            )}
          </div>
        </Block>
      ) : null}
    </>
  )
}

/** What a Question card reads from the model: every sheet, the drawing lists and the files' names. */
/** "Sources" (6.6): a sheet a Question holds is not counted as agreeing or not until it is answered. */
function SourcesFact({ row }: { row: Row }) {
  const tag = row.question?.tag
  if (tag) return <Trans>held by Question {tag}</Trans>
  if (!row.sheets.every((s) => s.agrees)) return <Trans>one source</Trans>
  // In the bulk act on its title block alone (#320): still one source, which the card says.
  if (row.sheets.some((s) => s.agrees_on === 'title_block'))
    return row.gapInNumbering ? <Trans>one, the title block, with no gap beside it</Trans> : <Trans>one, the title block, in numbering without a gap</Trans>
  return <Trans>two, agreeing</Trans>
}

export { cardContext }

/** The QS's pick on a Question; `refused` counts the answers refused for an empty number (each one refocuses the field). */
export interface Pick {
  key: string
  text: string
  refused?: number
}

/** What answering needs from the screen: the pick per Question, and the acts. Null for the MD and a Guest. */
export interface Answerer {
  /** The QS's pick on a Question (or null: the pre-pick, if any, stands). */
  choice(entry: QuestionEntry): Pick | null
  choose(entry: QuestionEntry, key: string): void
  /** The number typed under "Type a number". */
  type(entry: QuestionEntry, text: string): void
  answer(entry: QuestionEntry): void
  /** "Ask later": the next open Question. */
  later(): void
  busy: boolean
}

/**
 * "Type a number"'s field. An answer with it empty is refused under it (round 3's design gate): focus
 * stays in it, it is marked invalid, and the hint gives way to the error, announced politely.
 */
function NumberField({ entry, answerer, pick }: { entry: QuestionEntry; answerer: Answerer; pick: Pick | null }) {
  const ref = useRef<HTMLInputElement>(null)
  const refused = pick?.refused ?? 0
  useEffect(() => {
    if (refused) ref.current?.focus()
  }, [refused])
  return (
    <div aria-live="polite" className="ps-6">
      <TextField
        ref={ref}
        label={<Trans>The sheet’s number</Trans>}
        hint={refused ? undefined : <Trans>As its title block should read. Enter answers.</Trans>}
        error={refused ? <Trans>Type the sheet’s number first, as its title block should read.</Trans> : undefined}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={pick?.text ?? ''}
        onChange={(event) => answerer.type(entry, event.target.value)}
      />
    </div>
  )
}

export function QuestionCard({
  entry,
  readOnly,
  context,
  onOpen,
  answerer = null,
}: {
  entry: QuestionEntry
  readOnly: 'md' | 'guest' | null
  context: CardContext
  /** A Trace link opens its sheet. */
  onOpen?: (sheet: ProposalOut) => void
  answerer?: Answerer | null
}) {
  const names = context.names
  const { t } = useLingui()
  const f = useFormat()
  const kind = useKindLine(entry)
  const tag = entry.tag
  const options = optionsOf(entry)
  const pick = usePick(entry, context)
  const sources = usePickSources(entry, context)
  // Unique per card: the same Question's card is in the Selection and the Questions tab at once, and
  // radios sharing a name across both would uncheck each other.
  const uid = useId()
  const name = `question-${entry.question.id}-${uid}`
  const can = !readOnly && answerer !== null
  const choice = can ? answerer.choice(entry) : null
  const current = choice?.key ?? pick?.key ?? null
  return (
    <section aria-label={t`Question ${tag}`} data-question={entry.question.id} className="m-2 overflow-hidden rounded-md border border-question">
      <header className="flex items-center justify-between gap-2 bg-question-surface px-3 py-1.5 text-sm text-question">
        <span className="flex items-center gap-1.5 font-semibold">
          <QuestionGlyph size={14} />
          <Trans>Question {tag}</Trans>
        </span>
        <span className="text-xs">{entry.withdrawn ? <Trans>Withdrawn</Trans> : entry.kept ? <Trans>Kept open</Trans> : <Trans>Answer once</Trans>}</span>
      </header>
      <div className="bg-chrome-sunken px-3 py-1.5 text-xs">
        <Answering entry={entry} context={context} choice={choice?.key ?? null} hint={can} />
      </div>
      <div className="flex flex-col gap-2 px-3 py-2 text-sm">
        <p className="text-xs text-ink-secondary">{kind}</p>
        <p className="font-medium">
          <QuestionTitle entry={entry} names={names} />
        </p>
        <p className="text-xs text-ink-secondary empty:hidden">
          <QuestionBody entry={entry} context={context} />
        </p>
        {entry.holds.length > 1 ? (
          <ul className="text-xs">
            {entry.holds.map((s) => (
              <li key={s.id}>
                <SheetName sheets={[s]} /> <Copy sheet={s} />
                {s.issue_date ? <> · {f.day(s.issue_date)}</> : null} · <DrawingText kind="file-name" text={s.file_name} />
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-ink-secondary empty:hidden">
          <Trace entry={entry} context={context} onOpen={onOpen} />
        </p>
        {/* A radiogroup: the key map leaves the arrows to it, and Enter on an option answers (the screen's Enter). */}
        <fieldset role="radiogroup" aria-label={t`Answers`} className="flex flex-col gap-1" disabled={!can || answerer.busy}>
          {options.map((o, i) => (
            <div key={o.key ?? i} className="flex flex-col gap-1">
              <label className={cn('flex items-start gap-2 rounded-md px-1.5 py-1', current !== null && o.key === current && 'bg-selected')}>
                <input
                  type="radio"
                  name={name}
                  value={o.key}
                  checked={current !== null && o.key === current}
                  onChange={() => (can && o.key ? answerer.choose(entry, o.key) : undefined)}
                  className="mt-1"
                />
                <span className="num w-3 text-muted-foreground">{i < 9 ? i + 1 : null}</span>
                <span>
                  <OptionWords entry={entry} option={o} />
                  {pick && o.key === pick.key && sources ? (
                    <span className="block text-xs text-ink-secondary">
                      <Trans>Picked for you: {sources}</Trans>
                    </span>
                  ) : null}
                </span>
              </label>
              {can && o.key === 'type_number' && current === 'type_number' ? <NumberField entry={entry} answerer={answerer} pick={choice} /> : null}
            </div>
          ))}
        </fieldset>
        {can ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={current === null || (current === 'type_number' && !(choice?.text ?? '').trim()) || answerer.busy}
              onClick={() => answerer.answer(entry)}>
              <Trans>Answer {tag}</Trans>
              <KeyCombo combo="Enter" />
            </Button>
            <Button variant="ghost" onClick={answerer.later}>
              <Trans>Ask later</Trans>
              <KeyCombo combo="Q" />
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          <AnswerNote entry={entry} readOnly={readOnly} />
        </p>
      </div>
    </section>
  )
}

/** "Answered" (§6.6): one line each, "Q3 Keep R1 (14 Sep 2026); leave R0 out as superseded. Rafiq Hasan, 26 Sep 2026, 10:50". */
function AnsweredLine({ entry }: { entry: QuestionEntry }) {
  const f = useFormat()
  const given = (typeof entry.question.answer === 'object' && entry.question.answer !== null ? entry.question.answer : {}) as { option?: unknown; by?: unknown; text?: unknown }
  const option = typeof given.option === 'string' ? given.option : ''
  const by = typeof given.by === 'string' ? given.by : ''
  const at = entry.question.answered_at
  const date = at ? f.date(at) : ''
  const time = at ? f.time(at) : ''
  const tag = entry.tag
  const words =
    option === 'type_number' && typeof given.text === 'string' && given.text ? (
      <Trans>
        Numbered <DrawingText kind="sheet-number" text={given.text} truncate={false} />
      </Trans>
    ) : (
      <OptionWords entry={entry} option={{ key: option }} />
    )
  return (
    <li className="flex flex-col">
      <span>
        <span className="font-medium">{tag}</span> {words}.
      </span>
      {by ? (
        <span className="text-xs text-ink-secondary">
          {date ? (
            <Trans>
              {by}, {date}, {time}
            </Trans>
          ) : (
            by
          )}
        </span>
      ) : null}
    </li>
  )
}

export function QuestionsTab({
  model,
  readOnly,
  onOpen,
  answerer = null,
}: {
  model: Step1Model
  readOnly: 'md' | 'guest' | null
  onOpen?: (sheet: ProposalOut) => void
  answerer?: Answerer | null
}) {
  const withdrawn = model.withdrawn.flatMap((r) => (r.question ? [r.question] : []))
  return (
    <>
      {model.queue.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          <Trans>No open Questions.</Trans>
        </p>
      ) : null}
      {model.queue.map((entry) => (
        <QuestionCard key={entry.question.id} entry={entry} readOnly={readOnly} context={cardContext(model)} onOpen={onOpen} answerer={answerer} />
      ))}
      {withdrawn.length > 0 ? (
        <h3 className="px-3 pt-3 text-xs font-medium text-ink-secondary">
          <Plural value={withdrawn.length} one="Withdrawn when its sheet was left out" other="Withdrawn when their sheets were left out" />
        </h3>
      ) : null}
      {withdrawn.map((entry) => (
        <QuestionCard key={entry.question.id} entry={entry} readOnly={readOnly} context={cardContext(model)} onOpen={onOpen} answerer={answerer} />
      ))}
      {model.answered.length > 0 ? (
        <>
          <h3 className="px-3 pt-3 text-xs font-medium text-ink-secondary">
            <Trans>Answered</Trans>
          </h3>
          <ul className="flex flex-col gap-1.5 px-3 py-2 text-sm">
            {model.answered.map((entry) => (
              <AnsweredLine key={entry.question.id} entry={entry} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

/** The Takeoff Step a key of Coverage's `by_step` counts for: its own (a key or a number), Step 2's Notes for a Structural or Architectural Part; none for an MEP Part. */
function stepOf(key: string): number | null {
  const at = (STEP_KEYS as readonly string[]).indexOf(key)
  if (STEP_DISCIPLINES.has(key)) return NOTES_STEP
  if (/^\d+$/.test(key)) return Number(key)
  return at >= 0 ? at + 1 : null
}

/**
 * Coverage's `by_step` as the panel's rows (m0-screens 6.11): one per Takeoff Step, in the steps' order,
 * then each MEP Part. A Structural or Architectural Part's views join Step 2's row; the API counts a
 * view in Step 2 never again under that Part, so the sum counts each view once.
 */
function stepRows(byStep: Record<string, number>): { key: string; step: number | null; part: string | null; count: number }[] {
  const rows = new Map<string, { key: string; step: number | null; part: string | null; count: number }>()
  for (const [key, count] of Object.entries(byStep)) {
    const n = stepOf(key)
    const found = n === null ? undefined : TAKEOFF_STEPS.find((s) => s.number === n)
    const id = found ? `step:${found.number}` : key
    const row = rows.get(id) ?? { key: id, step: found ? found.number : null, part: found ? null : key, count: 0 }
    row.count += count
    rows.set(id, row)
  }
  const rank = (part: string) => {
    const i = (DISCIPLINE_ORDER as readonly string[]).indexOf(part)
    return i === -1 ? DISCIPLINE_ORDER.length : i
  }
  return [...rows.values()].sort((a, b) => {
    if (a.step !== null && b.step !== null) return a.step - b.step
    if (a.step !== null) return -1
    if (b.step !== null) return 1
    return rank(a.part!) - rank(b.part!)
  })
}

/** A row's name: a Takeoff Step's number and name ("5 Foundations"), else an MEP Part ("Electrical, M3 onwards"). */
function StepOrPart({ step, part }: { step: number | null; part: string | null }) {
  const { i18n } = useLingui()
  const found = step === null ? undefined : TAKEOFF_STEPS.find((s) => s.number === step)
  if (found) {
    const number = found.number
    const name = i18n._(found.name)
    return (
      <>
        {number} {name}
      </>
    )
  }
  const name = disciplineName(part ?? '', i18n)
  return <Trans>{name}, M3 onwards</Trans>
}

/** `held`: the held files' names; `reading`: the files still reading (m0-screens 6.11's line for each). */
export function CoveragePanel({ coverage, held, reading }: { coverage: CoverageOut; held: readonly string[]; reading: readonly string[] }) {
  const f = useFormat()
  const reasons = Object.entries(coverage.by_reason)
  const steps = stepRows(coverage.by_step)
  const { i18n } = useLingui()
  return (
    <>
      <Block title={<Trans>Coverage, every view on every sheet read</Trans>}>
        <p className="text-xs text-muted-foreground">
          <Trans>
            A view counts once it is assigned to a step that will read it, or excluded with a reason. Used is 0: no step after Step 1 runs in M0. A view may feed
            several steps, so the steps below add up to more than the views.
          </Trans>
        </p>
        <CoverageLine coverage={coverage} />
      </Block>
      {steps.length > 0 ? (
        <Block title={<Trans>Views by the step that will read them, proposed or assigned</Trans>}>
          <dl className="flex flex-col gap-1">
            {steps.map((row) => (
              <Fact key={row.key} label={<StepOrPart step={row.step} part={row.part} />}>
                {f.integer(row.count)}
              </Fact>
            ))}
          </dl>
        </Block>
      ) : null}
      {reasons.length > 0 ? (
        <Block title={<Trans>Excluded, by reason</Trans>}>
          <dl className="flex flex-col gap-1">
            {reasons.map(([reason, count]) => (
              <Fact key={reason} label={i18n._(REASON_SHORT[reason] ?? UNKNOWN_REASON)}>
                {f.integer(count)}
              </Fact>
            ))}
          </dl>
        </Block>
      ) : null}
      {held.map((name) => {
        const file = <DrawingText kind="file-name" text={name} truncate={false} />
        return (
          <p key={name} className="px-3 pt-2 text-xs">
            <Trans>{file} is held: its views are not counted unless you read it anyway.</Trans>
          </p>
        )
      })}
      {reading.map((name) => {
        const file = <DrawingText kind="file-name" text={name} truncate={false} />
        return (
          <p key={name} className="px-3 pt-2 text-xs">
            <Trans>{file} is still reading; its views join as its sheets arrive.</Trans>
          </p>
        )
      })}
      <p className="px-3 py-2 text-xs text-muted-foreground">
        <Trans>Esc goes back.</Trans>
      </p>
    </>
  )
}

/** "Coverage 70 views: 0 assigned, 0 excluded, 68 proposed, 2 unaccounted". */
export function CoverageLine({ coverage }: { coverage: CoverageOut }) {
  const f = useFormat()
  const assigned = f.integer(coverage.assigned)
  const excluded = f.integer(coverage.excluded)
  const proposed = f.integer(coverage.proposed)
  const unaccounted = f.integer(coverage.unaccounted)
  return (
    <span>
      <Plural value={coverage.views} one="Coverage # view:" other="Coverage # views:" />{' '}
      <Trans>
        {assigned} assigned, {excluded} excluded, {proposed} proposed, <span className={cn(coverage.unaccounted > 0 && 'text-question')}>{unaccounted} unaccounted</span>
      </Trans>
    </span>
  )
}
