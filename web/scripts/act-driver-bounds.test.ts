/*
 * S24-W1 fix round (PR 724): the act driver's wall-clock bound, each file's own deadline, and the
 * reasons it stopped short. A fake world on a tick clock, no browser (the acceptance tests of
 * ts24w1 pin the rest).
 */
import { describe, expect, it } from 'vitest'
import type { ActRecord } from '../e2e/real/act-timer'
import { actWhileReading, type ActKind } from '../e2e/real/act-driver'

const record = (kind: ActKind, over: Partial<ActRecord> = {}): ActRecord => ({
  kind,
  ms: 100,
  read_running: true,
  status: 200,
  ...over,
})

/** A world whose clock advances one tick per call; `ending(file)` is the tick a file's read ends at
 * (Infinity: never). Reads run one after another, each from its upload. */
function world(
  files: string[],
  endsAfter: Record<string, number>,
  actOf: (kind: ActKind, running: boolean) => ActRecord | null = (kind, running) =>
    record(kind, { read_running: running }),
) {
  let tick = 0
  let calls = 0
  const uploads: { file: string; at: number }[] = []
  const reads: { file: string; start: number; end: number }[] = []
  const call = () => {
    tick += 1
    calls += 1
    if (calls > 200_000) throw new Error('the act driver never stopped')
  }
  const reading = (t: number) => reads.some((r) => t >= r.start && t < r.end)
  return {
    uploads,
    reads,
    walk: {
      files,
      samplesMin: 5,
      fileTimeoutMs: 1000,
      now: () => tick,
      async upload(file: string) {
        call()
        const start = Math.max(tick, reads.at(-1)?.end ?? 0)
        reads.push({ file, start, end: start + (endsAfter[file] ?? 0) })
        uploads.push({ file, at: tick })
      },
      async reading() {
        call()
        return reading(tick)
      },
      async act(kind: ActKind) {
        call()
        const running = reading(tick)
        const made = actOf(kind, running)
        tick += 1
        return made
      },
    },
  }
}

describe('the act driver’s wall-clock bound (S24-W1 fix)', () => {
  it('stops acting and records a timeout when a read never ends', async () => {
    // Answers are never offered, so the samples can never be met: only the clock stops the loop.
    const w = world(['kilo.dwg'], { 'kilo.dwg': Infinity }, (kind, running) =>
      kind === 'answer' ? null : record(kind, { read_running: running }),
    )

    const result = await actWhileReading(w.walk)

    expect(result.reads_timed_out).toBe(1)
    expect(result.reads_ended_before_samples).toBe(false)
    expect(result.acts.length).toBeGreaterThan(0) // the acts gathered so far are returned
    expect(result.acts.length).toBeLessThan(400) // a thousand ticks of acts, not two thousand cycles
  })

  it('gives each remaining file its own deadline, recording every timeout and going on', async () => {
    const w = world(['kilo.dwg', 'lima.dwg', 'mike.dwg'], {
      'kilo.dwg': Infinity,
      'lima.dwg': Infinity,
      'mike.dwg': Infinity,
    })

    const result = await actWhileReading(w.walk)

    expect(w.uploads.map((u) => u.file)).toEqual(['kilo.dwg', 'lima.dwg', 'mike.dwg'])
    expect(result.reads_timed_out).toBe(3)
    // Each upload waited for the read before it to end or reach its deadline (1000 ticks).
    expect(w.uploads[1]!.at - w.uploads[0]!.at).toBeGreaterThanOrEqual(1000)
    expect(w.uploads[2]!.at - w.uploads[1]!.at).toBeGreaterThanOrEqual(1000)
  })

  it('uploads the next file only after the read before it ended, even once the samples are met', async () => {
    // The samples are met within the first read; the second file waits for it to end.
    const w = world(['kilo.dwg', 'lima.dwg'], { 'kilo.dwg': 500, 'lima.dwg': 5 })

    const result = await actWhileReading(w.walk)

    expect(result.reads_timed_out).toBe(0)
    expect(w.uploads[1]!.at).toBeGreaterThanOrEqual(w.reads[0]!.end)
  })

  it('records a read that does not end in time on the last file too', async () => {
    const w = world(['kilo.dwg', 'lima.dwg'], { 'kilo.dwg': 5, 'lima.dwg': Infinity })

    const result = await actWhileReading(w.walk)

    expect(result.reads_timed_out).toBe(1)
  })
})

