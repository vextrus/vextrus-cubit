/*
 * Step 1's acts as the QS makes them (m0-screens §6.4, §6.9, §6.10, §5 "Undo"): each sends 19a's
 * operations, refreshes Step 1, and toasts what it did with "Undo  Ctrl Z". The bulk act is one act
 * for the QS but several on the server (a confirm, then one exclusion per reason: 19a's `confirm` and
 * `exclude` take one reason each), so this keeps, per act the QS made in this tab, how many server
 * acts it was, and one Ctrl Z takes them all back (19a's undo takes back one of the user's own acts
 * a call). An act made before this tab opened is undone one server act at a time, worded from 19a's
 * reply.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Plural, Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { useQueryClient } from '@tanstack/react-query'
import { problemOf, problemText } from '@/auth/problem'
import { useSayRefused } from '@/auth/sayRefused'
import { useFormat } from '@/format'
import { useToast } from '@/ui'
import { DrawingText } from '@/ui/DrawingText'
import { confirm, exclude, setList, step1Key, undo, type ActOut, type ProposalOut } from './data'
import { REASONS, type Reason } from './model'
import { SheetRange } from './SheetRange'
import { DISCIPLINE_IN_TEXT, REASON_SHORT, UNKNOWN_REASON } from './words'

interface Done {
  /** How many of the user's server acts it was. */
  calls: number
  /** "confirmed 16 sheets and left out 1", after "Undone: ". */
  words: ReactNode
}

/** The label a sheet or a continuation goes by in a sentence: "S-02", "E-02–E-03", or its title. */
export function SheetName({ sheets }: { sheets: readonly ProposalOut[] }) {
  const first = sheets[0]
  const last = sheets.at(-1)
  if (!first || !last) return null
  if (!first.number) return <DrawingText kind="title" text={first.title} truncate={false} />
  if (sheets.length > 1 && last.number && last.number !== first.number) {
    return <SheetRange first={first.number} last={last.number} />
  }
  return <DrawingText kind="sheet-number" text={first.number} truncate={false} />
}

function UndoneWords({ act }: { act: ActOut }) {
  const n = act.sheets
  // 19a's ConfirmationAct: confirm, exclude, drawing_list.
  if (act.act === 'confirm' || act.act === 'confirmed') return <Plural value={n} one="confirmed # sheet" other="confirmed # sheets" />
  if (act.act === 'exclude' || act.act === 'excluded') return <Plural value={n} one="left out # sheet" other="left out # sheets" />
  if (act.act === 'drawing_list') return <Trans>the drawing list you set</Trans>
  return <Trans>your last change to Step 1</Trans>
}

/** What a bulk act did, after "Undone: ": "confirmed 16 sheets and left out 1". */
function BulkWords({ n, m }: { n: number; m: number }) {
  if (m === 0) return <Plural value={n} one="confirmed # sheet" other="confirmed # sheets" />
  if (n === 0) return <Plural value={m} one="left out # sheet" other="left out # sheets" />
  return (
    <Trans>
      <Plural value={n} one="confirmed # sheet" other="confirmed # sheets" /> and left out {m}
    </Trans>
  )
}

/** The bulk act's toast (§6.4): "Confirmed 16 sheets; left out 1, each with its reason." */
function BulkDone({ n, m }: { n: number; m: number }) {
  if (m === 0) return <Plural value={n} one="Confirmed # sheet." other="Confirmed # sheets." />
  if (n === 0) return <Plural value={m} one="Left out # sheet, with its reason." other="Left out # sheets, each with its reason." />
  return (
    <Trans>
      <Plural value={n} one="Confirmed # sheet" other="Confirmed # sheets" />; left out {m}, each with its reason.
    </Trans>
  )
}

export interface Step1Acts {
  bulk(confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]): Promise<void>
  /** `backIn`: the actor's name, when the sheets were excluded and are confirmed back in (6.9). */
  confirmSheets(sheets: readonly ProposalOut[], backIn?: string): Promise<boolean>
  excludeSheets(sheets: readonly ProposalOut[], reason: Reason, text?: string): Promise<boolean>
  setDrawingList(discipline: string, text: string): Promise<boolean>
  undoLast(): Promise<void>
  /** An act or an undo is in flight, until Step 1 has reloaded: keys that act are dropped meanwhile. */
  busy: boolean
}

