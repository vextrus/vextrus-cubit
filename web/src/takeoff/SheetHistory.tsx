/*
 * A sheet's "Who did what" (m0-screens §6.6 item 5, §6.9) and a typed value's provenance (#689), read from
 * the event log through the sheet's history (S24-B1): its own file, so its words have their own catalogue.
 */
import { Fragment, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import type { MessageDescriptor } from '@lingui/core'
import { useFormat } from '@/format'
import { DrawingText } from '@/ui'
import { PlanViewName } from './storeys'
import { ActorChip } from './ActorChip'
import { historyQuery, type HistoryAct, type ProposalOut } from './data'
import { REASON_SHORT, ROLE_NAMES, UNKNOWN_REASON } from './words'

export function reasonOf(sheet: { excluded_reason: string | null; excluded_text?: string }, i18n: { _: (d: MessageDescriptor) => string }): string {
  return sheet.excluded_reason === 'other' && sheet.excluded_text ? sheet.excluded_text : i18n._((sheet.excluded_reason && REASON_SHORT[sheet.excluded_reason]) || UNKNOWN_REASON)
}

/** One act in "who did what" (§6.6): the what, over "name, role, time" with the initials chip. */
function ActEntry({ what, name, role, at }: { what: ReactNode; name: string; role: string | null | undefined; at: string | null | undefined }) {
  const { i18n } = useLingui()
  const f = useFormat()
  const roleWords = role ? ROLE_NAMES[role] : undefined
  return (
    <div className="flex flex-col">
      <span>{what}</span>
      <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
        {name ? <ActorChip name={name} role={role} /> : null}
        <ActLine name={name} role={roleWords ? i18n._(roleWords) : null} date={at ? f.date(at) : ''} time={at ? f.time(at) : ''} />
      </span>
    </div>
  )
}

/** The sheet's standing decision as one act: what the sheet itself carries, where its history cannot be read. */
function Act({ sheet }: { sheet: ProposalOut }) {
  const { i18n } = useLingui()
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
  return <ActEntry what={what} name={sheet.decided_by ?? ''} role={sheet.decided_by_role} at={sheet.decided_at} />
}

/** What an act of the event log did (§6.6 item 5, §6.9): "Excluded: for information", "Corrected: number S-05 → S-51", "Undone". */
function ActWhat({ act }: { act: HistoryAct }) {
  const { i18n } = useLingui()
  const sheets = act.sheets ?? 1
  if (act.code === 'takeoff.step1.confirmed')
    return sheets > 1 ? <Plural value={sheets - 1} one="Confirmed in bulk with # other sheet" other="Confirmed in bulk with # other sheets" /> : <Trans>Confirmed</Trans>
  if (act.code === 'takeoff.step1.confirmed_back_in') return <Trans>Confirmed back in</Trans>
  if (act.code === 'takeoff.step1.excluded') {
    if (!act.reason) return <Trans>Excluded</Trans>
    const reason = reasonOf({ excluded_reason: act.reason, excluded_text: act.text ?? '' }, i18n)
    return <Trans>Excluded: {reason}</Trans>
  }
  if (act.code === 'takeoff.step1.undone') return <Trans>Undone</Trans>
  if (act.code === 'takeoff.step1.corrected') {
    const number = act.changes?.number
    const parts: ReactNode[] = []
    if (number) {
      const before = number.old ? <DrawingText kind="sheet-number" text={number.old} truncate={false} /> : '—'
      const after = <DrawingText kind="sheet-number" text={number.new} truncate={false} />
      parts.push(<Trans>number {before} → {after}</Trans>)
    }
    if (act.changes?.title) parts.push(<Trans>title</Trans>)
    for (const v of act.views ?? []) {
      const view = <PlanViewName title={v.title} place={v.place} />
      parts.push(<Trans>storeys of {view}</Trans>)
    }
    if (parts.length === 0) return <Trans>Corrected</Trans>
    const what = (
      <>
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 ? '; ' : null}
            {part}
          </Fragment>
        ))}
      </>
    )
    return <Trans>Corrected: {what}</Trans>
  }
  return null
}

const KNOWN_ACTS = new Set(['takeoff.step1.confirmed', 'takeoff.step1.confirmed_back_in', 'takeoff.step1.excluded', 'takeoff.step1.corrected', 'takeoff.step1.undone'])

/** A sheet's "Who did what" (§6.6 item 5): every act of the event log, oldest first, an undone act followed by its undo. */
export function SheetHistory({ projectId, sheet }: { projectId: string; sheet: ProposalOut }) {
  const history = useQuery(historyQuery(projectId, sheet.id))
  if (history.isError)
    // The history unread: the sheet's own latest decision, which it carries.
    return sheet.decision ? (
      <Act sheet={sheet} />
    ) : (
      <p>
        <Trans>Proposed by Vextrus from the file; no one has acted on it yet.</Trans>
      </p>
    )
  const acts = history.data?.filter((a) => KNOWN_ACTS.has(a.code))
  if (!acts) return null
  // A decided sheet never reads "no one has acted": what it carries stands when its history lists nothing.
  if (acts.length === 0 && sheet.decision) return <Act sheet={sheet} />
  if (acts.length === 0)
    return (
      <p>
        <Trans>Proposed by Vextrus from the file; no one has acted on it yet.</Trans>
      </p>
    )
  return (
    <>
      {acts.map((a, i) => (
        <ActEntry key={`${a.id}-${a.code}-${i}`} what={<ActWhat act={a} />} name={a.actor} role={a.actor_role} at={a.at} />
      ))}
    </>
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

/** Where a corrected value had been read, said after "from": "the title-block attribute". */
function fromThe(source: string | null | undefined): ReactNode {
  if (source === 'title_block_attribute') return <Trans>the title-block attribute</Trans>
  if (source === 'title_block_text') return <Trans>the text in the title block</Trans>
  if (source === 'jev') return <Trans>the title, as read by Vextrus</Trans>
  if (source === 'register') return <Trans>the drawing list</Trans>
  if (source === 'file_name') return <Trans>the file name</Trans>
  if (source === 'view_title') return <Trans>the title of its view</Trans>
  if (source === 'typed') return <Trans>an earlier correction</Trans>
  return null
}

/** A typed number or title names the person (#689): "corrected by Nusrat Jahan; read S-05 from the title-block attribute". */
export function CorrectedBy({ projectId, sheet, field }: { projectId: string; sheet: ProposalOut; field: 'number' | 'title' }) {
  const history = useQuery(historyQuery(projectId, sheet.id))
  // The newest correction of this value not undone since: an undone one gave a value the sheet no longer holds.
  const undone = new Set(history.data?.filter((a) => a.code === 'takeoff.step1.undone' && a.id).map((a) => a.id))
  const act = history.data?.findLast((a) => a.code === 'takeoff.step1.corrected' && !undone.has(a.id) && a.changes?.[field])
  const change = act?.changes?.[field]
  if (!act || !change) return <Trans>typed by a person</Trans>
  const name = act.actor
  if (!change.old) return <Trans>corrected by {name}; none was read</Trans>
  const old = field === 'number' ? <DrawingText kind="sheet-number" text={change.old} truncate={false} /> : <Trans>“<DrawingText kind="title" text={change.old} truncate={false} />”</Trans>
  const where = fromThe(change.old_source)
  return where ? <Trans>corrected by {name}; read {old} from {where}</Trans> : <Trans>corrected by {name}; read {old}</Trans>
}
