/*
 * Step 1 in the inspector (m0-screens §6.6, §6.7, §6.11): with nothing focused, the overview (the
 * per-Part progress, the order Enter takes things in, the expected sheets); with a row focused, its
 * Question card, the sheet's facts, where each was read, and who did what; Coverage's panel when the
 * status bar's Coverage is clicked. The Questions tab holds every open Question's card in queue order.
 *
 * Answering has no operation in 19a's API yet (the orchestrator's ruling for 22): the card shows the
 * Question, what each answer would do and its options, and says it cannot be answered here yet.
 */
import type { ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { DrawingText, cn } from '@/ui'
import { QuestionGlyph } from '@/ui/glyphs'
import { SheetName } from './acts'
import type { CoverageOut, ProposalOut } from './data'
import type { DisciplineSection, QuestionEntry, Row, Step1Model } from './model'
import { disciplineName } from './SheetList'
import { NOT_RECEIVED_NAMES, OPTION_NAMES, OTHER_DISCIPLINE, OTHER_OPTION, OTHER_QUESTION, QUESTION_KINDS, REASON_SHORT, UNKNOWN_REASON } from './words'
import { useHasEnglish } from './useHasEnglish'

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
      const left = f.integer(d.found - d.settled)
      return d.found - d.settled > 0 ? t`${name} ${left} to confirm` : t`${name}: Questions open`
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
  if (section.list) {
    const listed = f.integer(section.list.numbers.length)
    return (
      <Trans>
        {name}: {listed} on the drawing list; {found} found.
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
  const first = <DrawingText kind="sheet-number" text={run.first} truncate={false} />
  const last = <DrawingText kind="sheet-number" text={run.last} truncate={false} />
  return run.missing.length === 0 ? (
    <Trans>
      {name}: no drawing list; numbering runs {first}–{last} without a gap; {found} found.
    </Trans>
  ) : (
    <Trans>
      {name}: no drawing list; numbering runs {first}–{last} with gaps; {found} found.
    </Trans>
  )
}

export function Overview({ model, projectName }: { model: Step1Model; projectName: string }) {
  const { i18n } = useLingui()
  const n = model.bulk.confirm.length
  const m = model.bulk.leaveOut.length
  const questions = model.queue.length
  const reasons = model.bulk.reasons.map((r) => i18n._(REASON_SHORT[r] ?? UNKNOWN_REASON)).join(', ')
  const nothing = n + m === 0 && questions === 0
  return (
    <>
      <Block title={<Trans>{projectName}’s sheets</Trans>}>
        <p>
          <PartsLine model={model} />
        </p>
      </Block>
      <Block title={<Trans>Enter takes them in this order</Trans>}>
        {nothing ? (
          <p>
            <Trans>Nothing is waiting.</Trans>
          </p>
        ) : (
          <ol className="list-decimal ps-5">
            {n + m > 0 ? (
              <li>
                {m > 0 ? (
                  <Trans>
                    Confirm the {n} sheets that agree and leave out {m}: {reasons}
                  </Trans>
                ) : (
                  <Trans>Confirm the {n} sheets that agree</Trans>
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
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          <Trans>↓ walks the list; Space opens a sheet; a Proposal counts toward nothing until you confirm it.</Trans>
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

function Decided({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const name = sheet.decided_by ?? ''
  const date = sheet.decided_at ? f.date(sheet.decided_at) : ''
  if (sheet.decision === 'confirmed') return <Trans>Confirmed by {name}, {date}</Trans>
  if (sheet.decision === 'excluded') {
    const reason = sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
    return (
      <Trans>
        Excluded by {name}, {date}: {reason}
      </Trans>
    )
  }
  return <Trans>Proposed by Vextrus from the file; no one has acted on it yet. A Proposal counts toward nothing until you confirm it.</Trans>
}

function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function SourceOf({ source }: { source: string | null | undefined }) {
  if (source === 'file_name') return <Trans>from the file name</Trans>
  if (source === 'title_block') return <Trans>from the title block</Trans>
  return null
}

export function SheetFacts({ row, showTitle }: { row: Row; showTitle: boolean }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const sheet = row.sheets[0]
  if (!sheet) return null
  return (
    <>
      <Block>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">
            <SheetName sheets={row.sheets} />
          </span>
          {showTitle ? <DrawingText kind="title" text={sheet.title} truncate={false} className="text-ink-secondary" /> : null}
        </div>
      </Block>
      <Block title={<Trans>Proposal: where each was read</Trans>}>
        <dl className="flex flex-col gap-1">
          <Fact label={<Trans>Discipline</Trans>}>{disciplineName(sheet.discipline, i18n)}</Fact>
          <Fact label={<Trans>Revision</Trans>}>
            {sheet.revision_mark ? (
              <>
                <DrawingText kind="revision" text={sheet.revision_mark} truncate={false} />
                {sheet.issue_date ? <>, {f.date(sheet.issue_date)}</> : null} <SourceOf source={sheet.revision_mark_source} />
              </>
            ) : (
              <Trans>none: the title block has none and the file name none</Trans>
            )}
          </Fact>
          <Fact label={<Trans>File</Trans>}>
            <DrawingText kind="file-name" text={sheet.file_name} />
          </Fact>
          <Fact label={<Trans>Sources</Trans>}>{row.sheets.every((s) => s.agrees) ? <Trans>two agree</Trans> : <Trans>one source</Trans>}</Fact>
        </dl>
      </Block>
      <Block title={<Trans>Who did what</Trans>}>
        {row.sheets.map((s) => (
          <p key={s.id}>
            {row.sheets.length > 1 ? (
              <>
                <SheetName sheets={[s]} />{' '}
              </>
            ) : null}
            <Decided sheet={s} />
          </p>
        ))}
      </Block>
    </>
  )
}

function useQuestionTitle(entry: QuestionEntry): ReactNode {
  const { i18n } = useLingui()
  const has = useHasEnglish()
  const q = entry.question
  const params = Object.fromEntries(Object.entries(q.params).filter(([, v]) => typeof v === 'string' || typeof v === 'number')) as Record<string, string | number>
  if (has(q.code)) return <MachineText message={{ code: q.code, params }} />
  return i18n._(QUESTION_KINDS[q.kind] ?? OTHER_QUESTION)
}

function Answering({ entry }: { entry: QuestionEntry }) {
  const n = entry.holds.length
  const picked = entry.question.options.find((o) => (o as { picked?: boolean }).picked)
  if (picked === undefined) {
    return n === 0 ? <Trans>Answering confirms no sheets.</Trans> : <Plural value={n} one="Answering settles # sheet." other="Answering settles # sheets." />
  }
  return <Plural value={n} one="Answering settles # sheet, as picked below." other="Answering settles # sheets, as picked below." />
}

export function QuestionCard({ entry, readOnly }: { entry: QuestionEntry; readOnly: 'md' | 'guest' | null }) {
  const { i18n, t } = useLingui()
  const title = useQuestionTitle(entry)
  const kind = i18n._(QUESTION_KINDS[entry.question.kind] ?? OTHER_QUESTION)
  const tag = entry.tag
  const options = entry.question.options.map((o) => o as { key?: string; picked?: boolean })
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
        <Answering entry={entry} />
      </div>
      <div className="flex flex-col gap-2 px-3 py-2 text-sm">
        <p className="text-xs text-ink-secondary">{kind}</p>
        <p className="font-medium">{title}</p>
        {entry.holds.length > 1 ? (
          <ul className="text-xs">
            {entry.holds.map((s) => (
              <li key={s.id}>
                <SheetName sheets={[s]} /> <DrawingText kind="revision" text={s.revision_mark} truncate={false} /> · <DrawingText kind="file-name" text={s.file_name} />
              </li>
            ))}
          </ul>
        ) : null}
        <fieldset className="flex flex-col gap-1" disabled>
          <legend className="sr-only">
            <Trans>Answers</Trans>
          </legend>
          {options.map((o, i) => (
            <label key={o.key ?? i} className={cn('flex items-start gap-2 rounded-md px-1.5 py-1', o.picked && 'bg-selected')}>
              <input type="radio" name={name} value={o.key} defaultChecked={!!o.picked} className="mt-1" />
              <span className="num w-3 text-muted-foreground">{i + 1}</span>
              <span>
                {o.picked ? (
                  <span className="text-xs text-ink-secondary">
                    <Trans>Picked for you:</Trans>{' '}
                  </span>
                ) : null}
                {i18n._((o.key && OPTION_NAMES[o.key]) || OTHER_OPTION)}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          {readOnly === 'md' ? (
            <Trans>Waiting for the QS. The MD reads Questions and cannot answer them.</Trans>
          ) : readOnly === 'guest' ? (
            <Trans>Waiting for the QS. A Guest reads Questions and cannot answer them.</Trans>
          ) : (
            <Trans>This Question cannot be answered here yet. Keep its sheets open and ask the consultant.</Trans>
          )}
        </p>
      </div>
    </section>
  )
}

export function QuestionsTab({ model, readOnly }: { model: Step1Model; readOnly: 'md' | 'guest' | null }) {
  if (model.queue.length === 0)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        <Trans>No open Questions.</Trans>
      </p>
    )
  return (
    <>
      {model.queue.map((entry) => (
        <QuestionCard key={entry.question.id} entry={entry} readOnly={readOnly} />
      ))}
    </>
  )
}

export function CoveragePanel({ coverage }: { coverage: CoverageOut }) {
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
            <Fact key={step} label={<Trans>Step {step}</Trans>}>
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
      <p className="px-3 py-2 text-xs text-muted-foreground">
        <Trans>Esc goes back.</Trans>
      </p>
    </>
  )
}

/** "Coverage 70 views: 0 assigned, 0 excluded, 68 proposed, 2 unaccounted". */
export function CoverageLine({ coverage }: { coverage: CoverageOut }) {
  const f = useFormat()
  const views = f.integer(coverage.views)
  const assigned = f.integer(coverage.assigned)
  const excluded = f.integer(coverage.excluded)
  const proposed = f.integer(coverage.proposed)
  const unaccounted = f.integer(coverage.unaccounted)
  return (
    <span>
      <Trans>
        Coverage {views} views: {assigned} assigned, {excluded} excluded, {proposed} proposed,{' '}
        <span className={cn(coverage.unaccounted > 0 && 'text-question')}>{unaccounted} unaccounted</span>
      </Trans>
    </span>
  )
}
