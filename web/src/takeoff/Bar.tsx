/*
 * The Confirmation bar (m0-screens §6.4, §6.5, §6.12) and the exclusion picker it becomes (§6.9). The
 * bar floats at the canvas foot, at most 820 px wide, and always says what Enter will do: `barFor`
 * works that out once, and both the bar and the screen's Enter use it.
 */
import { useState, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFormat } from '@/format'
import { Button, KeyCombo, KeyScope, cn, useKeys } from '@/ui'
import { SheetName } from './acts'
import type { ProposalOut } from './data'
import { REASONS, whyOneSource, type Reason, type Row, type Step1Model } from './model'
import { Answering, QuestionTitle } from './questionWords'
import { disciplineName } from './SheetList'
import { REASON_NAMES, REASON_SHORT, UNKNOWN_REASON } from './words'

export interface BarSpec {
  what: ReactNode
  why: ReactNode
  /** The copper button, and what Enter does; `name` is its accessible name when its words hold figures. */
  button?: { label: ReactNode; run: () => void; name?: string }
  /** A ghost button beside it (by mouse), with its key shown when it has one. */
  ghost?: { label: ReactNode; run: () => void; combo?: string }
}

export interface BarContext {
  model: Step1Model
  row: Row | null
  mode: 'list' | 'sheet'
  readOnly: 'md' | 'guest' | null
  bulk: () => void
  confirmRow: (row: Row, thenNext: boolean) => void
  nextOpen: () => void
  openRow: (row: Row) => void
  /** Q: the next open Question's row. */
  nextQuestion: () => void
}

function Who({ sheet }: { sheet: ProposalOut }) {
  const f = useFormat()
  const name = sheet.decided_by ?? ''
  const date = sheet.decided_at ? `${f.date(sheet.decided_at)}, ${f.time(sheet.decided_at)}` : ''
  if (!name || !date) return null
  return (
    <Trans>
      By {name}, {date}.
    </Trans>
  )
}

/** "Nusrat Jahan (QS) confirms the sheet list; every act shows who did it." (6.12), naming the Project's QSs. */
function QsConfirms({ names }: { names: readonly string[] }) {
  const { i18n } = useLingui()
  if (names.length === 0) return <Trans>The QS confirms the sheet list; every act shows who did it.</Trans>
  const who = new Intl.ListFormat(i18n.locale, { type: 'conjunction' }).format(names)
  return names.length === 1 ? <Trans>{who} (QS) confirms the sheet list; every act shows who did it.</Trans> : <Trans>{who} (QS) confirm the sheet list; every act shows who did it.</Trans>
}

function BulkWhat({ model }: { model: Step1Model }) {
  const { i18n } = useLingui()
  const n = model.bulk.confirm.length
  const m = model.bulk.leaveOut.length
  const reasons = model.bulk.reasons.map((r) => i18n._(REASON_SHORT[r] ?? UNKNOWN_REASON)).join(', ')
  if (m === 0) return <Plural value={n} one="Confirm # sheet that agrees" other="Confirm # sheets that agree" />
  if (n === 0) return <Trans>Leave out {m}: {reasons}</Trans>
  return (
    <Trans>
      <Plural value={n} one="Confirm # sheet that agrees" other="Confirm # sheets that agree" />, and leave out {m}: {reasons}
    </Trans>
  )
}

function BulkWhy({ model }: { model: Step1Model }) {
  const bulk = new Set(model.bulk.confirm.map((p) => p.discipline))
  const sections = model.disciplines.filter((d) => bulk.has(d.discipline))
  const listed = sections.some((d) => d.list)
  const unlisted = sections.some((d) => !d.list)
  const out = model.bulk.leaveOut.length > 0
  const tail = out ? <Trans>Left-out sheets stay in the count with their reason.</Trans> : null
  if (listed && unlisted)
    return (
      <>
        <Trans>Each has a number and title from its title block, on its drawing list or in numbering without a gap.</Trans> {tail}
      </>
    )
  if (listed)
    return (
      <>
        <Trans>Each has a number and title from its title block and is on its drawing list.</Trans> {tail}
      </>
    )
  if (unlisted)
    return (
      <>
        <Trans>Each has a number and title from its title block, in numbering without a gap, and its Plot page matches.</Trans> {tail}
      </>
    )
  return tail
}

