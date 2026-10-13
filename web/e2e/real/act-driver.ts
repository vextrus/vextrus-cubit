/*
 * G1's act driver, extracted from walk.spec.ts (S24-W1, #716). It acts on Step 1 from the moment the
 * first file's read starts, cycling the four kinds until each has `samplesMin` samples (acts that
 * answered 1 to 399 with a read running, verdict.py's rule), and goes on across files while any read
 * remains. It says why it stopped short, so the act check names the walk's scheduling or the screen,
 * never the product's speed:
 *
 *   - reads_ended_before_samples: every read ended while every kind had answered at least once (an
 *     answer turn skipped for want of a running read counts here, never as kind_not_offered);
 *   - kind_not_offered: a kind never answered 1 to 399 in any act (the screen offered none, or every
 *     act of it failed): the reads ending is then not the reason;
 *   - reads_timed_out: files whose read had not ended FILE_TIMEOUT_MS after its upload (each file keeps
 *     its own deadline; the walk goes on to the next file, as the first Project's does).
 *
 * It knows no browser: the walk gives it the world.
 */
import type { ActRecord } from './act-timer'

export type ActKind = 'confirm' | 'undo' | 'exclude' | 'answer'

const KINDS: readonly ActKind[] = ['confirm', 'undo', 'exclude', 'answer']
/** One file's read must end within this of its upload, as the first Project's reads must. */
export const FILE_TIMEOUT_MS = 45 * 60 * 1000
/** A runaway guard beside the wall clock: no walk reaches it while reads run (a cycle takes seconds). */
const CYCLES_MAX = 2000

export type ActWalk = {
  /** The acts Project's files, in upload order. */
  files: readonly string[]
  /** act_samples_min: the samples each kind needs. */
  samplesMin: number
  /** Uploads one file; its read has begun when this resolves. */
  upload(file: string): Promise<void>
  /** Whether any file of the acts Project is still reading. */
  reading(): Promise<boolean>
  /** Waits until the screen can take an act (Step 1's list shown); optional. The driver calls it before
   * it decides an answer, so that decision is made after any wait `act` would otherwise do first. Resolving false (not ready
   * in time) defers the answer turn. */
  ready?(): Promise<boolean | void>
  /** One timed act by its keys; null when the screen offered nothing to act on. */
  act(kind: ActKind): Promise<ActRecord | null>
  /** A pause between polls and after a cycle that made no act (the screen has nothing yet): optional. */
  idle?(): Promise<void>
  /** The wall clock in ms (Date.now); a test gives its own. */
  now?(): number
  /** One file's read deadline in ms (FILE_TIMEOUT_MS); a test gives its own. */
  fileTimeoutMs?: number
}

export type ActOutcome = {
  acts: ActRecord[]
  reads_ended_before_samples: boolean
  kind_not_offered: boolean
  /** Files whose read had not ended by their deadline. */
  reads_timed_out: number
}

const answered = (a: ActRecord) => a.status > 0 && a.status < 400

/** Each kind has its samples: acts during a read that answered (a status of 1 to 399). */
function sampled(acts: readonly ActRecord[], samplesMin: number): boolean {
  const good = acts.filter((a) => a.read_running && answered(a))
  return KINDS.every((kind) => good.filter((a) => a.kind === kind).length >= samplesMin)
}

/** Some kind never answered 1 to 399 in any act, during a read or not. */
function notOffered(acts: readonly ActRecord[], answerUnasked: boolean): boolean {
  // An answer never asked for (every turn skipped for want of a read) is not one the screen failed to offer.
  return KINDS.some(
    (kind) => !(answerUnasked && kind === 'answer') && !acts.some((a) => a.kind === kind && answered(a)),
  )
}

export async function actWhileReading(walk: ActWalk): Promise<ActOutcome> {
  const now = walk.now ?? Date.now
  const timeoutMs = walk.fileTimeoutMs ?? FILE_TIMEOUT_MS
  const acts: ActRecord[] = []
  const act = async (kind: ActKind) => {
    const done = await walk.act(kind)
    if (done) acts.push(done)
    return done
  }
  let next = 0
  let deadline = 0 // the file in hand's
  let counted = true // its timeout is recorded (or it has no read in hand)
  let timedOut = 0
  const start = async () => {
    await walk.upload(walk.files[next++]!)
    deadline = now() + timeoutMs
    counted = false
  }
  /** Waits for the read in hand to end, or its deadline: a deadline passed is recorded once. */
  const settle = async () => {
    while (!counted) {
      if (!(await walk.reading())) {
        counted = true
      } else if (now() >= deadline) {
        timedOut += 1
        counted = true
      } else if (walk.idle) await walk.idle()
    }
  }

  let ended = false
  let deferred = false // an answer turn was skipped because no read ran
  let asked = false // an answer act was tried (made or null) while a read ran
  if (walk.files.length > 0) await start()
  for (let cycle = 0; cycle < CYCLES_MAX && !sampled(acts, walk.samplesMin); cycle++) {
    if (!(await walk.reading())) {
      // The read in hand ended: the next file's read starts, or the reads are over.
      counted = true
      if (next >= walk.files.length) {
        ended = true
        break
      }
      await start()
    } else if (now() >= deadline) {
      // A read that never ends holds nothing more: stop acting, record it, go on to the next file.
      timedOut += 1
      counted = true
      break
    }
    const before = acts.length
    // A cycle: confirm, undo, exclude, undo and answer (an undo only of an act that was made).
    if (await act('confirm')) await act('undo')
    if (await act('exclude')) await act('undo')
    // An answer cannot be undone and the supply is fixed: spend one only while a read runs.
    // The decision comes after the screen is ready: its wait can outlast the read.
    // A screen not ready (false) is a deferral too: `act` would wait for it again, after this decision.
    if ((await walk.ready?.()) !== false && (await walk.reading())) {
      asked = true
      await act('answer')
    } else deferred = true
    if (acts.length === before && walk.idle) await walk.idle()
  }
  // Every file is uploaded once, in order, each after the read before it ended or timed out.
  while (next < walk.files.length) {
    await settle()
    await start()
  }
  await settle()
  const unoffered = ended && notOffered(acts, deferred && !asked)
  return {
    acts,
    reads_ended_before_samples: ended && !unoffered,
    kind_not_offered: unoffered,
    reads_timed_out: timedOut,
  }
}