describe('why the driver stopped short (S24-W1 fix)', () => {
  it('says kind_not_offered, not reads_ended_before_samples, when a kind was never offered', async () => {
    const w = world(['kilo.dwg'], { 'kilo.dwg': 60 }, (kind, running) =>
      kind === 'exclude' ? null : record(kind, { read_running: running }),
    )

    const result = await actWhileReading(w.walk)

    expect(result.kind_not_offered).toBe(true)
    expect(result.reads_ended_before_samples).toBe(false)
    expect(result.reads_timed_out).toBe(0)
  })

  it('says kind_not_offered when every act of a kind failed', async () => {
    const w = world(['kilo.dwg'], { 'kilo.dwg': 60 }, (kind, running) =>
      record(kind, { read_running: running, status: kind === 'answer' ? 500 : 200 }),
    )

    const result = await actWhileReading(w.walk)

    expect(result.kind_not_offered).toBe(true)
    expect(result.reads_ended_before_samples).toBe(false)
  })

  it('says reads_ended_before_samples when every kind answered but the reads ended first', async () => {
    const w = world(['kilo.dwg'], { 'kilo.dwg': 30 })

    const result = await actWhileReading(w.walk)

    expect(result.reads_ended_before_samples).toBe(true)
    expect(result.kind_not_offered).toBe(false)
  })

  it('says neither when the samples were met', async () => {
    const w = world(['kilo.dwg'], { 'kilo.dwg': 900 })

    const result = await actWhileReading(w.walk)

    expect(result.reads_ended_before_samples).toBe(false)
    expect(result.kind_not_offered).toBe(false)
    expect(result.reads_timed_out).toBe(0)
  })
})

describe('an answer deferred for want of a read (S25-W2 fix round)', () => {
  it('still says kind_not_offered when every answer asked for failed, at any read length', async () => {
    for (let length = 40; length <= 80; length++) {
      const w = world(['kilo.dwg'], { 'kilo.dwg': length }, (kind, running) =>
        record(kind, { read_running: running, status: kind === 'answer' ? 500 : 200 }),
      )
      const result = await actWhileReading(w.walk)
      expect(result.kind_not_offered, `read of ${length} ticks`).toBe(true)
      expect(result.reads_ended_before_samples, `read of ${length} ticks`).toBe(false)
    }
  })

  it('still says kind_not_offered when a later read offers no answer after an earlier turn was deferred', async () => {
    const w = world(['kilo.dwg', 'lima.dwg'], { 'kilo.dwg': 3, 'lima.dwg': 200 }, (kind, running) =>
      kind === 'answer' ? null : record(kind, { read_running: running }),
    )
    const result = await actWhileReading(w.walk)
    expect(result.kind_not_offered).toBe(true)
    expect(result.reads_ended_before_samples).toBe(false)
  })

  it('decides an answer after the walk is ready, not before: a wait that outlasts the read spends none', async () => {
    let tick = 0
    let listShown = false
    const answers: boolean[] = []
    const walk = {
      files: ['kilo.dwg'],
      samplesMin: 5,
      fileTimeoutMs: 100_000,
      now: () => tick,
      async idle() {
        tick += 1
      },
      async upload() {
        tick += 1
      },
      async reading() {
        tick += 1
        return tick < 150
      },
      // Step 1's list appears only when the read ends, as a 60-tick wait that timed out would leave it.
      async ready() {
        if (!listShown) {
          tick = Math.max(tick, 151)
          listShown = true
        }
      },
      async act(kind: ActKind) {
        if (kind !== 'answer') return null // nothing to confirm or exclude before the list shows
        await walk.ready()
        const running = tick < 150
        tick += 1
        if (kind === 'answer') answers.push(running)
        return record(kind, { read_running: running })
      },
    }
    await actWhileReading(walk)
    expect(answers.every(Boolean)).toBe(true)
  })
})
