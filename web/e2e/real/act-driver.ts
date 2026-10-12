/*
 * G1's act driver, extracted from walk.spec.ts (S24-W1, #716). It acts on Step 1 from the moment the
 * first file's read starts, cycling the four kinds until each has `samplesMin` samples (acts that
 * answered 1 to 399 with a read running, verdict.py's rule), and goes on across files while any read
 * remains. It says `reads_ended_before_samples` when every read ended first, so the act check names the
 * walk's scheduling, never the product's speed. It knows no browser: the walk gives it the world.
 */
import type { ActRecord } from './act-timer'

export type ActKind = 'confirm' | 'undo' | 'exclude' | 'answer'

const KINDS: readonly ActKind[] = ['confirm', 'undo', 'exclude', 'answer']
/** A runaway guard: no walk reaches it while reads run (a cycle takes seconds). */
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
  /** One timed act by its keys; null when the screen offered nothing to act on. */
  act(kind: ActKind): Promise<ActRecord | null>
  /** A pause after a cycle that made no act (the screen has nothing yet): optional. */
  idle?(): Promise<void>
}

export type ActOutcome = { acts: ActRecord[]; reads_ended_before_samples: boolean }

/** Each kind has its samples: acts during a read that answered (a status of 1 to 399). */
function sampled(acts: readonly ActRecord[], samplesMin: number): boolean {
  const good = acts.filter((a) => a.read_running && a.status > 0 && a.status < 400)
  return KINDS.every((kind) => good.filter((a) => a.kind === kind).length >= samplesMin)
}

export async function actWhileReading(walk: ActWalk): Promise<ActOutcome> {
  const acts: ActRecord[] = []
  const act = async (kind: ActKind) => {
    const done = await walk.act(kind)
    if (done) acts.push(done)
    return done
  }
  let next = 0
  let ended = false
  if (walk.files.length > 0) await walk.upload(walk.files[next++]!)
  for (let cycle = 0; cycle < CYCLES_MAX && !sampled(acts, walk.samplesMin); cycle++) {
    if (!(await walk.reading())) {
      // The read in hand ended: the next file's read starts, or the reads are over.
      if (next >= walk.files.length) {
        ended = true
        break
      }
      await walk.upload(walk.files[next++]!)
    }
    const before = acts.length
    // A cycle: confirm, undo, exclude, undo and answer (an undo only of an act that was made).
    if (await act('confirm')) await act('undo')
    if (await act('exclude')) await act('undo')
    await act('answer')
    if (acts.length === before && walk.idle) await walk.idle()
  }
  // Every file is uploaded once, in order, whether or not the samples are met.
  while (next < walk.files.length) await walk.upload(walk.files[next++]!)
  return { acts, reads_ended_before_samples: ended }
}
