/*
 * Step 3, Levels (S16-W1; docs/design/m0-screens.md §4.7, §6.15): the canvas at `/p/:code/takeoff/3`.
 * The storeys of the building low to high, each with the level the QS typed ("levels typed, not read":
 * a drawing's level text is never taken as the storey's level) and the height it gives; below, the
 * views and the storeys each stands for, which the QS fixes with a tick. Enter confirms the storeys
 * (accepting the heights as shown), X leaves the focused storey out, Space opens its Trace on the sheet.
 * Typing a level and Enter puts it and moves to the next storey's field.
 */
import { useEffect, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { sessionQuery } from '@/app/session'
import { SlotFill } from '@/app/slots'
import { LoadProblem, readOnlyRole, usePageTitle, useReadOnlyToast } from '@/auth'
import { problemOf, problemText } from '@/auth/problem'
import { useFormat } from '@/format'
import { Checkbox, Count, KeyRegion, KeyScope, Skeleton, cn, useToast } from '@/ui'
import { frameKey, proposalsQuery, putLevels, putPlacement, storeysQuery, type FrameGroup, type FrameProposal, type StoreyOut, type TraceOut, type ViewPlacement } from './api'
import { counts, groupOf, groupState, lowToHigh, nextOpenGroup, readDecimal, toConfirm } from './model'
import { NothingRead } from './NothingRead'
import { Bar, EnterKey, FrameList, QuestionsList, ScreenKeys, StateMark, TraceButton, TraceSheet, focusRow, useFrameActs, useLatest, type BarSpec } from './parts'

const projectRoute = getRouteApi('/_app/p/$code')

export function StoreysPage() {
  const { t } = useLingui()
  usePageTitle(t`Step 3, Storeys and levels`)
  const project = projectRoute.useLoaderData()
  const storeys = useQuery(storeysQuery(project.id))
  const proposals = useQuery(proposalsQuery(project.id, 'storeys'))
  const error = storeys.error ?? proposals.error
  if (!storeys.data || !proposals.data) {
    if (error) return <LoadProblem error={error} onRetry={() => void (storeys.error ? storeys.refetch() : proposals.refetch())} className="m-4" />
    return <Skeleton rows={10} className="m-4" status={<Trans>Opening Step 3…</Trans>} />
  }
  if (storeys.data.storeys.length === 0 && proposals.data.length === 0) return <NothingRead projectId={project.id} step="storeys" />
  return (
    <KeyScope level="screen" name="step3">
      <Storeys projectId={project.id} storeys={lowToHigh(storeys.data.storeys)} placements={storeys.data.view_placements} groups={proposals.data} />
    </KeyScope>
  )
}

const proposalOf = (groups: readonly FrameGroup[], s: StoreyOut): FrameProposal | undefined =>
  groups.flatMap((g) => g.proposals).find((p) => p.mark === s.name || p.storey === s.name)

type Mode = { kind: 'list' } | { kind: 'sheet'; trace: TraceOut }

function Storeys({ projectId, storeys, placements, groups }: { projectId: string; storeys: StoreyOut[]; placements: ViewPlacement[]; groups: FrameGroup[] }) {
  const { t } = useLingui()
  const f = useFormat()
  const toast = useToast()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const readOnly = readOnlyRole(session)
  const refuse = useReadOnlyToast()
  const acts = useFrameActs(projectId, 'storeys')
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })

  const focused = storeys.find((s) => s.id === focusedKey) ?? null
  const focusedProposal = focused ? proposalOf(groups, focused) : undefined
  const target = (focusedProposal && groupOf(groups, focusedProposal.id)) ?? nextOpenGroup(groups, null)
  const sheetOf = (viewId: string) => placements.find((v) => v.view_id === viewId)?.sheet_number ?? null
  const total = counts(groups)

  const returned = useRef(false)
  useEffect(() => {
    if (mode.kind === 'list' && returned.current && focusedKey) focusRow(focusedKey)
    returned.current = mode.kind === 'sheet'
  }, [mode.kind, focusedKey])

  const openTrace = (trace: TraceOut | null | undefined) => {
    if (trace) setMode({ kind: 'sheet', trace })
  }

  async function enter() {
    if (readOnly) return refuse(readOnly)
    if (!target) return
    const ids = toConfirm(target).map((p) => p.id)
    if (ids.length === 0) {
      if (groupState(target) === 'question') toast.show({ message: <Trans>These storeys have an open Question. Answer it in the Questions tab first.</Trans> })
      return
    }
    await acts.run('confirm', ids)
  }

  const exclude = () => {
    if (readOnly) return refuse(readOnly)
    if (focusedProposal && focusedProposal.state !== 'excluded' && focusedProposal.state !== 'confirmed') void acts.run('exclude', [focusedProposal.id])
  }

  const agreeingCount = target ? toConfirm(target).length : 0
  const excludedCount = total.excluded
  const bar: BarSpec = {
    say: target && agreeingCount > 0 ? <Plural value={agreeingCount} one="Confirm the # storey" other="Confirm the # storeys" /> : null,
    note: target ? <Trans>The storeys have an open Question. Answer it in the Questions tab first.</Trans> : undefined,
    disabled: acts.busy,
    onEnter: () => void enter(),
    hints: [
      { combo: 'X', words: <Trans>leaves out the storey</Trans> },
      { combo: 'Space', words: <Trans>opens its sheet</Trans> },
      { combo: 'Ctrl Z', words: <Trans>takes back the last act</Trans> },
    ],
  }

  return (
    <>
      <SlotFill slot="toolbar.start" order={1}>
        <span className="text-sm whitespace-nowrap text-ink-secondary">
          {excludedCount > 0 ? (
            <Trans>
              Confirmed <Count n={total.n} N={total.N} format={f.integer} />, {excludedCount} excluded
            </Trans>
          ) : (
            <Trans>
              Confirmed <Count n={total.n} N={total.N} format={f.integer} />
            </Trans>
          )}
        </span>
      </SlotFill>
      <SlotFill slot="inspector.selection" className="flex-col items-stretch gap-0">
        {focused ? <StoreyInspector storey={focused} proposal={focusedProposal} sheetOf={sheetOf} onOpen={openTrace} /> : <p className="p-3 text-sm text-ink-secondary"><Trans>Pick a storey to see its level and where its name was read.</Trans></p>}
      </SlotFill>
      <SlotFill slot="inspector.questions" className="flex-col items-stretch gap-0">
        <QuestionsList proposals={groups.flatMap((g) => g.proposals)} />
      </SlotFill>
      <ScreenKeys
        enter={() => void enter()}
        exclude={exclude}
        undo={() => (readOnly ? refuse(readOnly) : void acts.undoLast())}
        escape={() => {
          if (mode.kind === 'sheet') setMode({ kind: 'list' })
          else {
            setFocusedKey(null)
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
        }}
        escapeActive={() => mode.kind === 'sheet' || focusedKey !== null}
        spaceFromPage={() => {
          if (mode.kind === 'sheet') setMode({ kind: 'list' })
          else openTrace(proposalOf(groups, focused ?? storeys[0]!)?.trace[0])
        }}
      />
      {mode.kind === 'sheet' ? (
        <TraceSheet projectId={projectId} trace={mode.trace} sheet={sheetOf(mode.trace.view_id)} onBack={() => setMode({ kind: 'list' })} />
      ) : (
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-auto pb-24">
            <p className="border-b border-border px-3 py-1.5 text-xs text-ink-secondary">
              <Trans>Names and order are read from the drawings; levels typed, not read. Type each level in metres, for example 3.05 for 10′-0″.</Trans>
            </p>
            <FrameList
              label={t`Storeys`}
              kind="list"
              items={storeys}
              getKey={(s) => s.id}
              focusedKey={focusedKey}
              onFocusKey={setFocusedKey}
              spaceLabel={t`Open the sheet this storey’s name was read from, or go back to the list`}
              onSpace={() => openTrace(focusedProposal?.trace[0])}
              className="flex-none overflow-visible pb-0"
              renderRow={(s) => <StoreyRow storey={s} proposal={proposalOf(groups, s)} projectId={projectId} readOnly={readOnly} onRefuse={() => readOnly && refuse(readOnly)} />}
            />
            <Placements projectId={projectId} storeys={storeys} placements={placements} readOnly={readOnly} onRefuse={() => readOnly && refuse(readOnly)} />
          </div>
          <Bar spec={bar} />
        </div>
      )}
    </>
  )
}

