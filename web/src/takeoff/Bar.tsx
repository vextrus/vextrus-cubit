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
import { REASONS, isGaps, whyOneSource, type Reason, type Row, type Step1Model } from './model'
import { Answering, QuestionTitle, cardContext, prePick } from './questionWords'
import type { Answerer } from './Step1Inspector'
import { disciplineName } from './SheetList'
import { REASON_NAMES, REASON_SHORT, UNKNOWN_REASON } from './words'

export interface BarSpec {
  what: ReactNode
  why: ReactNode
  /** The copper button, and what Enter does; `name` is its accessible name when its words hold figures. */
  button?: { label: ReactNode; run: () => void; name?: string; disabled?: boolean }
  /** A ghost button beside it (by mouse), with its key shown. */
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
  /** Q: the next open Question (m0-screens §6.12's ghost for the MD and a Guest). */
  nextQuestion: () => void
  openRow: (row: Row) => void
  /** The QS answering (null for the MD and a Guest): the pick on a Question, and Enter's answer. */
  answerer?: Answerer | null
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
        <Trans>Each has a number and title from its title block, and its drawing list names it or its Plot page shows the same number and title; storeys from its view titles.</Trans> {tail}
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
        <Trans>Each has a number and title from its title block, and its Plot page shows the same number and title; storeys from its view titles.</Trans> {tail}
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
  if (why === 'gap') {
    const tag = model.queue.find((e) => isGaps(e.question) && e.holds.some((p) => p.id === sheet.id))?.tag
    return tag ? (
      <Trans>
        It is beside a gap in its Discipline’s numbering that {tag} asks about; answering {tag} can give it a second source.
      </Trans>
    ) : (
      <Trans>It is beside a gap in its Discipline’s numbering; answering the gap Question can give it a second source.</Trans>
    )
  }
  if (why === 'twice') return <Trans>Another sheet of its Discipline has the same number.</Trans>
  if (why === 'no-list-no-plot') return <Trans>No drawing list and no Plot to check it against.</Trans>
  if (why === 'plot-differs') return <Trans>Its Plot page shows a different number or title; compare them before you confirm it.</Trans>
  return <Trans>Nothing else confirms it.</Trans>
}

/** Why the sheets left with one source have it, by the first of them (6.4's "Nothing left but sheets
 * with one source"): beside a gap, its Question gives them their second source (#229). */
