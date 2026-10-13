/*
 * Ticket S24-W1's acceptance test (#716): G1's act driver keeps acting while any read runs, until each
 * kind of act has its samples, and says so honestly when the reads end first.
 *
 * The defect (G1 walk 59524e39): the acts Project acted only while a later file read (never during the
 * first), at most ten rounds per file, so a Development Set whose reads are short gave 4 answers during
 * reads; the 5th landed after the last read ended, and act_p95_during_read failed on the walk's
 * scheduling, not on the product.
 *
 * The seam (the builder extracts the acts Project's loop from walk.spec.ts, which then imports it):
 *
 *   web/e2e/real/act-driver.ts
 *     export async function actWhileReading(walk: {
 *       files: readonly string[]          // the acts Project's files, in upload order
 *       samplesMin: number                // act_samples_min: the samples each kind needs
 *       upload(file: string): Promise<void>   // uploads one file; its read has begun when this resolves
 *       reading(): Promise<boolean>       // whether any file of the acts Project is still reading
 *       act(kind: 'confirm' | 'undo' | 'exclude' | 'answer'): Promise<ActRecord | null>
 *                                         // one timed act by its keys (act-timer's timedAct); null when
 *                                         // the screen offered nothing to act on
 *     }): Promise<{ acts: ActRecord[]; reads_ended_before_samples: boolean }>
 *
 * A sample is an act whose record says `read_running` true with a status of 1 to 399 (verdict.py's
 * rule). The world here is fake and deterministic: a tick clock that every call advances (an upload
 * or a poll one tick, an act two), reads that queue one after another, and acts that answer 200 at
 * once. No browser, no server, no sleep.
 */
import { describe, expect, it } from "vitest";
import type { ActRecord } from "../../../e2e/real/act-timer";
import { actWhileReading } from "../../../e2e/real/act-driver";

type Kind = "confirm" | "undo" | "exclude" | "answer";
const KINDS: Kind[] = ["confirm", "undo", "exclude", "answer"];
const SAMPLES_MIN = 5; // act_samples_min in every expectation (the owner's Q5 limits)
const CALLS_MAX = 100_000; // a driver that never stops fails here instead of hanging the suite

type Made = { record: ActRecord; at: number };

/** Each kind's samples: acts recorded while a read ran that answered 1 to 399. */
function samples(acts: ActRecord[]): Record<Kind, number> {
  const counted = { confirm: 0, undo: 0, exclude: 0, answer: 0 };
  for (const a of acts) {
    if (a.read_running && a.status > 0 && a.status < 400 && a.kind in counted)
      counted[a.kind as Kind] += 1;
  }
  return counted;
}

function met(acts: ActRecord[], min: number): boolean {
  const counted = samples(acts);
  return KINDS.every((k) => counted[k] >= min);
}

/**
 * A walk on a tick clock: each uploaded file's read starts when the one before it ends (a queued file
 * is still reading) and lasts its ticks. `offered(kind, attempt)` says whether the screen offers the
 * kind's nth attempt (1-based); an act not offered costs a tick and gives null.
 */
function tickWorld(
  files: { name: string; ticks: number }[],
  offered: (kind: Kind, attempt: number) => boolean = () => true,
) {
  let now = 0;
  let calls = 0;
  let queueEnd = 0;
  const ends: number[] = [];
  const uploaded: string[] = [];
  const made: Made[] = [];
  const attempts = { confirm: 0, undo: 0, exclude: 0, answer: 0 };
  const isReading = (t: number) => ends.some((end) => t < end);
  const call = () => {
    calls += 1;
    if (calls > CALLS_MAX) throw new Error("the act driver never stopped");
  };
  return {
    made,
    uploaded,
    ends,
    walk: {
      files: files.map((f) => f.name),
      samplesMin: SAMPLES_MIN,
      async upload(name: string) {
        call();
        const file = files.find((f) => f.name === name);
        if (!file) throw new Error(`no such file: ${name}`);
        now += 1;
        const start = Math.max(now, queueEnd);
        queueEnd = start + file.ticks;
        ends.push(queueEnd);
        uploaded.push(name);
      },
      async reading() {
        call();
        now += 1;
        return isReading(now);
      },
      async act(kind: Kind): Promise<ActRecord | null> {
        call();
        attempts[kind] += 1;
        if (!offered(kind, attempts[kind])) {
          now += 1;
          return null;
        }
        const at = now;
        const before = isReading(now);
        now += 2;
        const record = {
          kind,
          ms: 120,
          read_running: before && isReading(now),
          status: 200,
        };
        made.push({ record, at });
        return record;
      },
    },
  };
}

/**
 * A walk whose one file reads until the `endsDuring`th act is under way: that act began while the file
 * read and ended after it (recorded with `read_running` false, as timedAct records it); every later
 * poll says no read runs.
 */
