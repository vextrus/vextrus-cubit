/*
 * Steps 4 (Grid) and 6 (Columns) (S16-W1; docs/design/m0-screens.md §4.7, §6.15): the canvas of the
 * Takeoff's frame at `/p/:code/takeoff/4` and `/6`. The list is the server's groups: a grid's lines by
 * label, a column's by band and mark; each row says what it holds. Enter confirms the focused group's
 * agreeing proposals, X leaves its open ones out, E (Columns) types a size, Space opens the Trace on the
 * sheet, Ctrl Z takes the last act back. The inspector names each proposal's Trace.
 *
 * The MD and a Guest see everything and change nothing: a key that would change something says so (§1.4).
 */
import { useEffect, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { sessionQuery } from '@/app/session'
import { SlotFill } from '@/app/slots'
import { LoadProblem, readOnlyRole, usePageTitle, useReadOnlyToast } from '@/auth'
import { useFormat } from '@/format'
import { Count, DrawingText, KeyScope, Skeleton, useToast } from '@/ui'
import { proposalsQuery, storeysQuery, type FrameGroup, type FrameProposal, type TraceOut } from './api'
import { counts, firstTrace, groupState, nextOpenGroup, toConfirm, toExclude, valueText } from './model'
import { Bar, FrameList, QuestionsList, ScreenKeys, StateMark, TraceSheet, focusRow, useFrameActs, type BarSpec } from './parts'
import { NothingRead } from './NothingRead'
import { SizeEditor } from './SizeEditor'
import { GroupInspector } from './GroupInspector'

const projectRoute = getRouteApi('/_app/p/$code')

export function GridPage() {
  const { t } = useLingui()
  usePageTitle(t`Step 4, Grid`)
  return <GroupedStep step="grid" />
}

export function ColumnsPage() {
  const { t } = useLingui()
  usePageTitle(t`Step 6, Columns`)
  return <GroupedStep step="columns" />
}

function GroupedStep({ step }: { step: 'grid' | 'columns' }) {
  const project = projectRoute.useLoaderData()
  const proposals = useQuery(proposalsQuery(project.id, step))
  if (!proposals.data) {
    if (proposals.error) return <LoadProblem error={proposals.error} onRetry={() => void proposals.refetch()} className="m-4" />
    return <Skeleton rows={10} className="m-4" status={step === 'grid' ? <Trans>Opening Step 4…</Trans> : <Trans>Opening Step 6…</Trans>} />
  }
  if (proposals.data.length === 0) return <NothingRead projectId={project.id} step={step} />
  return (
    <KeyScope level="screen" name={step === 'grid' ? 'step4' : 'step6'}>
      <Groups projectId={project.id} step={step} groups={proposals.data} />
    </KeyScope>
  )
}

type Mode = { kind: 'list' } | { kind: 'sheet'; trace: TraceOut }

function Groups({ projectId, step, groups }: { projectId: string; step: 'grid' | 'columns'; groups: FrameGroup[] }) {
  const { t } = useLingui()
  const f = useFormat()
  const toast = useToast()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const readOnly = readOnlyRole(session)
  const refuse = useReadOnlyToast()
  const storeys = useQuery(storeysQuery(projectId))
  const acts = useFrameActs(projectId, step)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [editing, setEditing] = useState(false)

  const focused = groups.find((g) => g.key === focusedKey) ?? null
  const target = focused ?? nextOpenGroup(groups, null)
  const sheetOf = (viewId: string) => storeys.data?.view_placements.find((v) => v.view_id === viewId)?.sheet_number ?? null
  const total = counts(groups)

  // Back from the sheet or the editor, focus returns to the row it left.
  const returned = useRef(false)
  useEffect(() => {
    if (mode.kind === 'list' && returned.current && focusedKey) focusRow(focusedKey)
    returned.current = mode.kind === 'sheet'
  }, [mode.kind, focusedKey])

  const openTrace = (trace: TraceOut | null) => {
    if (trace) setMode({ kind: 'sheet', trace })
  }

  async function enter() {
    if (readOnly) return refuse(readOnly)
    if (editing || !target) return
    const ids = toConfirm(target).map((p) => p.id)
    if (ids.length === 0) {
      if (groupState(target) === 'question') toast.show({ message: <Trans>This group waits for its Question. Answer it first.</Trans> })
      else {
        const next = nextOpenGroup(groups, target.key)
        if (next) {
          setFocusedKey(next.key)
          focusRow(next.key)
        }
      }
      return
    }
    const ok = await acts.run('confirm', ids)
    if (ok) {
      const next = nextOpenGroup(groups, target.key)
      if (next && next.key !== target.key) {
        setFocusedKey(next.key)
        focusRow(next.key)
      }
    }
  }

  const exclude = () => {
    if (readOnly) return refuse(readOnly)
    if (focused) void acts.run('exclude', toExclude(focused).map((p) => p.id))
  }

  const edit = () => {
    if (readOnly) return refuse(readOnly)
    if (focused) setEditing(true)
  }

  const agreeingCount = target ? toConfirm(target).length : 0
  const excludedCount = total.excluded
  const bar: BarSpec = {
    say: target ? <Trans>Confirm <DrawingText kind={step === 'grid' ? 'grid' : 'mark'} text={target.label} truncate={false} />, {agreeingCount}</Trans> : null,
    disabled: !target || toConfirm(target).length === 0 || acts.busy,
    onEnter: () => void enter(),
    hints: [
      { combo: 'X', words: <Trans>leaves out</Trans> },
      ...(step === 'columns' ? [{ combo: 'E', words: <Trans>types a size</Trans> }] : []),
      { combo: 'Space', words: <Trans>opens the sheet</Trans> },
      { combo: 'Ctrl Z', words: <Trans>takes back</Trans> },
    ],
  }

  return (
    <>
      <SlotFill slot="toolbar.start" order={1}>
        <span className="text-sm whitespace-nowrap text-ink-secondary">
          <Trans>
            Confirmed <Count n={total.n} N={total.N} format={f.integer} />
          </Trans>
          {excludedCount > 0 ? <Trans>, {excludedCount} left out</Trans> : null}
        </span>
      </SlotFill>
      <SlotFill slot="inspector.selection">
        {editing && focused ? (
          <SizeEditor
            group={focused}
            onCancel={() => {
              setEditing(false)
              focusRow(focused.key)
            }}
            onSubmit={async (values) => {
              const ok = await acts.run('edit', focused.proposals.filter((p) => p.state !== 'excluded').map((p) => p.id), { values })
              if (ok) {
                setEditing(false)
                focusRow(focused.key)
              }
            }}
            busy={acts.busy}
          />
        ) : null}
        {focused ? <GroupInspector group={focused} sheetOf={sheetOf} onOpen={openTrace} step={step} /> : <NothingFocused />}
      </SlotFill>
      <SlotFill slot="inspector.questions">
        <QuestionsList proposals={groups.flatMap((g) => g.proposals)} />
      </SlotFill>
      <ScreenKeys
        enter={() => void enter()}
        exclude={exclude}
        edit={step === 'columns' ? edit : undefined}
        undo={() => (readOnly ? refuse(readOnly) : void acts.undoLast())}
        escape={() => {
          if (editing) {
            setEditing(false)
            if (focused) focusRow(focused.key)
          } else if (mode.kind === 'sheet') setMode({ kind: 'list' })
          else {
            setFocusedKey(null)
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
        }}
        escapeActive={() => editing || mode.kind === 'sheet' || focusedKey !== null}
        spaceFromPage={() => {
          if (mode.kind === 'sheet') setMode({ kind: 'list' })
          else if (target) openTrace(firstTrace(target))
        }}
      />
      {mode.kind === 'sheet' ? (
        <TraceSheet projectId={projectId} trace={mode.trace} sheet={sheetOf(mode.trace.view_id)} onBack={() => setMode({ kind: 'list' })} />
      ) : (
        <div className="relative flex h-full min-h-0 flex-col">
          <FrameList
            label={step === 'grid' ? t`Grid lines` : t`Columns`}
            kind="listbox"
            items={groups}
            focusedKey={focusedKey}
            onFocusKey={setFocusedKey}
            spaceLabel={t`Open the focused row’s sheet, or go back to the list`}
            onSpace={() => focused && openTrace(firstTrace(focused))}
            renderRow={(g) => <GroupRow group={g} step={step} />}
          />
          {step === 'columns' ? (
            <p className="absolute inset-x-0 bottom-11 border-t border-border bg-background px-3 py-1 text-xs text-ink-secondary">
              <Trans>Columns only: shear walls and core on allowance.</Trans>
            </p>
          ) : null}
          <Bar spec={bar} />
        </div>
      )}
    </>
  )
}

function NothingFocused() {
  return (
    <p className="p-3 text-sm text-ink-secondary">
      <Trans>Pick a row to see what it holds and where it was read.</Trans>
    </p>
  )
}

/** What a group's proposals say about a size: one size, several, or none read. */
function sizeOf(proposals: readonly FrameProposal[]): { b: string; d: string; unit: string } | 'differs' | null {
  const sizes = new Set<string>()
  let one: { b: string; d: string; unit: string } | null = null
  for (const p of proposals) {
    const b = valueText(p.values, 'section_b')
    const d = valueText(p.values, 'section_d')
    if (b === null || d === null) continue
    const unit = valueText(p.values, 'unit') ?? ''
    sizes.add(`${b}×${d}${unit}`)
    one = { b, d, unit }
  }
  if (sizes.size > 1) return 'differs'
  return one
}

function GroupRow({ group, step }: { group: FrameGroup; step: 'grid' | 'columns' }) {
  const state = groupState(group)
  const n = group.proposals.length
  const size = step === 'columns' ? sizeOf(group.proposals) : null
  return (
    <>
      <StateMark state={state} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        <DrawingText kind={step === 'grid' ? 'grid' : 'mark'} text={group.label} />
      </span>
      {step === 'columns' ? (
        <span className="text-xs whitespace-nowrap text-ink-secondary">
          {size === 'differs' ? (
            <Trans>sizes differ</Trans>
          ) : size ? (
            <span className="num" dir="ltr">
              {size.b} × {size.d} {size.unit}
            </span>
          ) : (
            <span className="text-question">
              <Trans>size not read</Trans>
            </span>
          )}
        </span>
      ) : null}
      <span className="num w-24 text-end text-xs whitespace-nowrap text-ink-secondary">
        {step === 'grid' ? <Plural value={n} one="# line" other="# lines" /> : <Plural value={n} one="# column" other="# columns" />}
      </span>
    </>
  )
}
