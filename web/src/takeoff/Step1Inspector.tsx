/*
 * Step 1 in the inspector (m0-screens §6.6, §6.7, §6.11): with nothing focused, the overview (the
 * per-Part progress, the order Enter takes things in, the expected sheets); with a row focused, its
 * Question card, the sheet's facts, where each was read, and who did what; Coverage's panel when the
 * status bar's Coverage is clicked. The Questions tab holds every open Question's card in queue order.
 *
 * Answering has no operation in 19a's API yet (the orchestrator's ruling for 22): the card shows the
 * Question, what its answer would do and its options, and says it cannot be answered here yet.
 */
import type { ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { TAKEOFF_STEPS } from '@/app/steps'
import { useFormat } from '@/format'
import { Button, DrawingText, KeyCombo, cn } from '@/ui'
import { MachineText } from '@/format/machine'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { ActorChip } from './ActorChip'
import { StoreyStrip, StoreysText, useStoreysWords } from './storeys'
import { QuestionGlyph } from '@/ui/glyphs'
import { SheetName } from './acts'
import { SheetRange } from './SheetRange'
import type { CoverageOut, ProposalOut, ViewOut } from './data'
import type { DisciplineSection, QuestionEntry, Row, Step1Model } from './model'
import { Answering, CannotAnswer, Copy, OptionWords, PickSources, QuestionBody, QuestionTitle, Trace, optionsOf, useKindLine, usePick, type CardContext } from './questionWords'
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
    return (
      <Trans>
        {name}: {listed} on the drawing list read on a sheet; {found} found.
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
            {questions > 0 ? (
              <li>
                <Plural
                  value={questions}
                  one="Answer # Question: the held file first, then those holding the most sheets"
                  other="Answer # Questions: the held file first, then those holding the most sheets"
                />
              </li>
            ) : null}
            {single > 0 ? (
              <li>
                <Plural value={single} one="Confirm # sheet with one source, on its own" other="Confirm # sheets with one source, one by one" />
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
  if (sheet.decision === 'confirmed') return <Trans>Confirmed by {name}, {date}</Trans>
  if (sheet.decision === 'excluded') {
    const reason = reasonOf(sheet, i18n)
    return (
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
  const when = sheet.decided_at ? `${f.date(sheet.decided_at)}, ${f.time(sheet.decided_at)}` : ''
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
        {role ? (
          <Trans>
            {name}, {role}, {when}
          </Trans>
        ) : (
          <Trans>
            {name}, {when}
          </Trans>
        )}
      </span>
    </div>
  )
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
  const stated = plans.some((v) => v.storeys.length > 0)
  return (
    <span className="flex flex-col gap-1">
      <span>
        <StoreysText views={sheet.views} />
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
  if (none?.code) {
    const why = <MachineText message={none} />
    return <Trans>None: {why}</Trans>
  }
  return <Trans>None: no PDF of this set matched it</Trans>
}

/** A view's chips (6.6): each proposed step ("7 Beams") or its Part, or its exclusion, or amber "no step: unaccounted". */
const CHIP = cn('rounded-sm bg-chrome-sunken px-1 text-2xs')

function ViewChips({ view, confirmed }: { view: ViewOut; confirmed: boolean }) {
  const { i18n } = useLingui()
  const chip = CHIP
  if (view.decision === 'excluded' || view.proposed_exclusion) {
    const reason = i18n._(REASON_SHORT[view.excluded_reason ?? view.proposed_exclusion ?? ''] ?? UNKNOWN_REASON)
    return (
      <span className={cn(chip, 'text-excluded')}>
        <Trans>excluded: {reason}</Trans>
      </span>
    )
  }
  const steps = view.steps
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
  const part = view.part ? disciplineName(view.part, i18n) : null
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
function Views({ sheet, selected, onSelect }: { sheet: ProposalOut; selected: string | null; onSelect?: (id: string) => void }) {
  const { i18n } = useLingui()
  const words = useStoreysWords()
  const views = sheet.views ?? []
  const n = views.length
  return (
    <Block
      title={
        <>
          <Plural value={n} one="Views (#)" other="Views (#)" />{' '}
          <span className="font-normal text-muted-foreground">
            <Trans>→ walks them; X excludes</Trans>
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
              {storeys ? (
                <span className="text-xs text-ink-secondary">
                  {meaning ? (
                    <Trans>
                      {storeys}, {meaning}
                    </Trans>
                  ) : (
                    storeys
                  )}
                </span>
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
}: {
  row: Row
  showTitle: boolean
  readOnly: boolean
  acts?: SheetActs
  selectedView?: string | null
  onSelectView?: (id: string) => void
  /** The storey strip's slots, the project's (6.8). */
  slots?: readonly string[]
}) {
  const sheet = row.sheets[0]
  if (!sheet) return null
  const excluded = row.sheets.every((s) => s.decision === 'excluded')
  const decided = row.sheets.filter((s) => s.decision)
  return (
    <>
      <Block>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">
            <SheetName sheets={row.sheets} />
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
          <Fact label={<Trans>Sources</Trans>}>{row.sheets.every((s) => s.agrees) ? <Trans>two, agreeing</Trans> : <Trans>one source</Trans>}</Fact>
        </dl>
      </Block>
      <Views sheet={sheet} selected={selectedView} onSelect={onSelectView} />
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
export function cardContext(model: Step1Model): CardContext {
  return {
    sheets: model.rows.flatMap((r) => [...r.sheets]),
    lists: Object.fromEntries(model.disciplines.map((d) => [d.discipline, d.list])),
    names: model.fileNames,
  }
}

export function QuestionCard({
  entry,
  readOnly,
  context,
  onOpen,
}: {
  entry: QuestionEntry
  readOnly: 'md' | 'guest' | null
  context: CardContext
  /** A Trace link opens its sheet. */
  onOpen?: (sheet: ProposalOut) => void
}) {
  const names = context.names
  const { t } = useLingui()
  const f = useFormat()
  const kind = useKindLine(entry)
  const tag = entry.tag
  const options = optionsOf(entry)
  const pick = usePick(entry)
  const sources = <PickSources entry={entry} context={context} />
  const name = `question-${entry.question.id}`
  return (
    <section aria-label={t`Question ${tag}`} className="m-2 overflow-hidden rounded-md border border-question">
      <header className="flex items-center justify-between gap-2 bg-question-surface px-3 py-1.5 text-sm text-question">
        <span className="flex items-center gap-1.5 font-semibold">
          <QuestionGlyph size={14} />
          <Trans>Question {tag}</Trans>
        </span>
        <span className="text-xs">{entry.kept ? <Trans>Kept open</Trans> : <Trans>Answer once</Trans>}</span>
      </header>
      <div className="bg-chrome-sunken px-3 py-1.5 text-xs">
        <Answering entry={entry} names={names} />
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
        <fieldset className="flex flex-col gap-1" disabled>
          <legend className="sr-only">
            <Trans>Answers</Trans>
          </legend>
          {options.map((o, i) => (
            <label key={o.key ?? i} className={cn('flex items-start gap-2 rounded-md px-1.5 py-1', pick && o.key === pick.key && 'bg-selected')}>
              <input type="radio" name={name} value={o.key} defaultChecked={!!pick && o.key === pick.key} className="mt-1" />
              <span className="num w-3 text-muted-foreground">{i + 1}</span>
              <span>
                <OptionWords entry={entry} option={o} />
                {pick && o.key === pick.key ? (
                  <span className="block text-xs text-ink-secondary">
                    <Trans>Picked for you: {sources}</Trans>
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          <CannotAnswer entry={entry} readOnly={readOnly} />
        </p>
      </div>
    </section>
  )
}

export function QuestionsTab({ model, readOnly, onOpen }: { model: Step1Model; readOnly: 'md' | 'guest' | null; onOpen?: (sheet: ProposalOut) => void }) {
  if (model.queue.length === 0)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        <Trans>No open Questions.</Trans>
      </p>
    )
  return (
    <>
      {model.queue.map((entry) => (
        <QuestionCard key={entry.question.id} entry={entry} readOnly={readOnly} context={cardContext(model)} onOpen={onOpen} />
      ))}
    </>
  )
}

/** A key of Coverage's `by_step`: a Takeoff Step's number ("5 Foundations"), else an MEP Part ("Electrical, M3 onwards"). */
function StepOrPart({ step }: { step: string }) {
  const { i18n } = useLingui()
  const found = /^\d+$/.test(step) ? TAKEOFF_STEPS.find((s) => s.number === Number(step)) : undefined
  if (found) {
    const number = found.number
    const name = i18n._(found.name)
    return (
      <>
        {number} {name}
      </>
    )
  }
  const part = disciplineName(step, i18n)
  return <Trans>{part}, M3 onwards</Trans>
}

export function CoveragePanel({ coverage, held }: { coverage: CoverageOut; held: readonly string[] }) {
  const f = useFormat()
  const reasons = Object.entries(coverage.by_reason)
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
      <Block title={<Trans>Views by the step that will read them, proposed or assigned</Trans>}>
        <dl className="flex flex-col gap-1">
          {Object.entries(coverage.by_step).map(([step, count]) => (
            <Fact key={step} label={<StepOrPart step={step} />}>
              {f.integer(count)}
            </Fact>
          ))}
        </dl>
      </Block>
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