function endingWorld(endsDuring: number) {
  let calls = 0;
  let started = 0;
  let uploaded = false;
  const made: Made[] = [];
  const call = () => {
    calls += 1;
    if (calls > CALLS_MAX) throw new Error("the act driver never stopped");
  };
  const isReading = () => uploaded && started < endsDuring;
  return {
    made,
    walk: {
      files: ["kilo.dwg"],
      samplesMin: SAMPLES_MIN,
      async upload() {
        call();
        uploaded = true;
      },
      async reading() {
        call();
        return isReading();
      },
      async act(kind: Kind): Promise<ActRecord | null> {
        call();
        const before = isReading();
        started += 1;
        const record = {
          kind,
          ms: 120,
          read_running: before && isReading(),
          status: 200,
        };
        made.push({ record, at: started });
        return record;
      },
    },
  };
}

describe("G1's act driver (S24-W1)", () => {
  it("keeps acting, cycling the four kinds past ten rounds, until each kind has its samples while a read runs", async () => {
    // An answer is offered only on every third try: five answers need fifteen rounds.
    const world = tickWorld(
      [
        { name: "kilo.dwg", ticks: 2000 },
        { name: "lima.dwg", ticks: 2000 },
      ],
      (kind, attempt) => kind !== "answer" || attempt % 3 === 0,
    );

    const result = await actWhileReading(world.walk);

    for (const kind of KINDS)
      expect(samples(result.acts)[kind], kind).toBeGreaterThanOrEqual(
        SAMPLES_MIN,
      );
    expect(result.reads_ended_before_samples).toBe(false);
  });

  it("stops acting once every kind has its samples, finishing at most the cycle in progress", async () => {
    const world = tickWorld([
      { name: "kilo.dwg", ticks: 2000 },
      { name: "lima.dwg", ticks: 2000 },
    ]);

    const result = await actWhileReading(world.walk);

    const records = world.made.map((m) => m.record);
    const metAt = records.findIndex((_, i) =>
      met(records.slice(0, i + 1), SAMPLES_MIN),
    );
    expect(metAt, "the samples were never met").toBeGreaterThanOrEqual(0);
    // A cycle is five acts (confirm, undo, exclude, undo, answer): fewer than that after the samples.
    expect(records.length - 1 - metAt).toBeLessThan(5);
    expect(result.reads_ended_before_samples).toBe(false);
  });

  it("starts acting as soon as the first read starts: a set of one file gives every kind its samples", async () => {
    const world = tickWorld([{ name: "kilo.dwg", ticks: 600 }]);

    const result = await actWhileReading(world.walk);

    expect(world.uploaded).toEqual(["kilo.dwg"]);
    for (const kind of KINDS)
      expect(samples(result.acts)[kind], kind).toBeGreaterThanOrEqual(
        SAMPLES_MIN,
      );
    expect(result.reads_ended_before_samples).toBe(false);
  });

  it("makes its first act before the first file has finished reading", async () => {
    const world = tickWorld([
      { name: "kilo.dwg", ticks: 600 },
      { name: "lima.dwg", ticks: 600 },
    ]);

    await actWhileReading(world.walk);

    expect(world.made.length).toBeGreaterThan(0);
    expect(world.made[0]!.at).toBeLessThan(world.ends[0]!);
  });

  it("uploads every file of the acts Project once, in order", async () => {
    const world = tickWorld([
      { name: "kilo.dwg", ticks: 2000 },
      { name: "lima.dwg", ticks: 30 },
      { name: "mike.dwg", ticks: 30 },
    ]);

    await actWhileReading(world.walk);

    expect(world.uploaded).toEqual(["kilo.dwg", "lima.dwg", "mike.dwg"]);
  });

  it("keeps acting across files while any read is still to run, when one file alone is too short", async () => {
    // Each read alone is too short for twenty-five acts; the three together are long enough.
    const world = tickWorld([
      { name: "kilo.dwg", ticks: 45 },
      { name: "lima.dwg", ticks: 45 },
      { name: "mike.dwg", ticks: 400 },
    ]);

    const result = await actWhileReading(world.walk);

    for (const kind of KINDS)
      expect(samples(result.acts)[kind], kind).toBeGreaterThanOrEqual(
        SAMPLES_MIN,
      );
    expect(result.reads_ended_before_samples).toBe(false);
  });

  it("says the reads ended before the samples when every read ends first, and stops", async () => {
    // Twenty-five acts at two ticks each cannot fit in forty ticks of reading.
    const world = tickWorld([
      { name: "kilo.dwg", ticks: 20 },
      { name: "lima.dwg", ticks: 20 },
    ]);

    const result = await actWhileReading(world.walk);

    expect(world.uploaded).toEqual(["kilo.dwg", "lima.dwg"]);
    expect(met(result.acts, SAMPLES_MIN)).toBe(false);
    expect(result.reads_ended_before_samples).toBe(true);
  });

  it("records the act the reads ended during, as not during a read, and every act as it was made", async () => {
    // The read ends during the thirteenth act: twelve samples at most, short of five of each kind.
    const world = endingWorld(13);

    const result = await actWhileReading(world.walk);

    const made = world.made.map((m) => m.record);
    expect(result.acts).toEqual(made);
    expect(made.length).toBeGreaterThanOrEqual(13);
    expect(made[12]!.read_running).toBe(false);
    expect(made.slice(0, 12).every((a) => a.read_running)).toBe(true);
    expect(result.reads_ended_before_samples).toBe(true);
  });
});