function StoreyRow({ storey, proposal, projectId, readOnly, onRefuse }: { storey: StoreyOut; proposal: FrameProposal | undefined; projectId: string; readOnly: unknown; onRefuse: () => void }) {
  const { t } = useLingui()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const { i18n } = useLingui()
  const [text, setText] = useState(storey.level_m ?? '')
  const [refused, setRefused] = useState(false)
  const committed = useRef(storey.level_m ?? '')
  const field = useRef<HTMLInputElement>(null)
  const name = storey.name
  const height = storey.height_m ? f.quantity(storey.height_m, 3) : null
  // The server's level (after a put or a refresh) is what the field shows, unless the QS is typing.
  useEffect(() => {
    if (document.activeElement !== field.current) setText(storey.level_m ?? '')
    committed.current = storey.level_m ?? ''
  }, [storey.level_m])

  async function commit(): Promise<boolean> {
    if (text.trim() === committed.current) return true
    if (readOnly) {
      onRefuse()
      return false
    }
    const level = readDecimal(text)
    setRefused(level === null)
    if (level === null) return false
    try {
      await putLevels(projectId, [{ storey_id: storey.id, level_m: level }])
      committed.current = level
      setText(level)
      await qc.invalidateQueries({ queryKey: frameKey(projectId) })
      return true
    } catch (error) {
      try {
        const p = problemOf(error)
        if (p) toast.show({ message: problemText(p, f, i18n) })
      } catch {
        toast.show({ message: problemText({ failed: true }, f, i18n) })
      }
      return false
    }
  }

  // Enter in the field puts the level and moves to the next storey's field: the field's own, never the screen's confirm.
  function putAndNext() {
    void commit().then((ok) => {
      if (!ok) return
      const all = [...document.querySelectorAll<HTMLInputElement>('[data-level-field]')]
      all[all.indexOf(field.current!) + 1]?.focus()
    })
  }

  return (
    <>
      <StateMark state={proposal ? (proposal.questions.length > 0 && proposal.state === 'proposal' ? 'question' : proposal.state === 'confirmed' ? 'confirmed' : proposal.state === 'excluded' ? 'excluded' : 'proposal') : 'proposal'} />
      <span className="min-w-0 flex-1 truncate font-semibold">{storey.name}</span>
      <span className="num w-40 text-end text-xs whitespace-nowrap text-ink-secondary">{height ? <Trans>{height} m floor to floor</Trans> : <Trans>height not set</Trans>}</span>
      <span className={cn('w-16 text-xs whitespace-nowrap', storey.level_basis === 'typed' ? 'text-confirmed' : 'text-ink-secondary')}>{storey.level_basis === 'typed' ? <Trans>typed</Trans> : <Trans>not typed</Trans>}</span>
      <KeyRegion name="level-field" className="contents">
        <EnterKey label={t`Save the level and go to the next storey`} run={() => void putAndNext()} />
      <input
        ref={field}
        data-level-field=""
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={t`Level of ${name}, in metres`}
        aria-invalid={refused || undefined}
        placeholder={t`metres`}
        readOnly={!!readOnly}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setRefused(false)
        }}
        onBlur={() => void commit()}
        className={cn('h-control w-28 rounded-md border bg-paper px-2 text-end text-sm', refused ? 'border-destructive' : 'border-input')}
      />
      </KeyRegion>
    </>
  )
}

