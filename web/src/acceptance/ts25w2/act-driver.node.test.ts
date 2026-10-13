/*
 * Ticket S25-W2's acceptance test: G1's act driver spends an answer only while a read runs, so every
 * answer is a timed sample.
 *
 * The defect (G1 walk A, S25): the Sample Project's acts Project has exactly 5 open Questions, and an
 * answer cannot be undone (m0-screens), so the supply of answers is fixed. The
 * driver (web/e2e/real/act-driver.ts, actWhileReading) runs its cycle confirm, undo, exclude, undo,
 * answer whether or not a read runs: its first cycle waited for Step 1's list (walk.spec.ts ready())
 * while the first short read ended, and a later cycle ran on past the end of its file's read, so two of
 * the five answers were spent with read_running false. act_p95_during_read failed with
 * reads_ended_before_samples (answer samples 3 of the 5 needed), on the walk's scheduling, not on the
 * product's speed.
 *
 * The seam is unchanged (S24-W1's): actWhileReading({ files, samplesMin, upload, reading, act, idle,
 * now, fileTimeoutMs }) returns { acts, reads_ended_before_samples, kind_not_offered, reads_timed_out }.
 * A sample is an act recorded with read_running true and a status of 1 to 399 (verdict.py's rule).
 *
 * The world here is fake and deterministic: a tick clock every call advances (an upload, a poll and an
 * idle one tick; a confirm, an undo or an exclude two). After each upload the next act first waits for
 * Step 1's list (LOAD_TICKS), as walk.spec.ts's ready() does, before its keys. Reads stop and start:
 * each uploaded file reads for its ticks, after the read before it, and between files no read runs
 * until the driver uploads the next. The acts Project has exactly ANSWERS open Questions; each answer
 * takes one Question for good, and takes no ticks, so a read never ends during one: an answer is a
 * sample exactly when a read runs as it is made. No browser, no server, no sleep.
 */
import { describe, expect, it } from "vitest";
import type { ActRecord } from "../../../e2e/real/act-timer";
import { actWhileReading } from "../../../e2e/real/act-driver";

type Kind = "confirm" | "undo" | "exclude" | "answer";
const KINDS: Kind[] = ["confirm", "undo", "exclude", "answer"];
const SAMPLES_MIN = 5; // act_samples_min (the owner's Q5 limits)
const ANSWERS = 5; // the open Questions in the acts Project: the supply of answers, exactly the samples
const LOAD_TICKS = 8; // the wait for Step 1's list before the first act after an upload
const CALLS_MAX = 100_000; // a driver that never stops fails here instead of hanging the suite

type Made = { record: ActRecord; at: number; reading: boolean };

/** Each kind's samples: acts recorded while a read ran that answered 1 to 399. */
function samples(acts: ActRecord[]): Record<Kind, number> {
  const counted = { confirm: 0, undo: 0, exclude: 0, answer: 0 };
  for (const a of acts) {
    if (a.read_running && a.status > 0 && a.status < 400 && a.kind in counted)
      counted[a.kind as Kind] += 1;
  }
  return counted;
}

/** A walk whose reads stop and start, with a fixed supply of answers (see the header). */
function readsWorld(files: { name: string; ticks: number }[]) {
  let now = 0;
  let calls = 0;
  let queueEnd = 0;
  let listShown = false; // Step 1's list is on screen (an upload replaces it)
  let questions = ANSWERS;
  const reads: { start: number; end: number }[] = [];
  const uploaded: string[] = [];
  const made: Made[] = [];
  const isReading = (t: number) =>
    reads.some((r) => r.start <= t && t < r.end);
  const call = () => {
    calls += 1;
    if (calls > CALLS_MAX) throw new Error("the act driver never stopped");
  };
  return {
    made,
    uploaded,
    /** The answers made, whether or not they were samples. */
    answers: () => made.filter((m) => m.record.kind === "answer"),
    walk: {
      files: files.map((f) => f.name),
      samplesMin: SAMPLES_MIN,
      fileTimeoutMs: 1_000_000,
      now: () => now,
      async idle() {
        call();
        now += 1;
      },
      async upload(name: string) {
        call();
        const file = files.find((f) => f.name === name);
        if (!file) throw new Error(`no such file: ${name}`);
        now += 1;
        const start = Math.max(now, queueEnd);
        queueEnd = start + file.ticks;
        reads.push({ start, end: queueEnd });
        uploaded.push(name);
        listShown = false;
      },
      async reading() {
        call();
        now += 1;
        return isReading(now);
      },
      async act(kind: Kind): Promise<ActRecord | null> {
        call();
        if (!listShown) {
          now += LOAD_TICKS;
          listShown = true;
        }
        const at = now;
        const before = isReading(now);
        if (kind === "answer") {
          if (questions === 0) {
            now += 1;
            return null; // no open Question left: the screen offers no answer
          }
          questions -= 1;
          const record = { kind, ms: 120, read_running: before, status: 200 };
          made.push({ record, at, reading: before });
          return record;
        }
        now += 2;
        const record = {
          kind,
          ms: 120,
          read_running: before && isReading(now),
          status: 200,
        };
        made.push({ record, at, reading: before });
        return record;
      },
    },
  };
}

