/*
 * The pieces Steps 3, 4 and 6 share (S16-W1; docs/design/m0-screens.md §2, §3, §6.15): the focusable
 * list, the acts with their toasts and Ctrl Z, the confirmation bar, the Trace buttons and the sheet a
 * Trace opens. Keys go through the key map; the lists keep one real focus (a row), so the ring is
 * always on the thing that has focus.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SlotFill } from '@/app/slots'
import { LoadProblem } from '@/auth'
import { problemOf, problemText } from '@/auth/problem'
import { useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { SheetViewer } from '@/sheet'
import { Button, ConfirmedGlyph, ExcludedGlyph, KeyCombo, KeyRegion, ProposalGlyph, QuestionGlyph, Skeleton, TraceGlyph, cn, useKeys, useToast } from '@/ui'
import { renderQuery } from '../data'
import { useHasEnglish } from '../useHasEnglish'
import { act, frameKey, type ActBody, type FrameProposal, type QuestionRef, type StepKey, type TraceOut } from './api'
import type { GroupState } from './model'

// The list ------------------------------------------------------------------------------------------

export interface Row {
  key: string
}

/** Puts real focus on a list row by its key (the list in the canvas). */
export function focusRow(key: string): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-frame-list] [data-row-key]')) {
    if (el.dataset.rowKey === key) {
      el.focus()
      return
    }
  }
}

/**
 * A list with one focused row: arrows, Home and End move real focus along it (a roving tabindex), so
 * the row that has focus draws the ring (system.md §7). Space is the screen's, passed in `onSpace`.
 * `kind` is a listbox of options when its rows say things (Steps 4 and 6), or a plain list when a row
 * holds fields of its own (Step 3's levels).
 */
export function FrameList<T>({
  label,
  kind,
  items,
  getKey,
  focusedKey,
  onFocusKey,
  onSpace,
  spaceLabel,
  renderRow,
  className,
}: {
  label: string
  kind: 'listbox' | 'list'
  items: readonly T[]
  getKey?: (item: T) => string
  focusedKey: string | null
  onFocusKey: (key: string) => void
  onSpace: () => void
  spaceLabel: string
  renderRow: (item: T, state: { focused: boolean }) => ReactNode
  className?: string
}) {
  const keyOf = getKey ?? ((item: T) => (item as unknown as Row).key)
  const at = focusedKey === null ? -1 : items.findIndex((i) => keyOf(i) === focusedKey)
  const tabbable = at >= 0 ? at : 0

  const move = (to: number) => {
    const next = items[Math.max(0, Math.min(items.length - 1, to))]
    if (!next) return
    onFocusKey(keyOf(next))
    focusRow(keyOf(next))
  }

  return (
    <KeyRegion name="frame-list" role={kind} aria-label={label} data-frame-list="" className={cn('min-h-0 flex-1 overflow-auto pb-24', className)}>
      <ListKeys
        spaceLabel={spaceLabel}
        onSpace={onSpace}
        onPrevious={() => move(at < 0 ? items.length - 1 : at - 1)}
        onNext={() => move(at < 0 ? 0 : at + 1)}
        onFirst={() => move(0)}
        onLast={() => move(items.length - 1)}
      />
      <div>
        {items.map((item, i) => {
          const key = keyOf(item)
          const focused = key === focusedKey
          return (
            <div
              key={key}
              data-row-key={key}
              role={kind === 'listbox' ? 'option' : 'listitem'}
              aria-selected={kind === 'listbox' ? focused : undefined}
              tabIndex={i === tabbable ? 0 : -1}
              onFocus={(event) => {
                // A field inside the row is the row's: focus on it makes the row current.
                if (!focused || event.target === event.currentTarget) onFocusKey(key)
              }}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest('input,select,button,textarea,label')) event.currentTarget.focus()
              }}
              className={cn('focus-inset flex min-h-row items-center gap-2 border-b border-border px-3 py-1 text-sm', focused ? 'bg-selected' : 'hover:bg-hover')}
            >
              {renderRow(item, { focused })}
            </div>
          )
        })}
      </div>
    </KeyRegion>
  )
}