/** Why a sheet has only one source (6.5): what the QS can do about it differs. */
function OneSourceWhy({ sheet, model }: { sheet: ProposalOut; model: Step1Model }) {
  const why = whyOneSource(
    sheet,
    model.disciplines.find((d) => d.discipline === sheet.discipline),
  )
  if (why === 'not-listed') return <Trans>The drawing list does not name it.</Trans>
  if (why === 'gap') return <Trans>Its Discipline’s numbering has a gap or a number twice.</Trans>
  if (why === 'no-list-no-plot') return <Trans>No drawing list and no Plot to check them against.</Trans>
  return <Trans>Nothing else confirms it.</Trans>
}

/** What the bar says and what Enter does, for the focused row (or none) in this mode. */
export function useBar(c: BarContext): BarSpec | null {
  const { i18n, t } = useLingui()
  const f = useFormat()
  const { model, row } = c
  const n = model.bulk.confirm.length
  const m = model.bulk.leaveOut.length
  const bulkable = n + m > 0

  if (c.readOnly) {
    const role = c.readOnly
    const what = model.allConfirmed ? (
      role === 'md' ? (
        <Trans>Step 1 is confirmed. You are reading it as the MD.</Trans>
      ) : (
        <Trans>Step 1 is confirmed. You are reading it as a Guest.</Trans>
      )
    ) : role === 'md' ? (
      <Trans>You are reading this as the MD.</Trans>
    ) : (
      <Trans>You are reading this as a Guest.</Trans>
    )
    return {
      what,
      why: <QsConfirms names={model.qs} />,
      ghost: model.queue.length > 0 ? { label: <Trans>Next open Question</Trans>, run: c.nextQuestion, combo: 'Q' } : undefined,
    }
  }

  const bulkName = plain(m === 0 ? t`Confirm ${n}` : n === 0 ? t`Leave out ${m}` : t`Confirm ${n}, leave out ${m}`)
  const bulkSpec: BarSpec = {
    what: <BulkWhat model={model} />,
    why: <BulkWhy model={model} />,
    button: {
      label: m === 0 ? <Trans>Confirm {n}</Trans> : n === 0 ? <Trans>Leave out {m}</Trans> : <Trans>Confirm {n}, leave out {m}</Trans>,
      run: c.bulk,
      name: bulkName,
    },
  }

  if (row) {
    const sheet = row.sheets[0]
    const name = <SheetName sheets={row.sheets} />
    if (row.question) {
      const tag = row.question.tag
      const title = <QuestionTitle entry={row.question} names={model.fileNames} />
      return {
        what: (
          <Trans>
            Question {tag}: {title}
          </Trans>
        ),
        why: <Answering entry={row.question} names={model.fileNames} />,
        ghost: { label: <Trans>Next open item</Trans>, run: c.nextOpen },
      }
    }
    if (sheet && sheet.decision === 'confirmed') {
      const by = sheet.decided_by ?? ''
      const date = sheet.decided_at ? `${f.date(sheet.decided_at)}, ${f.time(sheet.decided_at)}` : ''
      return {
        what: (
          <Trans>
            {name} is confirmed by {by}
          </Trans>
        ),
        why: <Trans>{date}. X excludes it, with a reason.</Trans>,
        button: { label: <Trans>Next open item</Trans>, run: c.nextOpen },
      }
    }
    if (sheet && sheet.decision === 'excluded') {
      const reason = sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
      return {
        what: (
          <Trans>
            {name} is excluded: {reason}
          </Trans>
        ),
        why: (
          <>
            <Who sheet={sheet} /> <Trans>It stays in the count.</Trans>
          </>
        ),
        button: { label: <Trans>Confirm back in</Trans>, run: () => c.confirmRow(row, false) },
      }
    }
    if (sheet && c.mode === 'sheet') {
      if (sheet.proposed_exclusion) {
        const reason = i18n._(REASON_SHORT[sheet.proposed_exclusion] ?? UNKNOWN_REASON)
        return {
          what: <Trans>Leave out {name}: {reason}</Trans>,
          why: <Trans>It stays in the count with its reason. X picks another reason.</Trans>,
          button: { label: <Trans>Leave out {name}</Trans>, run: () => c.confirmRow(row, true) },
        }
      }
      const agrees = row.sheets.every((s) => s.agrees)
      const section = model.disciplines.find((d) => d.discipline === sheet.discipline)
      return {
        what: agrees ? (
          section?.list ? (
            <Trans>{name} agrees: number and title from the title block, on the drawing list</Trans>
          ) : (
            <Trans>{name} agrees: number and title from the title block, in numbering without a gap, and its Plot page matches</Trans>
          )
        ) : (
          <Trans>{name} has one source: number and title from its title block</Trans>
        ),
        why: agrees ? (
          <Trans>Enter confirms it and opens the next open sheet.</Trans>
        ) : (
          <>
            <OneSourceWhy sheet={sheet} model={model} /> <Trans>Enter confirms it and opens the next open sheet.</Trans>
          </>
        ),
        ghost: n > 0 ? { label: m > 0 ? <Trans>Confirm {n}, leave out {m}</Trans> : <Trans>Confirm all {n} that agree</Trans>, run: c.bulk } : undefined,
        button: { label: <Trans>Confirm {name}</Trans>, run: () => c.confirmRow(row, true) },
      }
    }
    if (sheet && !row.sheets.every((s) => s.agrees) && !sheet.proposed_exclusion) {
      return {
        what: <Trans>{name} has one source: number and title from its title block</Trans>,
        why: (
          <>
            <OneSourceWhy sheet={sheet} model={model} /> <Trans>Open it to confirm it.</Trans>
          </>
        ),
        ghost: { label: <Trans>Open {name}</Trans>, run: () => c.openRow(row), combo: 'Space' },
        button: bulkable ? bulkSpec.button : undefined,
      }
    }
  }

  if (bulkable) return bulkSpec
  if (model.allConfirmed)
    return {
      what: <Trans>Step 1 is confirmed: every sheet is confirmed or excluded, and Coverage has none unaccounted</Trans>,
      why: <Trans>Step 2, General notes and specification, comes in M1.</Trans>,
    }
  if (model.oneSource.length > 0) {
    const first = model.oneSource[0]!
    const count = model.oneSource.filter((p) => p.discipline === first.discipline).length
    const discipline = disciplineName(first.discipline, i18n)
    const firstRow = model.rows.find((r) => r.sheets.some((s) => s.id === first.id)) ?? null
    return {
      what: <Plural value={count} one={`# ${discipline} sheet has one source`} other={`# ${discipline} sheets have one source each`} />,
      why:
        whyOneSource(first, model.disciplines.find((d) => d.discipline === first.discipline)) === 'no-list-no-plot' ? (
          <Trans>No drawing list and no Plot to check them against. Open each to confirm it.</Trans>
        ) : (
          <Trans>Nothing else confirms them. Open each to confirm it.</Trans>
        ),
      ghost: firstRow ? { label: <Trans>Open <SheetName sheets={[first]} /></Trans>, run: () => c.openRow(firstRow), combo: 'Space' } : undefined,
    }
  }
  if (model.queue.length > 0) {
    const count = model.queue.length
    return {
      what: <Plural value={count} one="# Question is open" other="# Questions are open" />,
      why: <Trans>Their sheets wait for the answers. Q takes you to the next one.</Trans>,
      ghost: { label: <Trans>Next open item</Trans>, run: c.nextOpen },
    }
  }
  if (model.unaccounted > 0)
    return {
      what: <Trans>Coverage has a view that is neither assigned nor excluded</Trans>,
      why: <Trans>Open Coverage on the status bar to find it.</Trans>,
    }
  return null
}