/**
 * The defect's shape: a first read shorter than the wait for Step 1's list (it ends before the first
 * act), then reads that end part way through a cycle, then one long enough for every kind's samples.
 */
const SHORT_THEN_LONG = [
  { name: "kilo.dwg", ticks: 6 },
  { name: "lima.dwg", ticks: 20 },
  { name: "mike.dwg", ticks: 25 },
  { name: "november.dwg", ticks: 200 },
];

/** Reads that each end before a cycle could reach its answer, then one long read. */
const MANY_SHORT_THEN_LONG = [
  ...["kilo", "lima", "mike", "november", "oscar", "papa"].map((n) => ({
    name: `${n}.dwg`,
    ticks: 14,
  })),
  { name: "quebec.dwg", ticks: 200 },
];

describe("G1's act driver spends answers only while a read runs (S25-W2)", () => {
  it("spends no answer while no read runs", async () => {
    const world = readsWorld(SHORT_THEN_LONG);

    await actWhileReading(world.walk);

    const answers = world.answers();
    expect(answers.length, "no answer was made").toBeGreaterThan(0);
    for (const a of answers)
      expect(a.reading, `an answer made at tick ${a.at} with no read running`).toBe(true);
  });

  it("gets five answer samples from a supply of exactly five Questions", async () => {
    const world = readsWorld(SHORT_THEN_LONG);

    const result = await actWhileReading(world.walk);

    expect(samples(result.acts).answer).toBe(ANSWERS);
    for (const kind of KINDS)
      expect(samples(result.acts)[kind], kind).toBeGreaterThanOrEqual(SAMPLES_MIN);
    expect(result.reads_ended_before_samples).toBe(false);
    expect(result.kind_not_offered).toBe(false);
  });

  it("keeps each Question for a later read when reads end before the cycle reaches its answer", async () => {
    const world = readsWorld(MANY_SHORT_THEN_LONG);

    const result = await actWhileReading(world.walk);

    for (const a of world.answers())
      expect(a.reading, `an answer made at tick ${a.at} with no read running`).toBe(true);
    expect(samples(result.acts).answer).toBe(ANSWERS);
    expect(result.reads_ended_before_samples).toBe(false);
  });

  it("uploads every file of the acts Project once, in order, when it defers answers", async () => {
    const world = readsWorld(SHORT_THEN_LONG);

    await actWhileReading(world.walk);

    expect(world.uploaded).toEqual(SHORT_THEN_LONG.map((f) => f.name));
  });

  it("says the reads ended before the samples, not that no answer was offered, when every read ends first", async () => {
    // Each read outlasts the wait for Step 1's list by a few ticks: too short for five of each kind.
    const world = readsWorld([
      { name: "kilo.dwg", ticks: 14 },
      { name: "lima.dwg", ticks: 14 },
    ]);

    const result = await actWhileReading(world.walk);

    for (const a of world.answers())
      expect(a.reading, `an answer made at tick ${a.at} with no read running`).toBe(true);
    expect(result.reads_ended_before_samples).toBe(true);
    expect(result.kind_not_offered).toBe(false);
  });
});
