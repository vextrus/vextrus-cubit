/*
 * Step 1's acts as the QS makes them (m0-screens §6.4, §6.9, §6.10, §5 "Undo"): each sends 19a's
 * operations, refreshes Step 1, and toasts what it did with "Undo  Ctrl Z". The bulk act is one act
 * for the QS but several on the server (a confirm, then one exclusion per reason: 19a's `confirm` and
 * `exclude` take one reason each), so this keeps, per act the QS made in this tab, how many server
 * acts it was, and one Ctrl Z takes them all back (19a's undo takes back one of the user's own acts
 * a call). An act made before this tab opened is undone one server act at a time, worded from 19a's
 * reply.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Plural, Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'
import { notifyManager, useQueryClient } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
import { filesQuery } from '@/drawing-set/data'
import { problemOf, problemText } from '@/auth/problem'
import { useFormat } from '@/format'
import type { MachineMessage } from '@/format/machine'
import { useToast } from '@/ui'
import { DrawingText } from '@/ui/DrawingText'
import { answer, confirm, drawingListQuery, exclude, setList, step1Key, undo, type ActOut, type ProposalOut, type Step1Data } from './data'
import { REASONS, type QuestionEntry, type Reason } from './model'
import { AnsweredWords } from './questionWords'
import { SheetRange } from './SheetRange'
import { DISCIPLINE_IN_TEXT, REASON_SHORT, UNKNOWN_REASON } from './words'

/**
 * One act the QS started in this tab, kept in the order they pressed its key: made, refused outright,
 * or dropped (its key came while another act or an undo was in flight). Ctrl Z takes the last one, as
 * it stands when the key is pressed, so it always undoes the act the QS meant (the review of 22,
 * round 4: F3 and the refuter's five sequences).
 */
/**
 * The call reached the server, which may have made it, but its reply could not be read (a proxy's page,
 * a body cut short): counted as made, so Ctrl Z stays in step with the server's latest act (the refuter
 * of round 4, P1). A refusal made nothing; an unreachable server (the browser's TypeError) was not asked.
 */
/** An answer 21c carries out by confirming or excluding sheets (a Confirmation the server's undo would take). */
function makesAct(entry: QuestionEntry, option: string): boolean {
  if (option === 'keep_open' || entry.holds.length === 0) return false
  const q = entry.question
  if (q.kind === 'conflict' && q.code !== 'takeoff.proposals.lists_disagree') return option === 'keep_latest' || option === 'keep_all'
  return q.kind === 'low_confidence'
}

/** Ctrl Z after an answer: the words of the server's refusal, which this tab does not ask for. */
const ANSWER_STAYS: MachineMessage = { code: 'takeoff.step1.answer_stays', params: {} }

const reached = (error: unknown) => !(error instanceof ApiRefused) && !(error instanceof TypeError)

interface Entry {
  /** How many of the user's server acts it was: none when refused outright or dropped. */
  calls: number
  /** "confirmed 16 sheets and left out 1", after "Undone: ". */
  words: ReactNode
  /** Settles once its server calls are made and counted (at once for a dropped key). */
  made: Promise<void>
  /** Its calls are made and counted (`made` has settled). */
  counted: boolean
  dropped: boolean
  /**
   * An answer to a Question that confirms or excludes: Ctrl Z does not take it back (21c has no undo
   * for an answer). Set when the answer is sent, so a Ctrl Z while it is in flight is held by it too.
   */
  answer?: boolean
}

