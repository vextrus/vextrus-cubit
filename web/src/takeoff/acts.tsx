/*
 * Step 1's acts as the QS makes them (m0-screens §6.4, §6.9, §6.10, §5 "Undo"): each sends 19a's
 * operations, refreshes Step 1, and toasts what it did with "Undo  Ctrl Z". The bulk act is one act
 * for the QS but several on the server (a confirm, then one exclusion per reason: 19a's `confirm` and
 * `exclude` take one reason each), so this keeps, per act the QS made in this tab, how many server
 * acts it was, and one Ctrl Z takes them all back (19a's undo takes back one of the user's own acts
 * a call). An act made before this tab opened is undone one server act at a time, worded from 19a's
 * reply.
 */
import { useCallback, useRef, type ReactNode } from 'react'
import { Plural, Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useSayRefused } from '@/auth/sayRefused'
import { useToast } from '@/ui'
import { DrawingText } from '@/ui/DrawingText'
import { confirm, exclude, setList, step1Key, undo, type ActOut, type ProposalOut } from './data'
import { REASONS, type Reason } from './model'
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
    return (
      <>
        <DrawingText kind="sheet-number" text={first.number} truncate={false} />–<DrawingText kind="sheet-number" text={last.number} truncate={false} />
      </>
    )
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

export interface Step1Acts {
  bulk(confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]): Promise<void>
  /** `backIn`: the actor's name, when the sheets were excluded and are confirmed back in (6.9). */
  confirmSheets(sheets: readonly ProposalOut[], backIn?: string): Promise<boolean>
  excludeSheets(sheets: readonly ProposalOut[], reason: Reason, text?: string): Promise<boolean>
  setDrawingList(discipline: string, text: string): Promise<boolean>
  undoLast(): Promise<void>
}

export function useStep1Acts(projectId: string): Step1Acts {
  const queryClient = useQueryClient()
  const toast = useToast()
  const sayRefused = useSayRefused()
  const { i18n } = useLingui()
  const done = useRef<Done[]>([])
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: step1Key(projectId) }), [queryClient, projectId])

  const undoLast = useCallback(async () => {
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
    } finally {
      await refresh()
    }
  }, [projectId, refresh, sayRefused, toast])

  const onUndo = useCallback(() => void undoLast(), [undoLast])

  /** Runs the server acts in turn; whatever of them was done is one act to undo. */
  const run = useCallback(
    async (calls: (() => Promise<unknown>)[], words: ReactNode, said: ReactNode): Promise<boolean> => {
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
        await refresh()
      }
    },
    [onUndo, refresh, sayRefused, toast],
  )

  const bulk = useCallback(
    async (confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]) => {
      const calls: (() => Promise<unknown>)[] = []
      if (confirming.length) calls.push(() => confirm(projectId, confirming.map((p) => p.id)))
      for (const reason of REASONS) {
        const ids = leavingOut.filter((p) => p.proposed_exclusion === reason).map((p) => p.id)
        if (ids.length) calls.push(() => exclude(projectId, ids, reason))
      }
      const n = confirming.length
      const m = leavingOut.length
      const words =
        m === 0 ? (
          <Plural value={n} one="confirmed # sheet" other="confirmed # sheets" />
        ) : n === 0 ? (
          <Plural value={m} one="left out # sheet" other="left out # sheets" />
        ) : (
          <Trans>
            <Plural value={n} one="confirmed # sheet" other="confirmed # sheets" /> and left out {m}
          </Trans>
        )
      const said =
        m === 0 ? (
          <Plural value={n} one="Confirmed # sheet." other="Confirmed # sheets." />
        ) : n === 0 ? (
          <Plural value={m} one="Left out # sheet, with its reason." other="Left out # sheets, each with its reason." />
        ) : (
          <Trans>
            <Plural value={n} one="Confirmed # sheet" other="Confirmed # sheets" />; left out {m}, each with its reason.
          </Trans>
        )
      await run(calls, words, said)
    },
    [projectId, run],
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
        await refresh()
      }
    },
    [i18n, onUndo, projectId, refresh, sayRefused, toast],
  )

  return { bulk, confirmSheets, excludeSheets, setDrawingList, undoLast }
}