export function OneSourceSummary({ first, model }: { first: ProposalOut; model: Step1Model }) {
  const why = whyOneSource(
    first,
    model.disciplines.find((d) => d.discipline === first.discipline),
  )
  if (why === 'gap') {
    const tag = model.queue.find((e) => isGaps(e.question) && e.holds.some((p) => p.id === first.id))?.tag
    return tag ? (
      <Trans>They are beside a gap in the numbering that {tag} asks about. Answer {tag} to give them a second source, or open each to confirm it.</Trans>
    ) : (
      <Trans>They are beside a gap in the numbering. Answer its Question to give them a second source, or open each to confirm it.</Trans>
    )
  }
  if (why === 'plot-differs') return <Trans>Their Plot pages show a different number or title. Open each to compare and confirm it.</Trans>
  if (why === 'no-list-no-plot') return <Trans>No drawing list and no Plot to check them against. Open each to confirm it.</Trans>
  return <Trans>Nothing else confirms them. Open each to confirm it.</Trans>
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
    const qs = model.qs
    const first = qs[0] ?? ''
    // The names joined by the Market's locale, not in code: "Nusrat Jahan and Rafiq Hasan".
    const names = qs.length > 1 ? new Intl.ListFormat(f.profile.locale, { type: 'conjunction' }).format(qs) : first
    return {
      what,
      why:
        qs.length === 1 ? (
          <Trans>{first} (QS) confirms the sheet list; every act shows who did it.</Trans>
        ) : qs.length > 1 ? (
          <Trans>{names} (QS) confirm the sheet list; every act shows who did it.</Trans>
        ) : (
          <Trans>The QS confirms the sheet list; every act shows who did it.</Trans>
        ),
      ghost: model.queue.length > 0 ? { label: <Trans>Next open Question</Trans>, run: c.nextQuestion, combo: 'Q' } : undefined,
    }
  }

  const bulkName = plain(m === 0 ? t`Confirm ${n}` : n === 0 ? t`Leave out ${m}` : t`Confirm ${n}, leave out ${m}`)
  const firstBulk = model.rows.find((r) => r.sheets.some((p) => model.bulk.confirm.includes(p) || model.bulk.leaveOut.includes(p))) ?? null
  const bulkSpec: BarSpec = {
    what: <BulkWhat model={model} />,
    why: <BulkWhy model={model} />,
    ghost: firstBulk ? { label: <Trans>Review one by one</Trans>, run: () => c.openRow(firstBulk) } : undefined,
    button: {
      label: m === 0 ? <Trans>Confirm {n}</Trans> : n === 0 ? <Trans>Leave out {m}</Trans> : <Trans>Confirm {n}, leave out {m}</Trans>,
      run: c.bulk,
      name: bulkName,
    },
  }

  if (row) {
    const sheet = row.sheets[0]
    const name = <SheetName sheets={row.sheets} />
    // At a sentence's start (#167's words gate: an untitled sheet's words are capitalised there).
    const Name = <SheetName sheets={row.sheets} start />
    if (row.question) {
      const entry = row.question
      const answerer = c.answerer ?? null
      const picked = answerer ? (answerer.choice(entry)?.key ?? prePick(entry, cardContext(model))?.key ?? null) : null
      // As the card's own button: off under "Type a number" until a number is typed (the walk, M4).
      const unnumbered = picked === 'type_number' && !(answerer?.choice(entry)?.text ?? '').trim()
      const tag = row.question.tag
      const title = <QuestionTitle entry={row.question} names={model.fileNames} />
      return {
        what: row.question.withdrawn ? (
          <Trans>
            Question {tag}, withdrawn: {title}
          </Trans>
        ) : (
          <Trans>
            Question {tag}: {title}
          </Trans>
        ),
        why: <Answering entry={row.question} context={cardContext(model)} choice={picked} hint={!!answerer} />,
        button: answerer
          ? picked
            ? { label: <Trans>Answer {tag}</Trans>, run: () => answerer.answer(entry), disabled: unnumbered }
            : { label: <Trans>Pick an answer</Trans>, run: () => {}, disabled: true }
          : undefined,
        ghost: answerer ? { label: <Trans>Ask later</Trans>, run: c.nextQuestion, combo: 'Q' } : { label: <Trans>Next open item</Trans>, run: c.nextOpen },
      }
    }
    if (sheet && sheet.decision === 'confirmed') {
      const by = sheet.decided_by ?? ''
      const date = sheet.decided_at ? f.date(sheet.decided_at) : ''
      const time = sheet.decided_at ? f.time(sheet.decided_at) : ''
      return {
        what:
          sheet.decided_by_role === 'vextrus_engineer' ? (
            <Trans>
              {Name} is confirmed by {by}, Vextrus Engineer
            </Trans>
          ) : (
            <Trans>
              {Name} is confirmed by {by}
            </Trans>
          ),
        why: date ? <Trans>{date}, {time}. X excludes it, with a reason.</Trans> : <Trans>X excludes it, with a reason.</Trans>,
        button: { label: <Trans>Next open item</Trans>, run: c.nextOpen },
      }
    }
    if (sheet && sheet.decision === 'excluded') {
      const reason = sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
      return {
        what: (
          <Trans>
            {Name} is excluded: {reason}
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
            <Trans>{Name} agrees: number and title from the title block, on the drawing list</Trans>
          ) : (
            <Trans>{Name} agrees: number and title from the title block, in numbering without a gap, and its Plot page matches</Trans>
          )
        ) : (
          <OneSourceWhat sheet={sheet} name={Name} />
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
        what: <OneSourceWhat sheet={sheet} name={Name} />,
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

  if (bulkable && row && row.sheets.length > 0) {
    const openRow = row
    return { ...bulkSpec, ghost: { label: <Trans>Open <SheetName sheets={row.sheets} /></Trans>, run: () => c.openRow(openRow), combo: 'Space' } }
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
      why: <OneSourceSummary first={first} model={model} />,
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
        <Button variant="commit" disabled={spec.button.disabled} onClick={spec.button.run} aria-label={spec.button.name} aria-keyshortcuts="Enter" /* eslint-disable-line lingui/no-unlocalized-strings -- a key name */>
          {spec.button.label}
          <KeyCombo combo="Enter" className="[&_kbd]:border-transparent [&_kbd]:bg-transparent [&_kbd]:text-current" />
        </Button>
      ) : null}
    </div>
  )
}

/** "S-07 has one source: …"; a sheet with neither number nor title has neither to read (#167's words gate, M5). */
export function OneSourceWhat({ sheet, name }: { sheet: ProposalOut | undefined; name: ReactNode }) {
  if (sheet && !sheet.number && !sheet.title.trim()) return <Trans>{name} has neither a number nor a title in its title block</Trans>
  return <Trans>{name} has one source: number and title from its title block</Trans>
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
      // Never from a Question's card (an option or its number field): that Enter is the card's, and
      // with the picker open it does nothing (#156's refuter, fix round 1).
      when: () => other !== null && !(document.activeElement as HTMLElement | null)?.closest('[data-question]'),
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