/** An accessible name without the isolates a message puts round its figures (a screen reader reads none). */
function plain(words: string): string {
  return words.replace(/[\u2066-\u2069]/g, '')
}

export function Bar({ spec }: { spec: BarSpec }) {
  return (
    <div className="pointer-events-auto mx-auto flex min-h-11 w-[min(820px,calc(100%-32px))] items-center gap-3 rounded-lg border border-border-raised bg-popover px-3 py-1.5 shadow-3">
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium">{spec.what}</div>
        <div className="line-clamp-2 text-xs text-muted-foreground">{spec.why}</div>
      </div>
      {spec.ghost ? (
        <Button variant="ghost" onClick={spec.ghost.run} aria-keyshortcuts={spec.ghost.combo}>
          {spec.ghost.label}
          {spec.ghost.combo ? <KeyCombo combo={spec.ghost.combo} /> : null}
        </Button>
      ) : null}
      {spec.button ? (
        <Button variant="commit" onClick={spec.button.run} aria-label={spec.button.name} aria-keyshortcuts="Enter" /* eslint-disable-line lingui/no-unlocalized-strings -- a key name */>
          {spec.button.label}
          <KeyCombo combo="Enter" className="[&_kbd]:border-transparent [&_kbd]:bg-transparent [&_kbd]:text-current" />
        </Button>
      ) : null}
    </div>
  )
}