/** The list's keys, registered inside its region: they act while focus is in the list. */
function ListKeys({
  spaceLabel,
  onSpace,
  onPrevious,
  onNext,
  onFirst,
  onLast,
}: {
  spaceLabel: string
  onSpace: () => void
  onPrevious: () => void
  onNext: () => void
  onFirst: () => void
  onLast: () => void
}) {
  const { t } = useLingui()
  useKeys([
    { key: '↑', label: t`Previous row`, group: 'screen', run: onPrevious },
    { key: '↓', label: t`Next row`, group: 'screen', run: onNext },
    { key: 'Home', label: t`First row`, group: 'screen', run: onFirst },
    { key: 'End', label: t`Last row`, group: 'screen', run: onLast },
    { key: 'Space', label: spaceLabel, group: 'screen', run: onSpace },
  ])
  return null
}

/** A group's or proposal's state mark (the app's glyphs: Question, Confirmed, Excluded, Proposal). */
export function StateMark({ state }: { state: GroupState | 'proposal' | 'question' }) {
  const { t } = useLingui()
  if (state === 'question') return <QuestionGlyph size={14} className="shrink-0 text-question" title={t`Question open`} />
  if (state === 'confirmed') return <ConfirmedGlyph size={14} className="shrink-0 text-confirmed" title={t`Confirmed`} />
  if (state === 'excluded') return <ExcludedGlyph size={14} className="shrink-0 text-excluded" title={t`Excluded`} />
  return <ProposalGlyph size={14} className="shrink-0 text-proposal" title={t`Proposal`} />
}

// Acts ----------------------------------------------------------------------------------------------

export type ActKind = 'confirm' | 'exclude' | 'edit' | 'unconfirm'

/** What an act said, for its toast ("Confirmed 2 columns"). */
function Said({ kind, step, n }: { kind: ActKind; step: StepKey; n: number }) {
  if (kind === 'confirm') {
    if (step === 'columns') return <Plural value={n} one="Confirmed # column" other="Confirmed # columns" />
    if (step === 'grid') return <Plural value={n} one="Confirmed # grid line" other="Confirmed # grid lines" />
    return <Plural value={n} one="Confirmed # storey" other="Confirmed # storeys" />
  }
  if (kind === 'exclude') {
    if (step === 'columns') return <Plural value={n} one="Left out # column" other="Left out # columns" />
    if (step === 'grid') return <Plural value={n} one="Left out # grid line" other="Left out # grid lines" />
    return <Plural value={n} one="Left out # storey" other="Left out # storeys" />
  }
  if (kind === 'edit') return <Plural value={n} one="Sized # column" other="Sized # columns" />
  if (step === 'columns') return <Plural value={n} one="Took back # column; it is a Proposal again" other="Took back # columns; they are Proposals again" />
  if (step === 'grid') return <Plural value={n} one="Took back # grid line; it is a Proposal again" other="Took back # grid lines; they are Proposals again" />
  return <Plural value={n} one="Took back # storey; it is a Proposal again" other="Took back # storeys; they are Proposals again" />
}

export interface Acts {
  /** One act on the proposals' ids; resolves when the server answered, never throws. */
  run: (kind: ActKind, ids: string[], extra?: Pick<ActBody, 'values' | 'reason'>) => Promise<boolean>
  /** Ctrl Z: takes back the last confirm or leave-out made on this screen. */
  undoLast: () => Promise<void>
  busy: boolean
}

/**
 * Each act is one Confirmation on the server; the screen refreshes, toasts what it did with "Undo
 * Ctrl Z", and keeps the confirm or leave-out acts it made so Ctrl Z takes the last one back
 * (`unconfirm`). A size edit has no undo here: typing the size again is its undo.
 */