/** The label a sheet or a continuation goes by in a sentence: "S-02", "E-02–E-03", or its title. */
/** A sheet's name in words; `start`: it opens a sentence (an untitled sheet's words are capitalised). */
export function SheetName({ sheets, start = false }: { sheets: readonly ProposalOut[]; start?: boolean }) {
  const first = sheets[0]
  const last = sheets.at(-1)
  if (!first || !last) return null
  if (!first.number && !first.title.trim()) {
    // Neither number nor title (#167): named by its file and its layout, never by an empty quotation.
    const file = <DrawingText kind="file-name" text={first.file_name} truncate={false} />
    // The place goes inside the name, so nothing trails it after a comma (review 1's recheck).
    if (first.layout) {
      const layout = <DrawingText kind="mark" text={first.layout} truncate={false} />
      return start ? <Trans>An untitled sheet on layout “{layout}” of {file}</Trans> : <Trans>an untitled sheet on layout “{layout}” of {file}</Trans>
    }
    return start ? <Trans>An untitled sheet laid out in the drawing of {file}</Trans> : <Trans>an untitled sheet laid out in the drawing of {file}</Trans>
  }
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

/** BulkWords over counts read when shown (the bulk act's words are made before its calls). */
function BulkWordsOf({ get }: { get: () => [number, number] }) {
  const [n, m] = get()
  return <BulkWords n={n} m={m} />
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

/** A toast an act shows once Step 1 has reloaded. */
type Done = Parameters<ReturnType<typeof useToast>['show']>[0] & {
  /** Its words when Step 1 could not reload after it, where `message` ends without a full stop ("Undone: …"). */
  stale?: ReactNode
}

/** Where an act began: its generation, and the Step 1 queries failing then (their failure is not the act's). */
interface Mark {
  generation: number
  failing: ReadonlySet<string>
}

/** An act's toast when Step 1 could not reload after it: what was done, and that the confirmed count may be behind. */
function StaleWords({ done }: { done: ReactNode }) {
  return (
    <>
      {done} <Trans>Step 1 could not be reloaded, so the confirmed count may be behind. Reload the page to see it.</Trans>
    </>
  )
}

export interface Step1Acts {
  bulk(confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]): Promise<void>
  /** `backIn`: the actor's name, when the sheets were excluded and are confirmed back in (6.9). */
  confirmSheets(sheets: readonly ProposalOut[], backIn?: string): Promise<boolean>
  excludeSheets(sheets: readonly ProposalOut[], reason: Reason, text?: string): Promise<boolean>
  setDrawingList(discipline: string, text: string): Promise<boolean>
  /** Answers a Question with one of its options (`text`: the number typed for "Type a number"). */
  answerQuestion(entry: QuestionEntry, option: string, text?: string): Promise<boolean>
  undoLast(): Promise<void>
  /** An act or an undo is in flight, until Step 1 has reloaded: keys that act are dropped meanwhile. */
  busy: boolean
}

/**
 * `shown`: the Step 1 data the screen has just rendered. An act's toast waits until it is the data
 * Step 1 reloaded after the act (#167, F1), so the toast never stands beside the Count it changed.
 */
export function useStep1Acts(projectId: string, shown?: Step1Data | null): Step1Acts {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { i18n } = useLingui()
  const f = useFormat()
  /** The acts started in this tab, the last on top: what Ctrl Z takes back. */
  const history = useRef<Entry[]>([])
  /** An act in flight: another (a second Enter, a key held down) is dropped until it and its reload end. */
  const pending = useRef(false)
  /** Undos asked for and not yet ended: they run one after another, in the order pressed. */
  const undos = useRef(0)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [busy, setBusy] = useState(false)
  // An answer can move a file's status too (a held file set aside, §6.13), so the files band is read again with Step 1.
  const refresh = useCallback(
    () => Promise.all([queryClient.invalidateQueries({ queryKey: step1Key(projectId) }), queryClient.invalidateQueries({ queryKey: filesQuery(projectId).queryKey })]).then(() => {}),
    [queryClient, projectId],
  )
  /**
   * Whether Step 1 reloaded (every query but the files' names; #167's refuter): a reload that failed (or is still being tried again after failing) leaves
   * old data on screen, and an act's toast must not stand beside it as if fresh.
   */
  const failing = useCallback(
    () =>
      new Set(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: step1Key(projectId) })
          .filter((query) => query.queryKey[2] !== 'file-names' && (query.state.status === 'error' || query.state.fetchFailureCount > 0))
          .map((query) => query.queryHash),
      ),
    [queryClient, projectId],
  )
  /** Whether nothing failed anew since `mark` (a list failing before the act is not the act's: the refuter, round 3). */
  const reloaded = useCallback((mark: Mark) => [...failing()].every((hash) => mark.failing.has(hash)), [failing])
  /** Bumped by each act begun: a toast queued for an earlier act is then dropped, as `toast.clear()` drops a shown one. */
  const generation = useRef(0)
  /** An act's place, taken as it begins: its generation and the Step 1 queries already failing. */
  const marked = useCallback((): Mark => ({ generation: generation.current, failing: failing() }), [failing])
  /** The toast of the last act, waiting for the screen to render what Step 1 reloaded. */
  const waiting = useRef<{ toast: Done; generation: number } | null>(null)
  /** Bumped when a toast starts waiting, so the effect below looks again. */
  const [asked, setAsked] = useState(0)
  /** Whether `shown` is the data Step 1 holds now (the same objects the reload put in its cache). */
  const current = useCallback(
    (data: Step1Data) => {
      const key = step1Key(projectId)
      const parts = [data.proposals, data.questions, data.coverage, data.progress]
      if (!(['proposals', 'questions', 'coverage', 'progress'] as const).every((part, i) => queryClient.getQueryData([...key, part]) === parts[i])) return false
      return Object.entries(data.lists).every(([discipline, list]) => queryClient.getQueryData(drawingListQuery(projectId, discipline).queryKey) === list)
    },
    [queryClient, projectId],
  )
  useEffect(() => {
    const next = waiting.current
    if (!next) return
    if (next.generation !== generation.current) {
      waiting.current = null
      return
    }
    if (shown && !current(shown)) return
    waiting.current = null
    toast.show(next.toast)
  }, [asked, current, shown, toast])
  /** Whether Step 1 is still on screen; leaving it shows a waiting toast at once rather than lose it. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const box = waiting
    return () => {
      mounted.current = false
      const next = box.current
      box.current = null
      if (next && next.generation === generation.current) toast.show(next.toast)
    }
  }, [toast])
  /** Why a call failed, in words; never throws (problemOf throws on an error that is not the API's). */
  const failedText = useCallback(
    (error: unknown) => {
      try {
        const problem = problemOf(error)
        if (problem) return problemText(problem, f, i18n)
      } catch {
        // Not the API's refusal: said plainly below.
      }
      return problemText({ failed: true }, f, i18n)
    },
    [f, i18n],
  )
  const say = useCallback((error: unknown) => toast.show({ message: failedText(error) }), [failedText, toast])
  /**
   * What an act did, shown once Step 1 has reloaded and rendered (#167, F1): queued behind the reload's
   * own notices, so the toast never stands beside the stale Count or a bulk confirm still clickable.
   */
  const showDone = useCallback((done: Done | null, fresh: boolean, mark: Mark) => {
    // An act or a Ctrl Z begun since this act began drops its toast (the refuter, rounds 1 to 3).
    if (!done || mark.generation !== generation.current) return
    // A reload that failed leaves the old Count on screen: the toast says so rather than stand beside it as if fresh.
    const { stale, ...toastOf } = done
    const next = fresh ? toastOf : { ...toastOf, message: stale ?? <StaleWords done={done.message} /> }
    // Behind the reload's own notices, then shown by the effect once the screen has rendered them.
    notifyManager.schedule(() => {
      if (mark.generation !== generation.current) return
      // Step 1 left meanwhile: no Count is drawn to wait for, so it is said at once (the refuter, round 4).
      if (!mounted.current) return toast.show(next)
      waiting.current = { toast: next, generation: mark.generation }
      setAsked((n) => n + 1)
    })
  }, [toast])

  /**
   * Starts an act: blocks others and puts it on top of `history` as its key is pressed; returns what
   * counts its calls once they are made. A key that comes while another act or an undo is in flight is
   * dropped, and kept as an act that made nothing, so the Ctrl Z after it undoes nothing and says so.
   */
  const begin = useCallback((): ((calls: number, words: ReactNode) => void) | null => {
    if (pending.current || undos.current > 0) {
      if (!history.current.at(-1)?.dropped) history.current.push({ calls: 0, words: null, made: Promise.resolve(), counted: true, dropped: true })
      return null
    }
    pending.current = true
    generation.current += 1
    setBusy(true)
    // The last act's toast goes: its Undo would now take back this act (the server undoes the latest).
    toast.clear()
    waiting.current = null
    let counted = () => {}
    const entry: Entry = { calls: 0, words: null, made: new Promise<void>((resolve) => (counted = resolve)), counted: false, dropped: false }
    history.current.push(entry)
    return (calls, words) => {
      entry.calls = calls
      entry.words = words
      entry.counted = true
      counted()
    }
  }, [toast])

  /** Ends an act once Step 1 has reloaded; other acts are taken again from here. */
  /** Ends an act once Step 1 has reloaded; whether the reload succeeded. */
  const settle = useCallback(
    async (mark: Mark): Promise<boolean> => {
      // Held until Step 1 has reloaded: a second Enter during the reload would send the act again.
      await refresh().catch(() => {})
      pending.current = false
      if (undos.current === 0) setBusy(false)
      return reloaded(mark)
    },
    [refresh, reloaded],
  )

  /** Undoes `entry` (none: the user's last act from before this tab), once the undos before it end. */
  /**
   * The Ctrl Z presses asked for and not yet run, each with the act it took. A refused undo leaves the
   * server's latest act where it was, so these are called off and their acts put back in order (the
   * refuter of round 4: otherwise the next undo takes back the server's latest act under another act's
   * words).
   */
  const queued = useRef<{ entry: Entry | undefined; off: boolean; kept: boolean }[]>([])

  /** Puts acts back under any dropped keys kept since (no act is made while undos run). */
  const restore = useCallback((entries: Entry[]) => {
    const dropped: Entry[] = []
    while (history.current.at(-1)?.dropped) dropped.unshift(history.current.pop()!)
    history.current.push(...entries, ...dropped)
  }, [])

  /**
   * Undoes `entry` (none: the user's last act from before this tab), once the undos before it end.
   * `kept`: an answer's entry, left in `history` when pressed, so every Ctrl Z after it meets it too.
   */
  const undoEntry = useCallback(
    (entry: Entry | undefined, kept = false) => {
      // The act's toast goes once an undo is pressed, shown or queued, as for a new act: it would stand
      // beside the Count the undo takes back (#167's refuter, round 2; CI's slowed run of PR #225).
      generation.current += 1
      waiting.current = null
      toast.clear()
      const mark = marked()
      undos.current += 1
      setBusy(true)
      const ask = { entry, off: false, kept }
      queued.current.push(ask)
      /** A refused undo: keeps what it did not undo, and calls off the presses behind it. */
      const refused = (left: Entry | null) => {
        const behind = queued.current.filter((q) => q !== ask && !q.off)
        for (const q of behind) q.off = true
        const back = behind
          .filter((q) => !q.kept)
          .map((q) => q.entry)
          .filter((e): e is Entry => !!e)
          .reverse()
        restore(left ? [...back, left] : back)
      }
      const one = async () => {
        queued.current = queued.current.filter((q) => q !== ask)
        // Its toast waits for the reload too (#167, F1): "Undone: …" never beside the Count it changed.
        let done: Done | null = null
        try {
          if (ask.off) return
          if (entry) {
            // An act in flight is waited for, so this undoes it; one that made nothing undoes nothing.
            const waited = !entry.counted
            await entry.made
            if (kept && !entry.answer) {
              // The answer was refused or made no act: this Ctrl Z takes its entry, as for any other act.
              const at = history.current.indexOf(entry)
              if (at !== -1) history.current.splice(at, 1)
            }
            if (entry.answer) {
              // It stays the last act: the server's latest acts are the answer's own, which no Ctrl Z may take.
              // The server's own refusal's words (`answer_stays`), so both paths say the same (session 09's ruling).
              toast.show({ message: problemText({ refusal: ANSWER_STAYS }, f, i18n) })
              return
            }
            if (entry.calls === 0) {
              // Refused while this Ctrl Z waited: its refusal, just shown, says why and what to do; kept.
              if (waited && !entry.dropped) return
              toast.show({ message: <Trans>Nothing undone: your last change was not made. Press Ctrl Z again to undo the one before it.</Trans> })
              return
            }
            let left = entry.calls
            try {
              for (; left > 0; left--) await undo(projectId)
              const words = entry.words
              done = {
                message: <Trans>Undone: {words}</Trans>,
                stale: <Trans>Undone: {words}. Step 1 could not be reloaded, so the confirmed count may be behind. Reload the page to see it.</Trans>,
              }
            } catch (error) {
              if (reached(error)) left -= 1
              // What was not undone stays the last act, for the next Ctrl Z; part of it, worded plainly.
              const words = left === entry.calls ? entry.words : <Trans>your last change to Step 1</Trans>
              if (left > 0) refused({ ...entry, calls: left, words, made: Promise.resolve(), counted: true })
              say(error)
            }
          } else {
            try {
              const act = await undo(projectId)
              done = {
                message: <Trans>Undone: <UndoneWords act={act} /></Trans>,
                stale: (
                  <Trans>
                    Undone: <UndoneWords act={act} />. Step 1 could not be reloaded, so the confirmed count may be behind. Reload the page to see it.
                  </Trans>
                ),
              }
            } catch (error) {
              if (!reached(error)) refused(null)
              say(error)
            }
          }
        } finally {
          // Reloaded whatever happened: the screen shows what the server holds.
          await refresh().catch(() => {})
          const fresh = reloaded(mark)
          undos.current -= 1
          if (undos.current === 0 && !pending.current) setBusy(false)
          showDone(done, fresh, mark)
        }
      }
      // Never left rejected: an undo that throws (a failed reload) must not stop the ones after it.
      chain.current = chain.current.then(one).catch(() => {})
      return chain.current
    },
    [f, i18n, marked, projectId, refresh, reloaded, restore, say, showDone, toast],
  )

  /** Ctrl Z: the last act as it stands now, even one still in flight. */
  const undoLast = useCallback(() => {
    // An answer, even one still in flight, is never taken off: each Ctrl Z after it meets it again.
    const top = history.current.at(-1)
    return top?.answer ? undoEntry(top, true) : undoEntry(history.current.pop())
  }, [undoEntry])

  /**
   * A toast's Undo: its own act, while nothing but dropped keys came after it (a later act clears the
   * toast); those keys made nothing, so they are passed over.
   */
  const undoFor = useCallback(
    (words: ReactNode) => () => {
      const at = history.current.findLastIndex((e) => e.words === words && !e.dropped)
      if (at === -1 || history.current.slice(at + 1).some((e) => !e.dropped)) return
      const [entry] = history.current.splice(at)
      void undoEntry(entry)
    },
    [undoEntry],
  )

  /** Runs the server acts in turn; whatever of them was done is one act to undo. */
  const run = useCallback(
    async (calls: (() => Promise<unknown>)[], words: ReactNode, said: ReactNode): Promise<boolean> => {
      const counted = begin()
      if (!counted) return false
      const mark = marked()
      let made = 0
      let done: Done | null = null
      try {
        for (const call of calls) {
          await call()
          made += 1
        }
        done = { message: said, onUndo: undoFor(words) }
        return true
      } catch (error) {
        if (reached(error)) made += 1
        say(error)
        return false
      } finally {
        counted(made, words)
        showDone(done, await settle(mark), mark)
      }
    },
    [begin, marked, say, settle, showDone, undoFor],
  )

  const bulk = useCallback(
    async (confirming: readonly ProposalOut[], leavingOut: readonly ProposalOut[]) => {
      const counted = begin()
      if (!counted) return
      const mark = marked()
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
      // Made before the calls, so the toast's Undo and the entry share it; it reads n and m when shown.
      const words = <BulkWordsOf get={() => [n, m]} />
      const count = (c: (typeof calls)[number]) => {
        made += 1
        if (c.out) m += c.sheets
        else n += c.sheets
      }
      let at: (typeof calls)[number] | undefined
      let done: Done | null = null
      try {
        for (const c of calls) {
          at = c
          await c.call()
          count(c)
        }
        done = { message: <BulkDone n={n} m={m} />, onUndo: undoFor(words) }
      } catch (error) {
        if (at && reached(error)) count(at)
        const refused = failedText(error)
        if (made === 0) say(error)
        else
          done = {
            message: (
              <>
                <BulkDone n={n} m={m} /> <Trans>The rest was not done: {refused}</Trans>
              </>
            ),
            onUndo: undoFor(words),
          }
      } finally {
        counted(made, words)
        showDone(done, await settle(mark), mark)
      }
    },
    [begin, failedText, marked, projectId, say, settle, showDone, undoFor],
  )

  const confirmSheets = useCallback(
    (sheets: readonly ProposalOut[], backIn?: string) => {
      const name = <SheetName sheets={sheets} />
      const Name = <SheetName sheets={sheets} start />
      const said = backIn ? <Trans>{Name} confirmed back in, under {backIn}’s name.</Trans> : <Trans>Confirmed {name}.</Trans>
      return run([() => confirm(projectId, sheets.map((p) => p.id))], <Trans>confirmed {name}</Trans>, said)
    },
    [projectId, run],
  )

  const excludeSheets = useCallback(
    (sheets: readonly ProposalOut[], reason: Reason, text = '') => {
      const name = <SheetName sheets={sheets} />
      const Name = <SheetName sheets={sheets} start />
      const short = reason === 'other' && text.trim() ? text.trim() : i18n._(REASON_SHORT[reason] ?? UNKNOWN_REASON)
      return run(
        [() => exclude(projectId, sheets.map((p) => p.id), reason, text)],
        <Trans>excluded {name}</Trans>,
        <Trans>
          {Name} excluded: {short}. It stays in the count.
        </Trans>,
      )
    },
    [i18n, projectId, run],
  )

  const setDrawingList = useCallback(
    async (discipline: string, text: string) => {
      // Not while another act is in flight: its undo would take this one's place (the refuter, round 1).
      const counted = begin()
      if (!counted) return false
      const mark = marked()
      const which = DISCIPLINE_IN_TEXT[discipline]
      const kind = which ? i18n._(which) : ''
      const words = <Trans>the drawing list you set</Trans>
      let made = 0
      let done: Done | null = null
      try {
        const list = await setList(projectId, discipline, text)
        made = 1
        const n = list.numbers.length
        done = {
          message: which ? (
            <Plural value={n} one={`Drawing list set: # ${kind} sheet.`} other={`Drawing list set: # ${kind} sheets.`} />
          ) : (
            <Plural value={n} one="Drawing list set: # sheet." other="Drawing list set: # sheets." />
          ),
          onUndo: undoFor(words),
        }
        return true
      } catch (error) {
        if (reached(error)) made = 1
        say(error)
        return false
      } finally {
        counted(made, words)
        showDone(done, await settle(mark), mark)
      }
    },
    [begin, i18n, marked, projectId, say, settle, showDone, undoFor],
  )

  const answerQuestion = useCallback(
    async (entry: QuestionEntry, option: string, text = '') => {
      const counted = begin()
      if (!counted) return false
      const mark = marked()
      const mine = history.current.at(-1)
      // Held from the moment it is sent (CI's slowed run: a Ctrl Z before the reply undid its act).
      if (mine) mine.answer = makesAct(entry, option)
      let made = 0
      let done: Done | null = null
      try {
        await answer(projectId, entry.question.id, option, text)
        made = 1
        done = { message: <AnsweredWords entry={entry} option={option} text={text.trim()} /> }
        return true
      } catch (error) {
        if (reached(error)) made = 1
        say(error)
        return false
      } finally {
        if (mine && !made) mine.answer = false
        counted(0, null)
        if (made && mine && !makesAct(entry, option)) {
          // An answer that confirms or excludes nothing makes no server act: Ctrl Z passes over it.
          const at = history.current.indexOf(mine)
          if (at !== -1) history.current.splice(at, 1)
        } else if (made && mine) {
          // The server's latest acts are now the answer's own (a confirm, an exclusion): no act made
          // earlier in this tab is the one an undo would take back, so Ctrl Z starts from the answer.
          const at = history.current.indexOf(mine)
          history.current = at === -1 ? [] : history.current.slice(at)
        }
        showDone(done, await settle(mark), mark)
      }
    },
    [begin, marked, projectId, say, settle, showDone],
  )

  return { bulk, confirmSheets, excludeSheets, setDrawingList, answerQuestion, undoLast, busy }
}