/** The picker the bar becomes on X: seven reasons, keys 1–7; 8, 9 and 0 do nothing while it is open. */
export function ExclusionPicker({ row, onPick, onCancel }: { row: Row; onPick: (reason: Reason, text?: string) => void; onCancel: () => void }) {
  const { t, i18n } = useLingui()
  const [other, setOther] = useState<string | null>(null)
  const name = <SheetName sheets={row.sheets} />
  const pick = (reason: Reason) => {
    if (reason === 'other') setOther('')
    else onPick(reason)
  }
  const nothing = t`Nothing: the picker has seven reasons`
  const bindings = [
    ...REASONS.map((reason, i) => ({ key: String(i + 1), label: i18n._(REASON_NAMES[reason]), group: 'screen' as const, run: (event: KeyboardEvent) => (event.repeat ? undefined : pick(reason)) })),
    { key: '8', label: nothing, group: 'screen' as const, run: () => {} },
    { key: '9', label: nothing, group: 'screen' as const, run: () => {} },
    { key: '0', label: nothing, group: 'screen' as const, run: () => {} },
    { key: 'Esc', label: t`Cancel the exclusion`, group: 'screen' as const, run: onCancel },
    {
      key: 'Enter',
      label: t`Exclude with the reason typed`,
      group: 'screen' as const,
      when: () => other !== null,
      run: () => {
        if (other && other.trim()) onPick('other', other.trim())
      },
    },
  ]
  return (
    <KeyScope level="mode" name="exclusion-picker">
      <PickerKeys bindings={bindings} />
      <div
        role="group"
        aria-label={t`Exclusion reasons`}
        className="pointer-events-auto mx-auto flex w-[min(820px,calc(100%-32px))] flex-col gap-1.5 rounded-lg border border-border-raised bg-popover px-3 py-2 shadow-3"
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">
            <Trans>Exclude {name}. Why?</Trans>
          </span>
          <span className="text-xs text-muted-foreground">
            <Trans>Coverage keeps the reason. Esc cancels</Trans>
          </span>
        </div>
        {other === null ? (
          <div className="grid grid-cols-7 gap-1">
            {REASONS.map((reason, i) => (
              <button
                key={reason}
                type="button"
                tabIndex={-1}
                onClick={() => pick(reason)}
                className={cn('flex min-h-9 items-start gap-1 rounded-md border border-border px-1 py-1 text-start text-2xs leading-tight hover:bg-hover')}
              >
                <span className="num font-semibold text-muted-foreground">{i + 1}</span>
                <span>{i18n._(REASON_NAMES[reason])}</span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (other.trim()) onPick('other', other.trim())
            }}
          >
            <input
              autoFocus
              aria-label={t`The reason, in a few words`}
              placeholder={t`The reason, in a few words`}
              value={other}
              onChange={(event) => setOther(event.target.value)}
              maxLength={200}
              className="h-control min-w-0 flex-1 rounded-md border border-input bg-paper px-2 text-sm"
            />
            <Button variant="primary" type="submit" disabled={!other.trim()}>
              <Trans>Exclude</Trans>
              <KeyCombo combo="Enter" className="[&_kbd]:border-transparent [&_kbd]:bg-transparent [&_kbd]:text-current" />
            </Button>
          </form>
        )}
      </div>
    </KeyScope>
  )
}

function PickerKeys({ bindings }: { bindings: Parameters<typeof useKeys>[0] }) {
  useKeys(bindings)
  return null
}