export function useStep1Acts(projectId: string): Step1Acts {
  const queryClient = useQueryClient()
  const toast = useToast()
  const sayRefused = useSayRefused()
  const { i18n } = useLingui()
  const f = useFormat()
  const done = useRef<Done[]>([])
  /** An act in flight: another (a second Enter, a key held down) is ignored until it and its reload end. */
  const pending = useRef(false)
  /**
   * The act in flight, until its reload ends: resolves once its server calls are made and kept in
   * `done`, with whether any was. An Undo waits for it (its toast shows before the reload), rather
   * than being dropped, and undoes nothing if it made nothing.
   */
  const sending = useRef<Promise<boolean> | null>(null)
  /** An undo in flight: a second Ctrl Z is ignored until it ends. */
  const undoing = useRef(false)
  /**
   * The QS's last act was not made: refused outright, or its key dropped while another was in
   * flight. The next Ctrl Z says so and undoes nothing, rather than taking back the act before, which
   * the QS did not mean (the review of 22, round 4); the Ctrl Z after it undoes that act.
   */
  const unmade = useRef(false)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: step1Key(projectId) }), [queryClient, projectId])

  /**
   * Starts an act: blocks others and marks its calls as in flight; returns what ends the calls, told
   * whether any was made (an act refused outright made none, and an Undo waiting on it undoes nothing).
   */
  const begin = useCallback((): ((made: boolean) => void) | null => {
    if (pending.current || undoing.current) {
      unmade.current = true
      return null
    }
    pending.current = true
    unmade.current = false
    setBusy(true)
    let sent = (_made: boolean) => {}
    sending.current = new Promise<boolean>((resolve) => {
      sent = resolve
    })
    // Kept until the act's reload ends: a Ctrl Z during it is for this act too.
    return (made) => {
      if (!made) unmade.current = true
      sent(made)
    }
  }, [])

  /** Ends an act once Step 1 has reloaded; other acts are taken again from here. */
  const settle = useCallback(async () => {
    // Held until Step 1 has reloaded: a second Enter during the reload would send the act again.
    await refresh()
    sending.current = null
    pending.current = false
    if (!undoing.current) setBusy(false)
  }, [refresh])

  const undoLast = useCallback(async () => {
    if (undoing.current) return
    undoing.current = true
    setBusy(true)
    try {
      // The act in flight is waited for, so this undoes it; one refused outright made nothing, and
      // this Ctrl Z was for it (its refusal is on screen), so it never reaches the act before.
      if (sending.current && !(await sending.current)) {
        unmade.current = false
        return
      }
      if (unmade.current) {
        unmade.current = false
        toast.show({ message: <Trans>Nothing undone: your last change was not made. Press Ctrl Z again to undo the one before it.</Trans> })
        return
      }
      const last = done.current.pop()
      try {
        if (last) {
          for (let i = 0; i < last.calls; i++) await undo(projectId)
          const words = last.words
          toast.show({ message: <Trans>Undone: {words}</Trans> })
        } else {
          const act = await undo(projectId)
          toast.show({ message: <Trans>Undone: <UndoneWords act={act} /></Trans> })
        }
      } catch (error) {
        sayRefused(error)
      }
      await refresh()
    } finally {
      undoing.current = false
      if (!pending.current) setBusy(false)
    }
  }, [projectId, refresh, sayRefused, toast])

  const onUndo = useCallback(() => void undoLast(), [undoLast])

  /** Runs the server acts in turn; whatever of them was done is one act to undo. */
  const run = useCallback(
    async (calls: (() => Promise<unknown>)[], words: ReactNode, said: ReactNode): Promise<boolean> => {
      const sent = begin()
      if (!sent) return false
      let made = 0
      try {
        for (const call of calls) {
          await call()
          made += 1
        }
        toast.show({ message: said, onUndo })
        return true
      } catch (error) {
        sayRefused(error)
        return false
      } finally {
        if (made > 0) done.current.push({ calls: made, words })
        sent(made > 0)
        await settle()
      }
    },
    [begin, onUndo, sayRefused, settle, toast],
  )

  const bulk = useCallback(
    async (confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]) => {
      const sent = begin()
      if (!sent) return
      // One call per kind of act, each counted as it is made, so the words name only what was done.
      const calls: { sheets: number; out: boolean; call: () => Promise<unknown> }[] = []
      if (confirming.length) calls.push({ sheets: confirming.length, out: false, call: () => confirm(projectId, confirming.map((p) => p.id)) })
      for (const reason of REASONS) {
        const ids = leavingOut.filter((p) => p.proposed_exclusion === reason).map((p) => p.id)
        if (ids.length) calls.push({ sheets: ids.length, out: true, call: () => exclude(projectId, ids, reason) })
      }
      let made = 0
      let n = 0
      let m = 0
      try {
        for (const c of calls) {
          await c.call()
          made += 1
          if (c.out) m += c.sheets
          else n += c.sheets
        }
        toast.show({ message: <BulkDone n={n} m={m} />, onUndo })
      } catch (error) {
        const problem = problemOf(error)
        const refused = problem ? problemText(problem, f, i18n) : ''
        if (made === 0) sayRefused(error)
        else
          toast.show({
            message: (
              <>
                <BulkDone n={n} m={m} /> <Trans>The rest was not done: {refused}</Trans>
              </>
            ),
            onUndo,
          })
      } finally {
        if (made > 0) done.current.push({ calls: made, words: <BulkWords n={n} m={m} /> })
        sent(made > 0)
        await settle()
      }
    },
    [begin, f, i18n, onUndo, projectId, sayRefused, settle, toast],
  )

  const confirmSheets = useCallback(
    (sheets: readonly ProposalOut[], backIn?: string) => {
      const name = <SheetName sheets={sheets} />
      const said = backIn ? <Trans>{name} confirmed back in, under {backIn}’s name.</Trans> : <Trans>Confirmed {name}.</Trans>
      return run([() => confirm(projectId, sheets.map((p) => p.id))], <Trans>confirmed {name}</Trans>, said)
    },
    [projectId, run],
  )

  const excludeSheets = useCallback(
    (sheets: readonly ProposalOut[], reason: Reason, text = '') => {
      const name = <SheetName sheets={sheets} />
      const short = reason === 'other' && text.trim() ? text.trim() : i18n._(REASON_SHORT[reason] ?? UNKNOWN_REASON)
      return run(
        [() => exclude(projectId, sheets.map((p) => p.id), reason, text)],
        <Trans>excluded {name}</Trans>,
        <Trans>
          {name} excluded: {short}. It stays in the count.
        </Trans>,
      )
    },
    [i18n, projectId, run],
  )

  const setDrawingList = useCallback(
    async (discipline: string, text: string) => {
      // Not while another act is in flight: its undo would take this one's place (the refuter, round 1).
      const sent = begin()
      if (!sent) return false
      const which = DISCIPLINE_IN_TEXT[discipline]
      const kind = which ? i18n._(which) : ''
      let made = 0
      try {
        const list = await setList(projectId, discipline, text)
        made = 1
        const n = list.numbers.length
        toast.show({
          message: which ? (
            <Plural value={n} one={`Drawing list set: # ${kind} sheet.`} other={`Drawing list set: # ${kind} sheets.`} />
          ) : (
            <Plural value={n} one="Drawing list set: # sheet." other="Drawing list set: # sheets." />
          ),
          onUndo,
        })
        return true
      } catch (error) {
        sayRefused(error)
        return false
      } finally {
        if (made) done.current.push({ calls: 1, words: <Trans>the drawing list you set</Trans> })
        sent(made > 0)
        await settle()
      }
    },
    [begin, i18n, onUndo, projectId, sayRefused, settle, toast],
  )

  return { bulk, confirmSheets, excludeSheets, setDrawingList, undoLast, busy }
}