function StoreyInspector({ storey, proposal, sheetOf, onOpen }: { storey: StoreyOut; proposal: FrameProposal | undefined; sheetOf: (viewId: string) => string | null; onOpen: (trace: TraceOut) => void }) {
  const f = useFormat()
  const level = storey.level_m ? f.quantity(storey.level_m, 3) : null
  return (
    <section aria-label={storey.name} className="flex flex-col gap-2 p-3 text-sm">
      <h3 className="font-semibold">{storey.name}</h3>
      <p className="num text-xs text-ink-secondary" dir="ltr">
        {level ? <Trans>Level {level} m</Trans> : <Trans>No level typed yet</Trans>}
      </p>
      {proposal?.trace.length ? (
        proposal.trace.map((tr, i) => <TraceButton key={`${tr.view_id}-${tr.fact}-${i}`} trace={tr} sheet={sheetOf(tr.view_id)} onOpen={onOpen} />)
      ) : (
        <p className="text-xs text-ink-secondary">
          <Trans>No Trace: the sheet this was read from is not recorded.</Trans>
        </p>
      )}
    </section>
  )
}

/** The views and the storeys each stands for: pick a view, tick the storeys it shows. */
function Placements({ projectId, storeys, placements, readOnly, onRefuse }: { projectId: string; storeys: StoreyOut[]; placements: ViewPlacement[]; readOnly: unknown; onRefuse: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const f = useFormat()
  const { t, i18n } = useLingui()
  const [openView, setOpenView] = useState<string | null>(null)
  const latest = useLatest(placements)
  if (placements.length === 0) return null

  async function toggle(view: ViewPlacement, storeyId: string, on: boolean) {
    if (readOnly) return onRefuse()
    const current = latest.current.find((v) => v.view_id === view.view_id)?.storeys ?? view.storeys
    const next = on ? [...new Set([...current, storeyId])] : current.filter((id) => id !== storeyId)
    try {
      await putPlacement(projectId, view.view_id, next)
      await qc.invalidateQueries({ queryKey: frameKey(projectId) })
    } catch (error) {
      try {
        const p = problemOf(error)
        if (p) toast.show({ message: problemText(p, f, i18n) })
      } catch {
        toast.show({ message: problemText({ failed: true }, f, i18n) })
      }
    }
  }

  return (
    <section aria-label={t`Views and their storeys`} className="flex flex-col border-t border-border">
      <h3 className="px-3 pt-2 text-xs font-semibold text-ink-secondary">
        <Trans>Views and their storeys</Trans>
      </h3>
      <p className="px-3 pb-1 text-xs text-ink-secondary">
        <Trans>Open a view and tick the storeys it shows.</Trans>
      </p>
      <ul className="flex flex-col">
        {placements.map((v) => {
          const names = storeys.filter((s) => v.storeys.includes(s.id)).map((s) => s.name)
          const open = openView === v.view_id
          return (
            <li key={v.view_id} className="border-b border-border">
              <button type="button" aria-expanded={open} onClick={() => setOpenView(open ? null : v.view_id)} className="focus-inset flex min-h-row w-full items-center gap-3 px-3 py-1 text-start text-sm hover:bg-hover">
                <span className="font-semibold">{v.sheet_number}</span>
                <span className={cn('min-w-0 flex-1 truncate', names.length === 0 && 'text-question')}>{names.length > 0 ? names.join(', ') : <Trans>no storeys ticked yet</Trans>}</span>
              </button>
              {open ? (
                <fieldset className="flex flex-wrap gap-x-4 gap-y-0.5 px-3 pb-2">
                  <legend className="sr-only">
                    <Trans>Storeys this view shows</Trans>
                  </legend>
                  {storeys.map((s) => (
                    <Checkbox key={s.id} label={s.name} checked={v.storeys.includes(s.id)} disabled={false} onCheckedChange={(on) => void toggle(v, s.id, on)} />
                  ))}
                </fieldset>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