export function useFrameActs(projectId: string, step: StepKey): Acts {
  const qc = useQueryClient()
  const toast = useToast()
  const f = useFormat()
  const { i18n } = useLingui()
  const stack = useRef<{ kind: ActKind; ids: string[] }[]>([])
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const say = useCallback(
    (problem: unknown) => {
      try {
        const p = problemOf(problem)
        if (p) toast.show({ message: problemText(p, f, i18n) })
      } catch {
        toast.show({ message: problemText({ failed: true }, f, i18n) })
      }
    },
    [toast, f, i18n],
  )

  const undoLast = useCallback(async () => {
    const last = stack.current.at(-1)
    if (!last || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await act(projectId, { act: 'unconfirm', step, proposal_ids: last.ids })
      stack.current.pop()
      await qc.invalidateQueries({ queryKey: frameKey(projectId) })
      toast.show({ message: <Said kind="unconfirm" step={step} n={last.ids.length} /> })
    } catch (error) {
      say(error)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [projectId, step, qc, toast, say])

  const run = useCallback<Acts['run']>(
    async (kind, ids, extra) => {
      if (ids.length === 0 || inFlight.current) return false
      inFlight.current = true
      setBusy(true)
      try {
        await act(projectId, { act: kind, step, proposal_ids: ids, ...extra })
        if (kind === 'confirm' || kind === 'exclude') stack.current.push({ kind, ids })
        await qc.invalidateQueries({ queryKey: frameKey(projectId) })
        toast.show({ message: <Said kind={kind} step={step} n={ids.length} />, onUndo: kind === 'edit' ? undefined : () => void undoLast() })
        return true
      } catch (error) {
        say(error)
        return false
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [projectId, step, qc, toast, say, undoLast],
  )

  return { run, undoLast, busy }
}

// The confirmation bar --------------------------------------------------------------------------------

export interface BarSpec {
  /** What Enter does, as the bar says it ("Confirm Ground · C1, 2 columns"); null when it does nothing now. */
  say: ReactNode | null
  /** Said in the button's place when Enter does nothing: what holds the step, or that nothing is left. */
  note?: ReactNode
  disabled?: boolean
  onEnter: () => void
  /** The other keys the screen has, as chips and words. */
  hints: { combo: string; words: ReactNode }[]
}

export function Bar({ spec }: { spec: BarSpec }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-border bg-chrome px-3 py-1.5 text-sm">
      {spec.say ? (
        <Button variant="commit" disabled={spec.disabled} onClick={spec.onEnter}>
          <span>{spec.say}</span>
          <KeyCombo combo="Enter" />
        </Button>
      ) : (
        <span className="text-ink-secondary">{spec.note ?? <Trans>Nothing left to confirm here.</Trans>}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-xs text-ink-secondary">
        {spec.hints.map((h) => (
          <span key={h.combo} className="inline-flex items-center gap-1 whitespace-nowrap">
            <KeyCombo combo={h.combo} />
            {h.words}
          </span>
        ))}
      </span>
    </div>
  )
}

// Questions -------------------------------------------------------------------------------------------

/** A Question's words: the machine's sentence when the catalogue has it; the few codes this frame knows, else the plain fallback. */
export function QuestionLine({ question }: { question: QuestionRef }) {
  const hasEnglish = useHasEnglish()
  if (!hasEnglish(question.code) && question.code === 'engine.column.size_not_read') {
    return <Trans>The size of this column was not read from its label. Press E to type it.</Trans>
  }
  return <MachineText message={{ code: question.code, params: question.params as Record<string, string | number> }} />
}

export function QuestionsList({ proposals }: { proposals: readonly FrameProposal[] }) {
  const held = proposals.filter((p) => p.questions.length > 0)
  if (held.length === 0)
    return (
      <p className="p-3 text-sm text-ink-secondary">
        <Trans>No open Questions here.</Trans>
      </p>
    )
  return (
    <ul className="flex flex-col gap-2 p-3 text-sm">
      {held.flatMap((p) =>
        p.questions.map((q, i) => (
          <li key={`${p.id}-${i}`} className="flex flex-col gap-0.5 border-s-2 border-question ps-2">
            <span className="font-semibold">{p.mark}</span>
            <span className="text-ink-secondary">
              <QuestionLine question={q} />
            </span>
          </li>
        )),
      )}
    </ul>
  )
}

// Trace ---------------------------------------------------------------------------------------------------

/** What each fact a Trace names is called for the QS; a fact with no words here is not named. */
const FACTS: Readonly<Record<string, MessageDescriptor>> = {
  name: msg({ message: 'name', context: 'Trace fact' }),
  order: msg({ message: 'order', context: 'Trace fact' }),
  label: msg({ message: 'label', context: 'Trace fact' }),
  axis: msg({ message: 'direction', context: 'Trace fact' }),
  offset: msg({ message: 'position', context: 'Trace fact' }),
  outline: msg({ message: 'outline', context: 'Trace fact' }),
  section_b: msg({ message: 'width', context: 'Trace fact' }),
  section_d: msg({ message: 'depth', context: 'Trace fact' }),
  at: msg({ message: 'position', context: 'Trace fact' }),
}

/** One Trace: opens the sheet it was read from, and says which fact it shows. */
export function TraceButton({ trace, sheet, onOpen }: { trace: TraceOut; sheet: string | null; onOpen: (trace: TraceOut) => void }) {
  const { i18n } = useLingui()
  const known = FACTS[trace.fact]
  const fact = known ? i18n._(known) : null
  return (
    <Button variant="ghost" className="justify-start" onClick={() => onOpen(trace)}>
      <TraceGlyph size={16} aria-hidden />
      {fact ? (
        sheet ? (
          <Trans>Trace {fact} on {sheet}</Trans>
        ) : (
          <Trans>Trace {fact} on the sheet</Trans>
        )
      ) : sheet ? (
        <Trans>Trace on {sheet}</Trans>
      ) : (
        <Trans>Trace on the sheet</Trans>
      )}
    </Button>
  )
}

/** The sheet a Trace opens: the sheet viewer on the sheet's render, in the canvas, with Space back to the list. */
export function TraceSheet({ projectId, trace, sheet, onBack }: { projectId: string; trace: TraceOut; sheet: string | null; onBack: () => void }) {
  const { t } = useLingui()
  const render = useQuery(renderQuery(projectId, trace.sheet_id))
  const region = useRef<HTMLDivElement>(null)
  const label = sheet ?? t`Sheet`
  useLayoutEffect(() => {
    const el = region.current
    if (!el) return
    const canvas = el.querySelector<HTMLElement>('[role="group"][tabindex]')
    if (canvas) canvas.focus({ preventScroll: true })
    else el.focus({ preventScroll: true })
  }, [render.data])
  return (
    <KeyRegion name="frame-sheet" className="relative h-full min-h-0 flex-1">
      <SheetKeys onBack={onBack} />
      <SlotFill slot="toolbar.end" order={1}>
        <Button variant="secondary" onClick={onBack}>
          <Trans>Back to the list</Trans>
          <KeyCombo combo="Space" />
        </Button>
      </SlotFill>
      <div ref={region} tabIndex={-1} data-region-focus="" className="focus-inset absolute inset-0 outline-none">
        {render.data ? (
          <SheetViewer key={trace.sheet_id} buffer={render.data} label={label} onRetry={() => void render.refetch()} />
        ) : render.error ? (
          <LoadProblem error={render.error} onRetry={() => void render.refetch()} className="m-4" />
        ) : (
          <Skeleton rows={6} className="m-6" status={<Trans>Opening {label}…</Trans>} />
        )}
      </div>
    </KeyRegion>
  )
}

/** The sheet's own Space (region scope: it outranks the screen's Space from the page). */
function SheetKeys({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  useKeys([{ key: 'Space', label: t`Back to the list`, group: 'sheet', run: onBack }])
  return null
}

/** Keeps the effect honest: a callback that always runs the latest closure. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}


// The screen's keys -------------------------------------------------------------------------------------

/** Whether focus is in a field the QS types in (a typed key is the field's, never the screen's). */
export const inField = (): boolean => {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
}

/**
 * Enter, X, E, Esc, Ctrl Z and Space-from-the-page, at the screen's scope (m0-screens §2.2, §6.15). The
 * list's own keys (arrows, Space on a row) are the list's. `readOnly` is the MD's or a Guest's: such a
 * key says why nothing happened, and the API refuses the same acts.
 */
export function ScreenKeys({
  enter,
  exclude,
  edit,
  undo,
  escape,
  escapeActive,
  spaceFromPage,
}: {
  enter: () => void
  exclude: () => void
  edit?: () => void
  undo: () => void
  escape: () => void
  escapeActive: () => boolean
  spaceFromPage: () => void
}) {
  const { t } = useLingui()
  useKeys([
    { key: 'Enter', label: t`Do what the bar says`, group: 'screen', run: (event) => (event.repeat || inField() ? undefined : enter()) },
    { key: 'X', label: t`Leave out the focused row`, group: 'screen', run: exclude },
    ...(edit ? [{ key: 'E', label: t`Type the size of the focused row`, group: 'screen' as const, run: edit }] : []),
    {
      key: 'Ctrl Z',
      label: t`Take back your last confirmation or exclusion on this step`,
      group: 'screen',
      // In a field Ctrl Z is the field's own undo: the key falls through to the browser.
      when: () => !inField(),
      run: (event) => (event.repeat ? undefined : undo()),
    },
    { key: 'Esc', label: t`Back to the list; in the list, clear the focus`, group: 'screen', when: escapeActive, run: escape },
    {
      key: 'Space',
      label: t`Open the focused row’s sheet, or go back to the list`,
      group: 'screen',
      when: () => !document.activeElement || document.activeElement === document.body,
      run: spaceFromPage,
    },
  ])
  return null
}

/** Enter inside a field's own region: the field's act (put a level, save a size), ahead of the screen's Enter. */
export function EnterKey({ label, run }: { label: string; run: () => void }) {
  useKeys([{ key: 'Enter', label, group: 'screen', run: (event) => (event.repeat ? undefined : run()) }])
  return null
}
